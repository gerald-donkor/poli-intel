import "server-only";

import { NonRetriableError, RetryAfterError } from "inngest";

import { EMBEDDING_RPM_ALLOCATION } from "@/lib/ai/config";
import {
  embedEvidenceCandidates,
  planEmbeddingBatches,
  type EmbeddingFailure,
} from "@/lib/ai/embeddings";
import {
  findEvidenceItemForEmbedding,
  listUnembeddedChunks,
  loadChunksForEmbedding,
  purgeEvidenceItemEmbeddings,
  recordEmbeddingRun,
  writeChunkEmbeddings,
} from "@/lib/db";
import type {
  Classification,
  EvidenceSourceType,
} from "@/lib/generated/prisma/enums";
import { partitionByClassification } from "@/lib/governance/gate";

import {
  evidenceClassificationChanged,
  evidenceEmbeddingBatchRequested,
  inngest,
} from "../client";

/**
 * Evidence embedding — the first Gemini call path in the codebase, and the
 * point at which the classification gate stops being structural and becomes
 * load-bearing.
 *
 * Two functions, on purpose:
 *
 *   1. `embedEvidenceOnClassification` decides. It re-reads the item's current
 *      classification, purges vectors if the item is no longer eligible, and
 *      otherwise plans batches and fans out over them.
 *   2. `embedEvidenceBatch` executes exactly one Gemini request per run, which
 *      is what makes Inngest's throttle a real requests-per-minute control
 *      rather than a decoration.
 *
 * Batch first, then fan out — never one run per chunk (AGENTS.md §14.6).
 */

const BATCH_RETRIES = 3;

/** Attempt numbers are zero-indexed, so this is the last one. */
const FINAL_ATTEMPT = BATCH_RETRIES;

type EmbeddingPlan =
  | { outcome: "not_found" }
  | { outcome: "not_extracted" }
  | {
      outcome: "purged";
      classification: Classification;
      purgedVectors: number;
    }
  | { outcome: "up_to_date" }
  | { outcome: "fanned_out"; batches: string[][]; chunkCount: number };

export const embedEvidenceOnClassification = inngest.createFunction(
  {
    id: "embed-evidence-on-classification",
    name: "Embed evidence on classification change",
    triggers: [evidenceClassificationChanged],
    // Deciding is cheap and touches no model; the Gemini pacing lives on the
    // batch function below.
    concurrency: 4,
    retries: 3,
  },
  async ({ event, step }) => {
    const { evidenceItemId } = event.data;

    const plan = await step.run(
      "resolve-embedding-plan",
      async (): Promise<EmbeddingPlan> => {
        const item = await findEvidenceItemForEmbedding(evidenceItemId);

        if (!item) return { outcome: "not_found" };

        // An item whose extraction never completed has no chunks worth
        // embedding, and its text may be a truncated fragment.
        if (!item.extractionCompletedAt) return { outcome: "not_extracted" };

        // THE GATE, read from the database and judged by the one partition
        // function the whole codebase shares. The event payload carries no
        // classification precisely so there is nothing here to be tempted by:
        // eligibility is whatever the row says right now.
        const { eligible } = partitionByClassification([item]);

        if (eligible.length === 0) {
          const purgedVectors =
            await purgeEvidenceItemEmbeddings(evidenceItemId);

          await recordEmbeddingRun({
            evidenceItemId,
            citationKey: item.citationKey,
            sourceType: item.sourceType,
            stage: purgedVectors > 0 ? "embedding-purge" : "embedding-refused",
            chunkCount: purgedVectors,
          });

          return {
            outcome: "purged",
            classification: item.classification,
            purgedVectors,
          };
        }

        const pending = await listUnembeddedChunks(evidenceItemId);

        // Idempotence, for free: an already-embedded chunk does not come back
        // from that query, so a replayed event costs zero Gemini requests.
        if (pending.length === 0) return { outcome: "up_to_date" };

        return {
          outcome: "fanned_out",
          batches: planEmbeddingBatches(pending),
          chunkCount: pending.length,
        };
      },
    );

    if (plan.outcome === "fanned_out") {
      await step.sendEvent(
        "request-embedding-batches",
        plan.batches.map((chunkIds) =>
          evidenceEmbeddingBatchRequested.create({ evidenceItemId, chunkIds }),
        ),
      );
    }

    return plan;
  },
);

export const embedEvidenceBatch = inngest.createFunction(
  {
    id: "embed-evidence-batch",
    name: "Embed one evidence chunk batch",
    triggers: [evidenceEmbeddingBatchRequested],
    // One Gemini request per run, so throttling run starts throttles requests.
    // Below the 15 RPM free-tier ceiling on purpose — see
    // EMBEDDING_RPM_ALLOCATION. Flow control, not a sleep inside a step, which
    // a retrying step would double-count (`inngest-jobs`).
    throttle: { limit: EMBEDDING_RPM_ALLOCATION, period: "1m" },
    concurrency: 1,
    retries: BATCH_RETRIES,
  },
  async ({ event, step, attempt }) => {
    const { evidenceItemId, chunkIds } = event.data;

    return step.run("embed-batch", async () => {
      const item = await findEvidenceItemForEmbedding(evidenceItemId);

      if (!item) return { outcome: "not_found" as const };

      // Loaded with the item's CURRENT classification, and filtered to chunks
      // that still have no vector. Both facts are re-read here rather than
      // carried from the fan-out: an item can be downgraded in between.
      const chunks = await loadChunksForEmbedding(chunkIds);

      if (chunks.length === 0) return { outcome: "nothing_pending" as const };

      const result = await embedEvidenceCandidates(chunks);

      if (!result.ok) {
        throw await batchFailure({
          evidenceItemId,
          citationKey: item.citationKey,
          sourceType: item.sourceType,
          failure: result.failure,
          attempt,
        });
      }

      if (result.embedded.length > 0) {
        await writeChunkEmbeddings(result.embedded);

        await recordEmbeddingRun({
          evidenceItemId,
          citationKey: item.citationKey,
          sourceType: item.sourceType,
          stage: "embedding",
          chunkCount: result.embedded.length,
        });
      }

      // A refusal is data. It is counted and recorded, never swallowed and
      // never thrown — an item downgraded after its batch was planned is the
      // gate working, not an error (§7.2).
      if (result.refused.length > 0) {
        await recordEmbeddingRun({
          evidenceItemId,
          citationKey: item.citationKey,
          sourceType: item.sourceType,
          stage: "embedding-refused",
          chunkCount: result.refused.length,
        });
      }

      return {
        outcome: "embedded" as const,
        embeddedChunks: result.embedded.length,
        refusedChunks: result.refused.length,
      };
    });
  },
);

/**
 * Records a failure exactly once and returns the error to throw for it.
 *
 * Never includes the caught error's message or any chunk text — an API error
 * body can echo request material, so only the machine reason and the HTTP
 * status leave here (§7.6, §13.9).
 */
async function batchFailure({
  evidenceItemId,
  citationKey,
  sourceType,
  failure,
  attempt,
}: {
  evidenceItemId: string;
  citationKey: string;
  sourceType: EvidenceSourceType;
  failure: EmbeddingFailure;
  attempt: number;
}): Promise<Error> {
  const terminal = isTerminal(failure);
  const reason = describeFailure(failure);

  // One row per failure, not one per attempt: a retryable failure is recorded
  // once its retries are spent, a terminal one immediately.
  if (terminal || attempt >= FINAL_ATTEMPT) {
    await recordEmbeddingRun({
      evidenceItemId,
      citationKey,
      sourceType,
      stage: "embedding",
      chunkCount: 0,
      failureReason: reason,
    });
  }

  if (failure.reason === "rate_limited") {
    // The free tier's 429 is normal operation, not an exception (§13.3).
    // Rescheduling through Inngest is the backoff. Vectors written by earlier
    // batches stay written and this batch resumes rather than restarting,
    // because only chunks with no vector are ever loaded.
    return new RetryAfterError(
      `Gemini rate limit reached while embedding evidence: evidenceItemId=${evidenceItemId}`,
      failure.retryAfterMs,
    );
  }

  if (terminal) {
    return new NonRetriableError(
      `Embedding refused and cannot be retried (${reason}): evidenceItemId=${evidenceItemId}`,
    );
  }

  return new Error(
    `Embedding request failed (${reason}): evidenceItemId=${evidenceItemId}`,
  );
}

/** Failures no number of retries can fix: configuration, not weather. */
function isTerminal(failure: EmbeddingFailure): boolean {
  return (
    failure.reason === "missing_api_key" ||
    failure.reason === "batch_too_large" ||
    failure.reason === "dimension_mismatch"
  );
}

function describeFailure(failure: EmbeddingFailure): string {
  switch (failure.reason) {
    case "rate_limited":
      return `rate_limited:${Math.round(failure.retryAfterMs / 1000)}s`;
    case "request_failed":
      return `request_failed:${failure.status ?? "unknown"}`;
    case "dimension_mismatch":
      return `dimension_mismatch:${failure.received}/${failure.expected}`;
    case "response_count_mismatch":
      return `response_count_mismatch:${failure.received}/${failure.expected}`;
    case "batch_too_large":
      return `batch_too_large:${failure.count}`;
    case "invalid_response":
      return "invalid_response";
    case "missing_api_key":
      return "missing_api_key";
  }
}
