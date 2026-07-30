import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { checkEmbeddingDimensions } from "@/lib/db/embedding";
import {
  partitionByClassification,
  type GateCandidate,
  type GateRefusal,
} from "@/lib/governance/gate";

import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DEFAULT_RETRY_AFTER_MS,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MAX_BATCH_CHARS,
  EMBEDDING_MAX_RETRY_AFTER_MS,
  EMBEDDING_MODEL,
} from "./config";

/**
 * THE DOOR INTO THE MODEL (AGENTS.md §7.2, `evidence-governance`).
 *
 * This module exposes no function that accepts raw chunk text. The only entry
 * point takes candidates carrying their classification, hands them to
 * `partitionByClassification`, and embeds `eligible` only. There is no exported
 * variant that skips the partition, no `force` parameter, no env var, and no
 * dev-mode branch — a caller cannot forget the check because there is no
 * unchecked door to forget.
 *
 * Refusals are RETURNED alongside the vectors, never thrown and never dropped.
 * They carry the id and the classification only, never the text that was
 * refused (§7.6).
 *
 * LOGGING: nothing in this module logs chunk text, and nothing logs a caught
 * error's message — an API error body can echo request material, and the
 * machine reason plus the HTTP status debug the pipeline without exporting
 * anything (§7.6, §13.9).
 */

export type EmbeddingCandidate = GateCandidate & { text: string };

export type EmbeddedVector = { id: string; vector: number[] };

export type EmbeddingFailure =
  | { reason: "missing_api_key" }
  | { reason: "rate_limited"; retryAfterMs: number }
  | { reason: "request_failed"; status: number | null }
  | { reason: "invalid_response" }
  | { reason: "response_count_mismatch"; expected: number; received: number }
  | { reason: "dimension_mismatch"; expected: number; received: number }
  | { reason: "batch_too_large"; count: number; chars: number };

export type EmbedEvidenceResult =
  | { ok: true; embedded: EmbeddedVector[]; refused: GateRefusal[] }
  | { ok: false; failure: EmbeddingFailure; refused: GateRefusal[] };

/**
 * The SDK types every field of an embedding response as optional, so the shape
 * is validated rather than asserted (AGENTS.md §13.8). No cast past a parse
 * failure, no `any`.
 */
const embedContentResponseSchema = z.object({
  embeddings: z
    .array(z.object({ values: z.array(z.number()).min(1) }))
    .min(1),
});

/** Lazy so a missing key is a typed refusal at call time, not an import crash. */
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Server-only, and never `NEXT_PUBLIC_*` (AGENTS.md §18). Absent is an
  // ordinary, reportable outcome — not an obscure SDK error three frames down.
  if (!apiKey) return null;

  client ??= new GoogleGenAI({ apiKey });

  return client;
}

/**
 * Split chunks into request-sized batches.
 *
 * Pure, and deliberately takes ids and character counts rather than text: the
 * caller that plans batches is the job that fans out over them, and a plan is
 * not a thing that should be able to carry evidence.
 *
 * A batch closes on whichever ceiling is hit first (`EMBEDDING_BATCH_SIZE` or
 * `EMBEDDING_MAX_BATCH_CHARS`). A single chunk larger than the character
 * ceiling still gets its own batch — splitting a chunk here would embed
 * something that does not match the stored text.
 */
export function planEmbeddingBatches(
  chunks: readonly { id: string; charCount: number }[],
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const chunk of chunks) {
    const wouldOverflow =
      current.length >= EMBEDDING_BATCH_SIZE ||
      (current.length > 0 &&
        currentChars + chunk.charCount > EMBEDDING_MAX_BATCH_CHARS);

    if (wouldOverflow) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(chunk.id);
    currentChars += chunk.charCount;
  }

  if (current.length > 0) batches.push(current);

  return batches;
}

/**
 * Embed one request's worth of candidates.
 *
 * Precondition: the caller sized this batch with `planEmbeddingBatches`. An
 * oversized batch is refused as a typed failure rather than silently split,
 * because a silent split would make one job run cost several Gemini requests
 * and quietly break the throttle the RPM budget depends on.
 */
export async function embedEvidenceCandidates(
  candidates: readonly EmbeddingCandidate[],
): Promise<EmbedEvidenceResult> {
  // THE GATE, before anything else. Filtering happens before batching is even
  // considered, so a request is never assembled around ineligible material
  // (`gemini-integration`, "filter by classification before batching").
  const { eligible, refused } = partitionByClassification(candidates);

  if (eligible.length === 0) {
    return { ok: true, embedded: [], refused };
  }

  const chars = eligible.reduce(
    (total, candidate) => total + candidate.text.length,
    0,
  );

  if (eligible.length > EMBEDDING_BATCH_SIZE || chars > EMBEDDING_MAX_BATCH_CHARS) {
    return {
      ok: false,
      failure: { reason: "batch_too_large", count: eligible.length, chars },
      refused,
    };
  }

  const ai = getClient();

  if (!ai) {
    return { ok: false, failure: { reason: "missing_api_key" }, refused };
  }

  let raw: unknown;

  try {
    raw = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      // Each input wrapped in its own `Content` object. Passing bare strings
      // returns ONE aggregated vector for the whole batch, which would give
      // every chunk in the batch the same embedding — see `config.ts`.
      contents: eligible.map((candidate) => ({
        parts: [{ text: candidate.text }],
      })),
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
  } catch (error) {
    return { ok: false, failure: toRequestFailure(error), refused };
  }

  const parsed = embedContentResponseSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, failure: { reason: "invalid_response" }, refused };
  }

  const { embeddings } = parsed.data;

  // Order is the contract — "in the same order as provided in the batch
  // request". A count mismatch means that contract is broken and pairing a
  // vector with a chunk id would be a guess.
  if (embeddings.length !== eligible.length) {
    return {
      ok: false,
      failure: {
        reason: "response_count_mismatch",
        expected: eligible.length,
        received: embeddings.length,
      },
      refused,
    };
  }

  const embedded: EmbeddedVector[] = [];

  for (const [index, embedding] of embeddings.entries()) {
    const check = checkEmbeddingDimensions(embedding.values);

    // A wrong-length vector is refused whole. Never truncated, never padded,
    // and never written — the column would take it and retrieval would be
    // quietly wrong ever after.
    if (!check.ok) {
      return {
        ok: false,
        failure: {
          reason: "dimension_mismatch",
          expected: check.expected,
          received: check.received,
        },
        refused,
      };
    }

    embedded.push({ id: eligible[index].id, vector: check.vector });
  }

  return { ok: true, embedded, refused };
}

function toRequestFailure(error: unknown): EmbeddingFailure {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return {
        reason: "rate_limited",
        retryAfterMs: readRetryDelayMs(error.message),
      };
    }

    return { reason: "request_failed", status: error.status };
  }

  return { reason: "request_failed", status: null };
}

/**
 * Gemini returns a `retryDelay` in a 429's error details. The SDK surfaces the
 * body only as the error message, so it is read out with a bounded pattern and
 * clamped — the hint is honoured where it exists (`gemini-integration`) without
 * letting a malformed one park a run.
 *
 * The message itself is never logged or stored; only the number leaves here.
 */
function readRetryDelayMs(message: string): number {
  const match = /"retryDelay"\s*:\s*"(\d{1,5})(?:\.\d+)?s"/.exec(message);

  if (!match) return EMBEDDING_DEFAULT_RETRY_AFTER_MS;

  const seconds = Number(match[1]);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return EMBEDDING_DEFAULT_RETRY_AFTER_MS;
  }

  return Math.min(seconds * 1000, EMBEDDING_MAX_RETRY_AFTER_MS);
}
