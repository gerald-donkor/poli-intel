import "server-only";

/**
 * Chunking constants. Server-only: nothing in the browser chunks a document.
 *
 * The accepted types and size ceilings live in `limits.ts` instead, because the
 * upload form states them to the person choosing a file.
 */

/**
 * Chunk sizing — 512-token overlapping segments (spec §4.2, AGENTS.md §12.4).
 *
 * THIS IS AN APPROXIMATION, NOT A MEASURED TOKEN COUNT. Sizing is done locally
 * in characters because measuring real tokens would mean sending document text
 * to Gemini's `countTokens` endpoint, which is exactly the transmission the
 * governance gate exists to prevent (§7.1). An item is `unpublished_internal`
 * at the moment it is ingested, so it is ineligible for any Gemini call at
 * precisely this point in its life.
 *
 * ~4 characters per token is the usual English-prose rule of thumb. Downstream
 * code must not treat `CHUNK_TARGET_CHARS / CHARS_PER_TOKEN_APPROX` as a token
 * count it can rely on.
 */
export const CHARS_PER_TOKEN_APPROX = 4;
export const CHUNK_TARGET_TOKENS = 512;
export const CHUNK_OVERLAP_TOKENS = 64;

export const CHUNK_TARGET_CHARS = CHUNK_TARGET_TOKENS * CHARS_PER_TOKEN_APPROX;
export const CHUNK_OVERLAP_CHARS =
  CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN_APPROX;

/**
 * How far back from the target end the chunker may look for a paragraph or
 * sentence boundary before giving up and cutting mid-sentence.
 */
export const CHUNK_BOUNDARY_SEARCH_CHARS = Math.round(CHUNK_TARGET_CHARS * 0.25);

/**
 * Below this, an extraction is treated as a failure rather than a document with
 * very little text. A scanned PDF with no text layer lands here, and it must
 * produce a recorded failure and a real message — never a silent success with
 * zero chunks.
 */
export const MIN_EXTRACTED_CHARS = 40;
