import "server-only";

import { z } from "zod";

import {
  RADAR_GROUNDED_RECENCY_DAYS,
  RADAR_MAX_DOCUMENT_CHARS,
  RADAR_MAX_ITEMS_PER_RUN,
} from "@/lib/ai/config";
import {
  clamp,
  resolvePublisherUrl,
  runGroundedSearch,
  type GroundedSource,
} from "@/lib/ai/grounded-search";
import { callStructured } from "@/lib/ai/structured";
import { describeHost } from "@/lib/net/url";

import type { DetectedItem, FetchResult } from "./extract";
import type { RadarSource } from "./sources";

/**
 * THE THIRD RETRIEVAL METHOD: Gemini with Google Search grounding, for the one
 * source that has no feed to poll and no page to scrape — a beat rather than a
 * site (spec §3.2, AGENTS.md §14.3, `inngest-jobs` rule 3).
 *
 * SERVER-ONLY, AND JOBS ONLY, exactly as the other two paths are (§18, §14.1).
 *
 * ── What lives here, and what moved ───────────────────────────────────────
 * The MODEL-FACING half of this module — the verified tool config, the
 * second-granularity time filter, the grounding-redirect resolution and the 429
 * mapping — now lives in `lib/ai/grounded-search.ts`, because the Impact
 * Tracker's weekly citation search makes the same call. It was EXTRACTED, not
 * copied: that call was verified against the live API and a second copy would
 * drift from the one anybody has actually run.
 *
 * What stays here is everything radar-specific: the search and extraction
 * prompts, the candidate schema, and the mapping into `DetectedItem`.
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
 * THE SAME READING GOVERNS THE IMPACT TRACKER, which makes the same call
 * through the same shared module and likewise stores a publisher URL rather than
 * the model's prose.
 *
 * LOGGING: source id, counts, model, outcome — carried in the return value and
 * the run record, the way the other two paths carry theirs. NEVER the query,
 * never the returned prose, never a title (§7.6, §13.9).
 */

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
  const searched = await runGroundedSearch({
    systemPrompt: SEARCH_SYSTEM_PROMPT,
    query: buildSearchQuery(source),
    recencyDays: RADAR_GROUNDED_RECENCY_DAYS,
    maxProseChars: RADAR_MAX_DOCUMENT_CHARS,
  });

  if (!searched.ok) {
    // The shared module's failure union, widened into the radar's own — the
    // same two outcomes this file mapped before the extraction, with the retry
    // timing preserved on a 429 (§13.3, §13.4).
    return searched.failure.reason === "rate_limited"
      ? {
          ok: false,
          failure: {
            reason: "rate_limited",
            retryAfterMs: searched.failure.retryAfterMs,
          },
        }
      : { ok: false, failure: { reason: `grounded:${searched.failure.reason}` } };
  }

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
