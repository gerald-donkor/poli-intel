import "server-only";

import { ThinkingLevel } from "@google/genai";
import type { z } from "zod";

import {
  GENERATION_INVALID_OUTPUT_RETRIES,
  GENERATION_MAX_OUTPUT_TOKENS,
  GENERATION_MODEL,
  GENERATION_TEMPERATURE,
} from "./config";
import { getGeminiClient, toGeminiRequestFailure } from "./gemini";

/**
 * Shared plumbing for the two structured-output calls — generation and the
 * fact-check pass. Same relationship to those two as `gemini.ts` has to the two
 * embedding paths: one copy of the validate-and-retry rule, so it cannot drift.
 *
 * NOTHING HERE IS A DOOR INTO THE MODEL FOR EVIDENCE. It takes an
 * already-assembled prompt string and has no idea what evidence is. The gate
 * sits one layer up, in the `GatedEvidenceContext` type that `generate-brief.ts`
 * and `fact-check.ts` are the only accepted way to build a prompt from
 * (`lib/ai/evidence-context.ts`, AGENTS.md §7.2).
 *
 * LOGGING: nothing here logs the prompt, the completion, or a caught error's
 * message (§7.6, §13.9).
 */

export type StructuredCallFailure =
  | { reason: "missing_api_key" }
  | { reason: "rate_limited"; retryAfterMs: number }
  | { reason: "request_failed"; status: number | null }
  /** Two validation failures in a row. Recorded as a failed generation (§9.4). */
  | { reason: "invalid_output" };

export type StructuredCallResult<T> =
  | { ok: true; value: T; model: string }
  | { ok: false; failure: StructuredCallFailure };

/**
 * Call Gemini for JSON matching `schema`, and validate the response with that
 * same schema before returning it.
 *
 * NEVER PERSIST UNVALIDATED MODEL OUTPUT (§9.4, §13.8). There is no `as` cast
 * past a parse failure and no `any` here: a response that does not parse is
 * retried `GENERATION_INVALID_OUTPUT_RETRIES` times and then becomes a typed
 * `invalid_output` failure the caller records.
 *
 * A 429 is NOT retried in-process. The caller owns that decision because it owns
 * the draft: the degradation contract is to preserve what exists and tell the
 * person when to try again (§13.4), not to hold a request open for minutes.
 */
export async function callStructured<T>({
  systemPrompt,
  userPrompt,
  schema,
}: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
}): Promise<StructuredCallResult<T>> {
  const ai = getGeminiClient();

  if (!ai) return { ok: false, failure: { reason: "missing_api_key" } };

  const responseJsonSchema = toGeminiJsonSchema(schema);

  for (
    let attempt = 0;
    attempt <= GENERATION_INVALID_OUTPUT_RETRIES;
    attempt += 1
  ) {
    let text: string | undefined;

    try {
      const response = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature: GENERATION_TEMPERATURE,
          maxOutputTokens: GENERATION_MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          responseJsonSchema,
          // The token cap is a fixed contract (spec §3.4) and on a thinking
          // model it is shared with reasoning tokens. Minimal thinking spends
          // the cap on the document the officer is waiting for. Both calls in
          // this pair are constrained reading-and-writing tasks over supplied
          // text, not open reasoning problems.
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });

      text = response.text;
    } catch (error) {
      return { ok: false, failure: toGeminiRequestFailure(error) };
    }

    const parsed = parseStructured(text, schema);

    if (parsed.ok) {
      return { ok: true, value: parsed.value, model: GENERATION_MODEL };
    }
  }

  return { ok: false, failure: { reason: "invalid_output" } };
}

function parseStructured<T>(
  text: string | undefined,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false } {
  if (text === undefined || text.trim().length === 0) return { ok: false };

  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    // A truncated or non-JSON body. Never a partial save, never a repair pass.
    return { ok: false };
  }

  const result = schema.safeParse(raw);

  return result.success ? { ok: true, value: result.data } : { ok: false };
}

/**
 * Gemini's `responseJsonSchema` accepts a documented SUBSET of JSON Schema. The
 * installed SDK (`@google/genai` 2.15.0) lists it on `GenerationConfig`:
 *
 *   $id, $defs, $ref, $anchor, type, format, title, description, enum, items,
 *   prefixItems, minItems, maxItems, minimum, maximum, anyOf, oneOf, properties,
 *   additionalProperties, required, and the non-standard propertyOrdering.
 *
 * `z.toJSONSchema` emits more than that — `$schema`, `minLength`, `pattern` —
 * so anything outside the list is stripped before the request. The constraints
 * are not lost: the SAME Zod schema validates the response afterwards, which is
 * where they were doing the real work anyway.
 */
function toGeminiJsonSchema(schema: z.ZodType<unknown>): unknown {
  return stripUnsupported(schema.toJSONSchema({ io: "output" }));
}

const SUPPORTED_KEYWORDS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

/** Keys under these are property NAMES, not keywords, and are never filtered. */
const NAME_KEYED_KEYWORDS = new Set(["properties", "$defs"]);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);

  if (node === null || typeof node !== "object") return node;

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    if (!SUPPORTED_KEYWORDS.has(key)) continue;

    out[key] = NAME_KEYED_KEYWORDS.has(key)
      ? mapValues(value, stripUnsupported)
      : stripUnsupported(value);
  }

  return out;
}

function mapValues(node: unknown, fn: (value: unknown) => unknown): unknown {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return node;
  }

  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, fn(value)]),
  );
}
