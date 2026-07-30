import { z } from "zod";

import { EVIDENCE_SEARCH_MAX_QUERY_CHARS } from "@/lib/evidence/search-limits";
import { EvidenceSourceType, ImpactArea } from "@/lib/generated/prisma/enums";

/**
 * The Evidence Library's search state: one query and four filters, shared by the
 * page that reads `searchParams` and the filter rail that writes them
 * (AGENTS.md §10.10).
 *
 * SHAPE ONLY — this module ships to the browser. No role, no classification
 * rule, no eligibility predicate. Which evidence a search may see is decided
 * server-side by `ELIGIBLE_EVIDENCE_WHERE` and by the vector query's own
 * classification join, never here.
 *
 * Enum membership comes from the Prisma enums rather than a re-declared string
 * union, so a filter can never offer a value the database cannot hold (§12.7).
 *
 * Search state lives in the URL, not in component state: a search is then
 * shareable, bookmarkable, and correct under the back button, and the page is a
 * plain Server Component read rather than a mutation (§5.3).
 */

/** The URL parameter names. Short, because they are typed and shared by hand. */
export const EVIDENCE_SEARCH_PARAMS = {
  query: "q",
  country: "country",
  year: "year",
  impactArea: "impact",
  sourceType: "type",
} as const;

/**
 * Every field `.catch()`es to null INDIVIDUALLY.
 *
 * A hand-edited or stale URL is a bad request, not a crash — and not a reason to
 * discard the three filters that were fine because the fourth was not. Unknown
 * parameters are ignored by the object schema.
 */
const evidenceSearchFieldsSchema = z.object({
  [EVIDENCE_SEARCH_PARAMS.query]: z
    .string()
    .trim()
    .min(1)
    .max(EVIDENCE_SEARCH_MAX_QUERY_CHARS)
    .nullish()
    .catch(null),
  [EVIDENCE_SEARCH_PARAMS.country]: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .nullish()
    .catch(null),
  [EVIDENCE_SEARCH_PARAMS.year]: z.coerce
    .number()
    .int()
    .min(1900)
    .max(2200)
    .nullish()
    .catch(null),
  [EVIDENCE_SEARCH_PARAMS.impactArea]: z.enum(ImpactArea).nullish().catch(null),
  [EVIDENCE_SEARCH_PARAMS.sourceType]: z
    .enum(EvidenceSourceType)
    .nullish()
    .catch(null),
});

/** The parsed shape the page and the rail both work in. */
export type EvidenceSearchInput = {
  query: string | null;
  country: string | null;
  year: number | null;
  impactArea: ImpactArea | null;
  sourceType: EvidenceSourceType | null;
};

export const EMPTY_EVIDENCE_SEARCH: EvidenceSearchInput = {
  query: null,
  country: null,
  year: null,
  impactArea: null,
  sourceType: null,
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(raw: RawSearchParams, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parse a URL's search parameters into the search input.
 *
 * Total by construction: a malformed value falls back to "not set" rather than
 * throwing, so `/evidence?year=banana` renders the library instead of an error
 * page.
 */
export function parseEvidenceSearch(raw: RawSearchParams): EvidenceSearchInput {
  const parsed = evidenceSearchFieldsSchema.safeParse({
    [EVIDENCE_SEARCH_PARAMS.query]: first(raw, EVIDENCE_SEARCH_PARAMS.query),
    [EVIDENCE_SEARCH_PARAMS.country]: first(raw, EVIDENCE_SEARCH_PARAMS.country),
    [EVIDENCE_SEARCH_PARAMS.year]: first(raw, EVIDENCE_SEARCH_PARAMS.year),
    [EVIDENCE_SEARCH_PARAMS.impactArea]: first(
      raw,
      EVIDENCE_SEARCH_PARAMS.impactArea,
    ),
    [EVIDENCE_SEARCH_PARAMS.sourceType]: first(
      raw,
      EVIDENCE_SEARCH_PARAMS.sourceType,
    ),
  });

  if (!parsed.success) return EMPTY_EVIDENCE_SEARCH;

  const data = parsed.data;

  return {
    query: data[EVIDENCE_SEARCH_PARAMS.query] ?? null,
    country: data[EVIDENCE_SEARCH_PARAMS.country] ?? null,
    year: data[EVIDENCE_SEARCH_PARAMS.year] ?? null,
    impactArea: data[EVIDENCE_SEARCH_PARAMS.impactArea] ?? null,
    sourceType: data[EVIDENCE_SEARCH_PARAMS.sourceType] ?? null,
  };
}

/** How many of the four metadata filters are set. Drives the "Filters" badge. */
export function countActiveFilters(input: EvidenceSearchInput): number {
  return [input.country, input.year, input.impactArea, input.sourceType].filter(
    (value) => value !== null,
  ).length;
}

/** Whether anything at all is narrowing the listing, query included. */
export function hasActiveSearch(input: EvidenceSearchInput): boolean {
  return input.query !== null || countActiveFilters(input) > 0;
}

/** Serialise back to a query string. Unset values are omitted, never blank. */
export function toEvidenceSearchParams(
  input: EvidenceSearchInput,
): URLSearchParams {
  const params = new URLSearchParams();

  if (input.query !== null) params.set(EVIDENCE_SEARCH_PARAMS.query, input.query);
  if (input.country !== null) {
    params.set(EVIDENCE_SEARCH_PARAMS.country, input.country);
  }
  if (input.year !== null) {
    params.set(EVIDENCE_SEARCH_PARAMS.year, String(input.year));
  }
  if (input.impactArea !== null) {
    params.set(EVIDENCE_SEARCH_PARAMS.impactArea, input.impactArea);
  }
  if (input.sourceType !== null) {
    params.set(EVIDENCE_SEARCH_PARAMS.sourceType, input.sourceType);
  }

  return params;
}
