import "server-only";

import { ThinkingLevel } from "@google/genai";

import {
  GENERATION_MAX_OUTPUT_TOKENS,
  GENERATION_MODEL,
  GENERATION_TEMPERATURE,
} from "@/lib/ai/config";
import { getGeminiClient, toGeminiRequestFailure } from "@/lib/ai/gemini";
import { isHttpUrl } from "@/lib/net/url";

/**
 * THE ONE GROUNDED-SEARCH CALL, shared by the two features that make one: the
 * Policy Radar's news beat (`lib/radar/grounded.ts`) and the Impact Tracker's
 * weekly citation search (`lib/ai/detect-influence.ts`).
 *
 * IT WAS EXTRACTED, NOT COPIED. Prompt 21 verified this call against the live
 * API — the tool shape, the second-granularity timestamps, the redirect
 * resolution, the 429 mapping — and each of those was found the hard way. A
 * second copy would drift from the verified one, and the verified one is the
 * only one anybody has actually run.
 *
 * SERVER-ONLY, AND JOBS ONLY, exactly as its callers are (§18, §14.1).
 *
 * ── What this module is, and what it is not ───────────────────────────────
 * It takes a system prompt, a query, and a recency window, and returns PROSE
 * plus RESOLVED PUBLISHER SOURCES. It does not know what a signal is, what a
 * brief is, or what either caller intends to do with the result — each caller
 * owns its own extraction schema and its own mapping into its own domain.
 *
 * ── The tool config shape, verified ───────────────────────────────────────
 * `tools: [{ googleSearch: {...} }]`, verified against the INSTALLED SDK
 * (`@google/genai` 2.15.0, `Tool.googleSearch?: GoogleSearch`) and against the
 * live API on 2026-08-03. Google's current docs page shows
 * `tools: [{ type: "google_search" }]` instead — that is the SDK's SEPARATE
 * `interactions` surface (`Tool_2` in the type definitions), not
 * `models.generateContent`, and it is not what this call path uses. Read the
 * installed types before changing this.
 *
 * `timeRangeFilter` IS supported here (the type notes it is unsupported on
 * Vertex AI, not on the Gemini API) and the live call confirmed it, with one
 * undocumented constraint found the hard way: timestamps must be SECOND
 * granularity. A plain `toISOString()` carries milliseconds and the API rejects
 * it with `[FIELD_INVALID] Granularity of nano is not supported`.
 *
 * ── What may be sent (§7) ─────────────────────────────────────────────────
 * NOTHING IS DECIDED HERE. This module transmits the query string it is handed
 * and has no way to read evidence, a chunk, or a `full_text` — it takes strings
 * and has no database access. The governance decision belongs to each caller, at
 * the point where it builds its query, and both callers state it there:
 *   - the radar assembles from its static source registry;
 *   - the Impact Tracker assembles from a PUBLISHED brief's title, audience and
 *     type, behind an input type that cannot carry body text.
 *
 * WIDENING EITHER CALLER'S INPUT IS A DIFFERENT DATA PATH and must be
 * re-assessed against `evidence-governance` first.
 *
 * ── Google's grounding terms ──────────────────────────────────────────────
 * The reading recorded at length in `lib/radar/grounded.ts` applies to every
 * caller of this module and is not restated here: the model's prose is INPUT to
 * a further pass and is never persisted or redisplayed, so the "display the
 * Grounded Results with the Search Suggestions" requirement has nothing to
 * attach to. A caller that decides to STORE the model's prose brings both
 * clauses back into force, and that is not a small change.
 *
 * LOGGING: nothing here logs the query, the returned prose, or a caught error's
 * message (§7.6, §13.9).
 */

/** A grounded call reaches an external service; a slow one is a failed call. */
const GROUNDED_REQUEST_TIMEOUT_MS = 60_000;

/** Resolving one redirect is a HEAD request, not a page load. */
const REDIRECT_RESOLVE_TIMEOUT_MS = 10_000;

/**
 * The host Gemini hands back instead of a publisher's own URL.
 *
 * Grounding metadata returns REDIRECT URIs on this host rather than the article
 * link, and those redirects expire. A stored source link that 404s in a month,
 * or lands on an API endpoint today, is a source nobody can verify — which
 * defeats the point of the row it was stored on.
 *
 * Only this host is ever resolved. A URI that already points at a publisher is
 * returned as it stands, and a URI on any other host is neither followed nor
 * rewritten.
 */
const GROUNDING_REDIRECT_HOSTS = new Set(["vertexaisearch.cloud.google.com"]);

/** One source found by search, before any of it has been validated. */
export type GroundedSource = {
  uri: string;
  title: string;
};

export type GroundedSearchFailure =
  | { reason: "missing_api_key" }
  | { reason: "rate_limited"; retryAfterMs: number }
  | { reason: "request_failed" };

export type GroundedSearchResult =
  | { ok: true; prose: string; sources: GroundedSource[] }
  | { ok: false; failure: GroundedSearchFailure };

/**
 * Issue one grounded call: the search tool, no response schema.
 *
 * NO RESPONSE SCHEMA ON THIS CALL, deliberately. Whether grounding may be
 * combined with `responseJsonSchema` in one request is undocumented and could
 * not be settled live (the free-tier daily quota was exhausted on 2026-08-03).
 * Callers put the returned prose through `callStructured` as a second pass.
 * Collapsing the two is a legitimate optimisation ONCE VERIFIED — not before.
 *
 * `maxProseChars` is required rather than defaulted: the prose becomes the next
 * call's input, so "never pass unbounded context" binds on the way OUT of the
 * model as firmly as on the way in (§13.7), and the right bound depends on what
 * the caller will do with it.
 */
export async function runGroundedSearch({
  systemPrompt,
  query,
  recencyDays,
  maxProseChars,
}: {
  systemPrompt: string;
  query: string;
  recencyDays: number;
  maxProseChars: number;
}): Promise<GroundedSearchResult> {
  const ai = getGeminiClient();

  if (!ai) return { ok: false, failure: { reason: "missing_api_key" } };

  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: [{ role: "user", parts: [{ text: query }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: GENERATION_TEMPERATURE,
        maxOutputTokens: GENERATION_MAX_OUTPUT_TOKENS,
        // Verified shape — see the module comment.
        tools: [{ googleSearch: { timeRangeFilter: recencyWindow(new Date(), recencyDays) } }],
        // The token cap is shared with reasoning tokens on a thinking model,
        // and this is a constrained reading-and-reporting task over search
        // results — the same judgement `lib/ai/structured.ts` makes.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        httpOptions: { timeout: GROUNDED_REQUEST_TIMEOUT_MS },
      },
    });

    const metadata = response.candidates?.[0]?.groundingMetadata;

    return {
      ok: true,
      prose: clamp((response.text ?? "").trim(), maxProseChars),
      sources: readGroundedSources(metadata?.groundingChunks),
    };
  } catch (error) {
    // Mapped through the ONE existing 429 reading, so a rate limit arrives with
    // its retry timing intact rather than as a second private mapping. The
    // caller records it and Inngest reschedules (§13.3, §13.4).
    const failure = toGeminiRequestFailure(error);

    return failure.reason === "rate_limited"
      ? {
          ok: false,
          failure: {
            reason: "rate_limited",
            retryAfterMs: failure.retryAfterMs,
          },
        }
      : { ok: false, failure: { reason: "request_failed" } };
  }
}

/**
 * The recency bound, in the granularity the API accepts.
 *
 * `toISOString()` emits milliseconds and the API rejects that outright
 * (`Granularity of nano is not supported`, verified live 2026-08-03), so the
 * fractional seconds are stripped. This is not cosmetic: without it every
 * grounded run fails with a 400.
 */
function recencyWindow(
  now: Date,
  recencyDays: number,
): { startTime: string; endTime: string } {
  const from = new Date(now.getTime() - recencyDays * 24 * 60 * 60 * 1000);

  return { startTime: toSecondPrecision(from), endTime: toSecondPrecision(now) };
}

function toSecondPrecision(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

function readGroundedSources(
  chunks: { web?: { uri?: string; title?: string } }[] | undefined,
): GroundedSource[] {
  const sources: GroundedSource[] = [];

  for (const chunk of chunks ?? []) {
    const uri = chunk.web?.uri;

    // Web chunks only. A grounding chunk with no URI is a source nobody can
    // open, and it must not occupy an index the model may then cite.
    if (!uri || !isHttpUrl(uri)) continue;

    sources.push({ uri, title: (chunk.web?.title ?? "").trim() });
  }

  return sources;
}

/**
 * Turn a grounding URI into a link a person can actually open, or nothing.
 *
 * Grounding metadata hands back redirect URIs on Google's own host rather than
 * publisher links, and those redirects expire — so storing one gives a reader a
 * source link that is opaque today and dead later. This resolves ONLY that host,
 * with a HEAD request that follows redirects and reads where it landed.
 *
 * DELIBERATELY NARROW. This is not the scraper and must never become it: no page
 * is loaded, no body is read, no markup is parsed, and nothing but the final URL
 * leaves here. A URI on any other host is returned unchanged if it is a valid
 * absolute http(s) URL, and dropped if it is not — every URL this module returns
 * has been validated by `isHttpUrl`, on this side of the network boundary,
 * before it can be stored or rendered (§18).
 *
 * A resolution that fails returns null, and the caller drops and COUNTS the
 * item. Storing the unresolved redirect instead would satisfy the type and give
 * somebody a dead link.
 */
export async function resolvePublisherUrl(uri: string): Promise<string | null> {
  if (!isHttpUrl(uri)) return null;

  let host: string;

  try {
    host = new URL(uri).hostname;
  } catch {
    return null;
  }

  if (!GROUNDING_REDIRECT_HOSTS.has(host)) return uri;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDIRECT_RESOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(uri, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    const resolved = response.url;

    // Resolved onto the same redirect host, or onto nothing usable: the link is
    // no better than the one we started with.
    if (!isHttpUrl(resolved)) return null;

    return GROUNDING_REDIRECT_HOSTS.has(new URL(resolved).hostname)
      ? null
      : resolved;
  } catch {
    // The reason is not recorded and the error is not logged — an error body
    // can echo the response back (§7.6). A source that cannot be resolved is a
    // dropped item, which the caller's run record counts.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
