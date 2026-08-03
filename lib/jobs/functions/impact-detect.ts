import "server-only";

import { cron, NonRetriableError, RetryAfterError } from "inngest";

import { IMPACT_DETECTION_RUNS_PER_MINUTE } from "@/lib/ai/config";
import {
  detectInfluenceForBrief,
  toPublishedBriefSubject,
} from "@/lib/ai/detect-influence";
import {
  findBriefForInfluenceDetection,
  listBriefsForInfluenceDetection,
  recordDetectedInfluenceEvents,
  recordImpactDetectionRun,
} from "@/lib/db";
import type { ImpactDetectionOutcome } from "@/lib/generated/prisma/enums";
import { IMPACT_DETECTION_CRON } from "@/lib/impact/config";

import { impactDetectionRequested, inngest } from "../client";

/**
 * The Impact Tracker's weekly detection pass — the pipeline's fourth module
 * (AGENTS.md §5.1, §14.9, `inngest-jobs` rule 9).
 *
 * IT FILES LEADS, NEVER FACTS. Every event it creates is `verified: false` and
 * stays there until a Programme Director confirms it, and the quarterly report
 * reads verified rows only. The model does not decide that Tropenbos influenced
 * anything (§8).
 *
 * IT NEVER TRIGGERS THE BRIEF GENERATOR, and has no reason to: this module reads
 * what published briefs did in the world and writes influence rows. Generation is
 * on demand only (§8.4).
 *
 * ── What may be sent to the model ─────────────────────────────────────────
 * Only `submitted` and `published` briefs are searched, and only their title,
 * audience and type are transmitted. That rule is enforced by
 * `toPublishedBriefSubject`, whose result type cannot carry body text or an
 * evidence reference — the status filter in the read is the first half of it, not
 * the gate (`lib/ai/detect-influence.ts`, §7).
 *
 * LOGGING: brief ids, counts, outcomes. NEVER the query, never the model's
 * prose, never a description or a quoted line (§7.6, §13.9).
 */

const DETECTION_RETRIES = 2;

/** Attempt numbers are zero-indexed, so this is the last one. */
const FINAL_ATTEMPT = DETECTION_RETRIES;

/**
 * Decide which briefs are due, and fan out.
 *
 * IT SEARCHES NOTHING ITSELF. One event per brief means one run per brief, each
 * with its own retries and its own failure, which is how one failed detection
 * cannot affect the others (§14.5) — the same shape as the radar's scheduler.
 */
export const scheduleImpactDetection = inngest.createFunction(
  {
    id: "schedule-impact-detection",
    name: "Schedule the weekly Impact Tracker pass",
    triggers: [cron(IMPACT_DETECTION_CRON)],
    retries: 2,
  },
  async ({ step, logger }) => {
    const dueOn = new Date().toISOString().slice(0, 10);

    const plan = await step.run("resolve-briefs-due", async () => {
      const briefs = await listBriefsForInfluenceDetection(new Date());

      // IDS ONLY across the step boundary. A step's return value is stored by
      // Inngest the same way an event payload is, and a brief title is document
      // content (`../client.ts`).
      return { briefIds: briefs.map((brief) => brief.id) };
    });

    if (plan.briefIds.length > 0) {
      await step.sendEvent(
        "request-impact-detections",
        plan.briefIds.map((briefId) =>
          impactDetectionRequested.create({ briefId, dueOn }),
        ),
      );
    }

    logger.info("[impact] weekly pass scheduled", {
      dueOn,
      requested: plan.briefIds.length,
    });

    return { dueOn, requested: plan.briefIds.length };
  },
);

/** What one attempt against one brief produced — ids and counts, no text. */
type ImpactDetectionResult = {
  outcome: ImpactDetectionOutcome;
  candidatesSeen: number;
  eventsCreated: number;
  eventsMatched: number;
  candidatesDropped: number;
  failureReason: string | null;
};

/**
 * One brief, end to end: resolve → search → extract → deduplicate → file.
 *
 * ONE BRIEF PER RUN, so a brief whose search times out fails alone. Its siblings
 * are separate runs from the same fan-out and are untouched (§14.5).
 *
 * THE WHOLE PIPELINE IS ONE STEP, for the reasons `radar-fetch.ts` gives: a
 * split would put the model's prose into Inngest's step storage, and a retry is
 * safe without memoization because deduplication runs before every insert.
 */
export const detectBriefInfluence = inngest.createFunction(
  {
    id: "detect-brief-influence",
    name: "Search for downstream citations of one brief",
    triggers: [impactDetectionRequested],
    // Event-level idempotency: a replayed or double-fired cron asking for the
    // same brief in the same week is dropped. It says nothing about two
    // detections of the same real citation — that is the domain-level dedup
    // inside the step (§14.4).
    idempotency: 'event.data.briefId + "-" + event.data.dueOn',
    // Flow control, not a sleep inside a step. Sized in lib/ai/config.ts from
    // the tracker's share of the RPM ceiling and the two requests one brief
    // costs, so a Monday fan-out cannot push an officer's generation into a 429.
    throttle: { limit: IMPACT_DETECTION_RUNS_PER_MINUTE, period: "1m" },
    concurrency: 1,
    retries: DETECTION_RETRIES,
  },
  async ({ event, step, attempt, logger }) => {
    const { briefId } = event.data;

    const result = await step.run(
      "detect-influence",
      async (): Promise<ImpactDetectionResult> => {
        const startedAt = new Date();
        const brief = await findBriefForInfluenceDetection(briefId);

        // A brief that no longer exists cannot be searched and will not come
        // back. Retrying is pointless and there is no run to record it against.
        if (!brief) {
          throw new NonRetriableError(`Unknown brief: briefId=${briefId}`);
        }

        const subject = toPublishedBriefSubject(brief);

        // THE GATE, AND IT IS NOT A FILTER. A brief that moved back to `draft`
        // between the scheduler and this run has nothing to hand the model, and
        // there is no other way to construct a subject. Recorded as its own
        // outcome rather than silently skipped — a refusal is data (§7.2).
        if (!subject) {
          await recordImpactDetectionRun({
            briefId,
            outcome: "empty",
            startedAt,
            failureReason: "not_published",
          });

          return {
            outcome: "empty",
            candidatesSeen: 0,
            eventsCreated: 0,
            eventsMatched: 0,
            candidatesDropped: 0,
            failureReason: "not_published",
          };
        }

        const detected = await detectInfluenceForBrief(subject);

        if (!detected.ok) {
          // Recorded once, when the retries are spent — not once per attempt.
          if (attempt >= FINAL_ATTEMPT) {
            await recordImpactDetectionRun({
              briefId,
              outcome: "failed",
              startedAt,
              failureReason: detected.failure.reason,
            });
          }

          if (
            detected.failure.reason === "rate_limited" &&
            "retryAfterMs" in detected.failure
          ) {
            // Rescheduling on the model's own timing rather than a generic
            // retry that walks straight back into the same ceiling. Inngest IS
            // the backoff — no hand-rolled sleep inside a step (§13.3, §13.4).
            throw new RetryAfterError(
              `Gemini rate limit reached during influence detection: briefId=${briefId}`,
              detected.failure.retryAfterMs,
            );
          }

          // The machine reason and the brief id. Never a caught error's message
          // and never the model's prose (§7.6, §13.9).
          throw new Error(
            `Influence detection failed (${detected.failure.reason}): briefId=${briefId}`,
          );
        }

        const filed = await recordDetectedInfluenceEvents({
          briefId,
          candidates: detected.candidates,
          detectedAt: startedAt,
        });

        // SEARCHED AND FOUND NOTHING IS `empty`, NOT `failed`. For a brief
        // nobody has cited yet that is the honest steady state, and the run row
        // is what lets a reader tell it from a brief that was never searched
        // (§14.7, acceptance criterion 8). A run that only re-found existing
        // citations is `found`: it did find something, and the row says how many
        // were matched rather than created.
        const outcome: ImpactDetectionOutcome =
          filed.created > 0 || filed.matched > 0 ? "found" : "empty";

        await recordImpactDetectionRun({
          briefId,
          outcome,
          startedAt,
          candidatesSeen: detected.candidatesSeen,
          eventsCreated: filed.created,
          eventsMatched: filed.matched,
          candidatesDropped: detected.dropped,
        });

        return {
          outcome,
          candidatesSeen: detected.candidatesSeen,
          eventsCreated: filed.created,
          eventsMatched: filed.matched,
          candidatesDropped: detected.dropped,
          failureReason: null,
        };
      },
    );

    logger.info("[impact] detection complete", { briefId, ...result });

    return result;
  },
);
