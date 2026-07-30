import "server-only";

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";

import { canIngestEvidence } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { findEvidenceItemForIngestion } from "@/lib/db/evidence";
import { ingestUploadedDocument } from "@/lib/ingestion/ingest";
import { MAX_PDF_SIZE, MAX_TEXT_SIZE } from "@/lib/ingestion/limits";

/**
 * The evidence upload file router.
 *
 * The middleware is where an upload token is issued, so it is where
 * authorisation happens: an unauthorised caller never obtains one. All actual
 * work is delegated to `lib/ingestion/` — the route handler that mounts this
 * stays thin because it serves an external caller (AGENTS.md §5.3).
 */

const f = createUploadthing();

export const evidenceFileRouter = {
  evidenceDocument: f({
    "application/pdf": { maxFileSize: MAX_PDF_SIZE, maxFileCount: 1 },
    "text/plain": { maxFileSize: MAX_TEXT_SIZE, maxFileCount: 1 },
  })
    // The item this upload fills in was created by the metadata Server Action
    // before the file was chosen, so a citation-key collision surfaces on the
    // form rather than after a completed upload.
    .input(z.object({ evidenceItemId: z.uuid() }))
    .middleware(async ({ input }) => {
      const staffUser = await getCurrentStaffUser();

      if (!staffUser) {
        throw new UploadThingError("Sign in to upload evidence.");
      }

      if (!canIngestEvidence(staffUser.role)) {
        throw new UploadThingError(
          "You do not have permission to ingest evidence.",
        );
      }

      const item = await findEvidenceItemForIngestion(input.evidenceItemId);

      if (!item) {
        throw new UploadThingError("That evidence record no longer exists.");
      }

      // Object-level, not role-only: a Research Officer may ingest evidence,
      // but not into someone else's in-progress record.
      if (item.ingestedById !== staffUser.id) {
        throw new UploadThingError(
          "That evidence record belongs to another person.",
        );
      }

      if (item.extractionCompletedAt) {
        throw new UploadThingError(
          "That evidence record already has extracted text.",
        );
      }

      return { evidenceItemId: item.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Returned to the client as `serverData`. Counts and a machine reason
      // only — never extracted text (§7.6).
      return ingestUploadedDocument({
        evidenceItemId: metadata.evidenceItemId,
        fileUrl: file.ufsUrl,
        fileKey: file.key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    }),
} satisfies FileRouter;

export type EvidenceFileRouter = typeof evidenceFileRouter;
