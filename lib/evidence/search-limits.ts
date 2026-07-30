/**
 * The one search limit both halves of the product need.
 *
 * Deliberately NOT declared in `lib/ai/config.ts`: that module is `server-only`,
 * and this number is also the `max()` of the shared Zod schema that ships to the
 * browser with the filter rail. A second copy would let the form and the branded
 * `SearchQuery` type disagree about what counts as a search string — exactly the
 * disagreement the branded type exists to make impossible. `lib/ai/config.ts`
 * re-exports it so AI call sites still import every number from one place
 * (AGENTS.md §13.1).
 *
 * 200 characters is a search box, not a document. A 512-token evidence chunk is
 * roughly ten times this, so evidence text fails this cap at runtime as well as
 * failing `SearchQuery` at the type level (`lib/ai/query-embedding.ts`).
 *
 * This module holds a shape constant and nothing else. No role, no
 * classification rule, no eligibility predicate — it is client-visible
 * (AGENTS.md §10.10).
 */
export const EVIDENCE_SEARCH_MAX_QUERY_CHARS = 200;
