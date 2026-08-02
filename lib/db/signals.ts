import "server-only";

import { EMBEDDING_MODEL } from "@/lib/ai/config";
import type {
  AudienceTarget,
  Geography,
  ImpactArea,
  RadarOutcome,
  Relevance,
  Urgency,
} from "@/lib/generated/prisma/enums";
import type { DedupCandidate } from "@/lib/radar/dedup";

import { prisma } from "./client";

/**
 * The Policy Radar's data layer: what dedup compares against, how a classified
 * signal is written, and the run record that makes silence readable.
 *
 * Ids, counts, outcomes and short machine reasons only in `radar_run` — never a
 * fetched document, never a scraped body, never a caught error's message
 * (§7.6, §13.9).
 */

/**
 * Recent signals, as the dedup comparison needs them.
 *
 * Scoped to one source AND to a recency window, which is what keeps this a
 * bounded in-memory comparison rather than a growing table scan. Cross-source
 * duplicates are deliberately out of scope: the same EU consultation announced
 * by both the Commission and Cocobod is two real signals with two real audiences
 * and two different framings, and collapsing them would lose one.
 */
export function findRecentSignalsForDedup({
  sourceName,
  since,
}: {
  sourceName: string;
  since: Date;
}): Promise<DedupCandidate[]> {
  return prisma.policySignal.findMany({
    where: { sourceName, detectedAt: { gte: since } },
    select: { id: true, sourceUrl: true, title: true },
    orderBy: { detectedAt: "desc" },
  });
}

export type CreateClassifiedSignalInput = {
  sourceUrl: string;
  sourceName: string;
  title: string;
  detectedAt: Date;
  summaryText: string;
  urgency: Urgency;
  relevance: Relevance;
  impactArea: ImpactArea;
  geography: Geography;
  audienceTarget: AudienceTarget;
  /** Already length-checked against EMBEDDING_DIMENSIONS by the AI layer. */
  embedding: number[];
};

/**
 * Create one classified signal, with its vector, in one transaction.
 *
 * The vector is written by raw SQL because Prisma cannot write an
 * `Unsupported("vector(1536)")` column — the same carve-out, in the same layer,
 * as `writeChunkEmbeddings` (AGENTS.md §6). Both statements are in one
 * transaction so a signal is never briefly visible without the embedding the
 * Evidence Matcher needs to see it.
 *
 * `status` is left to the schema default (`new`). NOTHING HERE ADVANCES A
 * SIGNAL: classification is automatic, acting on a signal is always a human
 * decision (§8.5).
 */
export function createClassifiedSignal(
  input: CreateClassifiedSignalInput,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const signal = await tx.policySignal.create({
      data: {
        sourceUrl: input.sourceUrl,
        sourceName: input.sourceName,
        title: input.title,
        detectedAt: input.detectedAt,
        summaryText: input.summaryText,
        urgency: input.urgency,
        relevance: input.relevance,
        impactArea: input.impactArea,
        geography: input.geography,
        audienceTarget: input.audienceTarget,
      },
      select: { id: true },
    });

    await tx.$executeRaw`
      UPDATE policy_signal
      SET embedding = ${JSON.stringify(input.embedding)}::vector,
          embedding_model = ${EMBEDDING_MODEL}
      WHERE id = ${signal.id}
    `;

    return signal;
  });
}

/**
 * A near match updates the existing row's `detectedAt` and creates nothing.
 *
 * That timestamp is the point: a notice a source is still re-listing is a
 * policy window that is still open, and a signal whose `detectedAt` stops
 * moving sorts away down the board while the window it describes is live.
 *
 * Nothing else on the row is touched. A reviewer may have already reclassified
 * this signal by hand, and a re-detection is not grounds to overwrite that
 * (§8.5, §8.6).
 */
export function touchSignalDetectedAt(
  signalId: string,
  detectedAt: Date,
): Promise<unknown> {
  return prisma.policySignal.update({
    where: { id: signalId },
    data: { detectedAt },
    select: { id: true },
  });
}

export type RecordRadarRunInput = {
  sourceId: string;
  sourceName: string;
  outcome: RadarOutcome;
  startedAt: Date;
  itemsSeen?: number;
  signalsCreated?: number;
  duplicatesSuppressed?: number;
  /** Short machine reason. Never a document, never an error message. */
  failureReason?: string;
};

/**
 * EVERY attempt writes exactly one of these — including the ones that found
 * nothing, and the ones that failed.
 *
 * This is what makes "silence is reported, not assumed" implementable
 * (AGENTS.md §14.7). Without it, a scraper broken by a site redesign and a
 * genuinely quiet week are the same absence of rows, and the weekly gap
 * analysis has nothing to tell them apart with.
 */
export function recordRadarRun(input: RecordRadarRunInput): Promise<{ id: string }> {
  return prisma.radarRun.create({
    data: {
      sourceId: input.sourceId,
      sourceName: input.sourceName,
      outcome: input.outcome,
      startedAt: input.startedAt,
      finishedAt: new Date(),
      itemsSeen: input.itemsSeen ?? 0,
      signalsCreated: input.signalsCreated ?? 0,
      duplicatesSuppressed: input.duplicatesSuppressed ?? 0,
      failureReason: input.failureReason ?? null,
    },
    select: { id: true },
  });
}
