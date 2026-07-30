import "server-only";

import { extractText } from "unpdf";

import { MIN_EXTRACTED_CHARS } from "./config";
import { isAcceptedMimeType, type AcceptedMimeType } from "./limits";

/**
 * Text extraction for the two accepted document types.
 *
 * Failures are returned as short machine reasons, never as a thrown error
 * carrying document text and never as a stack trace that might contain it
 * (AGENTS.md §7.6). The caller maps a reason to user-facing copy; nothing here
 * logs the text it read.
 */

export type ExtractionFailureReason =
  | "unsupported_mime_type"
  | "empty_file"
  | "pdf_parse_failed"
  | "no_text_layer"
  | "decode_failed";

export type ExtractionResult =
  | {
      ok: true;
      text: string;
      /**
       * Character offset in `text` at which each page begins, 0-indexed by page
       * order. `null` for plain text, which has no pages — the chunker records
       * `sourcePage` as null rather than inventing page 1.
       */
      pageStarts: number[] | null;
      pageCount: number | null;
    }
  | { ok: false; reason: ExtractionFailureReason };

/**
 * Normalise whitespace so chunk boundaries are predictable: CRLF and CR to LF,
 * runs of three or more blank lines collapsed to a paragraph break, trailing
 * spaces dropped. Applied per page BEFORE pages are joined, so the recorded
 * page offsets stay correct.
 */
function normalise(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractionResult> {
  let pages: string[];
  let totalPages: number;

  try {
    // `mergePages: false` returns one string per page, which is what makes a
    // chunk's `sourcePage` real rather than guessed.
    const result = await extractText(bytes, { mergePages: false });
    pages = result.text;
    totalPages = result.totalPages;
  } catch {
    // Deliberately not re-thrown and deliberately not logged with the caught
    // error: a pdf.js parse error can carry document content in its message.
    return { ok: false, reason: "pdf_parse_failed" };
  }

  const pageStarts: number[] = [];
  const parts: string[] = [];
  let offset = 0;

  for (const page of pages) {
    const normalised = normalise(page);
    pageStarts.push(offset);
    parts.push(normalised);
    // Pages are joined by a paragraph break so the chunker can prefer page
    // boundaries when it looks for a place to cut.
    offset += normalised.length + 2;
  }

  const text = parts.join("\n\n");

  if (text.length < MIN_EXTRACTED_CHARS) {
    return { ok: false, reason: "no_text_layer" };
  }

  return { ok: true, text, pageStarts, pageCount: totalPages };
}

function extractPlainText(bytes: Uint8Array): ExtractionResult {
  let decoded: string;

  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: "decode_failed" };
  }

  const text = normalise(decoded);

  if (text.length < MIN_EXTRACTED_CHARS) {
    return { ok: false, reason: "no_text_layer" };
  }

  return { ok: true, text, pageStarts: null, pageCount: null };
}

export async function extractDocumentText({
  bytes,
  mimeType,
}: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<ExtractionResult> {
  if (!isAcceptedMimeType(mimeType)) {
    return { ok: false, reason: "unsupported_mime_type" };
  }

  if (bytes.byteLength === 0) {
    return { ok: false, reason: "empty_file" };
  }

  const accepted: AcceptedMimeType = mimeType;

  return accepted === "application/pdf"
    ? extractPdf(bytes)
    : extractPlainText(bytes);
}
