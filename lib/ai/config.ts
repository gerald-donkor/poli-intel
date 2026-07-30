import "server-only";

/**
 * Central AI config — server-only.
 *
 * This file starts with only what the database schema consumes. Model IDs for
 * generation, temperature, token caps and rate-limit budgets belong to
 * `gemini-integration` and arrive with the first Gemini call, not here.
 */

/**
 * Embedding model that produces every vector this project stores.
 *
 * Verified 2026-07-30 against https://ai.google.dev/gemini-api/docs/embeddings.md.txt:
 * `gemini-embedding-2` is the current embedding model, uses Matryoshka
 * Representation Learning, and auto-normalises truncated dimensions.
 *
 * Store this alongside every vector (`embedding_model`). Changing the model
 * invalidates existing vectors, and without the record there is no safe
 * re-embedding path.
 */
export const EMBEDDING_MODEL = "gemini-embedding-2" as const;

/**
 * The single authoritative statement of embedding dimensionality.
 *
 * Verified from the same source: `gemini-embedding-2` supports an
 * `output_dimensionality` in the range 128–3072, with 768 / 1536 / 3072
 * recommended, and auto-normalises truncated outputs.
 *
 * 1536 is chosen because:
 *   - pgvector's `hnsw` / `ivfflat` indexes cap at 2000 dimensions, and an
 *     unindexed vector column is a sequential scan on every retrieval;
 *   - it halves vector storage against the 3072 default, which matters against
 *     the Supabase Free 500MB budget.
 *
 * Every embedding request MUST ask for exactly this many dimensions.
 *
 * The one unavoidable second copy of this number is the `vector(1536)` literal
 * in `prisma/schema.prisma` — SQL DDL cannot import TypeScript. The data layer
 * validates vector length against this constant before writing
 * (see `assertEmbeddingDimensions` in `lib/db`).
 */
export const EMBEDDING_DIMENSIONS = 1536;
