"use server";

import { revalidatePath } from "next/cache";

import { canSetSignalWindow, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { setSignalWindowClosesAt } from "@/lib/db";

import { setSignalWindowSchema, type SetSignalWindowInput } from "./schema";

/**
 * Recording or clearing the date a policy window closes (AGENTS.md §10.1).
 *
 * AUTHORISE, THEN VALIDATE, THEN WRITE. The tracker hides the date control for a
 * role that may not record one, and that hiding is presentation — this check is
 * the control. Authorisation runs first so an unauthorised caller learns nothing
 * from a validation message about a signal they cannot touch.
 *
 * THE ONLY MUTATION ON /tracker, AND IT TOUCHES ONE COLUMN. Nothing here advances
 * a brief's status: approval, submission and publication stay explicit actions on
 * the brief itself, still refused server-side while unresolved flags exist (§9.5,
 * §10.7). A calendar must never become a second, unguarded path to a status
 * change.
 *
 * NO GEMINI CALL, NO EVIDENCE READ. The governance gate is not on this path
 * because there is no model on this path (§7).
 */

export type SetSignalWindowResult =
  | { ok: true; windowClosesAt: string | null }
  | { ok: false; refusal: ActionRefusal };

export async function setSignalWindowAction(
  input: SetSignalWindowInput,
): Promise<SetSignalWindowResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return {
      ok: false,
      refusal: unauthorised("Sign in to record a closing date."),
    };
  }

  if (!canSetSignalWindow(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only the Programme Director or a Policy & Advocacy Officer can record a window's closing date.",
      ),
    };
  }

  const parsed = setSignalWindowSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      (fieldErrors[field] ??= []).push(issue.message);
    }

    return { ok: false, refusal: { kind: "invalid", fieldErrors } };
  }

  // Midday UTC, so no timezone offset can push a recorded day across a boundary
  // in either direction when it is read back and formatted.
  const windowClosesAt =
    parsed.data.windowClosesOn === null
      ? null
      : new Date(`${parsed.data.windowClosesOn}T12:00:00.000Z`);

  const result = await setSignalWindowClosesAt({
    signalId: parsed.data.signalId,
    windowClosesAt,
  });

  if (!result.ok) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: { form: ["That signal no longer exists."] },
      },
    };
  }

  revalidatePath("/tracker");
  revalidatePath(`/signals/${parsed.data.signalId}`);

  return { ok: true, windowClosesAt: result.windowClosesAt };
}
