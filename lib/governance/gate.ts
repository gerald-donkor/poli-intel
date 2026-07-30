import "server-only";

import { Classification } from "@/lib/generated/prisma/enums";

/**
 * THE GOVERNANCE GATE (AGENTS.md §7, `evidence-governance`).
 *
 * One structural chokepoint, not a check scattered across call sites. The AI
 * layer exposes no function that accepts raw evidence: the only way in is to
 * hand candidates to `partitionByClassification` and deal with both halves of
 * what comes back. A caller cannot forget to check, because there is no
 * unchecked door to forget.
 *
 * Nothing in this file calls Gemini. It ships here in its retrieval-filter
 * capacity — `ELIGIBLE_EVIDENCE_WHERE` is consumed by `lib/db/evidence.ts` so
 * untagged evidence is not searchable (§7.5) — and the embedding pass that
 * arrives next consumes the partition function through the same one fact.
 *
 * NO BYPASS. There is no `force` parameter, no env var, no config key, no
 * dev-mode branch, and no anticipatory paid-tier path. The gate lifts only by a
 * deliberate change to AGENTS.md §7 and to the `evidence-governance` skill —
 * never by a flag (§7.7). Do not add one.
 */

/** Refusal is data, never a throw and never a silent skip (§7.2). */
export type GateRefusal = {
  id: string;
  classification: Classification;
  reason: "ineligible_classification";
};

export type GateResult<T> = {
  eligible: T[];
  refused: GateRefusal[];
};

/** The minimum a candidate must carry to be judged. */
export type GateCandidate = {
  id: string;
  classification: Classification;
};

/**
 * Partition candidates into what may reach a model and what may not.
 *
 * Eligibility is `public_published` and nothing else — no trusted-source
 * exemption, no `.gov.gh` shortcut, no "obviously public" inference.
 *
 * Refusals carry the id and the classification only. Never the text that was
 * refused, in the return value or anywhere downstream of it (§7.6).
 */
export function partitionByClassification<T extends GateCandidate>(
  candidates: readonly T[],
): GateResult<T> {
  const eligible: T[] = [];
  const refused: GateRefusal[] = [];

  for (const candidate of candidates) {
    if (candidate.classification === Classification.public_published) {
      eligible.push(candidate);
    } else {
      refused.push({
        id: candidate.id,
        classification: candidate.classification,
        reason: "ineligible_classification",
      });
    }
  }

  return { eligible, refused };
}

/**
 * The retrieval half of the same one fact.
 *
 * Spread into every Prisma `where` that feeds the Evidence Library, the
 * Evidence Matcher, or anything that will later be handed to a model, so
 * "only eligible evidence is searchable" and "only eligible evidence reaches a
 * model" cannot drift apart into two rules.
 */
export const ELIGIBLE_EVIDENCE_WHERE = {
  classification: Classification.public_published,
} as const;

/**
 * The classification a newly ingested item is held at until a Research Officer
 * tags it. Stated here for readability at call sites that surface the queue —
 * the actual default lives in `prisma/schema.prisma`, and application code
 * never sets an item's initial classification (§7.3, §12.2).
 */
export const PENDING_CLASSIFICATION = Classification.unpublished_internal;
