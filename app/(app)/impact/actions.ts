"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import {
  canLogInfluenceEvent,
  canAuthorQuarterlyNarrative,
  canVerifyInfluenceEvent,
  unauthorised,
} from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import {
  logInfluenceEvent,
  upsertQuarterlyNarrative,
  verifyInfluenceEvent,
} from "@/lib/db";

import {
  logInfluenceEventSchema,
  verifyInfluenceEventSchema,
  type LogInfluenceEventInput,
  type VerifyInfluenceEventInput,
  quarterlyNarrativeSchema,
  type QuarterlyNarrativeInput,
} from "./schema";

/**
 * The Impact Tracker's two mutations.
 *
 * ORDER, EVERY TIME: resolve the session → authorise → validate → do the work.
 * Authorisation comes first so an unauthorised caller learns nothing from field
 * errors about a record they cannot touch (`server-actions`).
 *
 * WHO: logging is `canLogInfluenceEvent` — Programme Director and Policy &
 * Advocacy Officer. Confirming is `canVerifyInfluenceEvent` — Programme Director
 * only, because confirmation is the claim that goes to donors. Both refuse
 * SERVER-SIDE; a hidden button is presentation and is never the control (§10.1).
 *
 * SHORT ON PURPOSE. Validate, authorise, orchestrate, return. There is no Gemini
 * call on either path — detection belongs to the weekly job and the AI layer, and
 * the quarterly report is assembled from stored rows (§5.2, decision 7).
 *
 * LOGGING: nothing here logs a description, a quoted line, or a source document.
 * A verbatim sentence from a ministry's notice is exactly the kind of string that
 * must not end up in third-party telemetry (§7.6).
 */

export type ImpactActionResult =
  | { ok: true }
  | { ok: false; refusal: ActionRefusal };

export async function logInfluenceEventAction(
  input: LogInfluenceEventInput,
): Promise<ImpactActionResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return {
      ok: false,
      refusal: unauthorised("Sign in to add to the impact record."),
    };
  }

  if (!canLogInfluenceEvent(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "The impact record is the Programme Director's and the Policy & Advocacy Officer's to keep.",
      ),
    };
  }

  const parsed = logInfluenceEventSchema.safeParse(input);

  if (!parsed.success) return { ok: false, refusal: toInvalid(parsed.error) };

  const result = await logInfluenceEvent({
    briefId: parsed.data.briefId,
    eventType: parsed.data.eventType,
    description: parsed.data.description,
    sourceDocument: parsed.data.sourceDocument?.trim() || null,
    sourceTitle: parsed.data.sourceTitle?.trim() || null,
    quotedText: parsed.data.quotedText?.trim() || null,
    // Parsed as UTC midnight so the stored instant matches the day the person
    // chose, wherever the server happens to be.
    detectedAt: new Date(`${parsed.data.detectedAt}T00:00:00Z`),
    loggedById: staffUser.id,
  });

  if (!result.ok) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors:
          result.reason === "unknown_brief"
            ? { briefId: ["That brief no longer exists."] }
            : {
                sourceDocument: [
                  "That document is already recorded against this brief.",
                ],
              },
      },
    };
  }

  revalidatePath("/impact");

  return { ok: true };
}

/**
 * A Programme Director confirms a record.
 *
 * The action re-reads the caller's role from the database inside itself, so a
 * demotion applied a minute ago takes effect on this call. Actor and timestamp
 * are written by the data layer (§8.3).
 */
export async function verifyInfluenceEventAction(
  input: VerifyInfluenceEventInput,
): Promise<ImpactActionResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return {
      ok: false,
      refusal: unauthorised("Sign in to confirm an impact record."),
    };
  }

  if (!canVerifyInfluenceEvent(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only the Programme Director can confirm an impact record, because a confirmed record can go into a donor report.",
      ),
    };
  }

  const parsed = verifyInfluenceEventSchema.safeParse(input);

  if (!parsed.success) return { ok: false, refusal: toInvalid(parsed.error) };

  const result = await verifyInfluenceEvent({
    eventId: parsed.data.eventId,
    actorStaffUserId: staffUser.id,
    verifiedAt: new Date(),
  });

  if (!result.ok) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: { form: ["That record no longer exists."] },
      },
    };
  }

  revalidatePath("/impact");

  return { ok: true };
}

export async function saveQuarterlyNarrativeAction(
  input: QuarterlyNarrativeInput,
): Promise<ImpactActionResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to record a quarterly evaluation.") };
  }

  if (!canAuthorQuarterlyNarrative(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only the Programme Director and Policy & Advocacy Officer can record a quarterly evaluation.",
      ),
    };
  }

  const parsed = quarterlyNarrativeSchema.safeParse(input);

  if (!parsed.success) return { ok: false, refusal: toInvalid(parsed.error) };

  await upsertQuarterlyNarrative({ ...parsed.data, authorId: staffUser.id });
  revalidatePath("/impact");

  return { ok: true };
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
