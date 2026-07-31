import "server-only";

import { z } from "zod";

import { FlagReason } from "@/lib/generated/prisma/enums";

import {
  buildFactCheckSystemPrompt,
  buildFactCheckUserPrompt,
} from "./brief-prompt";
import type { GatedEvidenceContext } from "./evidence-context";
import { callStructured, type StructuredCallFailure } from "./structured";

/**
 * THE FACT-CHECK DOOR (`hallucination-guard`).
 *
 * The guard pass is a Gemini call that receives evidence context, so it is gated
 * exactly like generation — call type 8 in `evidence-governance`. It takes the
 * same `GatedEvidenceContext` and nothing else, and the caller passes THE SAME
 * CONTEXT THE GENERATOR SAW: the recorded evidence set for this brief, never the
 * library.
 *
 * ORDERING: this runs BEFORE the draft is persisted as reviewable (§9.1). The
 * only writer of a `Brief` row is the transaction in `lib/db/briefs.ts`, and its
 * only caller is the verify stage, after this has returned.
 *
 * LOGGING: nothing here logs the draft, the prompt, or evidence text.
 */

/**
 * One verdict per claim. A single enum rather than a boolean plus a nullable
 * reason: the two-field version can encode "unsupported with no reason" and
 * "supported with a reason", neither of which means anything, and a nullable
 * enum also needs a `null` type in the request schema that Gemini's
 * JSON-Schema subset does not document.
 *
 * The three non-supported values are `FlagReason` verbatim (spec §4.1), so a
 * verdict maps to a stored flag without a translation table that could drift.
 */
const VERDICTS = [
  "supported",
  FlagReason.unsupported,
  FlagReason.altered,
  FlagReason.misattributed,
] as const;

const factCheckResponseSchema = z.object({
  claims: z.array(
    z.object({
      /** Verbatim from the draft body — it is the re-anchoring key (§9.3). */
      claimText: z.string().min(1),
      verdict: z.enum(VERDICTS),
      checkedEvidenceItemIds: z.array(z.string()),
    }),
  ),
});

/** An unsupported claim, ready to become a `HallucinationFlag` row. */
export type UnsupportedClaim = {
  claimText: string;
  reason: FlagReason;
  checkedEvidenceItemIds: string[];
};

export type FactCheckResult =
  | {
      ok: true;
      /** How many claims were examined — a count, never the claims themselves. */
      claimsChecked: number;
      unsupported: UnsupportedClaim[];
    }
  | { ok: false; failure: StructuredCallFailure };

export async function factCheckDraft({
  bodyText,
  context,
}: {
  bodyText: string;
  context: GatedEvidenceContext;
}): Promise<FactCheckResult> {
  const result = await callStructured({
    systemPrompt: buildFactCheckSystemPrompt(),
    userPrompt: buildFactCheckUserPrompt({ bodyText, context }),
    schema: factCheckResponseSchema,
  });

  if (!result.ok) return { ok: false, failure: result.failure };

  const suppliedIds = new Set(context.map((item) => item.id));

  const unsupported = result.value.claims.flatMap((claim) => {
    if (claim.verdict === "supported") return [];

    return [
      {
        claimText: claim.claimText,
        reason: claim.verdict,
        // Ids are filtered to the set actually supplied. An id the checker
        // invented would otherwise be stored as though a real item had been
        // weighed, and the flag panel would show a source that does not exist.
        checkedEvidenceItemIds: claim.checkedEvidenceItemIds.filter((id) =>
          suppliedIds.has(id),
        ),
      },
    ];
  });

  return {
    ok: true,
    claimsChecked: result.value.claims.length,
    unsupported,
  };
}

/**
 * Where a flag sits in `bodyText`.
 *
 * ANCHORS ARE CHARACTER OFFSETS INTO `bodyText` IN THIS PROMPT, and
 * `BriefVersion.documentJson` stays null. The editor prompt builds the Tiptap
 * document and maps these offsets to Tiptap positions there; `claimText` is what
 * makes that mapping possible, and is also the schema's stated re-anchoring key
 * when ordinary editing shifts positions.
 *
 * `0/0` means the claim could not be located exactly — usually because the
 * checker paraphrased instead of copying. The flag is still recorded and still
 * rendered from `claimText`; only the highlight position is unavailable.
 */
export function anchorClaim(
  bodyText: string,
  claimText: string,
): { anchorFrom: number; anchorTo: number } {
  const index = bodyText.indexOf(claimText);

  if (index === -1) return { anchorFrom: 0, anchorTo: 0 };

  return { anchorFrom: index, anchorTo: index + claimText.length };
}
