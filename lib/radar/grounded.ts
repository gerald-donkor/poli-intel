import "server-only";

import { ThinkingLevel } from "@google/genai";
import { z } from "zod";

import {
  GENERATION_MAX_OUTPUT_TOKENS,
  GENERATION_MODEL,
  GENERATION_TEMPERATURE,
  RADAR_GROUNDED_RECENCY_DAYS,
  RADAR_MAX_DOCUMENT_CHARS,
  RADAR_MAX_ITEMS_PER_RUN,
} from "@/lib/ai/config";
import { getGeminiClient, toGeminiRequestFailure } from "@/lib/ai/gemini";
import { callStructured } from "@/lib/ai/structured";

import {
  isHttpUrl,
  type DetectedItem,
  type FetchFailure,
  type FetchResult,
} from "./extract";
import type { RadarSource } from "./sources";

/**
 * THE THIRD RETRIEVAL METHOD: Gemini with Google Search grounding, for the one
 * source that has no feed to poll and no page to scrape — a beat rather than a
 * site (spec §3.2, AGENTS.md §14.3, `inngest-jobs` rule 3).
 *
 * SERVER-ONLY, AND JOBS ONLY, exactly as the other two paths are (§18, §14.1).
 *
 * ── Two calls, not one ────────────────────────────────────────────────────
 * Step 1 issues the grounded call WITH the search tool and NO response schema,
 * and takes back prose plus grounding metadata. Step 2 puts that prose through
 * `callStructured` — no tools — for a Zod-validated candidate list. Whether the
 * two can be combined in a single request is undocumented, and the free-tier
 * daily quota was exhausted on 2026-08-03 when this was written, so it could
 * not be settled live. Two verified requests beat one unverified one. See
 * RADAR_GROUNDED_CALLS_PER_RUN.
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
 * ── What is transmitted, and what is not (§7) ─────────────────────────────
 * NO EVIDENCE DATA PATH. The query is assembled from the source registry's
 * static `topicTerms` and nothing else: no `evidence_item` is read, no chunk is
 * retrieved, no `full_text` is touched, and no staff input reaches it. A policy
 * document the radar finds is the SUBJECT of a signal, never evidence — nothing
 * here writes to `evidence_item`.
 *
 * THIS IS NOT A LICENCE TO WIDEN THE INPUT. Seeding the search from a signal's
 * summary, an evidence item, or a brief would be a DIFFERENT data path and must
 * be re-assessed against `evidence-governance` before it is written. The one
 * place that decision would be made is `buildSearchQuery` below.
 *
 * ── What is stored, and why that is the compliance answer ────────────────
 * The model's prose is INPUT to the classification pass and is NEVER
 * PERSISTED: a signal's `summary_text` is written by `classifySignal`, as it is
 * for every other source, and what this module stores is a publisher URL and a
 * headline.
 *
 * That is not incidental. Google's Gemini API terms
 * (https://ai.google.dev/gemini-api/terms#grounding-with-google-search),
 * checked 2026-08-03, say you may "only display the Grounded Results with the
 * associated Search Suggestion(s) to the end user who submitted the prompt",
 * and that you "will not ... cache, frame, syndicate, resell, analyze, train
 * on, or otherwise learn from Grounded Results or Search Suggestions".
 *
 * NEITHER CLAUSE MAPS ONTO A SCHEDULED JOB. There is no end user who submitted
 * the prompt — a cron did — so there is nobody to whom the Search Suggestions
 * could be shown at the moment they are returned. This module's answer is to
 * display no Grounded Results at all: the prose is read once, in process, and
 * discarded, and the signal a person later opens carries a classification-pass
 * summary and a link to the publisher's own page. Nothing Google returned is
 * cached or redisplayed, so the display requirement has nothing to attach to.
 *
 * THIS IS A READING, NOT A RULING, AND IT IS THE CONSTRAINT MOST LIKELY TO
 * NEED A LAWYER RATHER THAN AN ENGINEER. If Tropenbos decides the summary must
 * instead be the model's own prose, that decision brings both clauses back into
 * force and it is NOT a small change: it needs somewhere to store
 * `searchEntryPoint.renderedContent`, a surface that renders it beside every
 * grounded signal, and a fresh reading of the caching clause. Do not make that
 * change casually, and do not make it without revisiting this comment.
 *
 * LOGGING: source id, counts, model, outcome — carried in the return value and
 * the run record, the way the other two paths carry theirs. NEVER the query,
 * never the returned prose, never a title (§7.6, §13.9).
 */

/** A grounded call reaches an external service; a slow one is a failed source. */
const GROUNDED_REQUEST_TIMEOUT_MS = 60_000;

/** Resolving one redirect is a HEAD request, not a page load. */
const REDIRECT_RESOLVE_TIMEOUT_MS = 10_000;

/**
 * The host Gemini hands back instead of a publisher's own URL.
 *
 * Grounding metadata returns REDIRECT URIs on this host rather than the article
 * link, and those redirects expire. A signal whose source link 404s in a month,
 * or lands on an API endpoint today, is a signal an officer cannot verify —
 * which defeats the point of the row (decision 4, acceptance criterion 3).
 *
 * Only this host is ever resolved. A URI that already points at a publisher is
 * stored as it stands, and a URI on any other host is neither followed nor
 * rewritten.
 */
const GROUNDING_REDIRECT_HOSTS = new Set([
  "vertexaisearch.cloud.google.com",
]);

const SEARCH_SYSTEM_PROMPT = `You monitor public news coverage of forest and land-use policy in Ghana for Tropenbos Ghana, a forest-and-livelihoods research organisation in Kumasi.

Search for recent news reports, minister statements, and political developments on the topics you are given. Report only what published coverage actually says. Do not speculate, do not recommend anything, and do not include a story you cannot point to a published source for.

For each distinct development, give its headline and two or three plain sentences describing what happened and what it would change. Nothing you produce is acted on automatically: a member of staff reviews every item.`;

const EXTRACT_SYSTEM_PROMPT = `You convert a news summary into a structured list.

You are given a summary of recent news coverage and a numbered list of the sources it was drawn from. For each distinct development in the summary, return one item: its headline, a two-or-three-sentence description drawn only from the summary, and the number of the source it came from.

Return only developments the summary actually describes. Do not invent an item, do not merge two unrelated developments into one, and do not guess a source number — if a development cannot be tied to one of the numbered sources, leave it out.`;

/**
 * Step 2's contract. `sourceIndex` is what ties a candidate back to a grounding
 * chunk, and it is REQUIRED: an item with no source is an item nobody can
 * check, and it is dropped rather than stored against an invented URL
 * (decision 5).
 */
const groundedItemsSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        sourceIndex: z.number().int().min(1),
      }),
    )
    .max(RADAR_MAX_ITEMS_PER_RUN),
});

/** One source found by search, before any of it has been validated. */
type GroundedSource = {
  uri: string;
  title: string;
};

/**
 * Fetch one grounded source.
 *
 * Returns the SAME `FetchResult` the other two methods return, so the rest of
 * the pipeline — dedup, classification, embedding, the signal row — never
 * learns that grounded search exists.
 */
export async function fetchGroundedSource(
  source: RadarSource,
): Promise<FetchResult> {
  const searched = await runGroundedSearch(source);

  if (!searched.ok) return searched;

  // Searched successfully and found nothing to work with. `empty`, not
  // `failed`: for a news beat that is the healthy steady state, not a fault
  // (decision 6, `inngest-jobs` rule 7).
  if (searched.sources.length === 0 || searched.prose.length === 0) {
    return { ok: true, items: [] };
  }

  const extracted = await callStructured({
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    userPrompt: buildExtractionPrompt(searched.prose, searched.sources),
    schema: groundedItemsSchema,
  });

  if (!extracted.ok) {
    // A 429 in step 2 is the same recorded, reschedulable outcome as one in
    // step 1 — the retry timing survives either way.
    return extracted.failure.reason === "rate_limited"
      ? {
          ok: false,
          failure: {
            reason: "rate_limited",
            retryAfterMs: extracted.failure.retryAfterMs,
          },
        }
      : { ok: false, failure: { reason: `grounded:${extracted.failure.reason}` } };
  }

  const items: DetectedItem[] = [];
  let droppedItems = 0;

  for (const candidate of extracted.value.items) {
    if (items.length >= RADAR_MAX_ITEMS_PER_RUN) break;

    // One-indexed in the prompt, because a model asked for "source 0" answers
    // worse than one asked for "source 1".
    const found = searched.sources[candidate.sourceIndex - 1];

    if (!found) {
      droppedItems += 1;
      continue;
    }

    const url = await resolvePublisherUrl(found.uri);

    if (!url) {
      droppedItems += 1;
      continue;
    }

    items.push({
      sourceId: source.id,
      sourceName: source.name,
      url,
      // The publisher's own headline where grounding metadata carried one; the
      // model's otherwise. Dedup compares titles, so the more stable of the two
      // is the better one to carry.
      title: clamp(found.title.length > 0 ? found.title : candidate.title, 300),
      text: clamp(candidate.summary, RADAR_MAX_DOCUMENT_CHARS),
      // Grounding metadata carries no publication date, and inferring one from
      // the search window would put a fabricated date on the board. The caller
      // falls back to the run's own time.
      publishedAt: null,
    });
  }

  return { ok: true, items, droppedItems };
}

/* -------------------------------------------------------------------------
 * Step 1 — the grounded call
 * ---------------------------------------------------------------------- */

type GroundedSearchResult =
  | { ok: true; prose: string; sources: GroundedSource[] }
  | { ok: false; failure: FetchFailure };

async function runGroundedSearch(
  source: RadarSource,
): Promise<GroundedSearchResult> {
  const ai = getGeminiClient();

  if (!ai) return { ok: false, failure: { reason: "grounded:missing_api_key" } };

  const window = recencyWindow(new Date());

  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: [
        { role: "user", parts: [{ text: buildSearchQuery(source) }] },
      ],
      config: {
        systemInstruction: SEARCH_SYSTEM_PROMPT,
        temperature: GENERATION_TEMPERATURE,
        maxOutputTokens: GENERATION_MAX_OUTPUT_TOKENS,
        // Verified shape — see the module comment. NO response schema on this
        // call: the tool and the schema are not documented as combinable.
        tools: [{ googleSearch: { timeRangeFilter: window } }],
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
      // Bounded on the way OUT of the model as firmly as on the way in: this
      // prose becomes the next call's input, and "never pass unbounded context"
      // binds there too (§13.7).
      prose: clamp((response.text ?? "").trim(), RADAR_MAX_DOCUMENT_CHARS),
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
      : { ok: false, failure: { reason: "grounded:request_failed" } };
  }
}

/**
 * The search query — assembled HERE, from the registry, and from nowhere else.
 *
 * Read the §7 note in the module comment before adding anything to this
 * function. Everything it returns is transmitted to Google.
 */
function buildSearchQuery(source: RadarSource): string {
  const terms = source.topicTerms ?? [];

  return [
    `Recent news coverage, from the past ${RADAR_GROUNDED_RECENCY_DAYS} days, on these topics:`,
    ...terms.map((term) => `- ${term}`),
    "",
    `What to look for: ${source.signalTypes}.`,
  ].join("\n");
}

/**
 * The recency bound, in the granularity the API accepts.
 *
 * `toISOString()` emits milliseconds and the API rejects that outright
 * (`Granularity of nano is not supported`, verified live 2026-08-03), so the
 * fractional seconds are stripped. This is not cosmetic: without it every
 * grounded run fails with a 400.
 */
function recencyWindow(now: Date): { startTime: string; endTime: string } {
  const from = new Date(
    now.getTime() - RADAR_GROUNDED_RECENCY_DAYS * 24 * 60 * 60 * 1000,
  );

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

/* -------------------------------------------------------------------------
 * Step 2 — extraction
 * ---------------------------------------------------------------------- */

function buildExtractionPrompt(
  prose: string,
  sources: readonly GroundedSource[],
): string {
  return [
    "Summary of recent coverage:",
    prose,
    "",
    "Sources:",
    // Titles and domains only. The redirect URIs are long, carry no meaning for
    // the model, and would spend the token cap on opaque identifiers.
    ...sources.map(
      (source, index) =>
        `${index + 1}. ${source.title.length > 0 ? source.title : "(untitled)"} — ${describeHost(source.uri)}`,
    ),
  ].join("\n");
}

function describeHost(uri: string): string {
  try {
    return new URL(uri).hostname;
  } catch {
    return "unknown source";
  }
}

/* -------------------------------------------------------------------------
 * URLs
 * ---------------------------------------------------------------------- */

/**
 * Turn a grounding URI into a link a person can actually open, or nothing.
 *
 * Grounding metadata hands back redirect URIs on Google's own host rather than
 * publisher links, and those redirects expire — so storing one gives an officer
 * a source link that is opaque today and dead later. This resolves ONLY that
 * host, with a HEAD request that follows redirects and reads where it landed.
 *
 * DELIBERATELY NARROW. This is not the scraper and must never become it: no
 * page is loaded, no body is read, no markup is parsed, and nothing but the
 * final URL leaves here. A URI on any other host is returned unchanged if it is
 * a valid absolute http(s) URL, and dropped if it is not — every URL this
 * module returns has been validated by `isHttpUrl`, on this side of the network
 * boundary, before it can be stored or rendered (§18).
 *
 * A resolution that fails returns null, and the caller drops and counts the
 * item. Storing the unresolved redirect instead would satisfy the type and
 * break acceptance criterion 3.
 */
async function resolvePublisherUrl(uri: string): Promise<string | null> {
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
    // dropped item, which the run record counts.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
