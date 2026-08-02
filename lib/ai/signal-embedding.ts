import "server-only";

import { z } from "zod";

import { checkEmbeddingDimensions } from "@/lib/db/embedding";

import type { SignalClassification } from "./classify-signal";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./config";
import { getGeminiClient, toGeminiRequestFailure } from "./gemini";

/**
 * THE THIRD DOOR — a policy signal's own summary, embedded so the Evidence
 * Matcher can find evidence for it.
 *
 * EVIDENCE TEXT GOES THROUGH `embedEvidenceCandidates` IN `lib/ai/embeddings.ts`
 * AND ITS CLASSIFICATION GATE, AND MUST NEVER BE ROUTED HERE. Built to the same
 * rule as `query-embedding.ts`: a plain `embedText(text: string)` would be a
 * door into the model for evidence whatever its author intended, so this one is
 * built so evidence cannot fit through it.
 *
 *   - `embedSignalSummary` accepts the branded `SignalSummary` type and nothing
 *     else — no id, no row, no array, no options object.
 *   - `toSignalSummary` is the ONLY constructor, and it takes a validated
 *     `SignalClassification` — the output of a Gemini call over a fetched public
 *     document. It has no string parameter, so there is no signature that
 *     accepts arbitrary text in the first place.
 *
 * No bypass, no `force`, no env var, no dev branch (§7.7).
 *
 * LOGGING: nothing here logs the summary or a caught error's message.
 */

declare const signalSummaryBrand: unique symbol;

/** A model-written summary of a public policy document. Never evidence. */
export type SignalSummary = string & { readonly [signalSummaryBrand]: true };

/**
 * The ONLY constructor. Returns `null` for an empty summary rather than
 * throwing — a caller records that as a failed classification, which is what it
 * is, not as an exception.
 */
export function toSignalSummary(
  classification: SignalClassification,
): SignalSummary | null {
  const trimmed = classification.summary.trim();

  return trimmed.length === 0 ? null : (trimmed as SignalSummary);
}

/** Same failure vocabulary as the other two embedding paths. */
export type SignalEmbeddingFailure =
  | { reason: "missing_api_key" }
  | { reason: "rate_limited"; retryAfterMs: number }
  | { reason: "request_failed"; status: number | null }
  | { reason: "invalid_response" }
  | { reason: "dimension_mismatch"; expected: number; received: number };

export type EmbedSignalResult =
  | { ok: true; vector: number[] }
  | { ok: false; failure: SignalEmbeddingFailure };

const embedContentResponseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()).min(1) })).min(1),
});

/**
 * Embed one signal summary, at the same model and dimensionality as the stored
 * chunk vectors it will be compared against. A vector produced by a different
 * model is not comparable to them, and pgvector would return nonsense distances
 * rather than say so.
 */
export async function embedSignalSummary(
  summary: SignalSummary,
): Promise<EmbedSignalResult> {
  const ai = getGeminiClient();

  if (!ai) return { ok: false, failure: { reason: "missing_api_key" } };

  let raw: unknown;

  try {
    raw = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ parts: [{ text: summary }] }],
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
  } catch (error) {
    return { ok: false, failure: toGeminiRequestFailure(error) };
  }

  const parsed = embedContentResponseSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, failure: { reason: "invalid_response" } };
  }

  const check = checkEmbeddingDimensions(parsed.data.embeddings[0].values);

  // Refused whole, never truncated or padded: a wrong-length vector would be
  // accepted by the column and make every later retrieval quietly wrong.
  if (!check.ok) {
    return {
      ok: false,
      failure: {
        reason: "dimension_mismatch",
        expected: check.expected,
        received: check.received,
      },
    };
  }

  return { ok: true, vector: check.vector };
}
