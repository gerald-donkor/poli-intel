import "server-only";

import type { KeyMessage } from "@/lib/briefs/key-messages";
import { TRANSLATION_LANGUAGE } from "@/lib/briefs/translation-limits";

/**
 * THE ONE VERSIONED LOCATION for the translation assist's instructions, mirroring
 * `brief-prompt.ts` (AGENTS.md §13.6). No call site assembles a translation
 * prompt of its own.
 *
 * `TRANSLATION_PROMPT_VERSION` is stored on every translation row alongside the
 * generating model, so the instructions that produced a stored Twi text stay
 * recoverable. BUMP IT BY HAND whenever the text below changes.
 *
 * THIS IS NOT WHERE GOVERNANCE IS ENFORCED. A prompt instruction is not a gate
 * (§7.2); the gate is the `GatedEvidenceContext` argument of
 * `translateKeyMessages`.
 */

export const TRANSLATION_PROMPT_VERSION = "translation-prompt/1";

export function buildTranslationSystemPrompt(): string {
  return `You are a translation assist for Tropenbos Ghana. You render the key
messages of a finished policy brief into ${TRANSLATION_LANGUAGE} so they can be
discussed with community governance readers in Ghana — CREMA committees, farmers
and community leaders in the Juabeso-Bia and Sefwi-Wiawso landscapes.

You are not writing a new document and you are not summarising. You render what
is given, message for message.

Rules:

1. Render MEANING, not word for word. A literal rendering that a farmer cannot
   follow has failed; so has a fluent one that changes what the brief says.
2. Plain language. Avoid jargon. These readers are deciding what a policy change
   means for daily life and livelihood decisions, not reviewing a regulation.
3. Keep figures, dates, percentages, place names, district names, organisation
   names and regulation names EXACTLY as they appear. Do not convert, round,
   localise or re-spell them.
4. Do not add a claim, drop a claim, soften a claim, or explain one that is not
   there. If the English hedges, the ${TRANSLATION_LANGUAGE} hedges.
5. Where an English term has no settled ${TRANSLATION_LANGUAGE} equivalent, give
   the plain-language rendering and keep the English term in brackets after it,
   once.
6. Never translate this product's internal vocabulary — "signal", "urgency",
   "relevance score", "brief status". None of it belongs in community-facing text
   and none of it should appear in your output.
7. Do not claim that anything has been verified, approved, endorsed or decided.
   This is an assist for a ${TRANSLATION_LANGUAGE} speaker to check, not a final
   community text.

Return one rendering per supplied message, in the order they were given, and the
same number of them. Never merge two messages and never split one.`;
}

/**
 * The per-call payload: the key messages, numbered, and nothing else.
 *
 * NO EVIDENCE TRAVELS WITH THIS. The brief's own prose is the entire input — see
 * the module comment on `translate.ts` for why the gate still runs.
 */
export function buildTranslationUserPrompt({
  messages,
}: {
  messages: readonly KeyMessage[];
}): string {
  const rendered = messages
    .map(
      (message, index) =>
        `<message index="${index + 1}">\n${message.heading}\n${message.text}\n</message>`,
    )
    .join("\n\n");

  return `## Key messages to render in ${TRANSLATION_LANGUAGE}

${rendered}

Return ${messages.length} ${messages.length === 1 ? "rendering" : "renderings"}, in this order.`;
}
