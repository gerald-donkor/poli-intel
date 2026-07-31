import { BriefAudience } from "@/lib/generated/prisma/enums";

/**
 * THE ONE CONFIG LOCATION for the five audience profiles (AGENTS.md §16.3).
 * Framing emphasis and tone are spec §3.4's audience-tailoring table verbatim.
 *
 * Read by two callers and no others: the generation prompt assembly
 * (`brief-prompt.ts`) and the generation form, which shows the officer what each
 * choice will do before they make it. Both read the same rows, so the form can
 * never describe a framing the model was not given.
 *
 * Not server-only, deliberately — see the same note in `brief-types.ts`.
 *
 * These are the FIVE BRIEF audiences, keyed by `BriefAudience`. A policy
 * signal's own targeting uses `AudienceTarget`, which is a different and
 * deliberately separate list (see the enum comments in schema.prisma).
 */

export type AudienceProfile = {
  label: string;
  /** Spec §3.4, "Framing emphasis" column. */
  framingEmphasis: string;
  /** Spec §3.4, "Tone & format" column. */
  tone: string;
};

export const AUDIENCE_PROFILES: Record<BriefAudience, AudienceProfile> = {
  [BriefAudience.ghana_ministry_official]: {
    label: "Ghana ministry official",
    framingEmphasis:
      "National policy alignment, Ghana NDC commitments, forest cover targets, political feasibility",
    tone: "Formal, deferential, concise. Bullet recommendations. Clear ask.",
  },
  [BriefAudience.cocoa_company_sustainability]: {
    label: "Cocoa company (sustainability team)",
    framingEmphasis:
      "EUDR compliance risk, supply chain traceability, smallholder farmer relationships, reputational risk",
    tone: "Business-oriented, risk/opportunity framing, data-heavy. One-pager preferred.",
  },
  [BriefAudience.eu_regulator]: {
    label: "EU regulator / DG ENV",
    framingEmphasis:
      "Implementing regulation detail, smallholder protection gaps, Ghana country evidence, precedent from the TBI network",
    tone: "Technical, evidenced, references to specific regulation articles. Formal submission format.",
  },
  [BriefAudience.donor_programme_officer]: {
    label: "Donor / programme officer",
    framingEmphasis:
      "Impact evidence, contribution to global climate targets, value for money, sustainability beyond project",
    tone: "Narrative-led, impact stories, aligned to the donor's own reporting framework.",
  },
  [BriefAudience.crema_community_governance]: {
    label: "Community governance (CREMA)",
    framingEmphasis:
      "Rights, local benefit-sharing, what the policy change means for daily life and livelihood decisions",
    // Spec §3.4 adds "translated to Twi where needed" here. That is the
    // translation assist (§16.6) — a separate, on-demand Gemini call over the
    // finished brief, not an instruction to the generator to write in Twi. It
    // returns to this row when that feature ships.
    tone: "Plain language, local context. Avoid jargon.",
  },
};

/** Declaration order is spec §3.4's table order. */
export const AUDIENCE_OPTIONS = Object.values(BriefAudience).map((value) => ({
  value,
  ...AUDIENCE_PROFILES[value],
}));

export function audienceLabel(audience: BriefAudience): string {
  return AUDIENCE_PROFILES[audience].label;
}
