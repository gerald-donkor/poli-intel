import "server-only";

import { UTApi } from "uploadthing/server";

import {
  completeEvidenceExtraction,
  deleteEvidenceItem,
  findEvidenceItemForIngestion,
} from "@/lib/db/evidence";
import {
  recordIngestionFailure,
  recordIngestionSuccess,
} from "@/lib/db/ingestion-log";
import type { EvidenceSourceType } from "@/lib/generated/prisma/enums";

import { chunkDocument } from "./chunk";
import { extractDocumentText, type ExtractionFailureReason } from "./extract";
import { MAX_SIZE_BYTES, isAcceptedMimeType } from "./limits";

/**
 * Ingestion orchestration: extract → chunk → persist → log → prune.
 *
 * This runs inside Uploadthing's `onUploadComplete` server callback, not a
 * background job — Inngest is not installed yet. That imposes a ceiling: a very
 * large PDF can outlast the callback's execution window, which is why
 * `config.ts` keeps the size limits modest. Moving ingestion to an Inngest job
 * is the fix when that ceiling starts to bite; do not pre-build that job here.
 */

export type IngestFailureReason =
  | ExtractionFailureReason
  | "evidence_item_not_found"
  | "already_ingested"
  | "file_too_large"
  | "download_failed";

export type IngestOutcome =
  | {
      ok: true;
      evidenceItemId: string;
      extractedChars: number;
      chunkCount: number;
    }
  | { ok: false; reason: IngestFailureReason; message: string };

/**
 * User-facing copy per machine reason. Kept beside the reasons so a new failure
 * mode cannot ship without a sentence a Research Officer can act on.
 *
 * Never contains document text.
 */
const FAILURE_MESSAGES: Record<IngestFailureReason, string> = {
  no_text_layer:
    "This document appears to have no extractable text layer — it is most likely a scan or a photographed page. Run it through OCR and upload the text version.",
  pdf_parse_failed:
    "The PDF could not be read. It may be encrypted, password-protected, or damaged.",
  decode_failed:
    "The text file is not valid UTF-8. Re-save it as UTF-8 and upload it again.",
  empty_file: "The uploaded file is empty.",
  unsupported_mime_type:
    "Only PDF and plain-text documents can be ingested at the moment.",
  file_too_large: "The file is larger than the ingestion limit for its type.",
  download_failed:
    "The uploaded file could not be read back for extraction. Try the upload again.",
  evidence_item_not_found:
    "The evidence record for this upload no longer exists. Start the upload again.",
  already_ingested:
    "This evidence record already has extracted text. Start a new upload instead.",
};

/**
 * Removes the raw artefact once its text is safely in the database
 * (`supabase-schema`, AGENTS.md §12.5). The upload holds the file only long
 * enough to be read.
 *
 * Also called on the failure path: a document whose evidence record has just
 * been deleted has nothing left pointing at it.
 *
 * A failed prune is reported as a short machine reason and never aborts an
 * otherwise successful ingestion — the text is already persisted by then.
 */
async function pruneUpload(fileKey: string): Promise<void> {
  try {
    await new UTApi().deleteFiles([fileKey]);
  } catch {
    // Deliberately swallowed at this one point only, and deliberately without
    // the error object: the artefact is orphaned storage, not lost evidence,
    // and a caught upload-service error is not worth failing a completed
    // ingestion over. No document text is involved either way.
    console.warn(
      `[ingestion] upload artefact could not be pruned: key=${fileKey}`,
    );
  }
}

function fail(
  reason: IngestFailureReason,
): Extract<IngestOutcome, { ok: false }> {
  return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
}

export async function ingestUploadedDocument({
  evidenceItemId,
  fileUrl,
  fileKey,
  fileName,
  mimeType,
  sizeBytes,
}: {
  evidenceItemId: string;
  fileUrl: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<IngestOutcome> {
  const item = await findEvidenceItemForIngestion(evidenceItemId);

  if (!item) {
    await pruneUpload(fileKey);
    await recordIngestionFailure({
      evidenceItemId: null,
      sourceName: fileName,
      sourceType: null,
      failureReason: "evidence_item_not_found",
    });
    return fail("evidence_item_not_found");
  }

  const sourceType: EvidenceSourceType = item.sourceType;

  const abandon = async (reason: IngestFailureReason) => {
    await recordIngestionFailure({
      evidenceItemId,
      sourceName: fileName,
      sourceType,
      failureReason: reason,
    });
    await deleteEvidenceItem(evidenceItemId);
    await pruneUpload(fileKey);
    return fail(reason);
  };

  if (item.extractionCompletedAt) {
    // Not `abandon`: an already-ingested item is a completed one and must not
    // be deleted by a stray second callback.
    await pruneUpload(fileKey);
    await recordIngestionFailure({
      evidenceItemId,
      sourceName: fileName,
      sourceType,
      failureReason: "already_ingested",
    });
    return fail("already_ingested");
  }

  // Re-check MIME type and size server-side. The file router enforces both, but
  // that enforcement is on a path an external caller reaches — this is the one
  // that holds regardless (§18, security requirements).
  if (!isAcceptedMimeType(mimeType)) return abandon("unsupported_mime_type");
  if (sizeBytes > MAX_SIZE_BYTES[mimeType]) return abandon("file_too_large");

  let bytes: Uint8Array;
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return abandon("download_failed");
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return abandon("download_failed");
  }

  const extraction = await extractDocumentText({ bytes, mimeType });

  if (!extraction.ok) return abandon(extraction.reason);

  const chunks = chunkDocument(extraction.text, extraction.pageStarts);

  if (chunks.length === 0) return abandon("no_text_layer");

  await completeEvidenceExtraction({
    evidenceItemId,
    fullText: extraction.text,
    chunks,
  });

  await recordIngestionSuccess({
    evidenceItemId,
    sourceName: fileName,
    sourceType,
    extractedChars: extraction.text.length,
    chunkCount: chunks.length,
  });

  await pruneUpload(fileKey);

  return {
    ok: true,
    evidenceItemId,
    extractedChars: extraction.text.length,
    chunkCount: chunks.length,
  };
}
