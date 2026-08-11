"use server";

import { revalidatePath } from "next/cache";

import { GENERATION_EVIDENCE_CONTEXT_SIZE } from "@/lib/ai/config";
import { gateEvidenceForGeneration } from "@/lib/ai/evidence-context";
import type { GatedEvidenceContext } from "@/lib/ai/evidence-context";
import { anchorClaim, factCheckDraft } from "@/lib/ai/fact-check";
import {
  assembleBodyText,
  EVIDENCE_SECTION_HEADING,
  generateBrief,
  parseStoredDraft,
} from "@/lib/ai/generate-brief";
import type { StructuredCallFailure } from "@/lib/ai/structured";
import { canGenerateBrief, unauthorised } from "@/lib/auth/authorize";
import { buildDocumentFromDraft } from "@/lib/briefs/document";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import {
  createBriefGeneration,
  failBriefGeneration,
  findOwnedBriefGeneration,
  loadEvidenceForGenerationContext,
  loadSignalMatchScores,
  markBriefDrafting,
  persistGeneratedBrief,
  recordBriefDraft,
  signalExists,
} from "@/lib/db";
import {
  GenerationFailureReason,
  GenerationStage,
} from "@/lib/generated/prisma/enums";
import type {
  BriefAudience,
  BriefType,
  StaffRole,
} from "@/lib/generated/prisma/enums";
import { USAGE_EVENTS } from "@/lib/observability/events";
import { captureUsage } from "@/lib/observability/posthog-server";

import { generateBriefSchema, type GenerateBriefInput } from "./schema";

/**
 * Generation, as three separately-awaited Server Actions.
 *
 *   1. `startBriefGeneration`  — "Reading evidence": authorise, validate, re-read
 *      the selected evidence and put it through the gate, open the attempt row.
 *   2. `draftBriefAction`      — "Drafting": the Gemini generation call. The
 *      validated draft is stored ON THE ATTEMPT ROW, not as a BriefVersion.
 *   3. `verifyBriefAction`     — "Verifying citations": the fact-check pass, then
 *      the transaction that creates the brief.
 *
 * THE SPLIT IS WHAT MAKES §9.1 STRUCTURAL. Nothing reachable as a reviewable
 * brief exists until stage 3 commits, and stage 3 cannot commit without the
 * guard pass having returned. An attempt sitting in `drafting` or `verifying` is
 * an attempt, not a brief: it is absent from the list and unloadable at
 * /briefs/[id].
 *
 * It is also what lets the stepper report real work. Each stage is a completed
 * round-trip, so no label is ever shown for something that is not running
 * (`gemini-integration`, AGENTS.md §16.7).
 *
 * EVERY stage authorises — not just the first — and stages 2 and 3 additionally
 * verify the attempt belongs to the caller (§10.1).
 *
 * LOGGING: ids, counts, classifications and stages only. Never prompt text,
 * completion text, evidence body text, or the pasted policy document
 * (§7.6, §13.9).
 */

export type StartGenerationResult =
  | { ok: true; generationId: string }
  | { ok: false; refusal: ActionRefusal };

export type DraftResult =
  | { ok: true }
  | { ok: false; refusal: ActionRefusal };

export type VerifyResult =
  | { ok: true; briefId: string; flagCount: number }
  | { ok: false; refusal: ActionRefusal };

/* -------------------------------------------------------------------------
 * Stage 1 — Reading evidence
 * ---------------------------------------------------------------------- */

export async function startBriefGeneration(
  input: GenerateBriefInput,
): Promise<StartGenerationResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to generate a brief.") };
  }

  if (!canGenerateBrief(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only a Policy & Advocacy Officer or the Programme Director can generate a brief.",
      ),
    };
  }

  const parsed = generateBriefSchema.safeParse(input);

  if (!parsed.success) return { ok: false, refusal: toInvalid(parsed.error.issues) };

  const signalId = parsed.data.signalId ?? null;

  // A signal id arrives from a query parameter, so it is untrusted input twice
  // over: the schema says it could name a signal, and this says it does. A
  // submission naming one that does not resolve is REFUSED, never quietly
  // stripped — a brief silently detached from its signal would be a traceability
  // record that lies by omission.
  if (signalId !== null && !(await signalExists(signalId))) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          signalId: [
            "That signal is no longer available. Start again from the signal board, or draft this brief manually.",
          ],
        },
      },
    };
  }

  // Re-read from the database. The ids came from the browser and the picker is
  // presentation; a classification changed between picking and pressing Generate
  // must be caught here, which is the only place it can be (§7.1).
  const rows = await loadEvidenceForGenerationContext(parsed.data.evidenceItemIds);

  if (rows.length !== parsed.data.evidenceItemIds.length) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          evidenceItemIds: [
            "One of the selected items is no longer in the library. Reload the page and choose again.",
          ],
        },
      },
    };
  }

  const gated = gateEvidenceForGeneration(rows);

  if (!gated.ok) {
    // Named by title and classification so the officer can act on it — never by
    // excerpt, and never by body text.
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
    briefType: parsed.data.briefType,
    audience: parsed.data.audience,
    policyText: parsed.data.policyText,
    evidenceItemIds: parsed.data.evidenceItemIds,
    signalId,
  });

  console.info("brief.generation.started", {
    generationId,
    signalId,
    briefType: parsed.data.briefType,
    audience: parsed.data.audience,
    evidenceItemCount: gated.context.length,
  });
  await captureUsage(
    USAGE_EVENTS.briefGenerationRequested,
    {
      generationId,
      signalId,
      briefType: parsed.data.briefType,
      audience: parsed.data.audience,
      evidenceItemCount: gated.context.length,
    },
    staffUser,
  );

  return { ok: true, generationId };
}

/* -------------------------------------------------------------------------
 * Stage 2 — Drafting
 * ---------------------------------------------------------------------- */

export async function draftBriefAction(
  generationId: string,
): Promise<DraftResult> {
  const resolved = await resolveAttempt(generationId);

  if (!resolved.ok) return { ok: false, refusal: resolved.refusal };

  const { attempt, context, staffUser } = resolved;

  const started = Date.now();

  await markBriefDrafting(generationId);

  const generated = await generateBrief({
    briefType: attempt.briefType,
    audience: attempt.audience,
    policyText: attempt.policyText,
    context,
  });

  if (!generated.ok) {
    return {
      ok: false,
      refusal: await recordFailure(generationId, generated.failure, staffUser),
    };
  }

  await recordBriefDraft({
    generationId,
    draft: generated.draft,
    generatingModel: generated.generatingModel,
    promptVersion: generated.promptVersion,
  });

  console.info("brief.generation.drafted", {
    generationId,
    model: generated.generatingModel,
    promptVersion: generated.promptVersion,
    findingCount: generated.draft.findings.length,
    statedGapCount: generated.draft.statedGaps.length,
    elapsedMs: Date.now() - started,
  });
  await captureUsage(
    USAGE_EVENTS.briefGenerationCompleted,
    {
      generationId,
      stage: "drafted",
      briefType: attempt.briefType,
      audience: attempt.audience,
      findingCount: generated.draft.findings.length,
      statedGapCount: generated.draft.statedGaps.length,
      elapsedMs: Date.now() - started,
    },
    staffUser,
  );

  return { ok: true };
}

/* -------------------------------------------------------------------------
 * Stage 3 — Verifying citations, then persisting
 * ---------------------------------------------------------------------- */

export async function verifyBriefAction(
  generationId: string,
): Promise<VerifyResult> {
  const resolved = await resolveAttempt(generationId);

  if (!resolved.ok) return { ok: false, refusal: resolved.refusal };

  const { attempt, context, staffUser } = resolved;

  // Stage 2 already committed, so a retried stage 3 resumes rather than
  // regenerating — that is the whole reason the draft lives on the attempt row.
  const draft = parseStoredDraft(attempt.draftJson);

  if (
    draft === null ||
    attempt.generatingModel === null ||
    attempt.promptVersion === null
  ) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message: "That draft is no longer available. Start the generation again.",
      },
    };
  }

  const bodyText = assembleBodyText(draft);

  const started = Date.now();

  // THE GUARD PASS, BEFORE ANY BRIEF EXISTS (§9.1). Verified against the same
  // context the generator saw — the recorded set, never the library.
  const checked = await factCheckDraft({ bodyText, context });

  if (!checked.ok) {
    // A failed verification means NO reviewable brief is created. Not a
    // best-effort save, not a brief with the guard skipped.
    return {
      ok: false,
      refusal: await recordFailure(generationId, checked.failure, staffUser),
    };
  }

  // The editor's document, built from the very same `bodyText` so that every
  // anchor computed above stays valid, with the findings' citation chips
  // threaded in. Chips render to nothing in `bodyText`, so the two agree.
  const document = buildDocumentFromDraft({
    bodyText,
    evidenceSectionHeading: EVIDENCE_SECTION_HEADING,
    findingCitations: draft.findings.map((finding) => ({
      evidenceItemIds: finding.citations,
    })),
    citationKeys: new Map(context.map((item) => [item.id, item.citationKey])),
  });

  // The scores the matcher computed, for the items that came from this signal's
  // match set. Read from the ATTEMPT's signal id, so a brief cannot pick up a
  // score from a signal the officer merely happened to have open. Anything the
  // officer added by hand is absent here and stays unscored, permanently.
  const relevanceScores =
    attempt.signalId === null
      ? new Map<string, number>()
      : await loadSignalMatchScores({
          signalId: attempt.signalId,
          evidenceItemIds: attempt.evidenceItemIds,
        });

  const briefId = await persistGeneratedBrief({
    generationId,
    createdById: attempt.createdById,
    signalId: attempt.signalId,
    relevanceScores,
    briefType: attempt.briefType,
    audience: attempt.audience,
    evidenceItemIds: attempt.evidenceItemIds,
    bodyText,
    documentJson: document,
    generatingModel: attempt.generatingModel,
    promptVersion: attempt.promptVersion,
    flags: checked.unsupported.map((claim) => ({
      ...claim,
      ...anchorClaim(bodyText, claim.claimText),
    })),
  });

  console.info("brief.generation.verified", {
    generationId,
    briefId,
    signalId: attempt.signalId,
    scoredEvidenceCount: relevanceScores.size,
    claimsChecked: checked.claimsChecked,
    flagCount: checked.unsupported.length,
    elapsedMs: Date.now() - started,
  });
  await captureUsage(
    USAGE_EVENTS.briefGenerationCompleted,
    {
      generationId,
      briefId,
      signalId: attempt.signalId,
      stage: "verified",
      scoredEvidenceCount: relevanceScores.size,
      claimsChecked: checked.claimsChecked,
      flagCount: checked.unsupported.length,
      elapsedMs: Date.now() - started,
    },
    staffUser,
  );

  revalidatePath("/briefs");

  // The signal detail lists what has been drafted from it, so it is stale the
  // moment this commits.
  if (attempt.signalId !== null) {
    revalidatePath(`/signals/${attempt.signalId}`);
  }

  return { ok: true, briefId, flagCount: checked.unsupported.length };
}

/* -------------------------------------------------------------------------
 * Shared
 * ---------------------------------------------------------------------- */

type ResolvedAttempt = {
  ok: true;
  attempt: {
    createdById: string;
    signalId: string | null;
    briefType: BriefType;
    audience: BriefAudience;
    policyText: string;
    evidenceItemIds: string[];
    draftJson: unknown;
    generatingModel: string | null;
    promptVersion: string | null;
  };
  context: GatedEvidenceContext;
  staffUser: {
    id: string;
    role: StaffRole;
  };
};

/**
 * Authorise, resolve the attempt, and RE-GATE its evidence.
 *
 * Both later stages run this. The gate is not "already done in stage 1": each
 * stage is its own request, minutes may separate them, and a classification can
 * change in between. Re-reading and re-partitioning per Gemini call is what
 * `evidence-governance` means by a chokepoint at the AI layer's entry rather
 * than a check performed once at the top of a flow.
 */
async function resolveAttempt(
  generationId: string,
): Promise<ResolvedAttempt | { ok: false; refusal: ActionRefusal }> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to generate a brief.") };
  }

  if (!canGenerateBrief(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Only a Policy & Advocacy Officer or the Programme Director can generate a brief.",
      ),
    };
  }

  // Object-level: the query itself scopes to the caller, so somebody else's
  // attempt does not resolve rather than resolving and then being compared.
  const attempt = await findOwnedBriefGeneration({
    generationId,
    createdById: staffUser.id,
  });

  if (!attempt) {
    return {
      ok: false,
      refusal: unauthorised("That generation is not available to you."),
    };
  }

  if (
    attempt.stage === GenerationStage.failed ||
    attempt.stage === GenerationStage.complete
  ) {
    return {
      ok: false,
      refusal: {
        kind: "generation-failed",
        message:
          attempt.stage === GenerationStage.complete
            ? "That generation has already produced a draft."
            : "That generation did not complete. Start it again.",
      },
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
          "None of the selected evidence is still in the library. Start the generation again.",
      },
    };
  }

  // Belt and braces against a selection that somehow exceeded the cap: the
  // generator is contractually bounded (§13.7) and this is the last point that
  // can hold that line.
  const context = gated.context.slice(
    0,
    GENERATION_EVIDENCE_CONTEXT_SIZE,
  ) as unknown as GatedEvidenceContext;

  return {
    ok: true,
    attempt: { ...attempt, createdById: staffUser.id },
    context,
    staffUser,
  };
}

/**
 * Turn a Gemini failure into the refusal the UI renders, recording a terminal
 * one on the attempt row as it goes.
 *
 * A RATE LIMIT IS NOT TERMINAL. The attempt row and its draft are left exactly
 * as they are, so the officer retries the stage that was interrupted rather than
 * losing the draft and the pasted text (§13.4).
 */
async function recordFailure(
  generationId: string,
  failure: StructuredCallFailure,
  staffUser?: { id: string; role: StaffRole },
): Promise<ActionRefusal> {
  if (failure.reason === "rate_limited") {
    console.info("brief.generation.rate_limited", {
      generationId,
      retryAfterMs: failure.retryAfterMs,
    });
    await captureUsage(
      USAGE_EVENTS.briefGenerationFailed,
      {
        generationId,
        reason: "rate_limited",
        retryAfterMs: failure.retryAfterMs,
      },
      staffUser,
    );

    return { kind: "rate-limited", retryAfterMs: failure.retryAfterMs };
  }

  const reason =
    failure.reason === "invalid_output"
      ? GenerationFailureReason.invalid_output
      : failure.reason === "missing_api_key"
        ? GenerationFailureReason.missing_api_key
        : GenerationFailureReason.request_failed;

  await failBriefGeneration({ generationId, reason });

  console.warn("brief.generation.failed", {
    generationId,
    reason,
    status: failure.reason === "request_failed" ? failure.status : null,
  });
  await captureUsage(
    USAGE_EVENTS.briefGenerationFailed,
    {
      generationId,
      reason,
      status: failure.reason === "request_failed" ? failure.status : null,
    },
    staffUser,
  );

  return {
    kind: "generation-failed",
    message: FAILURE_COPY[reason],
  };
}

const FAILURE_COPY: Record<GenerationFailureReason, string> = {
  [GenerationFailureReason.invalid_output]:
    "The draft did not come back in a usable structure, twice. Nothing was saved. Try again, or shorten the policy text.",
  [GenerationFailureReason.missing_api_key]:
    "Brief generation is not configured on this deployment.",
  [GenerationFailureReason.request_failed]:
    "The generation request did not complete. Nothing was saved.",
};

function toInvalid(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Extract<ActionRefusal, { kind: "invalid" }> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    (fieldErrors[field] ??= []).push(issue.message);
  }

  return { kind: "invalid", fieldErrors };
}
