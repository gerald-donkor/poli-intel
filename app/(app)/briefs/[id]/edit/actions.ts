"use server";

import { revalidatePath } from "next/cache";

import { canEditBrief, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { renderDocument, stripGuardFlagMarks } from "@/lib/briefs/document";
import { saveBriefVersion } from "@/lib/db";
import { BriefStatus } from "@/lib/generated/prisma/enums";

import { saveBriefDraftSchema, type SaveBriefDraftInput } from "./schema";

/**
 * Autosave — the only mutation path the editor has (§5.3).
 *
 * ORDER, EVERY TIME: resolve the session → authorise the role → validate →
 * write. Authorisation comes before validation so an unauthorised caller learns
 * nothing from validation messages about a document they cannot touch.
 *
 * EVERY SAVE IS A NEW VERSION. No prior version is overwritten (§8.7), and the
 * previous version's flags carry forward with their status and resolution
 * metadata intact, re-anchored against the regenerated `bodyText`.
 *
 * WHAT THIS ACTION DOES NOT DO: it does not change `brief.status`, does not set
 * `reviewedById`, and writes no `BriefStatusChange` row. A draft advances only
 * through an explicit human action (§8.3). It also cannot clear a flag — that is
 * the review work, and it is a different action with a different role check
 * (§10.6).
 *
 * `bodyText` is REGENERATED FROM THE DOCUMENT here rather than accepted from the
 * client. It is the canonical text — the brief list's title, the fact-check
 * pass's coordinate space — so it is derived server-side from the validated
 * document, and the flag anchors are derived from the same render pass. The two
 * cannot disagree.
 *
 * LOGGING: ids, versions and counts only. Never document text, never a claim,
 * never evidence text (§7.6).
 */

export type SaveBriefDraftResult =
  | { ok: true; version: number; savedAt: string }
  | { ok: false; refusal: ActionRefusal };

export async function saveBriefDraft(
  input: SaveBriefDraftInput,
): Promise<SaveBriefDraftResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to edit this brief.") };
  }

  if (!canEditBrief(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only a Policy & Advocacy Officer or the Programme Director can edit a brief.",
      ),
    };
  }

  const parsed = saveBriefDraftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          document: [
            "This draft could not be saved in a readable structure. Your text is still on screen — reload the page and try the edit again.",
          ],
        },
      },
    };
  }

  // Guard-flag marks are derived state: painted on from the flag rows at load,
  // read back off here, and never stored inside the document.
  const rendered = renderDocument(parsed.data.document);

  const saved = await saveBriefVersion({
    briefId: parsed.data.briefId,
    fromVersion: parsed.data.fromVersion,
    createdById: staffUser.id,
    document: stripGuardFlagMarks(parsed.data.document),
    bodyText: rendered.bodyText,
    flagAnchors: rendered.flagRanges,
  });

  if (!saved.ok) {
    return { ok: false, refusal: toRefusal(saved) };
  }

  console.info("brief.draft.saved", {
    briefId: parsed.data.briefId,
    version: saved.version,
    flagCount: rendered.flagRanges.size,
  });

  revalidatePath(`/briefs/${parsed.data.briefId}`);
  revalidatePath("/briefs");

  return {
    ok: true,
    version: saved.version,
    savedAt: new Date().toISOString(),
  };
}

function toRefusal(
  saved: Exclude<Awaited<ReturnType<typeof saveBriefVersion>>, { ok: true }>,
): ActionRefusal {
  if (saved.reason === "conflict") {
    return { kind: "version-conflict", currentVersion: saved.currentVersion };
  }

  if (saved.reason === "not-editable") {
    return unauthorised(
      saved.status === BriefStatus.submitted
        ? "This brief has been submitted and is no longer editable."
        : "This brief has been published and is no longer editable.",
    );
  }

  return unauthorised("That brief is not available to you.");
}
