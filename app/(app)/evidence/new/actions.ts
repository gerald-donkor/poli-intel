"use server";

import { canIngestEvidence, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import {
  createEvidenceShell,
  deleteEvidenceItem,
  findEvidenceItemForIngestion,
} from "@/lib/db/evidence";
import type { EvidenceSourceType, ImpactArea } from "@/lib/generated/prisma/enums";

import { evidenceMetadataSchema, type EvidenceMetadataInput } from "./schema";

/**
 * Evidence ingestion actions, colocated with the route that uses them.
 *
 * Order in both: resolve the session → authorise → validate → work → return a
 * typed result. Authorisation comes before validation so an unauthorised caller
 * learns nothing from validation messages about a resource they cannot touch.
 */

export type CreateEvidenceRecordResult =
  | { ok: true; evidenceItemId: string }
  | { ok: false; refusal: ActionRefusal };

export async function createEvidenceRecordAction(
  input: EvidenceMetadataInput,
): Promise<CreateEvidenceRecordResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to ingest evidence.") };
  }

  if (!canIngestEvidence(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only a Research Officer or the Programme Director can ingest evidence.",
      ),
    };
  }

  const parsed = evidenceMetadataSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: toFieldErrors(parsed.error.issues),
      },
    };
  }

  const values = parsed.data;

  const created = await createEvidenceShell({
    title: values.title,
    authors: splitAuthors(values.authors),
    year: values.year ? Number(values.year) : null,
    sourceType: values.sourceType as EvidenceSourceType,
    country: values.country || null,
    impactArea: values.impactArea ? (values.impactArea as ImpactArea) : null,
    citationKey: values.citationKey,
    sourceUrl: values.sourceUrl || null,
    sourceFileName: values.sourceFileName,
    ingestedById: staffUser.id,
    // No `classification`. The schema default holds the item at
    // `unpublished_internal` and this action never accepts one from the client
    // (AGENTS.md §7.3).
  });

  if (!created.ok) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          citationKey: [
            "That citation key is already in use. Citation keys are unique across the evidence library.",
          ],
        },
      },
    };
  }

  return { ok: true, evidenceItemId: created.evidenceItemId };
}

/**
 * Removes a record whose upload never completed, so an abandoned upload does
 * not leave a half-ingested item behind. Called from the form's error path.
 *
 * Refuses to touch an item whose extraction finished: this is cleanup, not a
 * delete endpoint for the evidence library.
 */
export async function discardEvidenceRecordAction(
  evidenceItemId: string,
): Promise<{ ok: boolean }> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser || !canIngestEvidence(staffUser.role)) return { ok: false };

  const item = await findEvidenceItemForIngestion(evidenceItemId);

  if (!item) return { ok: true };
  if (item.extractionCompletedAt) return { ok: false };
  if (item.ingestedById !== staffUser.id) return { ok: false };

  await deleteEvidenceItem(evidenceItemId);

  return { ok: true };
}

function splitAuthors(authors: string | undefined): string[] {
  if (!authors) return [];

  return authors
    .split(",")
    .map((author) => author.trim())
    .filter((author) => author.length > 0);
}

/** Field-mapped Zod issues, in the shape `ActionRefusal["invalid"]` expects. */
function toFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    (fieldErrors[field] ??= []).push(issue.message);
  }

  return fieldErrors;
}
