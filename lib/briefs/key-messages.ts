import { parseBriefBody } from "./body";
import { TRANSLATION_MAX_MESSAGES } from "./translation-limits";

/**
 * The two blocks a community reader acts on: the executive summary, and each
 * recommendation.
 *
 * `brief-output` rule 6 says the translation assist renders KEY MESSAGES, not
 * the whole brief, so this is where "key messages" is given a single definition.
 * Everything here reads `parseBriefBody`'s blocks — THERE IS NO SECOND PARSER of
 * the stored body, because a second one would drift from the assembler and ship
 * half a translation without anyone noticing.
 *
 * THE HEADINGS BELOW ARE `assembleBodyText`'s LITERALS (lib/ai/generate-brief.ts).
 * They are restated rather than imported for the same reason `body.ts` restates
 * the block contract rather than importing it: that module is `server-only` and
 * this one is not. Change the assembler's section order and you must change
 * these — the extraction is silent when they disagree, which is why the two
 * lists sit under one comment here.
 *
 *   title
 *   Executive summary + prose      <- taken
 *   Context + prose
 *   Evidence                       (divider)
 *   ...findings
 *   Recommendations                (divider)
 *   ...recommendations             <- taken, heading = decision-maker
 *   Implementation pathway + prose (where the recommendations stop)
 *   About Tropenbos Ghana + prose
 *   Evidence gaps                  (optional)
 *
 * Pure, client-visible, and holds no governance rule (§10.10). It decides what
 * text a translation would cover, never whether one may run.
 */

const EXECUTIVE_SUMMARY_HEADING = "Executive summary";
const RECOMMENDATIONS_HEADING = "Recommendations";
const IMPLEMENTATION_PATHWAY_HEADING = "Implementation pathway";

export type KeyMessageKind = "executive_summary" | "recommendation";

export type KeyMessage = {
  kind: KeyMessageKind;
  /** "Executive summary", or the recommendation's decision-maker. */
  heading: string;
  text: string;
};

export type KeyMessageExtraction = {
  messages: KeyMessage[];
  /**
   * Key messages beyond `TRANSLATION_MAX_MESSAGES`. Named in the panel — a cap
   * that bites silently is a community reading a shorter list than the brief
   * makes.
   */
  omitted: number;
};

export function extractKeyMessages(bodyText: string): KeyMessageExtraction {
  const { blocks } = parseBriefBody(bodyText);

  const messages: KeyMessage[] = [];

  const summary = blocks.find(
    (block) =>
      block.heading === EXECUTIVE_SUMMARY_HEADING && block.body.trim() !== "",
  );

  if (summary) {
    messages.push({
      kind: "executive_summary",
      heading: summary.heading,
      text: summary.body.trim(),
    });
  }

  // The divider, which carries no prose of its own. A block that merely starts
  // with the word would be a finding, not the section.
  const start = blocks.findIndex(
    (block) => block.heading === RECOMMENDATIONS_HEADING && block.body === "",
  );

  if (start !== -1) {
    for (const block of blocks.slice(start + 1)) {
      if (block.heading === IMPLEMENTATION_PATHWAY_HEADING) break;
      if (block.body.trim() === "") continue;

      messages.push({
        kind: "recommendation",
        heading: block.heading,
        text: block.body.trim(),
      });
    }
  }

  return {
    messages: messages.slice(0, TRANSLATION_MAX_MESSAGES),
    omitted: Math.max(0, messages.length - TRANSLATION_MAX_MESSAGES),
  };
}
