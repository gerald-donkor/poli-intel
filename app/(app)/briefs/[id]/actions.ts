"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  canApproveOrRejectBrief,
  canDismissFlag,
  canSubmitOrPublishBrief,
  unauthorised,
} from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import {
  changeBriefStatus,
  findFlagForResolution,
  resolveHallucinationFlag,
  type FlagForResolution,
} from "@/lib/db";
import { BriefStatus, FlagStatus } from "@/lib/generated/prisma/enums";
import type { StaffUser } from "@/lib/generated/prisma/client";

import {
  briefTransitionNameSchema,
  changeBriefStatusSchema,
  reopenFlagSchema,
  resolveFlagSchema,
  type ChangeBriefStatusInput,
  type ReopenFlagInput,
  type ResolveFlagInput,
} from "./schema";

/**
 * The review surface's mutations: clearing a guard flag, reopening one, and the
 * four status transitions.
 *
 * ORDER, EVERY TIME: resolve the session → authorise this caller for this
 * operation ON THIS OBJECT → validate → do the work. Authorisation comes before
 * validation so an unauthorised caller learns nothing from validation messages
 * about a brief they cannot touch. Where authorisation needs the object, only
 * the id's shape is parsed first, and a malformed id is refused as
 * unauthorised rather than explained.
 *
 * WHAT ENFORCES WHAT: the role predicates in `lib/auth/authorize.ts` answer
 * "may this person", the write transactions in `lib/db/briefs.ts` answer "is
 * this brief still in the state that permits it" — including the approval's
 * open-flag count, which is re-read inside the transaction (§9.5). No button
 * state is a control.
 *
 * LOGGING: brief id, flag id, actor id, transition, outcome, counts. Never a
 * claim, never a reason string, never evidence text (§7.6).
 */

/** Only the id's shape, so the object can be loaded to authorise against. */
const idSchema = z.uuid();

export type ResolveFlagActionResult =
  | { ok: true; status: FlagStatus; openFlagCount: number }
  | { ok: false; refusal: ActionRefusal };

export type ChangeBriefStatusActionResult =
  | { ok: true; status: BriefStatus }
  | { ok: false; refusal: ActionRefusal };

export async function resolveFlagAction(
  input: ResolveFlagInput,
): Promise<ResolveFlagActionResult> {
  const authorised = await authoriseFlagChange(input.flagId);

  if ("refusal" in authorised) return { ok: false, refusal: authorised.refusal };

  const parsed = resolveFlagSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, refusal: toInvalid(parsed.error) };
  }

  if (authorised.flag.status !== FlagStatus.open) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          form: ["Someone has already closed this flag. Reload to see who."],
        },
      },
    };
  }

  return writeFlagState({
    flagId: parsed.data.flagId,
    briefId: authorised.flag.briefId,
    actor: authorised.staffUser,
    nextStatus:
      parsed.data.outcome === "resolved"
        ? FlagStatus.resolved
        : FlagStatus.dismissed,
    reason: parsed.data.reason,
  });
}

/**
 * A reviewer who cleared the wrong flag must be able to say so. A flag that
 * could only ever be closed would push people toward not clearing anything.
 */
export async function reopenFlagAction(
  input: ReopenFlagInput,
): Promise<ResolveFlagActionResult> {
  const authorised = await authoriseFlagChange(input.flagId);

  if ("refusal" in authorised) return { ok: false, refusal: authorised.refusal };

  const parsed = reopenFlagSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, refusal: toInvalid(parsed.error) };
  }

  if (authorised.flag.status === FlagStatus.open) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: { form: ["This flag is already open."] },
      },
    };
  }

  return writeFlagState({
    flagId: parsed.data.flagId,
    briefId: authorised.flag.briefId,
    actor: authorised.staffUser,
    nextStatus: FlagStatus.open,
    reason: parsed.data.reason,
  });
}

export async function changeBriefStatusAction(
  input: ChangeBriefStatusInput,
): Promise<ChangeBriefStatusActionResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to review this brief.") };
  }

  // The transition's NAME is parsed before authorisation, because it decides
  // which predicate applies. Both are Programme Director only; they are named
  // separately because §10.2 states them separately.
  const transition = briefTransitionNameSchema.safeParse(input.transition);

  if (!transition.success) {
    return { ok: false, refusal: unauthorised("That is not an action on a brief.") };
  }

  const permitted =
    transition.data === "submit" || transition.data === "publish"
      ? canSubmitOrPublishBrief(staffUser.role)
      : canApproveOrRejectBrief(staffUser.role);

  if (!permitted) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only the Programme Director can approve, send back, submit, or publish a brief.",
      ),
    };
  }

  const parsed = changeBriefStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, refusal: toInvalid(parsed.error) };
  }

  const result = await changeBriefStatus({
    briefId: parsed.data.briefId,
    actorId: staffUser.id,
    transition: parsed.data.transition,
    reason: parsed.data.reason ?? null,
  });

  if (!result.ok) {
    console.info("brief.status.refused", {
      briefId: parsed.data.briefId,
      actorId: staffUser.id,
      transition: parsed.data.transition,
      reason: result.reason,
      openFlagCount: result.reason === "open-flags" ? result.openFlagCount : 0,
    });

    return { ok: false, refusal: toTransitionRefusal(result) };
  }

  console.info("brief.status.changed", {
    briefId: parsed.data.briefId,
    actorId: staffUser.id,
    transition: parsed.data.transition,
    newStatus: result.status,
  });

  revalidatePath(`/briefs/${parsed.data.briefId}`);
  revalidatePath("/briefs");

  return { ok: true, status: result.status };
}

/* -------------------------------------------------------------------------
 * Shared internals
 * ---------------------------------------------------------------------- */

/**
 * The object-level check both flag actions share.
 *
 * `canDismissFlag` takes the brief's author and the actor as required
 * arguments precisely so a caller cannot perform only the role half: a
 * Programme Director who drafted a brief cannot clear its flags, and therefore
 * cannot approve it until someone else does — which is the guard working.
 */
async function authoriseFlagChange(
  flagId: string,
): Promise<
  { refusal: ActionRefusal } | { staffUser: StaffUser; flag: FlagForResolution }
> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { refusal: unauthorised("Sign in to review this brief.") };
  }

  const id = idSchema.safeParse(flagId);

  if (!id.success) {
    return { refusal: unauthorised("That flag is not available to you.") };
  }

  const flag = await findFlagForResolution(id.data);

  if (!flag || !flag.isCurrentVersion) {
    return {
      refusal: unauthorised(
        "That flag is not on this brief's current version. Reload the page.",
      ),
    };
  }

  if (
    !canDismissFlag(
      staffUser.role,
      // A brief whose author's row is gone has no author anyone can be, so the
      // object-level half cannot match — the role half still applies.
      { createdById: flag.briefCreatedById ?? "" },
      staffUser.id,
    )
  ) {
    return {
      refusal: unauthorised(
        flag.briefCreatedById === staffUser.id
          ? "You drafted this brief, so someone else has to check its flags."
          : "Only a Research Officer or the Programme Director can close a flag.",
      ),
    };
  }

  return { staffUser, flag };
}

async function writeFlagState(input: {
  flagId: string;
  briefId: string;
  actor: StaffUser;
  nextStatus: FlagStatus;
  reason: string;
}): Promise<ResolveFlagActionResult> {
  const result = await resolveHallucinationFlag({
    flagId: input.flagId,
    actorId: input.actor.id,
    nextStatus: input.nextStatus,
    reason: input.reason,
  });

  if (!result.ok) {
    console.info("brief.flag.refused", {
      briefId: input.briefId,
      flagId: input.flagId,
      actorId: input.actor.id,
      nextStatus: input.nextStatus,
      reason: result.reason,
    });

    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          form: [
            result.reason === "not-found"
              ? "That flag no longer exists."
              : result.reason === "not-current-version"
                ? "This brief has a newer version. Reload the page."
                : "Someone else changed this flag first. Reload to see the record.",
          ],
        },
      },
    };
  }

  console.info("brief.flag.changed", {
    briefId: result.briefId,
    flagId: input.flagId,
    actorId: input.actor.id,
    status: result.status,
    openFlagCount: result.openFlagCount,
  });

  revalidatePath(`/briefs/${result.briefId}`);
  revalidatePath("/briefs");

  return { ok: true, status: result.status, openFlagCount: result.openFlagCount };
}

function toInvalid(error: z.ZodError): ActionRefusal {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    (fieldErrors[field] ??= []).push(issue.message);
  }

  return { kind: "invalid", fieldErrors };
}

function toTransitionRefusal(
  result: Exclude<Awaited<ReturnType<typeof changeBriefStatus>>, { ok: true }>,
): ActionRefusal {
  if (result.reason === "open-flags") {
    return {
      kind: "refused-unresolved-flags",
      openFlagCount: result.openFlagCount,
    };
  }

  if (result.reason === "wrong-status") {
    return {
      kind: "invalid",
      fieldErrors: {
        form: [
          "This brief has moved since the page loaded. Reload to see where it is.",
        ],
      },
    };
  }

  return unauthorised("That brief is not available to you.");
}
