import "server-only";

import {
  partitionByClassification,
  type GateRefusal,
} from "@/lib/governance/gate";
import type { Classification } from "@/lib/generated/prisma/enums";

import { GENERATION_EVIDENCE_EXCERPT_CHARS } from "./config";

/**
 * THE THIRD DOOR — the one generation and the fact-check pass both go through.
 *
 * `evidence-governance` requires the AI layer to expose no function that accepts
 * raw evidence. `generateBrief` and `factCheckDraft` therefore accept the
 * branded `GatedEvidenceContext` and nothing else, and the ONLY constructor of
 * that type is `gateEvidenceForGeneration`, which calls
 * `partitionByClassification` itself. A caller cannot forget the gate, because
 * there is no unchecked way to build the argument.
 *
 * WHOLE-RUN REFUSAL, not a filter. If any selected item is ineligible the run is
 * refused entirely rather than quietly generated from the remainder: the officer
 * chose that evidence deliberately, and a brief silently drafted from a
 * different set than the one on screen is exactly the kind of untraceability
 * this product exists to prevent.
 *
 * There is no bypass, no `force`, no env var, and no dev branch (§7.7).
 *
 * LOGGING: refusals carry ids and classifications only. No title, no excerpt, no
 * body text leaves here (§7.6, §13.9).
 */

/** What one evidence item contributes to a model call. */
export type EvidenceContextItem = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  country: string | null;
  impactArea: string | null;
  sourceType: string;
  citationKey: string;
  /** Bounded at `GENERATION_EVIDENCE_EXCERPT_CHARS`. Never the whole document. */
  excerpt: string;
};

/** What the gate is handed: the item, plus the one field it judges. */
export type EvidenceContextCandidate = Omit<EvidenceContextItem, "excerpt"> & {
  classification: Classification;
  fullText: string;
};

declare const gatedBrand: unique symbol;

/**
 * A set of evidence items that has passed the classification gate. The brand is
 * unforgeable outside this module, so `as GatedEvidenceContext` is the only way
 * to fake one — and that is a deliberate act, not an oversight.
 */
export type GatedEvidenceContext = readonly EvidenceContextItem[] & {
  readonly [gatedBrand]: true;
};

export type EvidenceGateOutcome =
  | { ok: true; context: GatedEvidenceContext }
  | { ok: false; refused: GateRefusal[] };

/**
 * The only constructor. Partitions, refuses the whole run if anything was
 * refused, and bounds each item's excerpt on the way through.
 */
export function gateEvidenceForGeneration(
  candidates: readonly EvidenceContextCandidate[],
): EvidenceGateOutcome {
  const { eligible, refused } = partitionByClassification(candidates);

  if (refused.length > 0) return { ok: false, refused };

  const context = eligible.map(toContextItem) as unknown as GatedEvidenceContext;

  return { ok: true, context };
}

function toContextItem(candidate: EvidenceContextCandidate): EvidenceContextItem {
  const text = candidate.fullText.trim();

  return {
    id: candidate.id,
    title: candidate.title,
    authors: candidate.authors,
    year: candidate.year,
    country: candidate.country,
    impactArea: candidate.impactArea,
    sourceType: candidate.sourceType,
    citationKey: candidate.citationKey,
    excerpt:
      text.length > GENERATION_EVIDENCE_EXCERPT_CHARS
        ? `${text.slice(0, GENERATION_EVIDENCE_EXCERPT_CHARS).trimEnd()}…`
        : text,
  };
}
