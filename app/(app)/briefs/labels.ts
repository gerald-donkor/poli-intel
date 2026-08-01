import { BriefStatus, FlagReason, FlagStatus } from "@/lib/generated/prisma/enums";

/**
 * Presentation labels for the brief enums, derived from the Prisma enums rather
 * than re-declared as string unions (AGENTS.md §12.7).
 *
 * Brief-type and audience labels are NOT here: they live with their profiles in
 * `lib/ai/brief-types.ts` and `lib/ai/audience-profiles.ts`, so the form, the
 * prompt and the list all read one table (§16.1, §16.3).
 *
 * Copy never implies the system decided, approved or verified anything (§8.8).
 */

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  [BriefStatus.draft]: "Draft",
  [BriefStatus.reviewed]: "Reviewed",
  [BriefStatus.submitted]: "Submitted",
  [BriefStatus.published]: "Published",
};

/**
 * What a flag is saying, in the guard's own register: the claim needs a person's
 * eyes, not that it is false. "Not traceable to the supplied evidence" is right;
 * "incorrect" is not (`hallucination-guard`).
 */
export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  [FlagReason.unsupported]: "Not traceable to the supplied evidence",
  [FlagReason.altered]: "Differs from what the evidence states",
  [FlagReason.misattributed]: "Attributed to a source that does not say it",
};

export const FLAG_REASON_DETAIL: Record<FlagReason, string> = {
  [FlagReason.unsupported]:
    "Nothing in the evidence set passed to the generator states this. Check it against a source, or remove it.",
  [FlagReason.altered]:
    "The evidence says something close, but a figure, year, geography or denominator differs. Compare the two before this leaves the building.",
  [FlagReason.misattributed]:
    "The source named here does not appear to state this. Check the attribution.",
};

/**
 * What a closed flag says happened. A person checked the claim, or a person let
 * it through without checking — never that the system verified anything (§8.8).
 */
export const FLAG_STATUS_LABELS: Record<FlagStatus, string> = {
  [FlagStatus.open]: "Needs checking",
  [FlagStatus.resolved]: "Checked against a source",
  [FlagStatus.dismissed]: "Let through without a check",
};

/**
 * The Director's four moves, in their own words.
 *
 * "Send back" covers both of the spec's declining actions — sending back for
 * changes and rejecting — because the data model fixes `status` to four values.
 * The two are told apart by the reason recorded on the decision.
 */
export const BRIEF_TRANSITION_LABELS = {
  approve: "Approve",
  send_back: "Send back",
  submit: "Mark as submitted",
  publish: "Mark as published",
} as const;

export function formatGeneratedAt(iso: string | null): string {
  if (iso === null) return "Not recorded";

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A decision's timestamp — to the minute, because an audit trail needs one. */
export function formatDecisionAt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
