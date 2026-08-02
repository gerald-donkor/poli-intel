import "server-only";

import { z } from "zod";

import type { KeyMessage } from "@/lib/briefs/key-messages";

import type { GatedEvidenceContext } from "./evidence-context";
import { callStructured, type StructuredCallFailure } from "./structured";
import {
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
  TRANSLATION_PROMPT_VERSION,
} from "./translation-prompt";

/**
 * THE TRANSLATION DOOR — call type 7 of `evidence-governance`'s eight.
 *
 * WHAT IS TRANSMITTED: the brief's own key messages, and nothing else. No
 * evidence body text, no excerpt, no chunk leaves this module. `context` is
 * never rendered into a prompt.
 *
 * WHY IT TAKES `GatedEvidenceContext` ANYWAY, and why deleting the seemingly
 * unused argument would silently remove the gate:
 *
 *   The prose being sent is DERIVED FROM that evidence — the brief's findings
 *   are that evidence restated. Transmitting derived text about newly-restricted
 *   community data to an API whose terms permit training on it is exactly what
 *   §7 exists to prevent, and §7.8 already makes the same call for audience
 *   switching. Requiring the branded type here is what keeps the AI layer's
 *   invariant intact: no exported function in this layer accepts input that has
 *   not been through `gateEvidenceForGeneration`. Being cleared once when the
 *   brief was written does not clear the evidence forever.
 *
 * The output is Zod-validated before it leaves this module, and the array length
 * must equal the number of messages sent — a translation that silently drops a
 * recommendation is worse than one that fails (§9.4, §13.8).
 *
 * LOGGING: model, counts, latency, outcome. Never the English, never the Twi,
 * never an evidence excerpt (§7.6, §13.9).
 */

/**
 * One rendering per supplied message, positionally.
 *
 * The length is fixed on the REQUEST schema (`minItems`/`maxItems`, both inside
 * Gemini's JSON-Schema subset) as well as on the response validation, so the
 * model is told the constraint rather than only being judged against it. This is
 * the same instinct as `draftSchemaFor`'s citation check in `generate-brief.ts`:
 * output that does not correspond to what was supplied is invalid, not
 * salvageable.
 */
function translationSchemaFor(count: number) {
  return z.object({
    messages: z
      .array(z.object({ twi: z.string().min(1) }))
      .length(count),
  });
}

export type TranslateKeyMessagesResult =
  | {
      ok: true;
      /** One rendering per input message, in the order they were supplied. */
      translations: string[];
      generatingModel: string;
      promptVersion: string;
    }
  | { ok: false; failure: StructuredCallFailure };

export async function translateKeyMessages({
  messages,
  context,
}: {
  messages: readonly KeyMessage[];
  /** Proof the gate ran. Not transmitted — see the module comment. */
  context: GatedEvidenceContext;
}): Promise<TranslateKeyMessagesResult> {
  const started = Date.now();

  const result = await callStructured({
    systemPrompt: buildTranslationSystemPrompt(),
    userPrompt: buildTranslationUserPrompt({ messages }),
    schema: translationSchemaFor(messages.length),
  });

  if (!result.ok) {
    console.warn("brief.translation.failed", {
      reason: result.failure.reason,
      messageCount: messages.length,
      gatedEvidenceCount: context.length,
      elapsedMs: Date.now() - started,
    });

    return { ok: false, failure: result.failure };
  }

  console.info("brief.translation.rendered", {
    model: result.model,
    promptVersion: TRANSLATION_PROMPT_VERSION,
    messageCount: messages.length,
    gatedEvidenceCount: context.length,
    elapsedMs: Date.now() - started,
  });

  return {
    ok: true,
    translations: result.value.messages.map((message) => message.twi),
    generatingModel: result.model,
    promptVersion: TRANSLATION_PROMPT_VERSION,
  };
}
