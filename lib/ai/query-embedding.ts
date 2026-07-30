import "server-only";

import { z } from "zod";

import { checkEmbeddingDimensions } from "@/lib/db/embedding";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EVIDENCE_SEARCH_MAX_QUERY_CHARS,
} from "./config";
import { getGeminiClient, toGeminiRequestFailure } from "./gemini";

/**
 * THE SECOND DOOR — and the narrowest one in the codebase.
 *
 * THIS MODULE EMBEDS A STAFF-TYPED SEARCH STRING. EVIDENCE TEXT GOES THROUGH
 * `embedEvidenceCandidates` IN `lib/ai/embeddings.ts` AND ITS CLASSIFICATION
 * GATE, AND MUST NEVER BE ROUTED HERE. See `lib/governance/gate.ts` and
 * AGENTS.md §7.
 *
 * `evidence-governance` requires that the AI layer expose no function that
 * accepts raw evidence. A plain `embedText(text: string)` would be exactly that
 * door whatever its author intended it for, so this one is built so evidence
 * cannot fit through it:
 *
 *   - `embedSearchQuery` accepts the branded `SearchQuery` type and nothing
 *     else. No id, no row, no array, no options object that could carry a
 *     document alongside the query.
 *   - `toSearchQuery` is the ONLY constructor of that type, and it caps input at
 *     `EVIDENCE_SEARCH_MAX_QUERY_CHARS`. A 512-token evidence chunk is roughly
 *     ten times that cap, so evidence fails at runtime as well as at the type
 *     level — a cast past the brand does not buy a way in.
 *
 * There is no bypass, no `force`, no env var, and no dev branch. Do not add one
 * (§7.7).
 *
 * LOGGING: nothing here logs the query, and nothing logs a caught error's
 * message (§7.6, §13.9).
 */

declare const searchQueryBrand: unique symbol;

/** A staff-typed search string, short enough that it cannot be a document. */
export type SearchQuery = string & { readonly [searchQueryBrand]: true };

/**
 * The ONLY constructor. Rejects anything longer than a search query.
 *
 * Returns `null` rather than throwing: an over-long or empty query is an
 * ordinary input, not an exception, and the caller renders it as a state.
 */
export function toSearchQuery(raw: string): SearchQuery | null {
  const trimmed = raw.trim();

  if (trimmed.length === 0) return null;
  if (trimmed.length > EVIDENCE_SEARCH_MAX_QUERY_CHARS) return null;

  return trimmed as SearchQuery;
}

/**
 * Same failure vocabulary as `lib/ai/embeddings.ts`, so a caller that already
 * handles one shape handles both.
 */
export type QueryEmbeddingFailure =
  | { reason: "missing_api_key" }
  | { reason: "rate_limited"; retryAfterMs: number }
  | { reason: "request_failed"; status: number | null }
  | { reason: "invalid_response" }
  | { reason: "dimension_mismatch"; expected: number; received: number };

export type EmbedSearchQueryResult =
  | { ok: true; vector: number[] }
  | { ok: false; failure: QueryEmbeddingFailure };

/**
 * The SDK types every field of an embedding response as optional, so the shape
 * is validated rather than asserted (AGENTS.md §13.8). No cast past a parse
 * failure, no `any`.
 */
const embedContentResponseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()).min(1) })).min(1),
});

/**
 * Embed one search query for comparison against stored chunk vectors.
 *
 * The model and the dimensionality are the stored vectors' own — a query
 * embedded by a different model, or at a different dimensionality, is not
 * comparable to them, and pgvector would either error or return nonsense
 * distances rather than say so.
 */
export async function embedSearchQuery(
  query: SearchQuery,
): Promise<EmbedSearchQueryResult> {
  const ai = getGeminiClient();

  if (!ai) {
    return { ok: false, failure: { reason: "missing_api_key" } };
  }

  let raw: unknown;

  try {
    raw = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ parts: [{ text: query }] }],
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

  // A wrong-length query vector is refused whole, never truncated or padded —
  // the comparison it would feed is meaningless, and a meaningless similarity
  // score rendered as a number is worse than no result at all.
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
