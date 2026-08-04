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

/* ---------------------------------------------------------------------------
 * The map
 * ------------------------------------------------------------------------- */

/**
 * The map's own copy.
 *
 * A PATH IS *RECORDED*, NEVER PROVEN (§8.8). The map draws stored relations
 * between rows a person already chose; it finds nothing, infers nothing, and
 * establishes nothing. An unverified path is a lead nobody has confirmed yet —
 * it is not an error, and nothing on this screen is red.
 */
export const IMPACT_MAP_COPY = {
  heading: "The paths",
  intro:
    "Each line is a stored relation, not an inference: the evidence a brief cited, and the outcome someone recorded against that brief.",
  columns: {
    evidence: "Evidence",
    brief: "Brief",
    outcome: "Outcome",
  },
  legendVerified: "Solid — confirmed by the Programme Director",
  legendUnverified: "Dashed — recorded, not yet confirmed",
  replay: "Replay the paths",
  summaryHeading: "Every path on the map, in words",
  noEvidenceRecorded: "no evidence set recorded for this brief",
} as const;

/** What the SVG itself announces before the hidden list is read. */
export function impactMapAriaLabel(pathCount: number, outcomeCount: number) {
  return `Diagram of ${pathCount} recorded ${
    pathCount === 1 ? "path" : "paths"
  } from evidence through briefs to ${outcomeCount} ${
    outcomeCount === 1 ? "outcome" : "outcomes"
  }. The same information is listed as text below.`;
}

/** "3 Aug 2026" — the same short form the signal board uses. */
export function formatInfluenceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
