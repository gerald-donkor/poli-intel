import { BriefType } from "@/lib/generated/prisma/enums";

/**
 * The five brief types and their length targets, spec §3.4's output-type table
 * verbatim.
 *
 * LENGTH IS PART OF THE CONTRACT, NOT A SUGGESTION (AGENTS.md §16.1). The target
 * travels into the generation prompt and is also what the form shows the officer
 * before they choose, so both halves read the same numbers.
 *
 * Not server-only, deliberately: this is a taxonomy table with no credentials
 * and no prompt instructions in it, and one config location (§16.1) is worth
 * more than keeping a few hundred bytes out of the client bundle. The system
 * prompt itself stays server-only in `brief-prompt.ts`.
 */

export type BriefTypeProfile = {
  label: string;
  /** Human length target, e.g. "4–6 pages". Rendered, and sent to the model. */
  lengthTarget: string;
  /** Who it is for and what shape it takes — spec §3.4, condensed for the form. */
  description: string;
  /**
   * Approximate word budget the prompt states alongside the page count. A page
   * count means nothing to a model that emits no pages; ~450 words per page is
   * the conversion, stated once here rather than guessed per call.
   */
  approximateWords: string;
};

export const BRIEF_TYPE_PROFILES: Record<BriefType, BriefTypeProfile> = {
  [BriefType.policy_brief]: {
    label: "Policy brief",
    lengthTarget: "4–6 pages",
    description:
      "For ministry officials and senior government advisors. Problem, evidence, recommendations, implementation notes.",
    approximateWords: "1,800–2,700 words",
  },
  [BriefType.technical_submission]: {
    label: "Technical submission",
    lengthTarget: "8–15 pages",
    description:
      "For formal consultation processes such as EUDR implementing acts or NDC revisions. Citations, methodology notes, annexes.",
    approximateWords: "3,600–6,750 words",
  },
  [BriefType.position_paper]: {
    label: "Position paper",
    lengthTarget: "2–3 pages",
    description:
      "For multi-stakeholder dialogue sessions. Summarises the Tropenbos stance with key evidence points.",
    approximateWords: "900–1,350 words",
  },
  [BriefType.stakeholder_note]: {
    label: "Stakeholder note",
    lengthTarget: "1 page",
    description:
      "For company sustainability teams, donor programme officers, or community leaders. Plain language, action-oriented.",
    approximateWords: "400–500 words",
  },
  [BriefType.media_backgrounder]: {
    label: "Media backgrounder",
    lengthTarget: "1 page",
    description:
      "Key statistics and quotes for journalists covering forest and cocoa stories in Ghana.",
    approximateWords: "400–500 words",
  },
};

/** Ordered as spec §3.4 lists them — longest-standing format first. */
export const BRIEF_TYPE_OPTIONS = Object.values(BriefType).map((value) => ({
  value,
  ...BRIEF_TYPE_PROFILES[value],
}));

export function briefTypeLabel(briefType: BriefType): string {
  return BRIEF_TYPE_PROFILES[briefType].label;
}
