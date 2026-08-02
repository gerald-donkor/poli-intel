/**
 * Domain-level signal deduplication (AGENTS.md §14.4).
 *
 * Two layers stop duplicates, and they catch different things. Inngest's event
 * idempotency stops the same RUN being processed twice; it can do nothing about
 * two different fetches of the same real-world event, and a Gazette notice
 * reachable at two URLs is one policy window. This module is the second layer.
 *
 * IT RUNS BEFORE THE INSERT, never as a clean-up afterwards. A duplicate that
 * reached a reviewer has already cost their attention, which is the whole
 * defect (§14.4).
 *
 * THE COMPARISON IS DETERMINISTIC AND LOCAL — no Gemini call. Spending a model
 * request per candidate pair against a ~1,500/day budget to answer "are these
 * the same notice" is the wrong trade, and a non-deterministic dedup cannot be
 * tested. Pure functions, no I/O, no `server-only`: nothing here touches a
 * model, a database, or a secret.
 */

/**
 * Similarity two normalised titles must reach to be judged the same notice.
 *
 * A starting value. High on purpose: the cost of a false match is a real signal
 * silently swallowed into an existing row, which is worse than the duplicate it
 * would have prevented. Revisit against a real corpus, not by intuition.
 */
export const TITLE_SIMILARITY_THRESHOLD = 0.85;

/**
 * Distinctive tokens the shorter title must carry before a match is possible.
 *
 * The containment score below is 1.0 whenever one title's tokens all appear in
 * the other, which is right for a re-listing and wrong for a stub: "Draft
 * regulations" is contained in half the Gazette. Requiring four content words
 * is what keeps a short generic headline from swallowing a specific one.
 */
const MIN_TOKENS_FOR_MATCH = 4;

/**
 * How far back a candidate is compared. Sources re-list the same notice for
 * weeks, and a policy window is live for months; beyond this, the same headline
 * is far likelier to be a genuinely new round than a re-listing.
 */
export const DEDUP_RECENCY_DAYS = 60;

/** Words that carry no distinguishing weight in a policy headline. */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

/**
 * Lowercase, strip accents and punctuation, drop stopwords, collapse space.
 *
 * Exported because the same normalisation must be applied to a freshly detected
 * title and to a stored one; two normalisations that drift are a dedup that
 * silently stops working.
 */
export function normaliseTitle(title: string): string {
  return tokenise(title).join(" ");
}

function tokenise(title: string): string[] {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

/**
 * Token-set similarity: shared tokens over the SHORTER title's token count.
 *
 * Set-based rather than sequence-based, because the same notice is routinely
 * re-listed with its words reordered.
 *
 * Measured against the shorter set rather than the union, because the way a
 * re-listing actually differs is by ADDING words — "Notice:", a year, a
 * reference number, "(updated)". Scoring against the union punishes exactly
 * that: "Draft Legislative Instrument on Tree Tenure Registration" and "Notice:
 * Draft Legislative Instrument on Tree Tenure Registration, 2026" share every
 * word of the shorter title and still score 0.75 as a union ratio, which would
 * let plainly the same notice through as two signals. Containment scores it 1.0,
 * which is what it is.
 *
 * The over-matching this invites — a short generic headline contained in a
 * specific one — is handled by MIN_TOKENS_FOR_MATCH rather than by choosing a
 * measure that gets the common case wrong.
 *
 * Returns 0 for an empty title rather than 1: two titles that normalise to
 * nothing are unknown, not identical.
 */
export function titleSimilarity(left: string, right: string): number {
  const a = new Set(tokenise(left));
  const b = new Set(tokenise(right));

  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;

  for (const token of a) {
    if (b.has(token)) shared += 1;
  }

  return shared / Math.min(a.size, b.size);
}

/** Token count of the shorter normalised title, for the guard above. */
function shorterTokenCount(left: string, right: string): number {
  return Math.min(new Set(tokenise(left)).size, new Set(tokenise(right)).size);
}

export type DedupCandidate = {
  id: string;
  sourceUrl: string;
  title: string;
};

export type DedupMatch =
  | { duplicate: false }
  | { duplicate: true; signalId: string; reason: "same_url" | "similar_title" };

/**
 * Judge a detected item against the recent signals already stored.
 *
 * Exact `sourceUrl` first — it is certain, and cheaper than any comparison.
 * Then the fuzzy title match, which is the layer that collapses the same
 * real-world notice published at two different URLs into the one policy window
 * it actually is.
 */
export function findDuplicate(
  item: { url: string; title: string },
  recent: readonly DedupCandidate[],
): DedupMatch {
  for (const candidate of recent) {
    if (candidate.sourceUrl === item.url) {
      return { duplicate: true, signalId: candidate.id, reason: "same_url" };
    }
  }

  let best: { id: string; score: number } | null = null;

  for (const candidate of recent) {
    if (shorterTokenCount(item.title, candidate.title) < MIN_TOKENS_FOR_MATCH) {
      continue;
    }

    const score = titleSimilarity(item.title, candidate.title);

    if (score >= TITLE_SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { id: candidate.id, score };
    }
  }

  return best
    ? { duplicate: true, signalId: best.id, reason: "similar_title" }
    : { duplicate: false };
}
