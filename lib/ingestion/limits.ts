/**
 * Ingestion limits — the one place the file router, the server-side re-check,
 * and the upload form read them from.
 *
 * NOT `server-only`: the form states these limits to the person choosing a
 * file. They are product constraints, not secrets. Everything that could not
 * safely reach the browser stays in `config.ts`.
 */

/**
 * Accepted upload types. PDF and plain text only — DOCX is not on the build
 * list (AGENTS.md §1) and is not invented here.
 *
 * Enforced in the Uploadthing file router AND re-checked in `ingest.ts`. The
 * router's check is a courtesy to the browser; the re-check is the guarantee.
 */
export const ACCEPTED_MIME_TYPES = ["application/pdf", "text/plain"] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export function isAcceptedMimeType(
  mimeType: string,
): mimeType is AcceptedMimeType {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Per-type size ceilings. The PDF ceiling is deliberately modest: extraction
 * runs inside Uploadthing's `onUploadComplete` server callback rather than a
 * background job (Inngest is not installed yet), so a very large document would
 * push that callback past its execution window. When ingestion moves to a job,
 * this is the number that can rise.
 */
export const MAX_PDF_SIZE = "16MB" as const;
export const MAX_TEXT_SIZE = "4MB" as const;

/** Byte equivalents for the server-side re-check. */
export const MAX_SIZE_BYTES: Record<AcceptedMimeType, number> = {
  "application/pdf": 16 * 1024 * 1024,
  "text/plain": 4 * 1024 * 1024,
};
