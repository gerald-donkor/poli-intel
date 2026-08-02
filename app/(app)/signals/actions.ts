"use server";

import { revalidatePath } from "next/cache";

import { canReclassifySignal, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { reclassifySignalUrgency } from "@/lib/db";
import type { Urgency } from "@/lib/generated/prisma/enums";

import { reclassifySignalSchema, type ReclassifySignalInput } from "./schema";

/**
 * Moving a signal between urgency columns (AGENTS.md §8.6, §10.1).
 *
 * AUTHORISE, THEN VALIDATE, THEN WRITE. The board hides the drag affordance for
 * a role that may not reclassify, and that hiding is presentation — this check
 * is the control. Authorisation runs before validation so an unauthorised caller
 * learns nothing from a validation message about a signal they cannot touch.
 *
 * THE AUDIT ROW IS NOT OPTIONAL. It is written in the same transaction as the
 * urgency, in `reclassifySignalUrgency`, so a stored urgency nobody can
 * attribute cannot exist.
 *
 * NOTHING HERE ADVANCES A SIGNAL'S STATUS. The board groups by urgency; a column
 * move says how soon someone should look, never that anyone has acted (§8.5).
 */

export type ReclassifySignalResult =
  | { ok: true; urgency: Urgency; changed: boolean }
  | { ok: false; refusal: ActionRefusal };

export async function reclassifySignalUrgencyAction(
  input: ReclassifySignalInput,
): Promise<ReclassifySignalResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to move a signal.") };
  }

  if (!canReclassifySignal(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only the Programme Director or a Policy & Advocacy Officer can change a signal's urgency.",
      ),
    };
  }

  const parsed = reclassifySignalSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      (fieldErrors[field] ??= []).push(issue.message);
    }

    return { ok: false, refusal: { kind: "invalid", fieldErrors } };
  }

  const result = await reclassifySignalUrgency({
    signalId: parsed.data.signalId,
    actorId: staffUser.id,
    newUrgency: parsed.data.urgency,
  });

  if (!result.ok) {
    // A same-column drop is not an error and not a refusal — it is a move that
    // meant nothing, and it wrote nothing. The board keeps the card where it is.
    if (result.reason === "unchanged") {
      return { ok: true, urgency: parsed.data.urgency, changed: false };
    }

    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: { form: ["That signal no longer exists."] },
      },
    };
  }

  revalidatePath("/signals");
  revalidatePath(`/signals/${parsed.data.signalId}`);

  return { ok: true, urgency: result.newUrgency, changed: true };
}
