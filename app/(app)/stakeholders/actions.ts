"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { canManageStakeholders, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import {
  createStakeholder,
  updateStakeholder,
  type StakeholderInput,
} from "@/lib/db";

import {
  createStakeholderSchema,
  updateStakeholderSchema,
  type CreateStakeholderInput,
  type UpdateStakeholderInput,
} from "./schema";

/**
 * The CRM's mutations.
 *
 * ORDER, EVERY TIME: resolve the session → authorise → validate → do the work.
 * Authorisation comes first so an unauthorised caller learns nothing from field
 * errors about a record they cannot touch (`server-actions`).
 *
 * WHO: `canManageStakeholders` — Programme Director and Policy & Advocacy
 * Officer (§10.3). A Field Officer has no CRM access at all (§10.5), and a
 * Research Officer is refused too: §10.4 describes evidence and accuracy work
 * with no CRM component, and §10.3 assigns stakeholder relationships to the
 * Policy & Advocacy Officer.
 *
 * LOGGING: nothing here logs a contact's name, organisation, or a share note. A
 * named person at a named ministry is exactly the record Tropenbos cannot
 * afford to leak into third-party telemetry (§7.6).
 */

export type StakeholderActionResult =
  | { ok: true; id: string }
  | { ok: false; refusal: ActionRefusal };

export async function createStakeholderAction(
  input: CreateStakeholderInput,
): Promise<StakeholderActionResult> {
  const authorised = await authoriseCrmWrite();

  if (authorised !== null) return { ok: false, refusal: authorised };

  const parsed = createStakeholderSchema.safeParse(input);

  if (!parsed.success) return { ok: false, refusal: toInvalid(parsed.error) };

  const id = await createStakeholder(toRecord(parsed.data));

  revalidatePath("/stakeholders");

  return { ok: true, id };
}

export async function updateStakeholderAction(
  input: UpdateStakeholderInput,
): Promise<StakeholderActionResult> {
  const authorised = await authoriseCrmWrite();

  if (authorised !== null) return { ok: false, refusal: authorised };

  const parsed = updateStakeholderSchema.safeParse(input);

  if (!parsed.success) return { ok: false, refusal: toInvalid(parsed.error) };

  const result = await updateStakeholder(parsed.data.id, toRecord(parsed.data));

  if (!result.ok) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: { form: ["That contact no longer exists."] },
      },
    };
  }

  revalidatePath("/stakeholders");
  revalidatePath(`/stakeholders/${parsed.data.id}`);

  return { ok: true, id: parsed.data.id };
}

/** Returns a refusal, or `null` when the caller may write. */
async function authoriseCrmWrite(): Promise<ActionRefusal | null> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return unauthorised("Sign in to manage stakeholder records.");
  }

  if (!canManageStakeholders(staffUser.role)) {
    return unauthorised(
      "Stakeholder records are the Policy & Advocacy Officer's and the Programme Director's to keep.",
    );
  }

  return null;
}

/** An empty field means "not recorded", which is a null and not an empty string. */
function toRecord(
  values: z.infer<typeof createStakeholderSchema>,
): StakeholderInput {
  return {
    name: values.name,
    organisation: values.organisation?.trim() || null,
    role: values.role?.trim() || null,
    audienceType: values.audienceType || null,
    preferredLanguage: values.preferredLanguage || null,
  };
}

function toInvalid(
  error: z.ZodError,
): Extract<ActionRefusal, { kind: "invalid" }> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    (fieldErrors[field] ??= []).push(issue.message);
  }

  return { kind: "invalid", fieldErrors };
}
