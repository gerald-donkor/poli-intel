# 13 — Policy Radar: the first signals, detected, deduplicated, and classified

## Goal

Give EviBrief its **first `policy_signal` rows**, produced by scheduled jobs
rather than by hand. Nothing in the repository reads or writes `PolicySignal`
today — the model, its enums, its vector column and `SignalReclassification` are
all in `schema.prisma` and entirely unused. This prompt is what makes the
Policy Radar real.

Four things, one body of work:

- **The source registry** — all seven spec §3.2 sources in one config module,
  each with its cadence and its retrieval method, including the genuinely
  conditional "daily during COP" (`inngest-jobs`, §14.2).
- **The fetch** — RSS polling and Playwright scraping, one Inngest function per
  source so a dead source cannot abort the batch (§14.5).
- **The dedup** — two layers, because they catch different things: Inngest event
  idempotency, and domain-level fuzzy matching *before* the insert (§14.4).
- **The classification** — urgency, relevance, impact area, geography and
  audience target, as a Zod-validated structured Gemini call (§13.8).

**Classification is in scope, and that is a correction to the plan.** The
intention was detection in 13 and classification in 14. The schema forbids it:
`PolicySignal.urgency`, `.relevance`, `.impactArea` and `.geography` are all
non-nullable, faithfully to spec §4.1's field list, so there is no such thing as
a stored unclassified signal. `inngest-jobs` independently states the radar job
shape as **"Fetch → extract → deduplicate → create signal → classify"**. The
alternative — migrating four columns to nullable — would put half-built rows in
front of a reviewer, force every downstream read to handle null, and break the
kanban board, which groups by urgency. Classification stays in the pipeline
where both the schema and the skill put it.

**Explicitly out of scope, and named so the boundary is deliberate:**

- **Gemini grounded-search detection** for the two news sources (Reuters /
  AllAfrica, minister statements). It is a different mechanism with different
  failure modes — no deterministic fetch, no stable URL to dedupe on — and it
  earns its own prompt. The registry still **declares** those sources with their
  cadence and method; the scheduler records an explicit `not_implemented` run
  outcome for them rather than skipping silently, so the gap analysis reads
  "not yet monitored" and never "a quiet week" (§14.7).
- **The signal dashboard.** `/signals` stays a `ScreenPlaceholder`. The kanban
  board, drag-to-reclassify and `SignalReclassification` writes are prompt 15.
- **The morning digest and the weekly gap analysis.** Both consume the run
  records this prompt creates; neither is built here. No Resend dependency.
- **The Evidence Matcher.** This prompt emits `signal/detected` and stops.
  Nothing subscribes yet, and that is correct (§5.1).
- **Anything that advances a signal.** Signals are created at `new` and no code
  here moves one (§8.5).

## Skills read

- `inngest-jobs` — the full §14 contract: the seven-source cadence table and its
  retrieval methods, the two dedup layers, per-source failure isolation, the
  fetched-vs-failed distinction that the gap analysis needs, the free-tier
  budget, and rule 8 — detection triggers the Matcher and **never** the Brief
  Generator
- `supabase-schema` — the `policy_signal` field list, enums defined once, "no
  speculative indexes", the 500MB budget, and migrations-only
- `gemini-integration` — the central config module, 429 backoff, structured
  output via `responseJsonSchema` and its allow-list, Zod validation with one
  retry, and the instruction to prefer Inngest flow control over hand-rolled
  sleeps inside a step
- `evidence-governance` — **applies, and not vacuously**: signal classification
  is call type 3 in the gate's covered list. See the classification section for
  where the enforcement point sits and why there are no refusals to surface.
- `playwright-skill` — scraping mechanics for the structured sources
- `inngest-durable-functions`, `inngest-steps`, `inngest-flow-control`,
  `inngest-events` (vendor) — cron triggers, step memoization, throttle and
  concurrency, event idempotency keys

## Existing code inspected

- `prisma/schema.prisma` — `PolicySignal` carries `sourceUrl`, `sourceName`,
  `detectedAt`, the four required enum columns, `summaryText`, `status`
  (`@default(new)`), `embedding vector(1536)` and `embeddingModel`. Indexes on
  `status`, `urgency`, `detectedAt`. **`AudienceTarget` is declared as an enum
  and used by no model** — §1's classification list names audience target, so
  the column is missing and this prompt adds it.
- `lib/jobs/client.ts` — the client (`isDev` from `NODE_ENV`), `eventType` /
  `staticSchema` event declarations, and the standing rule that **event payloads
  carry ids, never text**. `sendEvidenceClassificationChanged` is the pattern for
  emitting after a commit rather than inside it.
- `lib/jobs/index.ts` — the registry the serve endpoint mounts; a function absent
  from this array does not exist to Inngest.
- `lib/jobs/functions/embed-evidence.ts`, `sweep-unembedded.ts` — the only two
  functions today, and the precedent for batching and fan-out.
- `lib/ai/config.ts` — `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS = 1536`,
  `GEMINI_RPM_BUDGET`, `GEMINI_DAILY_REQUEST_BUDGET`. The radar's model settings
  belong here, not in a job.
- `lib/ai/structured.ts` — `callStructured<T>` already implements the
  `responseJsonSchema` allow-list and Zod validation. Classification uses it
  rather than a second structured-call path.
- `lib/ai/gemini.ts` — `getGeminiClient`, `toGeminiRequestFailure`,
  `readRetryDelayMs`; the 429 handling exists and is reused.
- `lib/ai/embeddings.ts` — the embedding call the signal vector needs.
- `lib/db/evidence-vectors.ts` — `searchEvidenceChunksByVector` is the precedent
  for a raw pgvector query living in the data layer.
- `app/(app)/signals/page.tsx` — a 24-line `ScreenPlaceholder`. Untouched here.
- `package.json` — **Playwright is not installed.** Inngest is (`inngest@4`,
  `inngest-cli` dev, `npm run inngest:dev`).
- `AGENTS.md` §19 — names no test or Playwright script yet, and says the prompt
  that first introduces one adds it and updates §19 in the same change.

## Decisions and assumptions

1. **Classification ships with detection.** Reasoning in the goal. The four enum
   columns are non-nullable and `inngest-jobs` states the job shape.

2. **One config module owns the source registry**, `lib/radar/sources.ts`:
   name, base URL, cadence, retrieval method (`rss` | `scrape` | `grounded`),
   and the signal types it produces. This is the single answer to "how often do
   we check the Gazette?" (§14.2). **No cadence literal appears in a job.**

3. **"Daily during COP" is expressed, not flattened.** The registry holds a
   period-dependent cadence — a base cadence plus named intensified windows with
   date ranges. Hard-coding the busier rate all year burns the free-tier budget
   for eleven months; hard-coding the quieter one misses the fortnight that
   matters. The COP window dates are config data, editable without a deploy
   being *correct* is out of scope — a constant is fine, a silent yearly rate is
   not.

4. **One Inngest function per retrieval method, fanned out per source** — not one
   giant radar function. A cron function per cadence bucket emits one
   `radar/source.fetch.requested` per due source; the fetch function handles a
   single source. That is how a timeout on ITTO cannot lose the day's Gazette
   results (§14.5), and it is also how retries stay per-source.

5. **Domain-level dedup is fuzzy and runs before the insert.** Inngest's
   idempotency key stops the same *run* processing twice; it cannot stop two
   fetches of the same real-world event becoming two signals — a Gazette notice
   reachable at two URLs is one policy window (§14.4). The match is normalised
   title similarity within a recency window, plus exact `sourceUrl`. **A near
   match updates `detectedAt` on the existing row and creates nothing.** Cleaning
   up afterwards is not dedup; a duplicate that reached a reviewer has already
   cost their attention.

6. **The similarity function is deterministic and local — not a Gemini call.**
   Token-set ratio over normalised titles. Spending a model request per candidate
   pair against a 1,500/day budget to answer "are these the same notice" is the
   wrong trade, and a non-deterministic dedup is untestable.

7. **A new `RadarRun` table records every attempt**, per source: started, source
   name, outcome (`found` | `empty` | `failed` | `not_implemented`), items seen,
   signals created, duplicates suppressed, and a machine-readable failure reason.
   This is what makes §14.7's "silence is reported, not assumed" possible — the
   gap analysis cannot distinguish a broken scraper from a quiet week without it.
   Not speculative: it has a named consumer in the build list.

8. **The signal is embedded when it is created.** `PolicySignal.embedding` and
   its HNSW index already exist; a signal without its vector is a signal the
   Evidence Matcher cannot see, and a backfill job later costs more than one call
   now. Embedded from `summaryText`, batched across a run, recording
   `embeddingModel` (`supabase-schema`, dimensionality).

9. **Classification and embedding both go through `lib/ai/`**, never inline in a
   job (§5.3). The job orchestrates; the AI layer calls.

10. **A classification that fails validation twice does not become a signal.**
    `callStructured` retries once. A second failure records the run as `failed`
    with a reason and creates nothing — rather than inventing a default urgency,
    which would put a fabricated priority in front of a reviewer. The source is
    re-fetched on its next cadence.

11. **A 429 mid-run is a handled, recorded outcome, not a crash** (§13.3). Inngest
    throttle keeps the radar inside the RPM ceiling; a 429 that still lands
    records the run and lets the next cadence retry. No hand-rolled sleep inside
    a step (`gemini-integration`).

12. **Signals are created at `new` and nothing advances them** (§8.5). No code in
    this prompt writes `reviewed`, `actioned` or `archived`.

13. **`signal/detected` is emitted with no subscriber.** The Evidence Matcher
    will subscribe (§14.8). It is emitted **after** the insert commits, following
    `sendEvidenceClassificationChanged`'s precedent. It carries the signal id and
    nothing else — never `summaryText` (§7.6, and `lib/jobs/client.ts`'s own
    header rule).

14. **Playwright is added as a dependency with its script, and `AGENTS.md` §19 is
    updated in the same change** — §19 says exactly this, and referencing a
    script before it exists is what it forbids.

15. **Scraped source text is not evidence and is never written to
    `evidence_item`.** A policy document the radar fetches is the *subject* of a
    signal, not a source in the knowledge base. Conflating them would route
    unclassified external text into the evidence library behind the gate's back.

## Files likely to change

New:

- `lib/radar/sources.ts` — the registry: cadence, method, intensified windows
- `lib/radar/dedup.ts` — normalisation and the similarity function, pure and unit-testable
- `lib/radar/extract.ts` — RSS parsing and per-source scrape extraction to a common `DetectedItem`
- `lib/ai/classify-signal.ts` — the structured classification call and its Zod schema
- `lib/db/signals.ts` — `findRecentSignalsForDedup`, `createClassifiedSignal`, `recordRadarRun`
- `lib/jobs/functions/radar-schedule.ts` — the cron functions that fan out per due source
- `lib/jobs/functions/radar-fetch.ts` — one source: fetch → extract → dedup → classify → create → emit
- `prisma/migrations/<ts>_policy_radar/migration.sql` — `RadarRun`, `PolicySignal.audienceTarget`

Changed:

- `prisma/schema.prisma` — the `RadarRun` model, `audienceTarget` on `PolicySignal`
- `lib/jobs/client.ts` — `radar/source.fetch.requested` and `signal/detected` event types
- `lib/jobs/index.ts` — register the new functions
- `lib/ai/config.ts` — the classification model settings
- `lib/db/index.ts` — the new exports
- `package.json` — Playwright and its script
- `AGENTS.md` §19 — the new script
- `.env.example` — any source URL that belongs in config rather than code

## Implementation requirements

### The migration

- Authored with **`npm run db:migrate:new -- policy_radar`**, never
  `prisma migrate dev` (§19). Review the generated SQL before applying.
- `PolicySignal.audienceTarget` uses the existing `AudienceTarget` enum. It is
  **nullable or defaulted** — decide and state which; unlike the other four it is
  being added to a table that may already hold rows.
- `RadarRun` indexes what the gap analysis queries — source name and started-at —
  and nothing else (§12.5, no speculative indexes).
- No vector column is added, so no HNSW index is at stake in this migration. If
  that changes, the index is hand-written per §19 and named `*_embedding_cosine_idx`.

### The pipeline, per source

`fetch → extract → deduplicate → classify → create → embed → emit`, with each
source isolated:

- Bounded retries with backoff, per source (`inngest-durable-functions`).
- A failure records a `RadarRun` with its reason and **does not** fail sibling
  sources.
- Throttle sized against `GEMINI_RPM_BUDGET`, leaving headroom for interactive
  generation exactly as the embedding budget already does in `lib/ai/config.ts`.
- Every outcome writes exactly one `RadarRun` row — including the empty one.

### Classification

- Structured output through the existing `callStructured`, with a Zod schema
  covering the five fields. **No `any`, no cast past a parse failure** (§13.8).
- Model settings from `lib/ai/config.ts`. **No model ID in a job** (§13.1).
- The prompt gives the model the source's public document text and asks for the
  five enum values. It carries **no evidence context** — see below.
- Enum values come from the Prisma enums, not from a re-declared string union
  (§12.7).

## Evidence classification impact

**Call type 3 is touched. There is no evidence data path, and that is enforced
structurally rather than asserted.**

- Signal classification is explicitly item 3 in `evidence-governance`'s covered
  list ("signal urgency/relevance/impact-area/geography/audience scoring"), so
  this is **not** a "no AI path" task and must not be written up as one.
- **The enforcement point is the signature of `classifySignal` in
  `lib/ai/classify-signal.ts`**: it accepts a `DetectedItem` — source name,
  source URL, title, and the fetched public document text — and has **no
  parameter that can carry an `EvidenceItem`, an evidence id, or a chunk**. There
  is no path by which evidence reaches this call, so there is nothing for the
  gate to partition and **no refusals to surface**. That is the correct shape:
  the gate exists to keep ineligible evidence away from a model, and the way to
  satisfy it here is to make evidence unrepresentable in the input.
- **Scraped source text is not evidence** (decision 15). Nothing in this prompt
  writes to `evidence_item`, reads `classification`, or touches a chunk table.
  A fetched Gazette notice never enters the knowledge base.
- The `signal/detected` payload carries the signal id only. `summaryText` is
  derived from an external public document, but the standing rule in
  `lib/jobs/client.ts` is that payloads carry ids, and it is not being weakened
  for this one.
- **Logging: source name, run outcome, item counts, signal ids, model id, token
  counts, latency. Never document text, never a scraped body, never a prompt or
  completion** (§7.6, §13.9).

## Hallucination-guard implications

**None — no generated brief exists on this path.**

The guard verifies a *generated brief's* claims against the evidence context
passed to its generator (§9.2). This prompt generates no brief, extracts no
claims, writes no `HallucinationFlag` row, and renders no flag. Detection
triggers the Evidence Matcher and stops; it never reaches the Brief Generator
(§8.4, §14.8), so no fact-check pass is owed and none is skipped.

Nothing here changes what gets flagged, how claims are extracted, when the pass
runs, how anchors are stored, how flags render, who may clear one, or what
clearing one enables.

## Security requirements

- Scraping, RSS polling, classification and embedding run **server-side in
  Inngest functions only** — never in browser code, never in a request handler
  (§18, §14.1).
- No new secret reaches the client. Source URLs that live in `.env` are
  server-only and never `NEXT_PUBLIC_*`.
- **Playwright fetches untrusted remote pages.** Extraction takes text content
  only — no evaluation of page scripts into application state, no writing
  fetched HTML into the database unescaped, and a bounded page timeout and
  response size so a hostile or broken page cannot hang or exhaust a run.
- `sourceUrl` is validated as an absolute `http(s)` URL before it is stored;
  it is later rendered as a link.
- Logging as stated above: ids, counts and outcomes only.
- Playwright is a new dependency — pin as the installer resolves it, and add
  nothing else alongside it.

## Acceptance criteria

1. `npm run inngest:dev` shows the new functions registered at `/api/inngest`.
2. Triggering a due-source cron in the Inngest UI fans out one fetch per due
   source, and each appears as its own run.
3. An RSS source and a scraped source each produce at least one `PolicySignal`
   row with all five classification values populated and `status = new`.
4. Every run writes exactly one `RadarRun` row, including a source that found
   nothing — `empty` and `failed` are distinguishable in the table.
5. A source made to fail (bad URL) records `failed` with a reason and **does not
   prevent** sibling sources in the same fan-out from succeeding.
6. Re-running the same source immediately creates **no** duplicate signal; the
   existing row's `detectedAt` moves and the run records the suppression count.
7. Two entries for the same real-world notice at different URLs collapse to one
   signal.
8. A `grounded`-method source records `not_implemented` rather than `empty`.
9. Each created signal carries a 1536-dimension embedding and its
   `embeddingModel`.
10. `signal/detected` is emitted once per created signal, carries only the id,
    and triggers no brief generation.
11. No cadence literal and no model ID appears outside `lib/radar/sources.ts` and
    `lib/ai/config.ts`.
12. A forced classification-validation failure creates no signal and records the
    run as failed — no default urgency is invented.
13. The dev-server and Inngest logs contain no document text, no scraped body,
    and no prompt or completion.
14. `npm run lint`, `npm run typecheck` and `npm run build` pass with no new
    findings in this change's files.

## Checks to run

```
npm run db:migrate:new -- policy_radar   # review the SQL, then:
npm run db:migrate
npm run lint
npm run typecheck
npm run build
```

Report exact output. The four known pre-existing lint errors
(`components/ui/carousel.tsx`, `hooks/use-mobile.ts`,
`design_handoff_evibrief/support.js`) are expected and are not to be "fixed".

**This prompt has a migration.** Author it with `db:migrate:new`, never
`prisma migrate dev` (§19). **It also adds the first Playwright tooling**, so its
script goes into `package.json` and `AGENTS.md` §19 in this same change.

## Manual test steps

1. `npm run dev` and `npm run inngest:dev` side by side. Open
   <http://localhost:8288> and confirm the radar functions are discovered.
2. Trigger the daily cadence function. Watch the fan-out: one run per due source,
   each with its own step trace.
3. `npm run db:studio` → `policy_signal`: new rows, all five classification
   values set, `status = new`, embeddings present.
4. `radar_run`: one row per source per run, with outcomes distinguishable.
5. Trigger the same source again. Confirm no second signal, `detectedAt` updated,
   and the run's suppression count incremented.
6. Point one source at an unreachable URL and re-trigger. That source records
   `failed`; the others in the same fan-out still succeed.
7. Trigger a `grounded` source: `not_implemented`, no signal, no error.
8. Read both terminals for the whole session: source names, counts, outcomes and
   ids — no scraped text, no prompt, no completion.
9. Confirm `/signals` is unchanged and still the placeholder.
