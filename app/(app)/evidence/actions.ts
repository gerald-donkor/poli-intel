"use server";

import { revalidatePath } from "next/cache";

import {
  canChangeEvidenceClassification,
  unauthorised,
} from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { classifyEvidenceItem } from "@/lib/db/evidence";

import { classifyEvidenceSchema, type ClassifyEvidenceInput } from "./schema";

/**
 * The tagging gate (AGENTS.md §7.3, §10.8).
 *
 * Nothing leaves `unpublished_internal` without a caller who passes
 * `canChangeEvidenceClassification`, and every change is written with its audit
 * row in one transaction. Hiding the control in the UI is presentation; this
 * check is the enforcement.
 */

export type ClassifyEvidenceResult =
  | { ok: true; classification: ClassifyEvidenceInput["classification"] }
  | { ok: false; refusal: ActionRefusal };

export async function classifyEvidenceAction(
  input: ClassifyEvidenceInput,
): Promise<ClassifyEvidenceResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return {
      ok: false,
      refusal: unauthorised("Sign in to classify evidence."),
    };
  }

  if (!canChangeEvidenceClassification(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only a Research Officer or the Programme Director can set an evidence classification.",
      ),
    };
  }

  const parsed = classifyEvidenceSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      (fieldErrors[field] ??= []).push(issue.message);
    }

    return { ok: false, refusal: { kind: "invalid", fieldErrors } };
  }

  const result = await classifyEvidenceItem({
    evidenceItemId: parsed.data.evidenceItemId,
    actorId: staffUser.id,
    newClassification: parsed.data.classification,
    reason: parsed.data.reason || null,
  });

  if (!result.ok) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          form: [
            result.reason === "not_found"
              ? "That evidence item no longer exists."
              : "That item already carries this classification.",
          ],
        },
      },
    };
  }

  revalidatePath("/evidence");
  revalidatePath("/evidence/queue");

  return { ok: true, classification: parsed.data.classification };
}
