import "server-only";

import { EMBEDDING_DIMENSIONS } from "@/lib/ai/config";

/**
 * The `vector(1536)` literal in `prisma/schema.prisma` is a second copy of
 * EMBEDDING_DIMENSIONS that SQL DDL cannot import. This is the link between
 * them: nothing in the data layer writes a vector without checking its length
 * against the constant first.
 *
 * A mismatch is a typed, handled outcome — never a thrown error a caller can
 * swallow, and never a silently truncated vector.
 */
export type EmbeddingCheck =
  | { ok: true; vector: number[] }
  | {
      ok: false;
      reason: "dimension_mismatch";
      expected: number;
      received: number;
    };

export function checkEmbeddingDimensions(vector: number[]): EmbeddingCheck {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    return {
      ok: false,
      reason: "dimension_mismatch",
      expected: EMBEDDING_DIMENSIONS,
      received: vector.length,
    };
  }

  return { ok: true, vector };
}
