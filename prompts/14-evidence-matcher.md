# 14 — The Evidence Matcher: retrieval, rerank, and the surfaced gap

## Goal

Make `signal/detected` mean something. Prompt 13 emits that event at the end of
every radar run and says, correctly, that nothing subscribes to it yet. This
prompt is the subscriber.

For each detected signal: take the signal's stored vector, retrieve candidate
evidence over pgvector, rerank the candidates, keep the top 8 with their
relevance scores, and **persist the result — including the result "nothing
cleared the threshold"** so a gap is a stored fact rather than an absence
somebody has to notice.

Four things, one body of work:

- **The retrieval order, fixed** — signal vector → cosine similarity over
  eligible chunks → top 20 candidate items → rerank → top 8 (`evidence-matcher`
  rule 1). No step is optional and none may be reordered.
- **The rerank** — a single Zod-validated structured Gemini call that scores the
  20 candidates against the signal, because cosine similarity over a 512-token
  chunk ranks passages, not documents.
- **The stored match set** — a new `signal_evidence_match` table plus an
  `evidence_match_run` record, modelled on `radar_run`: every attempt writes
  exactly one run row, including the ones that matched nothing and the ones that
  failed.
- **The gap, as data** — `matched` / `gap` / `failed` is an outcome on the run
  row. The weekly gap analysis and the signal board both read it; neither has to
  infer it from an empty join.

**Explicitly out of scope, and named so the boundary is deliberate:**

- **The signal dashboard.** `/signals` stays a `ScreenPlaceholder`. The kanban
  board, drag-to-reclassify, the signal detail view, the matched-evidence panel
  and the gap empty state are prompt 15. This prompt stores what 15 renders.
- **The officer's add/remove of matched evidence** (`evidence-matcher` rule 5).
  That is a UI affordance on the signal detail view and it belongs with 15. The
  final evidence set is already recorded on the brief through `BriefEvidence`,
  written by the existing generation path — nothing here changes that.
- **Generate-from-signal.** `Brief.signalId` stays nullable and nothing here
  creates a brief. Detection triggers the Matcher and **stops there**
  (`AGENTS.md` §8.4, §14.8, `inngest-jobs` rule 8).
- **The on-demand re-match Server Action.** "Or on demand"
  (`AGENTS.md` §5.1) needs a button, and the button is prompt 15. Writing the
  action now would ship an unreachable mutation path.
- **The weekly gap analysis job and the morning digest.** Both consume the run
  rows this prompt creates. Neither is built here. No Resend dependency.
- **Anything that advances a signal.** A matched signal stays at `new`
  (`AGENTS.md` §8.5).

**This prompt ships no user-visible UI, and that is the same deliberate shape as
prompt 13.** The alternative — half a signal board now, half in 15 — would put
two prompts' worth of design decisions in the wrong order.

## Skills read

- `evidence-matcher` — the fixed retrieval order (rule 1), retrieval as a second
  face of the gate (rule 2), the four metadata filters (rule 3), gaps surfaced
  rather than hidden (rule 4), the officer's final evidence set on the brief
  (rule 5), and rule 6 on LangChain — see decision 6 below, which is the one
  place this prompt asks for a ruling rather than assuming.
- `evidence-governance` — retrieval is the gate's other half: "untagged evidence
  is not eligible for the Evidence Matcher", and only `public_published` enters
  retrieval. The rerank is a Gemini call and is therefore a gated call path, not
  an exempt one.
- `gemini-integration` — central config, structured output via `callStructured`
  and its `responseJsonSchema` allow-list, Zod validation with one retry, 429
  backoff, and the instruction to prefer Inngest flow control over sleeps.
- `inngest-jobs` — event-triggered job shape (job shape 2 is this one), per-item
  failure isolation, the free-tier budget, "silence is reported, not assumed",
  and rule 8: the Matcher, never the Brief Generator.
- `supabase-schema` — new models, enums declared once, no speculative indexes,
  the 500MB budget, migrations only, and the `*_embedding_cosine_idx` naming
  rule.
- `inngest-durable-functions`, `inngest-steps`, `inngest-flow-control`,
  `inngest-events` (vendor) — event triggers, step memoisation, throttle,
  idempotency.
- `langchain-rag` (vendor) — read for the general pattern before deciding, per
  decision 6.

## Existing code inspected

- `lib/jobs/client.ts` — `signalDetected` is declared, carries `{ signalId }`
  and nothing else, and its docstring already names the Matcher as its
  subscriber. **No new event type is needed for the scheduled path.** The
  standing rule that payloads carry ids and never text holds here.
- `lib/jobs/functions/radar-fetch.ts:316` — where `signalDetected` is sent, and
  the precedent for `throttle` / `concurrency` / `retries` on a Gemini-calling
  function.
- `lib/jobs/index.ts` — the registry the serve endpoint mounts. A function
  absent from this array does not exist to Inngest; the new function is added in
  the same change.
- `lib/db/evidence-vectors.ts` — `searchEvidenceChunksByVector` is the model to
  follow and **not** the function to reuse: it is sized by
  `EVIDENCE_SEARCH_*` (the library's numbers) and `lib/ai/config.ts` says in
  terms not to read those back into the Matcher. The SQL shape — three nested
  selects, `DISTINCT ON` collapsing chunks to one row per item, every value a
  bound parameter, the join to `evidence_item` carrying the classification
  filter — is exactly right and is copied deliberately.
- `lib/db/signals.ts` — `createClassifiedSignal` writes the signal vector by raw
  SQL in the same transaction as the row; `recordRadarRun` is the precedent for
  a run record that logs ids, counts, outcomes and short machine reasons only.
- `lib/governance/gate.ts` — `partitionByClassification`,
  `ELIGIBLE_EVIDENCE_WHERE`, and the no-bypass note.
- `lib/ai/evidence-context.ts` — the branded `GatedEvidenceContext` and its
  single constructor. The rerank's input type is built to the same pattern.
- `lib/ai/structured.ts` — `callStructured<T>` already implements the
  `responseJsonSchema` allow-list, Zod validation and the single retry. The
  rerank uses it; it does not open a second structured-call path.
- `lib/ai/classify-signal.ts` — the closest existing precedent for a
  structured, Zod-validated Gemini call made from a job.
- `lib/ai/config.ts` — `EMBEDDING_DIMENSIONS`, `GENERATION_MODEL`,
  `GENERATION_TEMPERATURE`, `RADAR_*`, and the explicit comment separating the
  library-search numbers from the Matcher's. The Matcher's numbers go in a new
  block in this file.
- `prisma/schema.prisma` — `PolicySignal.embedding vector(1536)` with
  `policy_signal_embedding_cosine_idx` already created in the init migration, so
  no new vector column and no new HNSW index is required.
  `BriefEvidence.relevanceScore` already exists for the final set.
- `prisma/migrations/20260730100000_init/migration.sql` — the hand-written HNSW
  index block, and the reason `npm run db:migrate:new` exists.
- `app/(app)/briefs/new/actions.ts` — the manual generation path, which selects
  evidence by hand. Untouched here; the Matcher does not feed it yet.
- `package.json` — `@google/genai` 2.15.0, `inngest` 4, `zod` 4.
  **`langchain` is not installed.**

## Decisions and assumptions

1. **The Matcher is a separate event-triggered function, not a step appended to
   the radar fetch.** A module never reaches into another module's internals;
   they communicate through the database and through Inngest events
   (`AGENTS.md` §5.1). It also isolates failure: a rerank 429 must not mark a
   successful radar run as failed or cost the day's Gazette signals a retry.

2. **The retrieval unit is the chunk; the match unit is the item.** Cosine
   similarity runs over `evidence_chunk.embedding` because that is what is
   embedded, then collapses `DISTINCT ON (evidence_item_id)` to the item's
   closest chunk — same shape as the library search. The stored match records
   the item, its best similarity, and the ordinal of the chunk that matched, so
   prompt 15 can quote the passage without re-running retrieval.

3. **Rerank is one structured Gemini call over the 20 candidates, not 20 calls.**
   There is no cross-encoder reranking endpoint on the Gemini free tier
   (`gemini-api-dev` lists none, and the Vertex Ranking API is a different
   platform this project has not moved to). The honest implementation of
   "rerank" available here is an LLM reranker: one `callStructured` request
   carrying the signal summary plus 20 bounded candidate excerpts, returning a
   relevance score in 0–1 and a one-line reason per candidate id.
   - **This is a substitution and it is recorded as one.** `evidence-matcher`
     rule 1 says "cross-encoder rerank"; this is an LLM reranker. It preserves
     the rule's purpose — a second, semantically richer pass over the top 20 —
     and cannot preserve its mechanism on this stack. If approved, the skill
     gets a one-line note recording what "rerank" means here.
   - Candidates whose id the model omits keep their retrieval rank and a null
     rerank score rather than being dropped. A model that returned 18 of 20 ids
     must not silently delete two eligible items.
   - Output is validated with Zod, retried once, then the run is recorded
     `failed`. Never persisted unvalidated (`AGENTS.md` §9.4, §13.8).

4. **The threshold is applied twice, at two different meanings.**
   `MATCHER_MIN_SIMILARITY` gates what may become a candidate at all;
   `MATCHER_MIN_RELEVANCE` gates what survives the rerank into the stored set.
   A run where nothing clears either is outcome `gap` — a normal, expected,
   recorded result, not a failure. Both are starting values with no corpus
   behind them and both say so in the config comment, as
   `EVIDENCE_SEARCH_MIN_SIMILARITY` already does.

5. **Re-matching replaces, and does so in one transaction.** A signal has one
   current match set. A re-run deletes the signal's existing
   `signal_evidence_match` rows and inserts the new ones atomically, so the
   board never renders half a set. Run rows accumulate; match rows do not.

6. **LangChain is not added, and this is the one point that needs a ruling.**
   `evidence-matcher` rule 6 says RAG orchestration uses LangChain.js inside
   Server Actions. This pipeline is one pgvector query and one structured Gemini
   call, both of which already have first-class implementations in this
   repository (`searchEvidenceChunksByVector`, `callStructured`), and it runs in
   an **Inngest job**, not a Server Action. Adding a dependency to satisfy the
   name of a rule whose substance is already met would add weight, a second
   Gemini call path, and a second place the gate could be bypassed.
   **Recommendation: skip LangChain here and note the deviation in the skill.**
   If the answer is instead "add it", say so at approval and this prompt is
   rewritten with LangChain owning retrieval and the rerank chain.

7. **Metadata filters are supported but unset by the scheduled path.**
   `evidence-matcher` rule 3 names country, year, impact area and evidence type.
   The retrieval function takes them as an optional filter object reusing the
   existing `EvidenceFilters` type; the scheduled job passes none, because a
   signal's own classification is a hypothesis about relevance and pre-filtering
   on it would hide the cross-cutting evidence the officer most needs to see.
   The parameter exists for the on-demand path in prompt 15.

8. **No new embedding call.** The signal's vector was written at detection
   (`createClassifiedSignal`). A signal with a null embedding — possible only if
   a row predates the radar — is recorded as run outcome `failed` with reason
   `signal_not_embedded`, never re-embedded here.

## Files likely to change

**New**

- `prisma/schema.prisma` (edited) + a new migration authored with
  `npm run db:migrate:new -- add_evidence_match` — `EvidenceMatchOutcome` enum,
  `SignalEvidenceMatch` model, `EvidenceMatchRun` model.
- `lib/db/evidence-matches.ts` — the pgvector candidate query, the transactional
  replace of a signal's match set, the run record, and the loader that reads a
  signal's summary and vector for the job.
- `lib/ai/rerank.ts` — the branded rerank-candidate type, its single
  constructor, the Zod response schema, and the `callStructured` call.
- `lib/matcher/config.ts` **or** a new block in `lib/ai/config.ts` — the
  Matcher's own numbers. Prefer the existing config module, in a clearly
  separated block, since `AGENTS.md` §13.1 wants one place for model and limit
  numbers and that file already anticipates the Matcher by name.
- `lib/jobs/functions/match-evidence.ts` — the `signal/detected` subscriber.

**Edited**

- `lib/db/index.ts` — export the new data-layer surface.
- `lib/jobs/index.ts` — register the new function.
- `.claude/skills/evidence-matcher/SKILL.md` — the rerank-mechanism note
  (decision 3) and, if approved, the LangChain note (decision 6).

## Implementation requirements

1. **Schema.**
   - `enum EvidenceMatchOutcome { matched, gap, failed }`.
   - `EvidenceMatchRun` — `id`, `signalId`, `outcome`, `startedAt`,
     `finishedAt`, `candidateCount`, `matchedCount`, `failureReason String?`
     (short machine reason only), indexed `[signalId, startedAt]`.
   - `SignalEvidenceMatch` — composite id `[signalId, evidenceItemId]`,
     `similarity Float`, `rerankScore Float?`, `rank Int`, `chunkOrdinal Int`,
     `matchedAt`. `onDelete: Cascade` from the signal; `onDelete: Restrict` from
     the evidence item, matching `BriefEvidence`.
   - No new vector column, no new HNSW index. Confirm the generated migration
     proposes no `DROP INDEX` on either `*_embedding_cosine_idx` before applying.

2. **Retrieval (`lib/db/evidence-matches.ts`).** Raw SQL, in the data layer, in
   the shape `searchEvidenceChunksByVector` established. Every value bound,
   including the vector and the enums. The join to `evidence_item` carries
   `classification = 'public_published'` — this is the gate's retrieval face and
   it is not optional, not parameterised, and not skippable. Also require
   `extraction_completed_at IS NOT NULL` and `embedding IS NOT NULL`.
   Over-fetch chunks, collapse `DISTINCT ON`, apply `MATCHER_MIN_SIMILARITY`,
   cap at `MATCHER_CANDIDATE_ITEMS` (20).

3. **The gate, structurally.** `lib/ai/rerank.ts` exposes no function that
   accepts raw evidence. Its input is a branded type whose single constructor
   calls `partitionByClassification` and bounds each excerpt at
   `MATCHER_RERANK_EXCERPT_CHARS`. Candidates come from a query that already
   filters on classification, so refusals should be empty in practice — a
   non-empty refusal set means the item was reclassified between the query and
   the call, and the correct response is to **drop those candidates and record
   the count on the run row**, not to refuse the whole run. (This differs from
   `gateEvidenceForGeneration`'s whole-run refusal on purpose: there, an officer
   chose the set by hand and silently substituting a different one is the defect;
   here the set is machine-selected and a shrunk candidate list is honest.)
   State this distinction in the module docstring.

4. **The job.** `inngest.createFunction` on `signalDetected`, with
   `throttle` derived from a new `MATCHER_RPM_ALLOCATION` in config (one Gemini
   call per run, so throttling run starts throttles requests — the
   `embedEvidenceBatch` pattern), `concurrency: 1`, bounded `retries`, and an
   idempotency key on the signal id so a replayed event does not re-spend the
   budget. Steps: load signal → retrieve candidates → rerank → persist. A run
   that finds no candidates short-circuits to outcome `gap` **without** making
   the Gemini call. Every path writes exactly one `EvidenceMatchRun` row,
   including failures — including the terminal ones, recorded once when retries
   are spent, following `radar-fetch.ts`.

5. **Rate limits.** A 429 from the rerank is a handled outcome: honour the
   retry-delay hint through the existing `readRetryDelayMs` path, let Inngest
   retry, and only on exhaustion record outcome `failed` with reason
   `rate_limited`. Never a crash, never a swallowed error.

6. **Nothing advances a signal.** No write to `PolicySignal.status` anywhere in
   this change. No `signal/matched` event that a future Brief Generator could
   subscribe to — if prompt 15 needs one for the UI, 15 adds it.

## Evidence classification impact

**Touched, and centrally.** Two of the eight covered call types are in play:

- **Retrieval as gate face** — `AGENTS.md` §7.5 and `evidence-matcher` rule 2:
  untagged evidence is not eligible for the Matcher. Enforcement point:
  `lib/db/evidence-matches.ts`, in the candidate query's
  `JOIN evidence_item i ... AND i.classification = 'public_published'`, bound as
  a parameter and cast to the Postgres enum, exactly as
  `searchEvidenceChunksByVector` and `listItemsWithUnembeddedChunks` do. This is
  the third layer of the same one fact, not a substitute for the other two:
  ineligible items are never embedded (`lib/ai/embeddings.ts`), and
  `purgeEvidenceItemEmbeddings` strips vectors on a downgrade, so an ineligible
  item has no vector to match on in the first place.
- **The rerank is a Gemini call** (`evidence-governance` call type 1/2 family —
  a model call carrying evidence excerpts). Enforcement point: the branded
  candidate type in `lib/ai/rerank.ts` whose only constructor calls
  `partitionByClassification`. There is no exported function in that module
  taking raw text.

Blocked items: dropped from the candidate list, counted on the
`EvidenceMatchRun` row by count only. **Refusals carry ids and classifications;
no title, no excerpt, no body text is logged, stored on the run row, or sent
anywhere** (§7.6, §13.9). The signal summary and candidate excerpts never appear
in an Inngest event payload — the event carries `{ signalId }` and the job reads
from the database.

No bypass, no `force`, no env var, no dev branch is added.

## Hallucination-guard implications

**None.** This prompt changes nothing about what is fact-checked, how claims are
extracted, how flags are stored, how flags render, or what a flag blocks. It
creates no brief, no version, and no flag, and it does not touch
`lib/ai/fact-check.ts`, the flag Mark, or the approval refusal.

The one forward-looking connection, stated so it is not mistaken for a change:
when prompt 15 lets an officer generate from a signal, the matched set becomes
`BriefEvidence`, and the fact-check pass verifies claims against **the final
evidence set after officer add/remove** — never against raw matcher output. That
is already how `Brief.evidenceSet` is documented in the schema and nothing here
alters it.

## Security requirements

- Every new module is `import "server-only"`. Retrieval, rerank and the job
  never run in browser code (§18).
- All SQL is parameterised through Prisma tagged templates — no id, vector or
  enum value interpolated into a statement string.
- No credential is read outside the existing `getGeminiClient` path.
- Logging is ids, counts, outcomes, stages and timings. Never the signal
  summary, never a candidate excerpt, never a caught error's message.
- No new public Route Handler, no new mutation path reachable from the browser.

## Acceptance criteria

1. A `signal/detected` event produces exactly one `evidence_match_run` row,
   whatever the outcome.
2. A signal with eligible, embedded, above-threshold evidence produces up to 8
   `signal_evidence_match` rows, ranked, each carrying a similarity and (where
   the model returned one) a rerank score, and the run reads `matched`.
3. A signal with no candidate above `MATCHER_MIN_SIMILARITY` produces zero match
   rows, a run of outcome `gap`, and **no Gemini call**.
4. An evidence item classified `community_sourced` or `unpublished_internal`
   never appears as a candidate, never reaches the rerank call, and its text
   never appears in any log line.
5. Re-running the matcher for the same signal replaces the match set atomically
   and adds a second run row.
6. No brief is created, no signal status changes, and no event is emitted that
   the Brief Generator could subscribe to.
7. The generated migration adds the two tables and the enum and **drops neither
   `*_embedding_cosine_idx`**.
8. `npm run lint` and `npm run typecheck` are clean apart from the four
   pre-existing errors §19 names.

## Checks to run

- `npm run db:migrate:new -- add_evidence_match`, then read the generated SQL
  before applying — confirm no `DROP INDEX` on either vector index.
- `npm run db:migrate`
- `npm run db:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Report the exact output of each.

## Manual test steps

1. `npm run dev` in one terminal, `npm run inngest:dev` in another. Open
   <http://localhost:8288>.
2. Ensure at least two evidence items are `public_published` with embedded
   chunks — `/evidence` shows their embedded-chunk counts; if any are missing,
   let the sweep or the classification event run first.
3. Trigger a radar run from the Inngest UI (or send
   `radar/source.fetch.requested` for a source) so a real `PolicySignal` is
   created and `signal/detected` fires. Confirm in the run UI that the new
   matcher function was invoked by that event.
4. In `npm run db:studio`, open `evidence_match_run` — one row for the signal,
   with `outcome`, `candidateCount`, `matchedCount` and timings. Open
   `signal_evidence_match` — at most 8 rows, ranked, with similarities.
5. In the Inngest run trace, read each step's output and confirm **no signal
   summary and no evidence excerpt appears anywhere in it**, and that the
   rerank step reports counts and ids only.
6. Gap path: in Studio, temporarily set every evidence item's classification to
   `unpublished_internal`, replay the `signal/detected` event from the Inngest
   UI, and confirm a second run row with `outcome = gap`, `candidateCount = 0`,
   zero match rows, and **no Gemini request in the trace**. Restore the
   classifications afterwards.
7. Confirm the signal's `status` is still `new` and `/briefs` is unchanged.
