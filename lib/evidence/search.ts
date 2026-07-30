import "server-only";

import { cache } from "react";

import {
  EVIDENCE_SEARCH_EXCERPT_CHARS,
  EVIDENCE_SEARCH_MAX_ITEMS,
} from "@/lib/ai/config";
import {
  embedSearchQuery,
  toSearchQuery,
  type QueryEmbeddingFailure,
} from "@/lib/ai/query-embedding";
import {
  listEligibleEvidence,
  loadEvidenceListItems,
  type EvidenceKeywordQuery,
  type EvidenceListItem,
} from "@/lib/db/evidence";
import { searchEvidenceChunksByVector } from "@/lib/db/evidence-vectors";

/**
 * The Evidence Library's read orchestrator: parse → keyword query and, when a
 * query is present, embed and vector-query → merge → one typed outcome the page
 * renders without further branching.
 *
 * A READ, not a mutation. There is no Server Action here and there must not be
 * one: search and filtering are reads, and only Server Components fetch initial
 * page data (AGENTS.md §5.3).
 *
 * THIS IS NOT THE EVIDENCE MATCHER. No signal input, no cross-encoder rerank, no
 * top-8 context assembly, no gap record. Those belong to the Matcher and must
 * not be half-built here — but the eligibility filter and the similarity query
 * underneath are the same mechanics it will reuse (§15.1).
 *
 * LOGGING: nothing in this module logs the query, a chunk, or an excerpt
 * (§7.6, §13.9).
 */

/** Why a row is in the list. Every row with a query behind it carries one. */
export type MatchProvenance =
  | {
      kind: "semantic";
      similarity: number;
      chunkOrdinal: number;
      chunkExcerpt: string;
    }
  | { kind: "keyword" }
  | {
      kind: "both";
      similarity: number;
      chunkOrdinal: number;
      chunkExcerpt: string;
    };

export type EvidenceSearchResult = EvidenceListItem & {
  /**
   * `null` when browsing. With no query there is no match to explain, so the
   * Match column is not rendered rather than being filled with a fake marker.
   */
  match: MatchProvenance | null;
};

export type SemanticStatus =
  | { status: "ran" }
  | { status: "skipped_no_query" }
  | { status: "unavailable"; reason: "rate_limited"; retryAfterMs: number }
  | { status: "unavailable"; reason: "not_configured" | "failed" };

/**
 * Which ceiling cut the list short, kept apart rather than collapsed into one
 * boolean: with a query, BOTH caps are in play at once and they are different
 * numbers, so a single flag could only produce a sentence that is right by
 * accident. The UI states the one that actually bit.
 */
export type EvidenceSearchTruncation = {
  /** The browse/keyword listing hit `EVIDENCE_BROWSE_MAX_ITEMS`. */
  listing: boolean;
  /** The semantic half hit `EVIDENCE_SEARCH_MAX_ITEMS`. */
  semantic: boolean;
};

export type EvidenceSearchOutcome = {
  results: EvidenceSearchResult[];
  /** Present when the semantic half could not run. The keyword half still did. */
  semantic: SemanticStatus;
  truncated: EvidenceSearchTruncation;
};

/**
 * One embedding per render, at most.
 *
 * React's `cache` is per-request memoisation and nothing more. A refresh
 * re-embeds the query, and that is accepted: a cross-request cache of query
 * embeddings is storage plus an invalidation rule, and it has not earned either
 * yet. Do not build one speculatively.
 */
const embedQueryOnce = cache(embedSearchQuery);

export async function searchEvidence(
  input: EvidenceKeywordQuery,
): Promise<EvidenceSearchOutcome> {
  const keywordPage = await listEligibleEvidence(input);

  if (input.query === null) {
    return {
      results: keywordPage.items.map((item) => ({ ...item, match: null })),
      semantic: { status: "skipped_no_query" },
      truncated: { listing: keywordPage.truncated, semantic: false },
    };
  }

  const semantic = await runSemanticSearch(input);

  const results = mergeResults(keywordPage.items, semantic.matches);

  return {
    results,
    semantic: semantic.status,
    truncated: { listing: keywordPage.truncated, semantic: semantic.truncated },
  };
}

type SemanticMatch = {
  item: EvidenceListItem;
  similarity: number;
  chunkOrdinal: number;
  chunkExcerpt: string;
};

type SemanticOutcome = {
  matches: SemanticMatch[];
  status: SemanticStatus;
  truncated: boolean;
};

const NO_SEMANTIC_MATCHES: SemanticMatch[] = [];

/**
 * A SEMANTIC FAILURE IS NEVER FATAL.
 *
 * A 429, a missing key, or a failed request returns no matches and a status the
 * page explains. The keyword results still render. The user gets results and a
 * sentence about what is missing — never a generic error, never an empty page,
 * never a thrown exception (AGENTS.md §13.4, `gemini-integration`).
 */
async function runSemanticSearch(
  input: EvidenceKeywordQuery,
): Promise<SemanticOutcome> {
  if (input.query === null) {
    return {
      matches: NO_SEMANTIC_MATCHES,
      status: { status: "skipped_no_query" },
      truncated: false,
    };
  }

  // The branded constructor is the only way into the embedding call, and it is
  // what makes "evidence cannot be routed here" structural rather than a
  // convention (`lib/ai/query-embedding.ts`).
  const query = toSearchQuery(input.query);

  if (query === null) {
    return {
      matches: NO_SEMANTIC_MATCHES,
      status: { status: "skipped_no_query" },
      truncated: false,
    };
  }

  const embedded = await embedQueryOnce(query);

  if (!embedded.ok) {
    return {
      matches: NO_SEMANTIC_MATCHES,
      status: toUnavailable(embedded.failure),
      truncated: false,
    };
  }

  const chunkMatches = await searchEvidenceChunksByVector({
    queryVector: embedded.vector,
    filters: input,
  });

  // Re-reads the items through the gated loader rather than trusting the ids
  // that came back from the vector query (`loadEvidenceListItems`).
  const items = await loadEvidenceListItems(
    chunkMatches.map((match) => match.evidenceItemId),
  );

  const byId = new Map(items.map((item) => [item.id, item]));

  const matches = chunkMatches.flatMap((match) => {
    const item = byId.get(match.evidenceItemId);

    if (item === undefined) return [];

    return [
      {
        item,
        similarity: match.similarity,
        chunkOrdinal: match.chunkOrdinal,
        chunkExcerpt: toExcerpt(match.chunkText),
      },
    ];
  });

  // The SQL `LIMIT` is the cap, so coming back exactly at it means there were
  // very likely more above the threshold. Reported as "showing the closest N"
  // rather than silently presenting a cut list as the whole answer.
  return {
    matches,
    status: { status: "ran" },
    truncated: chunkMatches.length >= EVIDENCE_SEARCH_MAX_ITEMS,
  };
}

/**
 * Every embedding failure becomes a state the page can put a sentence to. The
 * reason is carried; the SDK's error text never is.
 */
function toUnavailable(failure: QueryEmbeddingFailure): SemanticStatus {
  switch (failure.reason) {
    case "rate_limited":
      return {
        status: "unavailable",
        reason: "rate_limited",
        retryAfterMs: failure.retryAfterMs,
      };
    case "missing_api_key":
      return { status: "unavailable", reason: "not_configured" };
    default:
      return { status: "unavailable", reason: "failed" };
  }
}

/**
 * ONE LIST, WITH AN HONEST PER-ROW PROVENANCE — not a fabricated unified score.
 *
 * A keyword hit has no cosine similarity, and inventing one so the two rankings
 * could be interleaved would put a number in front of a reader that the product
 * cannot defend. In a product whose whole proposition is traceability, that is
 * the wrong trade. So the list is ordered:
 *
 *   1. semantic hits, similarity descending;
 *   2. keyword-only hits, newest first.
 *
 * Every row still says why it is there, which is what the design is actually
 * for. This is a deliberate deviation from the handoff's "merge into one ranked
 * list" line — that line describes the ⌘K command palette, which is a later
 * prompt and is not what /evidence renders.
 */
function mergeResults(
  keywordItems: EvidenceListItem[],
  semanticMatches: SemanticMatch[],
): EvidenceSearchResult[] {
  const keywordIds = new Set(keywordItems.map((item) => item.id));
  const semanticIds = new Set(semanticMatches.map((match) => match.item.id));

  const semanticResults: EvidenceSearchResult[] = semanticMatches.map(
    (match) => ({
      ...match.item,
      match: {
        kind: keywordIds.has(match.item.id) ? "both" : "semantic",
        similarity: match.similarity,
        chunkOrdinal: match.chunkOrdinal,
        chunkExcerpt: match.chunkExcerpt,
      },
    }),
  );

  const keywordOnlyResults: EvidenceSearchResult[] = keywordItems
    .filter((item) => !semanticIds.has(item.id))
    .map((item) => ({ ...item, match: { kind: "keyword" } }));

  return [...semanticResults, ...keywordOnlyResults];
}

function toExcerpt(chunkText: string): string {
  const trimmed = chunkText.trim();

  if (trimmed.length <= EVIDENCE_SEARCH_EXCERPT_CHARS) return trimmed;

  return `${trimmed.slice(0, EVIDENCE_SEARCH_EXCERPT_CHARS).trimEnd()}…`;
}
