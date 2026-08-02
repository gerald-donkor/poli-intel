"use server";

import { revalidatePath } from "next/cache";

import { GENERATION_EVIDENCE_CONTEXT_SIZE } from "@/lib/ai/config";
import { gateEvidenceForGeneration } from "@/lib/ai/evidence-context";
import type { GatedEvidenceContext } from "@/lib/ai/evidence-context";
import {
  anchorClaim,
  factCheckDraft,
  parseStoredFactCheck,
} from "@/lib/ai/fact-check";
import {
  assembleBodyText,
  EVIDENCE_SECTION_HEADING,
  generateBrief,
  parseStoredDraft,
} from "@/lib/ai/generate-brief";
import type { StructuredCallFailure } from "@/lib/ai/structured";
import { canGenerateBrief, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { diffBriefBodies, type BriefDiff } from "@/lib/briefs/diff";
import { buildDocumentFromDraft } from "@/lib/briefs/document";
import {
  createBriefGeneration,
  discardBriefGeneration,
  failBriefGeneration,
  findBriefForReframe,
  findOwnedBriefGeneration,
  isEditableStatus,
  loadEvidenceForGenerationContext,
  markBriefDrafting,
  persistReframedVersion,
  recordBriefDraft,
  recordBriefFactCheck,
} from "@/lib/db";
import {
  GenerationFailureReason,
  GenerationStage,
} from "@/lib/generated/prisma/enums";
import type { BriefAudience, BriefType } from "@/lib/generated/prisma/enums";

import { reframeBriefSchema, type ReframeBriefInput } from "./schema";

/**
 * THE AUDIENCE SWITCHER'S ENGINE — the same evidence, reframed for a different
 * reader.
 *
 * IT REUSES THE THREE-STAGE GENERATION FLOW rather than inventing a second
 * pipeline, because a reframe is exactly the situation that split was built for:
 * two Gemini calls on the free tier with a person watching, where a 429 at the
 * fact-check stage must not discard a draft that already cost a generation
 * request (§13.4).
 *
 *   1. `startBriefReframe`   — "Reading evidence": authorise, re-read the
 *      brief's OWN policy text and evidence set from the database, gate them,
 *      open the attempt row.
 *   2. `draftReframeAction`  — "Drafting": generation against the new audience
 *      profile. The validated draft is parked on the attempt row.
 *   3. `verifyReframeAction` — "Verifying citations": the fact-check pass. Its
 *      verdicts are parked on the attempt row too, and the DIFF IS RETURNED —
 *      nothing is written.
 *   4. `commitReframeAction` — the human decision. One transaction: the new
 *      version, its new flags, and `Brief.audience`.
 *   5. `discardReframeAction` — the other human decision. The brief is left
 *      exactly as it was and the attempt records that the run was not taken up.
 *
 * WHY 3 AND 4 ARE SEPARATE (decision 5). Generating straight into a new version
 * would make a one-click control overwrite the officer's working draft with
 * model output — the wholesale replacement `brief-output` rule 4 forbids, and an
 * autonomous write §8 forbids. So the reframe is shown as a diff and committed
 * by an explicit human action.
 *
 * THE GATE IS NOT SKIPPED BECAUSE THE BRIEF ALREADY EXISTS. Audience switching
 * is call type 6 in `evidence-governance` and it is explicitly not exempt: being
 * cleared once does not clear the evidence forever (§7.8). An item reclassified
 * to `community_sourced` since the brief was written refuses the whole run.
 *
 * LOGGING: ids, counts, classifications, stages and outcomes only. Never a
 * draft, never a prompt, never a completion, never an excerpt (§7.6, §13.9).
 */

export type StartReframeResult =
  | { ok: true; generationId: string; fromVersion: number }
  | { ok: false; refusal: ActionRefusal };

export type DraftReframeResult =
  | { ok: true }
  | { ok: false; refusal: ActionRefusal };

export type VerifyReframeResult =
  | { ok: true; diff: BriefDiff; flagCount: number }
  | { ok: false; refusal: ActionRefusal };

export type CommitReframeResult =
  | { ok: true; version: number }
  | { ok: false; refusal: ActionRefusal };

export type DiscardReframeResult =
  | { ok: true }
  | { ok: false; refusal: ActionRefusal };

/* -------------------------------------------------------------------------
 * Stage 1 — Reading evidence
 * ---------------------------------------------------------------------- */

export async function startBriefReframe(
  input: ReframeBriefInput,
): Promise<StartReframeResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to reframe a brief.") };
  }

  // A reframe IS a generation, so it is the generation matrix — not the editing
  // one, and not a second predicate declared here (§10.3, decision 8). A
  // Research Officer may resolve the flags a reframe produces and may not
  // produce them; a Field Officer reaches none of this.
  if (!canGenerateBrief(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only a Policy & Advocacy Officer or the Programme Director can reframe a brief.",
      ),
    };
  }

  const parsed = reframeBriefSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: { audience: ["Choose an audience to reframe for."] },
      },
    };
  }

  const brief = await findBriefForReframe(parsed.data.briefId);

  if (!brief) {
    return { ok: false, refusal: unauthorised("That brief is not available.") };
  }

  // Object-level, and re-read inside the commit transaction as well. Reframing a
  // `reviewed` brief would change the document after the Director approved it;
  // reframing a `submitted` one would change a document that has left the
  // building. A brief past `draft` is sent back first (decision 7).
  if (!isEditableStatus(brief.status)) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          "This brief is no longer a draft, so it cannot be reframed. Ask the Programme Director to send it back first.",
      },
    };
  }

  if (brief.audience === parsed.data.audience) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          audience: ["This brief is already written for that reader."],
        },
      },
    };
  }

  if (brief.policyText === null) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          "The policy document this brief answers is no longer on record, so it cannot be reframed against the same material.",
      },
    };
  }

  if (brief.evidenceItemIds.length === 0) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          "This brief records no evidence set, so there is nothing to reframe against.",
      },
    };
  }

  // THE GATE. Re-read from the database, then partitioned — not "already checked
  // when the brief was generated" (§7.8).
  const rows = await loadEvidenceForGenerationContext(brief.evidenceItemIds);
  const gated = gateEvidenceForGeneration(rows);

  if (!gated.ok) {
    const byId = new Map(rows.map((row) => [row.id, row.title]));

    return {
      ok: false,
      refusal: {
        kind: "refused-ineligible-classification",
        items: gated.refused.map((refusal) => ({
          id: refusal.id,
          title: byId.get(refusal.id) ?? "An evidence item",
          classification: refusal.classification,
        })),
      },
    };
  }

  const generationId = await createBriefGeneration({
    createdById: staffUser.id,
    briefType: brief.briefType,
    audience: parsed.data.audience,
    // The brief's OWN records, read above. Never the browser's copy.
    policyText: brief.policyText,
    evidenceItemIds: brief.evidenceItemIds,
    signalId: brief.signalId,
    briefId: brief.id,
  });

  console.info("brief.reframe.started", {
    generationId,
    briefId: brief.id,
    fromAudience: brief.audience,
    toAudience: parsed.data.audience,
    fromVersion: brief.version,
    evidenceItemCount: gated.context.length,
  });

  return { ok: true, generationId, fromVersion: brief.version };
}

/* -------------------------------------------------------------------------
 * Stage 2 — Drafting
 * ---------------------------------------------------------------------- */

export async function draftReframeAction(
  generationId: string,
): Promise<DraftReframeResult> {
  const resolved = await resolveReframeAttempt(generationId);

  if (!resolved.ok) return { ok: false, refusal: resolved.refusal };

  const { attempt, context } = resolved;

  const started = Date.now();

  await markBriefDrafting(generationId);

  // `buildGenerationSystemPrompt` already threads the audience profile through;
  // this is the call that finally sends the other four profiles to a model.
  const generated = await generateBrief({
    briefType: attempt.briefType,
    audience: attempt.audience,
    policyText: attempt.policyText,
    context,
  });

  if (!generated.ok) {
    return {
      ok: false,
      refusal: await recordFailure(generationId, generated.failure),
    };
  }

  await recordBriefDraft({
    generationId,
    draft: generated.draft,
    generatingModel: generated.generatingModel,
    promptVersion: generated.promptVersion,
  });

  console.info("brief.reframe.drafted", {
    generationId,
    briefId: attempt.briefId,
    audience: attempt.audience,
    model: generated.generatingModel,
    promptVersion: generated.promptVersion,
    findingCount: generated.draft.findings.length,
    statedGapCount: generated.draft.statedGaps.length,
    elapsedMs: Date.now() - started,
  });

  return { ok: true };
}

/* -------------------------------------------------------------------------
 * Stage 3 — Verifying citations, then showing the diff
 * ---------------------------------------------------------------------- */

export async function verifyReframeAction(
  generationId: string,
): Promise<VerifyReframeResult> {
  const resolved = await resolveReframeAttempt(generationId);

  if (!resolved.ok) return { ok: false, refusal: resolved.refusal };

  const { attempt, brief, context } = resolved;

  const draft = parseStoredDraft(attempt.draftJson);

  if (draft === null) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message: "That draft is no longer available. Start the reframe again.",
      },
    };
  }

  const bodyText = assembleBodyText(draft);

  // A retried stage 3 resumes from the stored verdicts rather than spending a
  // second free-tier request on the same draft.
  const stored = parseStoredFactCheck(attempt.factCheckJson);

  if (stored !== null) {
    return {
      ok: true,
      diff: diffBriefBodies(brief.bodyText, bodyText),
      flagCount: stored.unsupported.length,
    };
  }

  const started = Date.now();

  // THE GUARD PASS, BEFORE ANYTHING IS WRITTEN (§9.1). A reframe is new output,
  // so it gets a new pass — it does not inherit the previous version's cleared
  // flag state. Verified against the same context the generator saw.
  const checked = await factCheckDraft({ bodyText, context });

  if (!checked.ok) {
    return {
      ok: false,
      refusal: await recordFailure(generationId, checked.failure),
    };
  }

  await recordBriefFactCheck({
    generationId,
    factCheck: {
      claimsChecked: checked.claimsChecked,
      unsupported: checked.unsupported,
    },
  });

  console.info("brief.reframe.verified", {
    generationId,
    briefId: attempt.briefId,
    audience: attempt.audience,
    claimsChecked: checked.claimsChecked,
    flagCount: checked.unsupported.length,
    elapsedMs: Date.now() - started,
  });

  return {
    ok: true,
    // Computed server-side from two stored strings. The client never supplies
    // either half of this comparison.
    diff: diffBriefBodies(brief.bodyText, bodyText),
    flagCount: checked.unsupported.length,
  };
}

/* -------------------------------------------------------------------------
 * The human decision
 * ---------------------------------------------------------------------- */

export async function commitReframeAction(
  generationId: string,
): Promise<CommitReframeResult> {
  // No Gemini call happens here, so no gate runs here: the gate guards model
  // calls, and everything this writes was already produced under one. What it
  // does re-check is authority and the brief's state, inside the transaction.
  const resolved = await resolveReframeAttempt(generationId, { gate: false });

  if (!resolved.ok) return { ok: false, refusal: resolved.refusal };

  const { attempt, brief } = resolved;

  const draft = parseStoredDraft(attempt.draftJson);
  const checked = parseStoredFactCheck(attempt.factCheckJson);

  if (
    draft === null ||
    checked === null ||
    attempt.generatingModel === null ||
    attempt.promptVersion === null
  ) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          "That reframed draft is no longer available, or it was never checked. Start the reframe again.",
      },
    };
  }

  const bodyText = assembleBodyText(draft);

  const rows = await loadEvidenceForGenerationContext(attempt.evidenceItemIds);
  const citationKeys = new Map(rows.map((row) => [row.id, row.citationKey]));

  // Built from the same `bodyText` the anchors below index into, so the chips a
  // reader sees and the flags a reviewer sees describe one document.
  const document = buildDocumentFromDraft({
    bodyText,
    evidenceSectionHeading: EVIDENCE_SECTION_HEADING,
    findingCitations: draft.findings.map((finding) => ({
      evidenceItemIds: finding.citations,
    })),
    citationKeys,
  });

  const persisted = await persistReframedVersion({
    generationId,
    briefId: brief.id,
    fromVersion: brief.version,
    createdById: attempt.createdById,
    audience: attempt.audience,
    bodyText,
    documentJson: document,
    generatingModel: attempt.generatingModel,
    promptVersion: attempt.promptVersion,
    flags: checked.unsupported.map((claim) => ({
      ...claim,
      ...anchorClaim(bodyText, claim.claimText),
    })),
  });

  if (!persisted.ok) {
    if (persisted.reason === "conflict") {
      return {
        ok: false,
        refusal: { kind: "version-conflict", currentVersion: persisted.currentVersion },
      };
    }

    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          persisted.reason === "not-editable"
            ? "This brief is no longer a draft, so the reframe was not applied. Nothing was changed."
            : "That brief is no longer available. Nothing was changed.",
      },
    };
  }

  console.info("brief.reframe.committed", {
    generationId,
    briefId: brief.id,
    audience: attempt.audience,
    version: persisted.version,
    flagCount: checked.unsupported.length,
  });

  revalidatePath("/briefs");
  revalidatePath(`/briefs/${brief.id}`);

  return { ok: true, version: persisted.version };
}

export async function discardReframeAction(
  generationId: string,
): Promise<DiscardReframeResult> {
  const resolved = await resolveReframeAttempt(generationId, { gate: false });

  if (!resolved.ok) return { ok: false, refusal: resolved.refusal };

  await discardBriefGeneration(generationId);

  console.info("brief.reframe.discarded", {
    generationId,
    briefId: resolved.brief.id,
    audience: resolved.attempt.audience,
  });

  return { ok: true };
}

/* -------------------------------------------------------------------------
 * Shared
 * ---------------------------------------------------------------------- */

type ResolvedReframe = {
  ok: true;
  attempt: {
    createdById: string;
    briefId: string;
    briefType: BriefType;
    audience: BriefAudience;
    policyText: string;
    evidenceItemIds: string[];
    draftJson: unknown;
    factCheckJson: unknown;
    generatingModel: string | null;
    promptVersion: string | null;
  };
  brief: { id: string; version: number; bodyText: string };
  context: GatedEvidenceContext;
};

/**
 * Authorise, resolve the attempt AND its brief, and RE-GATE the evidence.
 *
 * Every stage runs this — not just the first. Each stage is its own request,
 * minutes may separate them, and both a classification and the brief's status
 * can change in between. Re-reading and re-partitioning per Gemini call is what
 * `evidence-governance` means by a chokepoint at the AI layer's entry rather
 * than a check performed once at the top of a flow.
 *
 * `gate: false` is for the two stages that make NO model call — commit and
 * discard. It skips the partition, not the authorisation: both still resolve the
 * caller, re-read their role from the database, verify the attempt belongs to
 * them, and re-read the brief's status. It is not a bypass, because there is
 * nothing to bypass on a path that never reaches a model.
 */
async function resolveReframeAttempt(
  generationId: string,
  { gate = true }: { gate?: boolean } = {},
): Promise<ResolvedReframe | { ok: false; refusal: ActionRefusal }> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to reframe a brief.") };
  }

  if (!canGenerateBrief(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only a Policy & Advocacy Officer or the Programme Director can reframe a brief.",
      ),
    };
  }

  // Ownership is answered by the query: somebody else's attempt does not
  // resolve, rather than resolving and then being compared.
  const attempt = await findOwnedBriefGeneration({
    generationId,
    createdById: staffUser.id,
  });

  if (!attempt || attempt.briefId === null) {
    return {
      ok: false,
      refusal: unauthorised("That reframe is not available to you."),
    };
  }

  if (
    attempt.stage === GenerationStage.failed ||
    attempt.stage === GenerationStage.complete ||
    attempt.stage === GenerationStage.discarded
  ) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          attempt.stage === GenerationStage.complete
            ? "That reframe has already been applied."
            : attempt.stage === GenerationStage.discarded
              ? "That reframe was discarded. Start another one if you still want it."
              : "That reframe did not complete. Start it again.",
      },
    };
  }

  const brief = await findBriefForReframe(attempt.briefId);

  if (!brief) {
    return { ok: false, refusal: unauthorised("That brief is not available.") };
  }

  if (!isEditableStatus(brief.status)) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          "This brief is no longer a draft, so the reframe cannot go ahead. Nothing was changed.",
      },
    };
  }

  const resolvedAttempt = {
    createdById: staffUser.id,
    briefId: attempt.briefId,
    briefType: attempt.briefType,
    audience: attempt.audience,
    policyText: attempt.policyText,
    evidenceItemIds: attempt.evidenceItemIds,
    draftJson: attempt.draftJson,
    factCheckJson: attempt.factCheckJson,
    generatingModel: attempt.generatingModel,
    promptVersion: attempt.promptVersion,
  };

  const resolvedBrief = {
    id: brief.id,
    version: brief.version,
    bodyText: brief.bodyText,
  };

  if (!gate) {
    return {
      ok: true,
      attempt: resolvedAttempt,
      brief: resolvedBrief,
      context: [] as unknown as GatedEvidenceContext,
    };
  }

  const rows = await loadEvidenceForGenerationContext(attempt.evidenceItemIds);
  const gated = gateEvidenceForGeneration(rows);

  if (!gated.ok) {
    const byId = new Map(rows.map((row) => [row.id, row.title]));

    return {
      ok: false,
      refusal: {
        kind: "refused-ineligible-classification",
        items: gated.refused.map((refusal) => ({
          id: refusal.id,
          title: byId.get(refusal.id) ?? "An evidence item",
          classification: refusal.classification,
        })),
      },
    };
  }

  if (gated.context.length === 0) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          "None of this brief's evidence is still in the library, so it cannot be reframed.",
      },
    };
  }

  const context = gated.context.slice(
    0,
    GENERATION_EVIDENCE_CONTEXT_SIZE,
  ) as unknown as GatedEvidenceContext;

  return { ok: true, attempt: resolvedAttempt, brief: resolvedBrief, context };
}

/**
 * A Gemini failure as the refusal the UI renders, recording a terminal one on
 * the attempt row as it goes.
 *
 * A RATE LIMIT IS NOT TERMINAL. The attempt row, its draft and its verdicts are
 * left exactly as they are, so the officer retries the stage that was
 * interrupted rather than losing work that already cost a request (§13.4).
 */
async function recordFailure(
  generationId: string,
  failure: StructuredCallFailure,
): Promise<ActionRefusal> {
  if (failure.reason === "rate_limited") {
    console.info("brief.reframe.rate_limited", {
      generationId,
      retryAfterMs: failure.retryAfterMs,
    });

    return { kind: "rate-limited", retryAfterMs: failure.retryAfterMs };
  }

  const reason =
    failure.reason === "invalid_output"
      ? GenerationFailureReason.invalid_output
      : failure.reason === "missing_api_key"
        ? GenerationFailureReason.missing_api_key
        : GenerationFailureReason.request_failed;

  await failBriefGeneration({ generationId, reason });

  console.warn("brief.reframe.failed", {
    generationId,
    reason,
    status: failure.reason === "request_failed" ? failure.status : null,
  });

  return { kind: "generation-failed", message: FAILURE_COPY[reason] };
}

const FAILURE_COPY: Record<GenerationFailureReason, string> = {
  [GenerationFailureReason.invalid_output]:
    "The reframed draft did not come back in a usable structure, twice. Nothing was changed. Try again.",
  [GenerationFailureReason.missing_api_key]:
    "Brief generation is not configured on this deployment.",
  [GenerationFailureReason.request_failed]:
    "The reframe request did not complete. Nothing was changed.",
};
