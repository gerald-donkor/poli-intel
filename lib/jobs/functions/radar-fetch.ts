import "server-only";

import { NonRetriableError, RetryAfterError } from "inngest";

import { classifySignal } from "@/lib/ai/classify-signal";
import { RADAR_FETCH_RUNS_PER_MINUTE } from "@/lib/ai/config";
import { embedSignalSummary, toSignalSummary } from "@/lib/ai/signal-embedding";
import {
  createClassifiedSignal,
  findRecentSignalsForDedup,
  recordRadarRun,
  touchSignalDetectedAt,
} from "@/lib/db";
import type { RadarOutcome } from "@/lib/generated/prisma/enums";
import {
  DEDUP_RECENCY_DAYS,
  findDuplicate,
  type DedupCandidate,
} from "@/lib/radar/dedup";
import { fetchSource } from "@/lib/radar/extract";
import { findRadarSource } from "@/lib/radar/sources";

import { inngest, radarSourceFetchRequested, signalDetected } from "../client";

/**
 * One source, end to end: fetch → extract → deduplicate → classify → create →
 * embed → emit (`inngest-jobs`, "job shapes").
 *
 * ONE SOURCE PER RUN, so a source that times out fails alone. Its siblings are
 * separate runs from the same fan-out and are untouched (AGENTS.md §14.5).
 *
 * THE WHOLE PIPELINE IS ONE STEP, deliberately, for two reasons:
 *
 *   1. Step return values are stored by Inngest, the same way event payloads
 *      are. Splitting fetch from classification would put every fetched
 *      document's text into that storage as a step result. The text is a public
 *      external document rather than evidence, so this is not a §7.6 breach —
 *      but the rule at the top of `../client.ts` is that this project's job
 *      infrastructure carries ids and counts, and there is no reason to make
 *      this the exception.
 *   2. A retry is safe without memoization because deduplication runs before
 *      every insert. A retried run re-reads what it already created and
 *      suppresses it, so re-running costs a fetch rather than a duplicate.
 *
 * The step returns ids and counts only.
 */

const FETCH_RETRIES = 2;

/** Attempt numbers are zero-indexed, so this is the last one. */
const FINAL_ATTEMPT = FETCH_RETRIES;

/**
 * What one attempt against one source produced — ids and counts, no text.
 *
 * Declared rather than inferred because a step's return value crosses Inngest's
 * serialisation boundary, and `null` is what survives it. `undefined` does not.
 */
type RadarDetectionResult = {
  outcome: RadarOutcome;
  itemsSeen: number;
  signalsCreated: number;
  duplicatesSuppressed: number;
  failureReason: string | null;
  createdIds: string[];
};

export const fetchRadarSource = inngest.createFunction(
  {
    id: "fetch-radar-source",
    name: "Fetch one Policy Radar source",
    triggers: [radarSourceFetchRequested],
    // Event-level idempotency: the first layer of the two (§14.4). A replayed
    // or double-fired cron asking for the same source on the same day is
    // dropped. It says nothing about two fetches of the same real-world
    // notice — that is the domain-level dedup inside the step.
    idempotency: 'event.data.sourceId + "-" + event.data.dueOn',
    // Flow control, not a sleep inside a step. Sized in lib/ai/config.ts from
    // the radar's share of the RPM ceiling and one run's worst-case request
    // count, so a full fan-out cannot push an officer's generation into a 429.
    throttle: { limit: RADAR_FETCH_RUNS_PER_MINUTE, period: "1m" },
    concurrency: 1,
    retries: FETCH_RETRIES,
  },
  async ({ event, step, attempt }) => {
    const { sourceId } = event.data;

    const result = await step.run(
      "detect-signals",
      async (): Promise<RadarDetectionResult> => {
        const startedAt = new Date();
        const source = findRadarSource(sourceId);

        // A source that left the registry cannot be fetched and will not appear
        // again — retrying is pointless and there is no run to record it against.
        if (!source) {
          throw new NonRetriableError(
            `Unknown radar source: sourceId=${sourceId}`,
          );
        }

        const fetched = await fetchSource(source);

        if (!fetched.ok) {
          // Declared in the registry, not implemented yet: recorded as its own
          // outcome so the gap analysis reads "not yet monitored" (§14.7).
          if (fetched.failure.reason.startsWith("not_implemented")) {
            await recordRadarRun({
              sourceId: source.id,
              sourceName: source.name,
              outcome: "not_implemented",
              startedAt,
              failureReason: fetched.failure.reason,
            });

            return {
              outcome: "not_implemented",
              itemsSeen: 0,
              signalsCreated: 0,
              duplicatesSuppressed: 0,
              failureReason: fetched.failure.reason,
              createdIds: [],
            };
          }

          // Recorded once, when the retries are spent — not once per attempt.
          if (attempt >= FINAL_ATTEMPT) {
            await recordRadarRun({
              sourceId: source.id,
              sourceName: source.name,
              outcome: "failed",
              startedAt,
              failureReason: fetched.failure.reason,
            });
          }

          // The machine reason and the source id. Never the URL's response body
          // and never a caught error's message (§7.6, §13.9).
          throw new Error(
            `Radar fetch failed (${fetched.failure.reason}): sourceId=${source.id}`,
          );
        }

        const items = fetched.items;

        const since = new Date(
          startedAt.getTime() - DEDUP_RECENCY_DAYS * 24 * 60 * 60 * 1000,
        );
        const recent: DedupCandidate[] = await findRecentSignalsForDedup({
          sourceName: source.name,
          since,
        });

        const createdIds: string[] = [];
        let duplicatesSuppressed = 0;
        let failureReason: string | null = null;

        /**
         * A rate limit ends the run, and the LAST attempt still records one.
         *
         * Without this a source that keeps hitting the free-tier ceiling would
         * spend its retries and leave no `radar_run` row at all — which reads
         * downstream as a source that was never checked, the exact confusion
         * §14.7 exists to prevent. The signals created before the limit landed
         * are counted, because they are real.
         */
        const endOnRateLimit = async (
          stage: "classification" | "embedding",
          retryAfterMs: number,
        ): Promise<Error> => {
          if (attempt >= FINAL_ATTEMPT) {
            await recordRadarRun({
              sourceId: source.id,
              sourceName: source.name,
              outcome: "failed",
              startedAt,
              itemsSeen: items.length,
              signalsCreated: createdIds.length,
              duplicatesSuppressed,
              failureReason: `${stage}:rate_limited`,
            });
          }

          // Rescheduling through Inngest IS the backoff — no hand-rolled sleep
          // inside a step, which a retrying step would double-count. Signals
          // created earlier stay created; the retry deduplicates them away and
          // carries on from where the limit landed (§13.3).
          return new RetryAfterError(
            `Gemini rate limit reached while classifying signals: sourceId=${source.id}`,
            retryAfterMs,
          );
        };

        for (const item of items) {
          // DEDUP BEFORE THE INSERT, never as a clean-up afterwards (§14.4).
          // `recent` grows as signals are created, so two entries for the same
          // notice on the same page collapse within a single run too.
          const match = findDuplicate(item, recent);

          if (match.duplicate) {
            // A source still re-listing a notice is a policy window still open.
            await touchSignalDetectedAt(match.signalId, new Date());
            duplicatesSuppressed += 1;
            continue;
          }

          const classified = await classifySignal(item);

          if (!classified.ok) {
            if (classified.failure.reason === "rate_limited") {
              throw await endOnRateLimit(
                "classification",
                classified.failure.retryAfterMs,
              );
            }

            // Two validation failures in a row create NOTHING. Inventing a
            // default urgency would put a fabricated priority in front of a
            // reviewer; the source is re-fetched on its next cadence instead.
            failureReason = `classification:${classified.failure.reason}`;
            break;
          }

          const summary = toSignalSummary(classified.classification);

          if (!summary) {
            failureReason = "classification:empty_summary";
            break;
          }

          const embedded = await embedSignalSummary(summary);

          if (!embedded.ok) {
            if (embedded.failure.reason === "rate_limited") {
              throw await endOnRateLimit(
                "embedding",
                embedded.failure.retryAfterMs,
              );
            }

            // A signal the Evidence Matcher cannot see is a signal that will
            // quietly never match anything, so an unembeddable signal is not
            // written at all.
            failureReason = `embedding:${embedded.failure.reason}`;
            break;
          }

          const detectedAt =
            item.publishedAt &&
            item.publishedAt.getTime() <= startedAt.getTime()
              ? item.publishedAt
              : startedAt;

          const signal = await createClassifiedSignal({
            sourceUrl: item.url,
            sourceName: source.name,
            title: item.title,
            detectedAt,
            summaryText: summary,
            urgency: classified.classification.urgency,
            relevance: classified.classification.relevance,
            impactArea: classified.classification.impactArea,
            geography: classified.classification.geography,
            audienceTarget: classified.classification.audienceTarget,
            embedding: embedded.vector,
          });

          createdIds.push(signal.id);
          recent.push({
            id: signal.id,
            sourceUrl: item.url,
            title: item.title,
          });
        }

        const outcome: RadarOutcome = failureReason
          ? "failed"
          : createdIds.length > 0
            ? "found"
            : "empty";

        // EXACTLY ONE RUN ROW PER ATTEMPT THAT GOT THIS FAR, including the empty
        // one. An empty run is the record that distinguishes a quiet week from a
        // scraper broken by a site redesign (§14.7).
        await recordRadarRun({
          sourceId: source.id,
          sourceName: source.name,
          outcome,
          startedAt,
          itemsSeen: items.length,
          signalsCreated: createdIds.length,
          duplicatesSuppressed,
          failureReason: failureReason ?? undefined,
        });

        return {
          outcome,
          itemsSeen: items.length,
          signalsCreated: createdIds.length,
          duplicatesSuppressed,
          failureReason,
          createdIds,
        };
      },
    );

    // AFTER the inserts commit, never inside them — an event announcing a
    // transaction that later rolled back is a lie (see `../client.ts`).
    //
    // The Evidence Matcher subscribes to this. THE BRIEF GENERATOR DOES NOT:
    // detection stops here, and generation is on demand only (§8.4, §14.8).
    if (result.createdIds.length > 0) {
      await step.sendEvent(
        "announce-detected-signals",
        result.createdIds.map((signalId) =>
          signalDetected.create({ signalId }),
        ),
      );
    }

    return result;
  },
);
