import {
  InfluenceDetectionMethod,
  InfluenceEventType,
} from "@/lib/generated/prisma/enums";

/**
 * How the Impact Tracker's enums read on screen and in the digest.
 *
 * KEYED OFF THE PRISMA ENUMS, never a re-declared string union (§12.7). A value
 * added to the schema is a type error here until it is given words, which is the
 * point.
 *
 * THE COPY NEVER IMPLIES THE SYSTEM DECIDED ANYTHING (§8.8). A detected event
 * was *found*; a person *logged* it; a Programme Director *confirmed* it. The
 * product does not verify, endorse, or establish influence.
 */

export const INFLUENCE_EVENT_TYPE_LABELS: Record<InfluenceEventType, string> = {
  [InfluenceEventType.policy_citation]: "Cited in a policy document",
  [InfluenceEventType.legislation_aligned]: "Legislation aligned",
  [InfluenceEventType.company_commitment]: "Company commitment",
  [InfluenceEventType.dialogue_outcome]: "Dialogue outcome",
  [InfluenceEventType.national_strategy]: "National strategy",
};

/** Declaration order, which is spec §3.5's order. Nothing re-sorts it. */
export const INFLUENCE_EVENT_TYPE_ORDER: readonly InfluenceEventType[] = [
  InfluenceEventType.policy_citation,
  InfluenceEventType.legislation_aligned,
  InfluenceEventType.company_commitment,
  InfluenceEventType.dialogue_outcome,
  InfluenceEventType.national_strategy,
];

/** What the form's select says, one line each, in plain language. */
export const INFLUENCE_EVENT_TYPE_HINTS: Record<InfluenceEventType, string> = {
  [InfluenceEventType.policy_citation]:
    "A policy document, consultation response or official notice refers to the brief.",
  [InfluenceEventType.legislation_aligned]:
    "Legislation or a legislative instrument matches its recommendation.",
  [InfluenceEventType.company_commitment]:
    "A company or industry body made a public commitment.",
  [InfluenceEventType.dialogue_outcome]:
    "A stakeholder dialogue or convening recorded an outcome.",
  [InfluenceEventType.national_strategy]:
    "Text in a national strategy or plan reflects it.",
};

export const DETECTION_METHOD_LABELS: Record<InfluenceDetectionMethod, string> =
  {
    [InfluenceDetectionMethod.logged_by_person]: "Logged by a person",
    [InfluenceDetectionMethod.detected_by_search]: "Found by the weekly search",
  };

/** "3 Aug 2026" — the same short form the signal board uses. */
export function formatInfluenceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
