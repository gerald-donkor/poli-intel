import "server-only";

import {
  CHUNK_BOUNDARY_SEARCH_CHARS,
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
} from "./config";

/**
 * Boundary-aware overlapping segmentation.
 *
 * Sizes are character approximations of 512 tokens with 64 tokens of overlap —
 * see the note in `config.ts` for why the count is not measured. Nothing here
 * calls a model.
 *
 * Ordinals are dense from 0, matching `@@unique([evidenceItemId, ordinal])` on
 * `evidence_chunk`.
 */

export type TextChunk = {
  ordinal: number;
  text: string;
  charStart: number;
  charEnd: number;
  /** 1-based page number for PDFs; null for plain text, which has no pages. */
  sourcePage: number | null;
};

/**
 * Prefer a paragraph break, then a sentence end, then a hard cut. The search
 * only ever looks backwards from the target end, so a chunk is never longer
 * than the target.
 */
function findCutPoint(text: string, start: number, targetEnd: number): number {
  const floor = Math.max(start + 1, targetEnd - CHUNK_BOUNDARY_SEARCH_CHARS);

  const paragraph = text.lastIndexOf("\n\n", targetEnd);
  if (paragraph >= floor) return paragraph + 2;

  for (let i = targetEnd; i >= floor; i--) {
    const char = text[i];
    if (char !== "." && char !== "!" && char !== "?") continue;

    // Require whitespace after the punctuation so "e.g." and "2.5ha" do not
    // read as sentence ends.
    const next = text[i + 1];
    if (next === undefined || /\s/.test(next)) return i + 1;
  }

  return targetEnd;
}

function pageForOffset(pageStarts: number[] | null, offset: number): number | null {
  if (!pageStarts || pageStarts.length === 0) return null;

  let page = 1;
  for (let i = 0; i < pageStarts.length; i++) {
    if (pageStarts[i] <= offset) page = i + 1;
    else break;
  }

  return page;
}

export function chunkDocument(
  text: string,
  pageStarts: number[] | null,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const length = text.length;

  let start = 0;
  let ordinal = 0;

  while (start < length) {
    const targetEnd = Math.min(start + CHUNK_TARGET_CHARS, length);
    const end =
      targetEnd >= length ? length : findCutPoint(text, start, targetEnd);

    const slice = text.slice(start, end);
    const leading = slice.length - slice.trimStart().length;
    const trimmed = slice.trim();

    if (trimmed.length > 0) {
      const charStart = start + leading;
      chunks.push({
        ordinal,
        text: trimmed,
        charStart,
        charEnd: charStart + trimmed.length,
        sourcePage: pageForOffset(pageStarts, charStart),
      });
      ordinal += 1;
    }

    if (end >= length) break;

    // Step back by the overlap, but never far enough to stall: a chunk shorter
    // than the overlap would otherwise loop forever on the same offsets.
    const nextStart = end - CHUNK_OVERLAP_CHARS;
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}
