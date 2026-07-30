# 08 — Evidence Library search and filters

## Goal

Turn `/evidence` from "the whole eligible list, newest first" into the searchable, filterable library the spec calls for: metadata filters (country, year, impact area, source type) plus **keyword and semantic search** across the knowledge base, with every result stating why it is there.

Spec §5.4 (`/evidence` — "Searchable evidence library with filters (country, year, impact area, source type)"), §5.5 ("shadcn Table + Command palette (cmdk) for keyword search; semantic search results merged client-side with relevance-score badges"), §7 Phase 1 ("Evidence search UI: keyword + semantic search across the knowledge base"). `AGENTS.md` §1 build list, item 1.

This is the first read path in the product that queries pgvector. The similarity query, its metadata filters, and its eligibility filter are the same mechanics the Evidence Matcher will reuse (`AGENTS.md` §15.1), so getting the SQL and the gate right here is most of that later prompt's foundation.

**It is not the Evidence Matcher.** No signal input, no cross-encoder rerank, no top-8 context assembly, no gap record. Those belong to the Matcher prompt and must not be half-built here.

## Skills read

- `evidence-governance` — the gate as a **retrieval filter**, the eligibility rule, the no-second-door requirement, refusal as data, and the logging prohibition
- `gemini-integration` — central config, rate limits as a handled visible state, 429 backoff, never logging prompt text
- `supabase-schema` — pgvector cosine query shape, the metadata filters retrieval needs in the same statement, the 500MB budget's position on keyword-search indexes
- `server-actions` — the read-path boundary (only Server Components fetch initial page data), shared Zod schemas, and why nothing here is a Server Action
- `design-system` + `design_handoff_evibrief/design-system.md` — the Evidence Library grid recipe, the responsive table, the match-reveal motion, relevance as number + bar, and the five required states
- `shadcn` — `Sheet`, `Select`/`NativeSelect`, `Input`, `Badge`, `Alert`, `Table` (the full set is already installed)

Vendor docs to read **before writing code**, not from memory:

- `node_modules/next/dist/docs/` — the current `searchParams` contract for a Server Component page in Next.js 16.2, and the current client navigation surface (`useSearchParams`, `useRouter`, `useTransition`) for the filter controls. Do not assume the Next 14/15 shapes.
- `node_modules/@google/genai` — already used by `lib/ai/embeddings.ts`; the query-embedding path uses the same `embedContent` call and must match the installed types.

## Existing code inspected

| File | What it establishes |
|---|---|
| `app/(app)/evidence/page.tsx` | Server Component, `requireStaffUser()` at the DAL call, `ClassificationPendingAlert` above the fold, an empty state that branches on `pendingCount`, `mayIngest` gating the "Add evidence" link |
| `app/(app)/evidence/evidence-table.tsx` | Two-column table + detail panel; its own header comment says the filter rail and keyword/semantic search are *this* prompt. Selected row = `bg-surface-tint`. Type/Classification columns drop below 760px. `EvidenceExcerpt` sets extracted source text in the serif |
| `app/(app)/evidence/labels.ts` | `EVIDENCE_SOURCE_TYPE_LABELS`, `IMPACT_AREA_LABELS`, and `*_OPTIONS` derived from the Prisma enums — the filter rail's option lists already exist |
| `lib/db/evidence.ts` | `listEligibleEvidence()` with the standing TODO "Filters … and keyword/semantic search arrive with the evidence-library-search prompt"; `EvidenceListItem`; `ELIGIBLE_EVIDENCE_WHERE` spread into the `where` |
| `lib/db/evidence-vectors.ts` | The only place raw SQL lives. Parameterised Prisma tagged templates throughout; `countEmbeddedChunksByItem()` carries "Revisit when the library gets its filters and pagination" |
| `lib/governance/gate.ts` | `ELIGIBLE_EVIDENCE_WHERE`, `partitionByClassification`, `GateRefusal`. No bypass exists and none may be added |
| `lib/ai/embeddings.ts` | The single door into the embedding API today: takes `GateCandidate & { text }`, partitions first, returns typed failures including `rate_limited` with `retryAfterMs` |
| `lib/ai/config.ts` | `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS = 1536`, RPM budgets, retry ceilings. Every number this prompt needs goes here |
| `prisma/migrations/20260730100000_init/migration.sql` | `evidence_chunk_embedding_cosine_idx` — HNSW, `vector_cosine_ops`. Also `evidence_item` indexes on `classification`, `impact_area`, `source_type`, `(country, year)` — the four filters are already indexed |
| `components/app-nav.tsx` | The ⌘K control is a **disabled placeholder** whose comment says the command palette is a later prompt |
| `app/globals.css` | `--animate-rise-in` (240ms) and the global `prefers-reduced-motion` kill rule already exist |

## Decisions and assumptions

**1. Search is URL state read by the Server Component — no Server Action.**
Search and filtering are reads, not mutations. `AGENTS.md` §5.3: only Server Components fetch initial page data, and Server Actions are the mutation path. Filters and the query live in `searchParams`, so a search is shareable, bookmarkable, and correct under the back button. The filter controls are a client component that pushes to the router; the page re-renders on the server.

**2. Semantic search runs on submit only, never per keystroke.**
Each semantic search costs one Gemini embedding request against a 15 RPM / ~1,500-per-day budget. The search box is a form with an explicit submit; typing costs nothing. Filter selects apply immediately (they are pure SQL), but they only re-run the embedding if a query is present — accepted, and bounded by human pace.

**3. A refresh re-embeds the query. Accepted.**
No cross-request cache of query embeddings in this prompt. The embedding call is wrapped in React's `cache` so a single render never embeds twice, and nothing else. A persistent query-embedding cache is a real optimisation but it is storage and a new invalidation rule; it has not earned either yet. Do not build it speculatively.

**4. Keyword search runs against existing columns. No tsvector, no new extension, no migration.**
`supabase-schema`'s budget rule: "Keyword search can run against existing columns before it earns a duplicate." Keyword matching is case-insensitive `contains` over `title`, `citationKey`, `country`, the `authors` array, and `fullText`, through Prisma. The corpus is small and the four filter columns are already indexed. **Record, don't build:** if the corpus grows to where the `full_text` scan bites, the answer is a GIN expression index on `to_tsvector('english', full_text)` — an index, not a second copy of the text. That is a later, evidenced decision.

**5. Hybrid results are one list with an honest per-row provenance, not a fabricated unified score.**
A keyword hit has no cosine similarity, and inventing one to merge the rankings would be a number the product cannot defend — in a product whose whole proposition is traceability. So: semantic hits sort first by similarity descending; keyword-only hits follow, newest first. One "Match" column, always populated — a number + bar for a semantic hit, the word "Keyword" for a literal one. Every row says why it is in the list.
This is a deliberate deviation from the handoff's "merge into one ranked list" line, which describes the ⌘K palette (decision 6). Note it in the code comment where the ordering is implemented.

**6. The global ⌘K command palette stays out of scope.**
It spans signals and evidence, and signals do not exist yet. Building an evidence-only palette now means rebuilding it when signals land. `components/app-nav.tsx` already renders an honest disabled placeholder saying so; **leave it disabled and do not touch it.** The `/evidence` route gets its own search input in the filter rail, which is what spec §5.4 actually asks that route for.

**7. Facet values come from the eligible set only.**
The country and year options offered in the filter rail are derived by querying `public_published` items. An unclassified item's country must never appear as a filter option — the rail would otherwise leak the existence and metadata of evidence the gate is holding. Impact area and source type come from the Prisma enums (all values always offered) because those are taxonomy, not data.

**8. The similarity threshold is a starting value, and says so.**
`EVIDENCE_SEARCH_MIN_SIMILARITY = 0.35` (cosine similarity, i.e. `1 - distance`). There is no corpus to tune against, and a guessed number presented as a verified one is worse than a documented starting point. Comment it as such, in the config module, the way `EMBEDDING_BATCH_SIZE` documents its own headroom.

**9. Pagination is out of scope.** The result set is capped at `EVIDENCE_SEARCH_MAX_ITEMS = 20` for a semantic query and at a bounded ceiling for browse; the cap is stated in the UI when it bites ("showing the 20 closest matches"). Pagination arrives when a real corpus makes it necessary.

## Files likely to change

**New**

- `app/(app)/evidence/search-schema.ts` — the shared Zod schema for the query and the four filters. **Shape only**; ships to the browser; no authorisation, no role, no eligibility rule in it (`server-actions`, `AGENTS.md` §10.10)
- `app/(app)/evidence/filter-rail.tsx` — client component: search input + four filter controls + "Clear filters"; rendered inline at `desktop`, inside a `Sheet` below it
- `lib/ai/query-embedding.ts` — the narrow second door into the embedding API, for staff-typed queries only (see governance below)
- `lib/evidence/search.ts` — server-only read orchestrator: parse → keyword query + (optionally) embed and vector-query → merge → typed result. Composes the data and AI layers the way `lib/ingestion/ingest.ts` does for the write path

**Changed**

- `lib/ai/config.ts` — add the search constants
- `lib/db/evidence.ts` — accept filters on the listing; scope `countEmbeddedChunksByItem` to the ids actually rendered; add `listEvidenceFacets()`
- `lib/db/evidence-vectors.ts` — add the cosine similarity query; narrow the embedded-count helper
- `app/(app)/evidence/page.tsx` — read `searchParams`, call the orchestrator, render the new states
- `app/(app)/evidence/evidence-table.tsx` — Match column, matched-passage excerpt in the detail panel, staggered reveal
- `app/(app)/evidence/labels.ts` — only if a label is genuinely missing

**Not changed**

- `components/app-nav.tsx` (decision 6), `lib/governance/gate.ts`, `prisma/schema.prisma`, any migration, `app/globals.css`

## Implementation requirements

### A. Config (`lib/ai/config.ts`)

Add, each with a comment saying where the number comes from and how confident it is:

- `EVIDENCE_SEARCH_MAX_QUERY_CHARS = 200` — the cap that makes the branded query type structurally meaningful (§B)
- `EVIDENCE_SEARCH_CANDIDATE_CHUNKS = 60` — chunks the vector query retrieves before collapsing to one row per item
- `EVIDENCE_SEARCH_MAX_ITEMS = 20` — items returned
- `EVIDENCE_SEARCH_MIN_SIMILARITY = 0.35` — starting value, per decision 8

State explicitly in the comment that these are the **library search** path and are **not** the Evidence Matcher's top-20 → rerank → top-8 order (`AGENTS.md` §15.1), so the next prompt does not mistake one for the other.

### B. The query-embedding door (`lib/ai/query-embedding.ts`)

This adds a second entry point to the embedding API, and that is the most governance-sensitive thing in this prompt. `evidence-governance` requires that the AI layer expose **no function that accepts raw evidence**. A naive `embedText(text: string)` would be exactly that door, whatever its intended use.

Build it so evidence cannot pass through it:

- A branded type, constructible only through a validator:

  ```ts
  declare const searchQueryBrand: unique symbol;
  export type SearchQuery = string & { readonly [searchQueryBrand]: true };

  /** The ONLY constructor. Rejects anything longer than a search query. */
  export function toSearchQuery(raw: string): SearchQuery | null;
  ```

  `toSearchQuery` trims, rejects empty, and rejects anything over `EVIDENCE_SEARCH_MAX_QUERY_CHARS`. A 512-token evidence chunk is roughly ten times that cap, so passing evidence text fails at runtime as well as at the type level.

- `embedSearchQuery(query: SearchQuery)` takes the branded type and nothing else — no id, no row, no array, no options object that could carry a document.
- Module header comment states, unmissably: **this embeds a staff-typed search string; evidence text goes through `embedEvidenceCandidates` and its gate, and must never be routed here.** Cross-reference `lib/governance/gate.ts` and `AGENTS.md` §7.
- Typed result, same vocabulary as `lib/ai/embeddings.ts` so the caller handles one shape:
  `{ ok: true; vector: number[] }` | `{ ok: false; failure: { reason: "missing_api_key" } | { reason: "rate_limited"; retryAfterMs } | { reason: "request_failed"; status } | { reason: "invalid_response" } | { reason: "dimension_mismatch"; ... } }`
- Reuse the existing 429 handling and `checkEmbeddingDimensions`. If the retry-delay reader in `embeddings.ts` is needed here, **extract it to a shared server-only helper rather than copying it** — two copies of a backoff rule drift.
- Request `outputDimensionality: EMBEDDING_DIMENSIONS` and use `EMBEDDING_MODEL`. A query embedded at a different dimensionality or by a different model cannot be compared to the stored vectors.
- `import "server-only"` at the top. Log nothing — not the query, not a caught error message.

### C. Data layer

**`lib/db/evidence-vectors.ts` — `searchEvidenceChunksByVector`**

Raw SQL, parameterised through Prisma tagged templates as everything else in that file is. No id, vector, or enum value interpolated into a statement string.

- Inner query: join `evidence_chunk` to `evidence_item`; `WHERE c.embedding IS NOT NULL AND i.extraction_completed_at IS NOT NULL AND i.classification = ${Classification.public_published}::"classification"` plus the metadata filters; `ORDER BY c.embedding <=> ${queryVector}::vector LIMIT ${EVIDENCE_SEARCH_CANDIDATE_CHUNKS}`.
- Outer query: `DISTINCT ON (evidence_item_id)` ordered by distance, so one row per item carrying its **closest** chunk — its ordinal, its text, and `1 - distance` as `similarity`.
- Drop rows below `EVIDENCE_SEARCH_MIN_SIMILARITY`, then `LIMIT EVIDENCE_SEARCH_MAX_ITEMS`.
- The eligibility predicate is the same one fact as `ELIGIBLE_EVIDENCE_WHERE`, expressed in the place Prisma's `where` cannot reach. Comment it as such, the way `listItemsWithUnembeddedChunks` already does.
- Comment the index consideration honestly: filters in the `WHERE` mean Postgres may post-filter HNSW results, so an aggressive filter can return fewer candidates than the limit. `EVIDENCE_SEARCH_CANDIDATE_CHUNKS` over-fetches for exactly that reason. Do not tune `hnsw.ef_search` without a corpus to measure against.

**`lib/db/evidence-vectors.ts` — `countEmbeddedChunksByItem(evidenceItemIds)`**

Scope it to the ids being rendered, resolving the note already in that function. An empty id list returns an empty map without a query.

**`lib/db/evidence.ts`**

- `listEligibleEvidence(filters)` — `ELIGIBLE_EVIDENCE_WHERE` stays spread in first; add `country`, `year`, `impactArea`, `sourceType`, and the keyword `OR` block. Replace the standing TODO comment with what the function now does.
- `loadEvidenceListItems(ids)` — hydrate the `EvidenceListItem` shape for a set of ids from the vector query, preserving the caller's order. Reuse `evidenceListSelect` and `toListItem`; **re-apply `ELIGIBLE_EVIDENCE_WHERE`** rather than trusting the ids to have come from a gated query. Belt and braces on the one rule that matters.
- `listEvidenceFacets()` — distinct non-null countries and years across eligible, extraction-complete items; countries alphabetical, years descending (decision 7).

### D. Read orchestrator (`lib/evidence/search.ts`)

`import "server-only"`. Takes the parsed search input, returns one typed result the page renders without further branching:

```ts
type EvidenceSearchOutcome = {
  results: EvidenceSearchResult[];
  /** Present when the semantic half could not run. The keyword half still did. */
  semantic:
    | { status: "ran" }
    | { status: "skipped_no_query" }
    | { status: "unavailable"; reason: "rate_limited"; retryAfterMs: number }
    | { status: "unavailable"; reason: "not_configured" | "failed" };
  truncated: boolean;
};
```

`EvidenceSearchResult` is `EvidenceListItem` plus:

```ts
type MatchProvenance =
  | { kind: "semantic"; similarity: number; chunkOrdinal: number; chunkExcerpt: string }
  | { kind: "keyword" }
  | { kind: "both"; similarity: number; chunkOrdinal: number; chunkExcerpt: string };
```

Behaviour:

- No query → filters only → the browse listing. With no query there is no match to explain, so rows carry **no** provenance and the Match column is not rendered. Model that explicitly — an absent `match`, or a discriminated outcome — never a fake `"keyword"` marker on every row.
- Query present → run the keyword query and the semantic path. Union by item id: an item hit by both is `"both"`. Order per decision 5.
- **A semantic failure is never fatal.** If the embedding call 429s, is not configured, or fails, return the keyword results with `semantic.status === "unavailable"`. The user gets results and a clear explanation — never a generic error, never an empty page, never a thrown exception (`gemini-integration`, `AGENTS.md` §13.4).
- Cap the matched-chunk excerpt at ~400 characters with an ellipsis.
- Wrap the embedding call in React `cache` so one render embeds at most once.
- Log nothing containing the query or any chunk text (`AGENTS.md` §7.6, §13.9).

### E. UI

**Page (`app/(app)/evidence/page.tsx`)**

- Read `searchParams` per the installed Next 16.2 docs. Parse with the shared schema using a `safeParse` that **falls back to unfiltered rather than throwing** — a hand-edited URL is a bad request, not a crash. Unknown params are ignored.
- `requireStaffUser()` stays at the DAL call. Keep `ClassificationPendingAlert` above the fold and never behind a breakpoint (`design-system`, responsive rules).
- Grid per the handoff: `grid grid-cols-1 laptop:grid-cols-[1fr_320px] desktop:grid-cols-[216px_1fr_340px]`. The 216px filter rail is inline at `desktop`; below `desktop` it collapses to a "Filters" trigger opening a `Sheet` (handoff responsive table). The trigger shows the count of active filters.
- **States, all designed, none optional:**
  - *rate-limited* — `Alert`, slate/olive, naming the retry timing from `retryAfterMs`, saying keyword results are still shown. Never `destructive`, never a toast, never red (`AGENTS.md` §11.4, `design-system`).
  - *semantic not configured / failed* — same `Alert` treatment, plain wording, no stack detail.
  - *empty* — a real next step, branching on what is actually true: filters are active → offer "Clear filters"; a query is active → suggest broadening it; `pendingCount > 0` → link the classification queue, because the evidence may exist and simply be untagged. This is the `AGENTS.md` §17.6 empty state, not a blank panel.
  - *classification-pending* — the existing banner, unchanged.
  - The existing "nothing eligible at all" empty state stays for the no-filters-no-query case.
- Copy never implies the system decided, verified, or endorsed anything (`AGENTS.md` §8.8). "Closest matches", not "best evidence"; "matched passage", not "verified passage".

**Filter rail (`app/(app)/evidence/filter-rail.tsx`)**

- Client component. Search input inside a `<form>` with a real submit (Enter works; a visible submit button too). Filter selects apply on change via the router.
- Use `useTransition` so the pending read is visible without an indeterminate spinner — a subtle disabled/dimmed state on the rail, per `design-system` (nothing beyond 300ms of decoration; if in doubt, cut it).
- Every control has a real `<label>`; the rail is a labelled `<fieldset>`/`aria-label`ed region; the `Sheet` variant is keyboard-operable and focus-trapped (shadcn gives this — do not defeat it). WCAG 2.1 AA is a hard requirement (`AGENTS.md` §11.13).
- "Clear filters" removes every param including the query, and is only rendered when something is set.
- The rail owns the same options the schema validates: `EVIDENCE_SOURCE_TYPE_OPTIONS`, `IMPACT_AREA_OPTIONS`, and the facet lists from the server. No re-declared string unions (`AGENTS.md` §12.7).

**Table (`app/(app)/evidence/evidence-table.tsx`)**

- Add a **Match** column, rendered only when a query is active. Number + bar, never colour-only (`design-system`, evidence table). Similarity as a 0–100 integer in the mono face, with a proportional bar; `aria-label` giving the same information in words. Keyword-only rows render the word "Keyword" in that cell — one column, always explaining the row.
- Detail panel: when the selected row has a matched chunk, show it as **"Matched passage"** in the serif with its chunk ordinal, above the existing opening excerpt. It is source text, so the serif rule applies (`AGENTS.md` §11.6). Reuse `EvidenceExcerpt`'s treatment; do not fork a second blockquote style.
- Match reveal motion: `--animate-rise-in` with `style={{ animationDelay: `${i * 70}ms` }}`, capped at a small number of rows so a 20-row list does not stagger for over a second. Handoff motion table: 200ms, 70ms stagger, fade + 8px rise, relevance order. The global reduced-motion rule already neutralises it.
- Selection: when results change, the previously selected id may be gone. Reconcile to the first result rather than showing an empty panel.
- Keep the existing responsive column drops and the `bg-surface-tint` selected row.

## Evidence classification impact

**This task touches the gate in both of its capacities.**

*As a retrieval filter (`AGENTS.md` §7.5, §15.2):*

- Keyword and metadata filtering go through `listEligibleEvidence`, which spreads `ELIGIBLE_EVIDENCE_WHERE` — unchanged and non-negotiable.
- The new vector query enforces the same rule in SQL: `i.classification = ${Classification.public_published}::"classification"`, joined from the chunk to its parent item. Classification is not duplicated onto chunks, so the join is the enforcement (`supabase-schema`).
- `loadEvidenceListItems` re-applies `ELIGIBLE_EVIDENCE_WHERE` even though its ids came from a gated query.
- Facet values are derived from eligible items only, so the filter rail cannot leak the metadata of held evidence.
- Only `public_published` chunks carry vectors at all — `lib/ai/embeddings.ts` gates that, and `purgeEvidenceItemEmbeddings` removes them on downgrade. The vector filter is the third layer of the same one rule, not a substitute for either.

*As a model gate:*

- Classifications involved: **all three.** `public_published` is searchable and retrievable; `community_sourced` and `unpublished_internal` are neither, and their existence is not disclosed by the filter rail.
- The one new Gemini call is **query embedding** — a staff-typed string, not evidence. It is a Gemini call and so is named here explicitly rather than waved past. **Enforcement point:** `toSearchQuery` in `lib/ai/query-embedding.ts` is the only constructor of the branded type `embedSearchQuery` accepts, and it caps input at `EVIDENCE_SEARCH_MAX_QUERY_CHARS`. Evidence text cannot reach this function by type, and would fail by length if cast past the type.
- **No second unchecked door.** `lib/ai/query-embedding.ts` must not export a raw-string embed function, must not accept an array, and must not accept anything carrying an evidence id. `lib/ai/embeddings.ts` keeps its partition-first entry point unchanged.
- **Blocked items:** ineligible evidence never appears in results, is never counted, and is never named. Where the user might reasonably wonder why something is missing, the empty state points at the classification queue and its count — the backlog stays visible (`AGENTS.md` §7.5), which is the honest surfacing of the refusal, not a leak of what is held.
- **No bypass added.** No env var, no flag, no "search everything" toggle, no dev branch. Do not write one.
- **Logging:** nothing logs query text, chunk text, excerpts, or a caught error's message. Ids, counts, similarity numbers, and classifications only (`AGENTS.md` §7.6).

## Hallucination-guard implications

**None — no generation path.** This prompt adds a retrieval and browse surface. It does not generate text, does not extract claims, does not create, store, render, dismiss, or resolve a flag, and does not touch anything that blocks approval. No brief is read or written.

The one adjacency worth naming: the matched-passage excerpt sets source text in the serif, which is the same typographic distinction the citation chip and guard flag depend on (`AGENTS.md` §11.6). Getting it right here keeps that contract consistent for the editor work later.

## Security requirements

- `import "server-only"` in `lib/ai/query-embedding.ts`, `lib/evidence/search.ts`, and any new data-layer module. Nothing in this prompt makes a model call or a Prisma query reachable from browser code (`AGENTS.md` §18).
- `GOOGLE_GENERATIVE_AI_API_KEY` is read server-side only, lazily, exactly as `lib/ai/embeddings.ts` does. Absent is a typed outcome, never a crash and never a client-visible detail.
- All SQL is parameterised through Prisma tagged templates. **No string interpolation of a query, filter value, enum, id, or vector** into a statement. The filter values are enum-validated by Zod before they reach the data layer; `country` is a free-text column and is still bound as a parameter, never concatenated.
- `app/(app)/evidence/search-schema.ts` ships to the browser: shape only. No role, no classification rule, no eligibility predicate in it (`AGENTS.md` §10.10).
- Query strings are capped (200 chars) and filter values validated before any query runs — an unbounded query string is both an injection surface and a rate-budget surface.
- `requireStaffUser()` remains the gate on the route. Search results are staff-only data.
- No evidence body text, query text, or excerpt in a log line, a Sentry event, or a PostHog property.

## Acceptance criteria

1. `/evidence` renders a filter rail inline at ≥1300px and behind a "Filters" `Sheet` trigger below it; the trigger shows the active filter count.
2. Country, year, impact area, and source type each narrow the listing; combinations compose; state lives in the URL and survives refresh, share, and the back button.
3. Country and year options include only values present on `public_published` items.
4. A submitted query returns keyword matches (title, citation key, country, authors, full text — case-insensitive) merged with semantic matches, ordered per decision 5, each row showing its provenance in the Match column.
5. Semantic matches show similarity as a number **and** a bar, with an equivalent `aria-label`. Never colour-only, never red.
6. Selecting a semantic result shows the matched passage in the **serif**, with its chunk ordinal.
7. Only `public_published`, extraction-complete evidence appears — through keyword, through filters, and through the vector query.
8. With `GOOGLE_GENERATIVE_AI_API_KEY` unset, keyword search still works and a slate/olive `Alert` explains that semantic search is unavailable. Nothing crashes and no red appears anywhere.
9. A 429 on the query embedding produces a retry-timing `Alert` and keyword results, not an error page.
10. Zero results produces a next step matched to the cause (clear filters / broaden the query / open the classification queue), never a blank panel.
11. The classification-pending banner and count stay visible at every width.
12. `lib/ai/query-embedding.ts` exports no function accepting an unbranded string, and `lib/ai/embeddings.ts` is unchanged in its gate behaviour.
13. No migration, no schema change, no new dependency, no change to `components/app-nav.tsx`.
14. Usable and legible at 390, 760, 1000, 1300, and 1600px with no horizontal page scroll; the table scrolls inside its own panel.
15. Keyboard-only operation: reach and set every filter, submit a search, move through rows, open and close the `Sheet`. Visible focus ring throughout.
16. `npm run lint` and `npm run typecheck` clean of new errors; `npm run build` succeeds.

## Checks to run

```
npm run lint
npm run typecheck
npm run build
```

Report exact output. `npm run lint` has 4 known pre-existing errors from `components/ui/carousel.tsx`, `hooks/use-mobile.ts`, and `design_handoff_evibrief/support.js` (`AGENTS.md` §19) — read past those for problems in the files this prompt touches, and do not reformat vendored or handoff files.

## Manual test steps

Prerequisites: `npm run dev`, signed in, and at least three `public_published` items whose chunks carry vectors (`/evidence` detail panel shows "Embedded n / n chunks"). Use `npm run inngest:dev` and the classification queue to get there if the corpus is empty.

1. **Browse** — open `/evidence` with no params. The full eligible listing renders, no Match column, filter rail present.
2. **Filters** — set source type, then impact area, then a country and a year. Each narrows the list; the URL carries every param; refresh reproduces the view exactly; the back button steps back through the filter states.
3. **Facets** — confirm the country and year dropdowns offer only values that exist on eligible items. Classify an item down to `unpublished_internal` from the queue and confirm its country disappears from the options if no eligible item shares it.
4. **Keyword** — search an exact phrase from a document body. The item appears with "Keyword" in the Match column.
5. **Semantic** — search a paraphrase that shares no literal words with the document (e.g. "cocoa farmers' rights to trees on their land" against a tree-tenure report). The item appears with a similarity number and bar; its detail panel shows the matched passage in the serif.
6. **Both** — search a term that is both literally present and semantically central; confirm the row reports the combined provenance and sorts by similarity.
7. **Empty** — search nonsense. The empty state offers a real next step; if the queue is non-empty it links there.
8. **Rate limit / not configured** — temporarily unset `GOOGLE_GENERATIVE_AI_API_KEY`, restart dev, and search. Keyword results still render beneath a slate/olive alert explaining semantic search is unavailable. Nothing red, no error page. Restore the key.
9. **Gate** — take an eligible item, reclassify it to `community_sourced` in the queue, and re-run a query that previously returned it. It is absent from keyword, filter, and semantic results, and its metadata is gone from the facets.
10. **Responsive** — at 390, 760, 1000, 1300, 1600px: no horizontal page scroll; the filter rail is inline only at 1300+ and a `Sheet` below; the classification-pending banner is visible at every width; the table scrolls inside its panel.
11. **Keyboard** — tab from the search input through every filter to the first row; submit with Enter; open and close the `Sheet` with the keyboard alone; confirm the focus ring is visible throughout.
12. **Reduced motion** — enable the OS setting and confirm results appear instantly with no stagger.
