import "server-only";

import {
  IngestionOutcome,
  type EvidenceSourceType,
} from "@/lib/generated/prisma/enums";

import { prisma } from "./client";

/**
 * The ingestion log (AGENTS.md §12.8).
 *
 * Ids, counts, outcomes, and short machine reasons ONLY. No document text, no
 * extracted excerpt, no stack trace that might carry either (§7.6, §13.9). The
 * same rule applies to anything derived from these rows — a Sentry event or a
 * PostHog property built from an ingestion failure carries the reason string,
 * never the document.
 */

export function recordIngestionSuccess({
  evidenceItemId,
  sourceName,
  sourceType,
  extractedChars,
  chunkCount,
}: {
  evidenceItemId: string;
  sourceName: string;
  sourceType: EvidenceSourceType;
  extractedChars: number;
  chunkCount: number;
}) {
  return prisma.ingestionLog.create({
    data: {
      evidenceItemId,
      sourceName,
      sourceType,
      outcome: IngestionOutcome.succeeded,
      extractedChars,
      chunkCount,
    },
    select: { id: true },
  });
}

/**
 * `evidenceItemId` is written even though the shell is deleted immediately
 * afterwards: the relation is `onDelete: SetNull`, so the log row survives the
 * deletion with the id nulled out and the failure stays visible.
 */
/**
 * Embedding outcomes go in the SAME log, not a parallel one.
 *
 * Embedding is spec §4.2 step 9 — a stage of the ingestion pipeline, not a
 * separate concern — so this extends the existing table rather than forking one
 * for the same idea (AGENTS.md §12.1).
 *
 * Two conventions make an embedding row readable without a schema change:
 *   - `sourceName` is `"<citationKey> · <stage>"`. The citation key is what a
 *     Research Officer recognises; the stage suffix is what distinguishes an
 *     embedding row from the upload row above it.
 *   - `chunkCount` is what the stage acted on — chunks embedded, or vectors
 *     purged. `extractedChars` stays null; nothing here extracts text.
 *
 * `failureReason` keeps its meaning: short machine reasons, failures only. If
 * per-chunk reasons ever need persisting, that is a migration in a follow-up
 * prompt, not a column quietly repurposed here.
 *
 * Ids, counts and machine reasons only. Never chunk text, and never a caught
 * error's message (§7.6, §13.9).
 */
export type EmbeddingStage = "embedding" | "embedding-purge" | "embedding-refused";

export function recordEmbeddingRun({
  evidenceItemId,
  citationKey,
  sourceType,
  stage,
  chunkCount,
  failureReason,
}: {
  evidenceItemId: string;
  citationKey: string;
  sourceType: EvidenceSourceType | null;
  stage: EmbeddingStage;
  chunkCount: number;
  failureReason?: string;
}) {
  return prisma.ingestionLog.create({
    data: {
      evidenceItemId,
      sourceName: `${citationKey} · ${stage}`,
      sourceType,
      outcome: failureReason
        ? IngestionOutcome.failed
        : IngestionOutcome.succeeded,
      chunkCount,
      failureReason: failureReason ?? null,
    },
    select: { id: true },
  });
}

export function recordIngestionFailure({
  evidenceItemId,
  sourceName,
  sourceType,
  failureReason,
}: {
  evidenceItemId: string | null;
  sourceName: string;
  sourceType: EvidenceSourceType | null;
  failureReason: string;
}) {
  return prisma.ingestionLog.create({
    data: {
      evidenceItemId,
      sourceName,
      sourceType,
      outcome: IngestionOutcome.failed,
      failureReason,
    },
    select: { id: true },
  });
}
