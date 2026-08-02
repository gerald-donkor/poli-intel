import {
  AudienceTarget,
  EvidenceMatchOutcome,
  Geography,
  ImpactArea,
  Relevance,
  Urgency,
} from "@/lib/generated/prisma/enums";

/**
 * Presentation labels for the signal enums, derived from the Prisma enums rather
 * than re-declared as string unions (AGENTS.md §12.7).
 *
 * Copy never implies the system decided anything (§8.8). A signal was *picked
 * up*, its urgency is a *suggestion a person can move*, and a match set is
 * *what retrieval found* — never a verdict.
 */

/**
 * The warm→cool ramp, in the order the enum declares and nothing else
 * re-sorts: immediate → near-term → horizon → watch (§11.4).
 *
 * THE ORDER CARRIES THE TAXONOMY. Never remap a stage to a different meaning,
 * and never re-order these columns by count, recency, or anything else.
 */
export const URGENCY_ORDER = [
  Urgency.immediate,
  Urgency.near_term,
  Urgency.horizon,
  Urgency.watch,
] as const;

export const URGENCY_LABELS: Record<Urgency, string> = {
  [Urgency.immediate]: "Immediate",
  [Urgency.near_term]: "Near-term",
  [Urgency.horizon]: "Horizon",
  [Urgency.watch]: "Watch",
};

/** The time window each stage means, so the column header says it in plain words. */
export const URGENCY_WINDOWS: Record<Urgency, string> = {
  [Urgency.immediate]: "under 4 weeks",
  [Urgency.near_term]: "1–3 months",
  [Urgency.horizon]: "3–6 months",
  [Urgency.watch]: "over 6 months",
};

/**
 * The ramp's utility classes, WRITTEN OUT IN FULL per stage.
 *
 * Tailwind 4 scans source for complete class strings, so `border-l-${ramp}` is a
 * class that never exists at runtime. These are literals for that reason, not
 * for want of a loop. The enum's `near_term` maps to the `nearterm` token — the
 * one place those two spellings meet, and the reason this table exists at all.
 *
 * `card` is the card's left rule and border; `eyebrow` is the small-caps text.
 * URGENCY APPEARS AS THOSE TWO AND NOTHING ELSE — never a filled card
 * background, which is what keeps board density readable (§11.5). `column` tints
 * only the column header and the drop target, never a card.
 */
export const URGENCY_RAMP: Record<
  Urgency,
  { card: string; eyebrow: string; column: string; over: string }
> = {
  [Urgency.immediate]: {
    card: "border-immediate-border border-l-immediate",
    eyebrow: "text-immediate",
    column: "border-immediate-border",
    over: "bg-immediate-surface",
  },
  [Urgency.near_term]: {
    card: "border-nearterm-border border-l-nearterm",
    eyebrow: "text-nearterm",
    column: "border-nearterm-border",
    over: "bg-nearterm-surface",
  },
  [Urgency.horizon]: {
    card: "border-horizon-border border-l-horizon",
    eyebrow: "text-horizon",
    column: "border-horizon-border",
    over: "bg-horizon-surface",
  },
  [Urgency.watch]: {
    card: "border-watch-border border-l-watch",
    eyebrow: "text-watch",
    column: "border-watch-border",
    over: "bg-watch-surface",
  },
};

/**
 * Relevance labels and their badge classes.
 *
 * A SEPARATE SCALE FROM URGENCY, and it never borrows the urgency ramp (§11.4,
 * `design-system` rule 2): core is a filled primary pill, adjacent is
 * surface-tint, background is stone.
 */
export const RELEVANCE_LABELS: Record<Relevance, string> = {
  [Relevance.core]: "Core",
  [Relevance.adjacent]: "Adjacent",
  [Relevance.background]: "Background",
};

export const RELEVANCE_BADGE: Record<Relevance, string> = {
  [Relevance.core]: "bg-primary text-card border-primary",
  [Relevance.adjacent]:
    "bg-surface-tint text-primary-ink border-surface-tint-border",
  [Relevance.background]: "bg-stone text-ink-2 border-line",
};

export const IMPACT_AREA_LABELS: Record<ImpactArea, string> = {
  [ImpactArea.restoration]: "Restoration",
  [ImpactArea.community_forestry]: "Community forestry",
  [ImpactArea.diversified_production]: "Diversified production",
  [ImpactArea.cross_cutting]: "Cross-cutting",
};

export const GEOGRAPHY_LABELS: Record<Geography, string> = {
  [Geography.ghana_national]: "Ghana, national",
  [Geography.cocoa_belt_landscapes]: "Cocoa-belt landscapes",
  [Geography.international]: "International",
  [Geography.multi_level]: "Multi-level",
};

export const AUDIENCE_TARGET_LABELS: Record<AudienceTarget, string> = {
  [AudienceTarget.ministry]: "Ministry",
  [AudienceTarget.cocobod]: "Cocobod",
  [AudienceTarget.eu_institutions]: "EU institutions",
  [AudienceTarget.private_sector]: "Private sector",
  [AudienceTarget.community_governance]: "Community governance",
};

/**
 * What a match run says happened, in the matcher's own register.
 *
 * `gap` is not a failure and is not worded as one: the search ran and the
 * eligible corpus has nothing close enough (`evidence-matcher` rule 4).
 */
export const MATCH_OUTCOME_LABELS: Record<EvidenceMatchOutcome, string> = {
  [EvidenceMatchOutcome.matched]: "Evidence matched",
  [EvidenceMatchOutcome.gap]: "No evidence above the threshold",
  [EvidenceMatchOutcome.failed]: "The match did not complete",
};

/**
 * A run's short machine reason, said in words.
 *
 * Reasons are written by the job as `rerank:<reason>` or a bare token, never as
 * free text and never as an API error message (§7.6). Anything unrecognised is
 * shown as-is rather than hidden — an unexplained state is worse than an
 * unfamiliar token.
 */
export function describeMatchFailure(reason: string | null): string {
  if (reason === null) return "No reason was recorded.";

  if (reason === "signal_not_embedded") {
    return "This signal has no stored vector, so there was nothing to search with. It predates the current radar.";
  }

  if (reason.startsWith("rerank:rate_limited")) {
    return "The daily allowance for the ranking step was spent. Re-matching later will pick it up.";
  }

  if (reason.startsWith("rerank:request_failed")) {
    return "The ranking step could not be reached. Re-matching will try again.";
  }

  if (reason === "rerank:invalid_output") {
    return "The ranking step returned something that could not be read. Re-matching will try again.";
  }

  if (reason === "rerank:missing_api_key") {
    return "The ranking step is not configured on this deployment.";
  }

  return reason;
}

export function formatSignalDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Audit timestamps need the minute, not just the day. */
export function formatSignalDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Scores render as a number AND a bar, never colour alone (§11.13). */
export function formatScore(value: number): string {
  return value.toFixed(2);
}
