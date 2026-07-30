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
