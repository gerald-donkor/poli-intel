import { titleSimilarity } from "@/lib/radar/dedup";
import { isHttpUrl } from "@/lib/net/url";

/**
 * Influence-event deduplication.
 *
 * A weekly job that re-finds the same citation every Monday for a year is the
 * defect AGENTS.md §14.4 describes, one layer up — and worse here than on the
 * radar, because these rows go into a donor report. Three citations of one
 * notice would read as three times the influence.
 *
 * IT RUNS BEFORE THE INSERT, never as a clean-up afterwards, and the URL layer
 * of it is enforced by a UNIQUE INDEX rather than by a read the next concurrent
 * run could race (`@@unique([briefId, sourceKey])`).
 *
 * THE COMPARISON IS DETERMINISTIC AND LOCAL — no Gemini call, for the same
 * reason the radar's is not: spending a model request per candidate pair against
 * a ~1,500/day budget to answer "are these the same document" is the wrong
 * trade, and a non-deterministic dedup cannot be tested.
 *
 * IT REUSES `lib/radar/dedup.ts`'s NORMALISATION rather than writing a second
 * one. Two normalisations that drift are a dedup that silently stops working.
 * Pure functions, no I/O, no `server-only`.
 */

/**
 * Similarity two descriptions must reach to be judged the same reference.
 *
 * HIGHER than the radar's title threshold, and deliberately. A headline is a
 * short, stable string; a description is model-written prose that varies between
 * runs, so containment over its content words is a looser signal. The cost of a
 * false match here is a genuine second citation silently folded into an existing
 * row — a claim quietly lost from a donor report — which is worse than the
 * duplicate it would have prevented. A starting value, to revisit against real
 * rows rather than by intuition.
 */
export const DESCRIPTION_SIMILARITY_THRESHOLD = 0.9;

/**
 * Query parameters that identify a campaign rather than a document.
 *
 * Stripped so the same notice shared through a newsletter and through a search
 * result collapses to one key. Anything not on this list is KEPT: a `?id=1234`
 * is frequently the whole address of the document, and dropping it would merge
 * every page on a site into one.
 */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
];

/**
 * The stored dedup key for a source document, or `null` for a URL there is no
 * sense in keying on.
 *
 * Normalises the things that vary between two links to the same document and
 * nothing else: scheme, `www.`, host case, a trailing slash, a fragment, and the
 * tracking parameters above. The path's case is PRESERVED — plenty of servers
 * treat `/Reports/A.pdf` and `/reports/a.pdf` as different documents, and
 * lower-casing here would merge two real sources.
 *
 * Returns `null` for anything that is not an absolute http(s) URL, which is what
 * lets a person's log with no URL sit at `sourceKey = NULL` — distinct from
 * every other row under Postgres's unique-index rules, so two staff logs against
 * one brief never collide.
 */
export function influenceSourceKey(url: string | null): string | null {
  if (!url || !isHttpUrl(url)) return null;

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  for (const param of TRACKING_PARAMS) parsed.searchParams.delete(param);

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");
  const query = parsed.searchParams.toString();

  return `${host}${path}${query.length > 0 ? `?${query}` : ""}`;
}

export type InfluenceDedupCandidate = {
  id: string;
  sourceKey: string | null;
  description: string;
};

export type InfluenceDedupMatch =
  | { duplicate: false }
  | {
      duplicate: true;
      eventId: string;
      reason: "same_source" | "similar_description";
    };

/**
 * Judge a detected candidate against the events already stored for this brief.
 *
 * Exact `sourceKey` first — it is certain, and cheaper than any comparison. Then
 * the fuzzy description match, which is the layer that catches the same document
 * reached at two genuinely different addresses.
 *
 * Scoped to ONE BRIEF by the caller, always. Two briefs cited by the same policy
 * document are two influence events, not one: what happened is that both briefs
 * reached it.
 */
export function findDuplicateInfluenceEvent(
  candidate: { sourceKey: string | null; description: string },
  existing: readonly InfluenceDedupCandidate[],
): InfluenceDedupMatch {
  if (candidate.sourceKey !== null) {
    for (const row of existing) {
      if (row.sourceKey === candidate.sourceKey) {
        return { duplicate: true, eventId: row.id, reason: "same_source" };
      }
    }
  }

  let best: { id: string; score: number } | null = null;

  for (const row of existing) {
    const score = titleSimilarity(candidate.description, row.description);

    if (score >= DESCRIPTION_SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { id: row.id, score };
    }
  }

  return best
    ? { duplicate: true, eventId: best.id, reason: "similar_description" }
    : { duplicate: false };
}
