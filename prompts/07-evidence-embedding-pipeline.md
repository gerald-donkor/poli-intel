# 07 — Evidence embedding pipeline (and the Inngest foundation)

## Goal

Give eligible evidence its vectors, and make the gate hold in both directions.

When a Research Officer tags an item `public_published`, its chunks are embedded with
Gemini Embedding 2 and the vectors are written to the pgvector columns that prompt 04
created and prompt 06 left null. When an item is tagged *away* from `public_published`,
its stored vectors are purged — because a vector derived from evidence that is no longer
eligible is still derived from that evidence, and leaving it in the index would let
ineligible material reach retrieval through the back door.

This is the **first consumer of `partitionByClassification`** (`lib/governance/gate.ts`),
and the first Gemini call in the codebase. It is also the project's **first Inngest job**,
so the Inngest client, serve endpoint, and dev script land here (`AGENTS.md` §19,
`inngest-jobs` "Not installed yet").

**Why this is next.** `AGENTS.md` §15.1 fixes the retrieval order as *embed the signal text
→ pgvector cosine similarity → top 20 → rerank → top 8*. Every step after the first reads
`evidence_chunk.embedding`, which is null for every row in the database today. The Evidence
Matcher, semantic search, the Brief Generator, and the hallucination guard are all blocked
behind this one column being populated. Prompt 06 states the deferral explicitly in its
decision 2.

**Why Inngest lands here rather than in its own prompt.** `AGENTS.md` §14.1: event-triggered
work is an Inngest function, "never a fire-and-forget promise in a request handler."
Embedding on classification is event-triggered by definition. `inngest-jobs` says the first
jobs task adds the dependency and scripts in that same change. An Inngest-setup prompt with
no job to run would deliver nothing observable and would have to be re-opened immediately.

## Skills read

- `evidence-governance` — the gate's structural position, the `GateResult` contract, the
  refusal shape, the logging prohibition, and the rule that a job is not an exemption
- `gemini-integration` — centralised model config, 429 backoff, embedding batching, "filter
  by classification **before** batching", storing model identity with the vectors
- `inngest-jobs` — job shape 3 (embedding, event-triggered, batched and fanned out), the
  free-tier budget, "batch first, then fan out", flow control over hand-rolled sleeps
- `supabase-schema` — the vector columns, dimensionality as one central fact, the 500MB
  budget, migrations only
- `server-actions` — where the triggering event is emitted, and the authorise-first order
- `design-system` — the states this adds to the evidence detail panel
- Vendor, for mechanics only: `gemini-api-dev`, `inngest-setup`, `inngest-durable-functions`,
  `inngest-steps`, `inngest-events`, `inngest-flow-control`, `inngest-cli`

## Existing code inspected

- `lib/governance/gate.ts` — `partitionByClassification`, `ELIGIBLE_EVIDENCE_WHERE`,
  `PENDING_CLASSIFICATION`. Built in 06 and unused so far; this prompt is its first caller.
- `lib/ai/config.ts` — `EMBEDDING_MODEL = "gemini-embedding-2"` and
  `EMBEDDING_DIMENSIONS = 1536`, both already verified against the live embeddings doc
- `lib/db/embedding.ts` — `checkEmbeddingDimensions`, the typed dimension guard linking the
  constant to the `vector(1536)` column literal. Also unused so far; this prompt uses it.
- `lib/db/evidence.ts` — `classifyEvidenceItem` (the transaction that must now emit an
  event), `listEligibleEvidence`, `EvidenceListItem`
- `app/(app)/evidence/actions.ts` — `classifyEvidenceAction`, guarded by
  `canChangeEvidenceClassification`
- `prisma/schema.prisma` — `EvidenceChunk.embedding Unsupported("vector(1536)")?`,
  `embeddingModel String?`; `IngestionLog` with `outcome`, `chunkCount`, `failureReason`
- `prisma/migrations/20260730100000_init/migration.sql:452` — the HNSW cosine index on
  `evidence_chunk.embedding`, already created and currently indexing nothing
- `.env.example` — `GOOGLE_GENERATIVE_AI_API_KEY`, `INNGEST_EVENT_KEY`,
  `INNGEST_SIGNING_KEY` all already listed
- `package.json` — no `inngest`, no `@google/genai`, no LangChain

## Decisions and assumptions

1. **The gate is re-read from the database inside the job, never trusted from the event
   payload.** An event is transport, not a governance source: it can be replayed, delayed,
   or delivered after a reclassification that happened in between. The job loads the item's
   *current* classification and runs it through `partitionByClassification`. An event
   payload that says `public_published` proves nothing.

2. **One event, both directions: `evidence/classification.changed`.** The same function
   handles embed and purge, branching on the classification it reads. Two separate events
   would let the purge path be forgotten or drift; one function that always asks "is this
   currently eligible?" cannot.

3. **Purging on downgrade is in scope and is not optional.** `public_published →
   community_sourced` (exactly the correction made by hand during 06's manual testing) must
   delete that item's vectors. Without this, the gate holds only at the instant of embedding
   — which is not a gate.

4. **No migration.** Embedding state is derived, not stored: `embedding IS NULL` means not
   embedded. Adding a status column would create a second source of truth that can disagree
   with the column it describes. If per-chunk failure *reasons* later need persisting, that
   is a migration in a follow-up prompt — say so rather than sneaking one in here.

5. **Embedding outcomes are logged to `IngestionLog`, not a new table.** Embedding is spec
   §4.2 step 9 — a stage of the ingestion pipeline, not a separate concern — so this extends
   the existing log rather than forking a parallel one (`AGENTS.md` §12.1). `sourceName`
   carries the citation key. Ids, counts, and short machine reasons only; never chunk text.

6. **Direct `@google/genai`, no LangChain yet.** LangChain is the RAG *orchestration* layer
   (`AGENTS.md` §15.6) and earns its place with the retrieval chain in the Evidence Matcher.
   A single `embedContent` call does not need a chain around it, and installing LangChain
   here would be overbuilding.

7. **Verified against the live embeddings doc on 2026-07-30**, so write these rather than
   guessing: the call is `ai.models.embedContent({ model, contents, config })`; multiple
   texts batch by passing `contents` as an array of `{ parts: [{ text }] }` objects;
   `config.outputDimensionality` sets the dimension; `gemini-embedding-2` accepts 8,192
   input tokens per text. **The maximum number of texts per request is not documented** —
   read it from the installed SDK's types or errors and pick a conservative batch size in
   config. Do not assume a number.

8. **Rate limits are handled with Inngest flow control, not hand-rolled sleeps**
   (`gemini-integration`, `inngest-jobs`). A `sleep` inside a step that Inngest would retry
   anyway double-counts the wait. Verify the throttle/concurrency option names against the
   installed package — do not write them from memory.

9. **A daily sweep provides both backfill and self-healing.** The two items already sitting
   at `public_published` in the database have no vectors, and an `inngest.send()` that fails
   after a committed transaction would otherwise strand an item forever. One scheduled
   function that finds eligible items with unembedded chunks solves both, at one run per
   day against the free-tier budget.

10. **The `send` is not inside the classification transaction.** It happens after the commit.
    An event announcing a transaction that later rolled back is a lie; a commit whose event
    failed to send is recoverable by decision 9.

11. **This is background work, so §13.4's mid-generation rate-limit contract does not apply
    here.** That contract is about not losing a draft during interactive generation. The
    honest user-visible state for this pipeline is "chunks not yet embedded" on the evidence
    detail panel — say that plainly rather than inventing a countdown for a job the user is
    not watching.

12. **`GOOGLE_GENERATIVE_AI_API_KEY` is not currently set in `.env.local`** (checked; all
    three of the vars this needs are absent). The implementation must fail clearly and
    server-side when it is missing, not with an obscure SDK error — and the manual test
    steps must tell the user to set it first.

## Files likely to change

**New**
- `lib/jobs/client.ts` — the Inngest client and typed event schema
- `lib/jobs/functions/embed-evidence.ts` — the embed-or-purge function
- `lib/jobs/functions/sweep-unembedded.ts` — the daily backfill/self-heal sweep
- `lib/jobs/index.ts` — the function registry the serve endpoint mounts
- `app/api/inngest/route.ts` — the serve endpoint (thin; external caller)
- `lib/ai/embeddings.ts` — batched `embedContent`, 429 backoff, Zod-validated response
- `lib/db/evidence-vectors.ts` — the raw-SQL vector writes, purges, and counts

**Changed**
- `lib/ai/config.ts` — embedding batch size, RPM/daily budget constants
- `app/(app)/evidence/actions.ts` — emit `evidence/classification.changed` after the commit
- `lib/db/evidence.ts` — embedded-chunk counts on `EvidenceListItem`
- `lib/db/index.ts` — export the new data-layer functions
- `app/(app)/evidence/evidence-table.tsx` — embedding state in the detail panel
- `package.json` — add `inngest`, `@google/genai`; add the Inngest dev script
- `AGENTS.md` §19 — document the new script (the section explicitly requires this)

## Implementation requirements

### The gate, as an actual chokepoint

- `lib/ai/embeddings.ts` **exposes no function that accepts raw chunk text**. Its entry point
  takes candidates carrying `{ id, classification, text }`, calls
  `partitionByClassification`, embeds only `eligible`, and returns `refused` alongside the
  vectors. There must be no exported variant that skips the partition.
- Refusals are returned and handled, never thrown and never silently dropped. The job records
  a refusal count; refusal reporting carries ids and classifications only, never text (§7.6).
- The job re-reads classification from the database (decision 1). The event payload's
  classification field, if present at all, is for observability only and must never be the
  value the gate judges.

### Embedding

- Batch chunks per request; batch size from `lib/ai/config.ts`, chosen conservatively against
  the undocumented per-request limit (decision 7).
- Request `outputDimensionality: EMBEDDING_DIMENSIONS`. Every returned vector passes
  `checkEmbeddingDimensions` before it is written; a mismatch is the typed refusal that
  module already defines, not a truncated write.
- Validate the SDK response shape with Zod before use (`AGENTS.md` §13.8). No cast past a
  parse failure, no `any`.
- Handle 429 with bounded exponential backoff, honouring a retry-delay hint when the response
  carries one. Prefer Inngest throttle for pacing (decision 8).
- Write `embeddingModel = EMBEDDING_MODEL` with every vector. A model change invalidates
  existing vectors and without this there is no safe re-embedding path.
- Only chunks with `embedding IS NULL` are embedded, so a re-run is idempotent and a partial
  failure resumes rather than restarts.

### The data layer

- Vector writes and purges are **raw SQL inside `lib/db/`** — the one carve-out `AGENTS.md`
  §6 allows, because Prisma cannot write an `Unsupported("vector(1536)")` column. Parameterise
  the vector literal and cast it; never interpolate it into the statement string.
- Purge deletes the vectors (`embedding = NULL, embedding_model = NULL`), not the chunk rows.
  The text stays; only the derived artefact goes.
- Expose an embedded-chunk count per item for the UI.

### Jobs

- `lib/jobs/client.ts` declares the event schema so payloads are typed at both send and
  receive.
- The embed function is stepped: load item → gate → batch → embed → write → log. Steps so a
  crash resumes rather than re-embedding everything already paid for.
- Concurrency and throttle configured to sit inside Gemini's 15 RPM and the Inngest free
  tier. Batch first, then fan out over batches — never one run per chunk (§14.6).
- The serve endpoint is a Route Handler with no business logic (§5.2).
- One failing item does not abort a sweep of many.

### UI

- The evidence detail panel gains an embedding line: embedded / not yet embedded, with the
  chunk counts in mono. Copy states what is true — "not yet embedded", never "verified" or
  "indexed by the system" (§8.8).
- No spinner. This is background work with no live progress to show.
- Everything stays legible at 390 / 760 / 1000 / 1300 / 1600px (§11.15).
- No red, no `destructive`.

### Logging

- Log model id, batch sizes, chunk counts, item ids, classifications, latency, outcomes.
- **Never log chunk text, prompts, or completions** (§7.6, §13.9) — including inside a caught
  error. A pdf.js-style error carrying document content in its message must not be re-logged.

## Evidence classification impact

**This task is the first thing in the codebase that sends evidence to a model**, so the gate
stops being structural and starts being load-bearing.

- **Classifications involved:** all three. Only `public_published` is embedded.
  `community_sourced` and `unpublished_internal` are refused, counted, and — critically —
  *purged* if they previously held vectors.
- **Of the eight gated call types, this touches exactly one: embedding.**
- **Enforcement points in code:**
  - `lib/ai/embeddings.ts` — the entry point calls `partitionByClassification` and has no
    unchecked path. This is the door.
  - `lib/jobs/functions/embed-evidence.ts` — re-reads classification from the database rather
    than trusting the event payload (decision 1).
  - `lib/db/evidence-vectors.ts` — the purge path, so a downgrade removes derived vectors.
- **What happens to blocked items:** nothing is sent, the refusal is counted in the job's
  `IngestionLog` row, and the evidence detail panel shows the chunks as not embedded. An item
  downgraded from `public_published` has its vectors deleted, so it disappears from retrieval
  entirely.
- **Logging:** ids, classifications, counts, model id, timings. No chunk text anywhere.

## Hallucination-guard implications

None. No generation, no claim extraction, no flag storage, and no change to flag rendering or
to what a flag blocks. `HallucinationFlag` is untouched. This prompt produces vectors, not
prose, so there is nothing to fact-check — but it is the step that makes the guard's future
job possible, since a claim can only be traced to a chunk that retrieval can find.

## Security requirements

- `GOOGLE_GENERATIVE_AI_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` are server-only
  and never reach browser code (§18). A missing key fails clearly and server-side.
- The Inngest serve endpoint verifies request signatures via `INNGEST_SIGNING_KEY`. It is an
  external caller's endpoint: no login, and therefore signature verification is the control.
- `lib/ai/`, `lib/jobs/`, `lib/db/` are all `server-only`. No embedding, no Prisma, no job
  invocation from client code (§18).
- Raw SQL is parameterised. No string interpolation of vectors or ids.
- No evidence body text in a log line, a Sentry event, or a PostHog property.

## Acceptance criteria

1. Tagging an item `public_published` results in every one of its chunks carrying a vector of
   exactly `EMBEDDING_DIMENSIONS` and `embeddingModel = EMBEDDING_MODEL`.
2. Tagging an item away from `public_published` deletes its vectors while leaving the chunk
   rows and their text intact.
3. `lib/ai/embeddings.ts` exposes no path that embeds text without passing the gate, and no
   flag, parameter, env var, or branch that disables the check.
4. The job re-reads classification from the database; forging a payload with
   `classification: "public_published"` for a `community_sourced` item embeds nothing.
5. Re-running the job over an already-embedded item performs no Gemini calls.
6. A 429 is handled with backoff and does not crash the run or lose already-written vectors.
7. A returned vector of the wrong length is refused via `checkEmbeddingDimensions` and never
   written.
8. The daily sweep finds and embeds eligible items that have unembedded chunks, including the
   two already sitting at `public_published` today.
9. One failing item does not abort a sweep covering several.
10. `IngestionLog` gains a row per embedding run with counts and outcome, and no chunk text.
11. No chunk text appears in any log line, including on the error paths.
12. `/evidence` shows embedding state per item, legible at all five widths, with no red.
13. No migration was run; `prisma/schema.prisma` is unchanged.

## Checks to run

- `npm run lint` — expect only the 4 known pre-existing errors (`components/ui/carousel.tsx`,
  `hooks/use-mobile.ts`, and two in `design_handoff_evibrief/support.js`)
- `npm run typecheck`
- `npm run build` — new dependencies and a new route handler make this mandatory
- No `db:migrate` run is expected. If one becomes necessary, **stop and report it** rather
  than proceeding (§19's `migrate dev` warning applies to the vector indexes this touches).

Report exact output. Never claim a check passed without running it.

## Manual test steps

1. Set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local` — it is currently absent, and nothing
   below works without it. `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` are not needed for
   local development against the Inngest dev server.
2. Run `npm run dev` in one terminal and the Inngest dev server in another (the script this
   prompt adds). Confirm the dev server discovers the functions at `/api/inngest`.
3. In `npm run db:studio`, confirm your `StaffUser.role` is `research_officer`.
4. Ingest a fresh document per prompt 06 and tag it `public_published` in `/evidence/queue`.
5. Watch the Inngest dev UI: the `evidence/classification.changed` event fires and the embed
   function runs. Confirm the step list shows batching, not one step per chunk.
6. In Studio or via SQL, confirm every chunk of that item has a non-null `embedding` and
   `embedding_model = gemini-embedding-2`.
7. Reload `/evidence` and confirm the detail panel reports the item as embedded, with counts.
8. Re-send the same event from the Inngest dev UI. Confirm the run completes with **zero**
   Gemini calls — nothing is re-embedded.
9. Tag that item `community_sourced`. Confirm its vectors are deleted, its chunk rows and
   text survive, and the detail panel no longer reports it as embedded.
10. From the Inngest dev UI, send `evidence/classification.changed` for a
    `community_sourced` item with a forged payload claiming `public_published`. Confirm
    nothing is embedded and the refusal is recorded.
11. Trigger the sweep manually from the dev UI. Confirm it picks up the two items already at
    `public_published` and embeds them.
12. Read the terminal output and the `IngestionLog` rows from every run above. Confirm counts,
    ids, and model ids are present and **no document or chunk text appears anywhere**.
13. Temporarily set an invalid `GOOGLE_GENERATIVE_AI_API_KEY` and re-run. Confirm a clear
    server-side failure and a recorded outcome, not an unhandled crash.
14. Check `/evidence` at 390, 760, 1000, 1300, and 1600px. No horizontal page scroll, no red.
