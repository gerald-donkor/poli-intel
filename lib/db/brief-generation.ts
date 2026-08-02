import "server-only";

import type {
  BriefAudience,
  BriefType,
  GenerationFailureReason,
} from "@/lib/generated/prisma/enums";
import { GenerationStage } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "./client";

/**
 * The generation attempt's lifecycle.
 *
 * AN ATTEMPT IS NOT A BRIEF. Nothing here creates a `Brief`, and nothing here is
 * readable by the brief list or by /briefs/[id]. The row exists so a generation
 * that failed is a real, queryable outcome rather than a lost request (§9.4),
 * and so a rate limit in the verify stage cannot lose a draft that already
 * exists (§13.4).
 *
 * `policyText` is the pasted external policy document. It is NOT evidence: it is
 * never written to `evidence_item`, never chunked, never embedded, and lives
 * nowhere but this row (prompt 09, decision 5).
 */

export type CreateBriefGenerationInput = {
  createdById: string;
  briefType: BriefType;
  audience: BriefAudience;
  policyText: string;
  evidenceItemIds: string[];
  /**
   * The signal the officer opened the form from, resolved against the database
   * by stage 1 — never a query parameter taken on trust. Null for a manual
   * draft, which is the only other way in.
   */
  signalId: string | null;
  /**
   * The brief being REFRAMED, for an audience switch. Null for a first
   * generation, which has no brief until its stage-3 transaction creates one.
   *
   * Set at creation for a reframe because the attempt's `policyText` and
   * `evidenceItemIds` are read off that brief's own records, so the association
   * exists before the run does.
   */
  briefId?: string | null;
};

export async function createBriefGeneration(
  input: CreateBriefGenerationInput,
): Promise<string> {
  // `stage` is left to the schema default (`retrieving`). Each stage sets its
  // own value as it begins, so a row stuck at one names the call that never
  // returned rather than the call that was about to start.
  const row = await prisma.briefGeneration.create({
    data: input,
    select: { id: true },
  });

  return row.id;
}

/** Stage 2 opening. Set before the generation call, not after it. */
export async function markBriefDrafting(generationId: string): Promise<void> {
  await prisma.briefGeneration.update({
    where: { id: generationId },
    data: { stage: GenerationStage.drafting },
  });
}

/**
 * What stages 2 and 3 need — and the object-level authorisation check they run.
 *
 * Ownership is answered by the QUERY, not by a comparison a caller might skip:
 * an attempt belonging to somebody else simply does not resolve.
 */
export function findOwnedBriefGeneration({
  generationId,
  createdById,
}: {
  generationId: string;
  createdById: string;
}) {
  return prisma.briefGeneration.findFirst({
    where: { id: generationId, createdById },
    select: {
      id: true,
      briefType: true,
      audience: true,
      policyText: true,
      evidenceItemIds: true,
      // Read from the ROW, not re-derived from the URL the third request
      // happened to arrive on.
      signalId: true,
      stage: true,
      draftJson: true,
      factCheckJson: true,
      generatingModel: true,
      promptVersion: true,
      briefId: true,
    },
  });
}

/**
 * Stage 3's output, held on the attempt for the same reason stage 2's is.
 *
 * ONLY THE AUDIENCE SWITCHER USES THIS. A first generation fact-checks and
 * persists in one request, so its verdicts never need a home. A reframe shows
 * the officer a diff and waits, so the flags they reviewed must be the flags
 * that land — re-running the pass at commit would spend another free-tier
 * request and could return a different set (§9.1, §13.3).
 *
 * The stage stays `verifying`: the pass has returned but nothing is committed,
 * and that is exactly what `verifying` means until a person decides.
 */
export async function recordBriefFactCheck({
  generationId,
  factCheck,
}: {
  generationId: string;
  factCheck: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.briefGeneration.update({
    where: { id: generationId },
    data: { factCheckJson: factCheck },
  });
}

/**
 * A verified draft the officer chose not to take up.
 *
 * NOT `failed`. The run did produce a draft, two Gemini requests were spent, and
 * a person decided against the result — recording that as a failure would lose
 * the only fact worth keeping about it. The brief is left exactly as it was.
 */
export async function discardBriefGeneration(
  generationId: string,
): Promise<void> {
  await prisma.briefGeneration.update({
    where: { id: generationId },
    data: { stage: GenerationStage.discarded },
  });
}

/**
 * Stage 2's output, held on the attempt so stage 3 can be retried without
 * regenerating. Already Zod-validated by `generateBrief` — nothing unvalidated
 * reaches this function (§9.4).
 */
export async function recordBriefDraft({
  generationId,
  draft,
  generatingModel,
  promptVersion,
}: {
  generationId: string;
  draft: Prisma.InputJsonValue;
  generatingModel: string;
  promptVersion: string;
}): Promise<void> {
  await prisma.briefGeneration.update({
    where: { id: generationId },
    data: {
      draftJson: draft,
      generatingModel,
      promptVersion,
      stage: GenerationStage.verifying,
    },
  });
}

/**
 * A terminal failure. Never a silent skip and never a swallowed error — the
 * officer is told, and the row records which of the three reasons it was.
 *
 * A 429 never lands here: a rate limit preserves the attempt so it can be
 * resumed (§13.4), which is why `GenerationFailureReason` has no value for it.
 */
export async function failBriefGeneration({
  generationId,
  reason,
}: {
  generationId: string;
  reason: GenerationFailureReason;
}): Promise<void> {
  await prisma.briefGeneration.update({
    where: { id: generationId },
    data: { stage: GenerationStage.failed, failureReason: reason },
  });
}
