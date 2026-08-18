# 40 — Demo seed data and client demo script

## Goal

EviBrief's build list (AGENTS.md §1) is committed through prompt 39 — every module in
the spec exists in code. What is missing is anything to *show*: the database is empty,
so a walkthrough for Tropenbos Ghana would open onto an empty evidence library and an
empty signal board. This prompt adds:

1. `prisma/seed.ts` — a repeatable, idempotent seed script that populates a believable
   slice of the product: evidence at all three classifications, a classification queue,
   Policy Radar signals with real Evidence Matcher output, one fully generated brief
   carrying an open hallucination-guard flag (so the flag-resolution and approval steps
   are demoable live, not just visible as a screenshot), a stakeholder CRM with brief
   history, a verified influence event, and a field submission awaiting review.
2. `npm run db:seed` script wired to it.
3. `docs/demo-script.md` — the walkthrough itself: what to click, in what order, what
   each screen is proving, and the honest caveats (empty/rate-limited/offline states,
   optional services that are inert without configuration).

This is demo preparation, not a new product feature. No new route, Server Action,
schema field, or UI is added. Everything the seed data touches already has a screen.

## Skills read

- `evidence-governance` — the seed data is the classification gate's demo surface: it
  must show all three classifications, a non-trivial pending-classification queue, and
  prove the gate holds (a `community_sourced` field submission never reaches embedding
  or generation). Fabricated demo text may legitimately be sent to Gemini once
  classified `public_published` — it is synthetic, not real Tropenbos community data,
  so §7 is satisfied by classification, not by avoidance.
- `gemini-integration` — the seed script's embedding step must go through
  `embedEvidenceCandidates` (the gate's only door into the model), never call the SDK
  directly, and must handle `missing_api_key`/`rate_limited`/`request_failed` as real,
  reported outcomes rather than crashing the seed.
- `supabase-schema` — chunk/embedding write pattern (`writeChunkEmbeddings`, raw SQL
  for the `Unsupported("vector(1536)")` columns), 512-token chunking via
  `chunkDocument`, and the 500MB budget (seed data must stay small: short evidence
  texts, not full PDFs).
- `evidence-matcher` — the fixed retrieval order and the `EvidenceMatchRun` /
  `SignalEvidenceMatch` shapes the seed writes directly (bypassing the live pgvector
  query, since seed evidence is small and the match set can be authored by hand) must
  still look exactly like a real matcher run's output, including one run left at
  `outcome: gap` to demo the explicit-gap state.
- `brief-output` — the standard brief structure, audience profile fields, and what a
  `Brief` + `BriefVersion` + `BriefEvidence` + `BriefGeneration` set must record
  together for `/briefs/[id]` to render as a real completed generation.
- `hallucination-guard` — the seeded flag must match the stored contract exactly
  (`anchorFrom`/`anchorTo`/`claimText`/`reason`/`checkedEvidenceItemIds`, `status: open`)
  so the flag renders with the real slate/pulse treatment, not a stub.
- `server-actions` — confirms `provisionStaffUser` only ever defaults a *new* sign-in to
  `field_officer`; seeding `StaffUser` rows first with real Tropenbos emails and the
  intended role is what makes the live Google sign-in land each attendee in the right
  role rather than everyone starting as Field Officer.

## Existing code inspected

- `prisma/schema.prisma` — all 22 models and their enums; the vector columns are
  `Unsupported("vector(1536)")` and unreachable from `prisma.create()`.
- `lib/db/evidence-vectors.ts` — `writeChunkEmbeddings` (parameterised raw SQL,
  binds each 1536-float vector as a JSON string cast to `::vector`, never
  interpolated) is the only place a vector may be written; the seed script reuses it
  rather than reimplementing raw SQL.
- `lib/db/evidence.ts` — `createEvidenceShell`, `completeEvidenceExtraction`,
  `classifyEvidenceItem` (writes the `EvidenceClassificationChange` audit row),
  `createFieldSubmission`. Reusing these means seed data is written through the same
  functions the app itself uses, not a parallel path that could silently drift from the
  real write contract.
- `lib/ingestion/chunk.ts` — `chunkDocument` produces `TextChunk[]` at the real 512-token
  boundary logic; reused rather than hand-splitting seed text.
- `lib/ai/embeddings.ts` — `embedEvidenceCandidates` is the sole gated entry point;
  confirmed it partitions by classification before ever building a request, and returns
  refusals as typed data rather than throwing.
- `lib/ai/config.ts` — `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` (1536); no model id
  will be inlined in the seed script.
- `auth.ts`, `lib/db/staff.ts` (`provisionStaffUser`) — confirms first sign-in on an
  unseeded email defaults to `field_officer`; a pre-seeded `StaffUser` row with a chosen
  `role` is preserved because the upsert's `update` clause only touches `name`.
- `package.json` — `db:generate`, `db:migrate`, `db:migrate:new`, `db:studio` exist;
  no `db:seed` or `prisma.seed` config yet, and no `prisma/seed.ts`.
- `prompts/33-core-regression-test-harness.md` — confirms the credential-free test
  suite deliberately avoids seed data; this prompt's seed script is a separate,
  developer-run tool and must not become a dependency of `npm run test`.
- `.env.example` — `AUTH_ALLOWED_DOMAIN`, `GEMINI_API_KEY`/equivalent, `DIRECT_URL`/
  `DATABASE_URL` are the vars the seed script needs present; nothing new is added.

## Decisions and assumptions

1. **The seed script is a real pipeline run, not fabricated rows pretending to be
   one.** Evidence goes in through `createEvidenceShell` → `completeEvidenceExtraction`
   → `classifyEvidenceItem` → `embedEvidenceCandidates` → `writeChunkEmbeddings`, in
   that order, for every evidence item. This is deliberate: it proves the actual
   ingestion→classification→embedding pipeline works end to end as part of seeding,
   which is worth more in a demo than static rows. It also means seeding genuinely
   needs `GEMINI_API_KEY` (or equivalent) set and reachable — the script must fail
   loud and clear if it is not, never write items with permanently-null embeddings and
   call that success.
2. **Radar and matcher output is authored, not computed live.** `RadarRun`,
   `EvidenceMatchRun`, and `SignalEvidenceMatch` rows are inserted directly (via
   Prisma, not raw SQL — none of these carry vector columns) with plausible
   similarity/rerank numbers, rather than running the real scraper or the real pgvector
   query against six seed rows. Running the actual Playwright radar or the actual
   Inngest matcher job is out of scope for a seed script and belongs to `npm run
   inngest:dev`, which the demo script separately offers as an optional live segment.
3. **Exactly one signal gets a full generated brief with an open flag.** Multiple
   generated briefs would dilute the walkthrough; one signal (the EUDR one, chosen for
   client relevance per AGENTS.md §1.0) carries a complete `BriefGeneration` →
   `Brief` → `BriefVersion` → `BriefEvidence` → one open `HallucinationFlag`. The other
   signals stay at `new`/`reviewed` with only matcher output, so the board shows real
   variety (a kanban with one card per urgency lane) without every card being a
   finished story.
4. **Emails are placeholders the user must edit before running.** The script cannot
   know real Tropenbos staff Google Workspace addresses. It seeds four `StaffUser`
   rows keyed to `${role}@example.org`-style placeholders read from four new optional
   env vars (`SEED_DIRECTOR_EMAIL`, `SEED_POLICY_OFFICER_EMAIL`,
   `SEED_RESEARCH_OFFICER_EMAIL`, `SEED_FIELD_OFFICER_EMAIL`), each falling back to a
   clearly-fake `@tropenbosghana.example` address with a console warning if unset. This
   is called out prominently in `docs/demo-script.md` as the one step the user must do
   themselves before a live client session: set those four env vars to the real Google
   accounts that will be in the room, so Workspace sign-in lands each attendee in the
   right role instead of everyone defaulting to Field Officer.
5. **Idempotent via a fixed seed key, not `deleteMany` first.** Every seeded row uses a
   stable, hardcoded natural key (`citationKey` for evidence, `sourceUrl` for signals,
   a fixed `stakeholder.name`+`organisation` pair, etc.) and the script upserts /
   skip-if-exists rather than wiping tables. Re-running `npm run db:seed` after a demo
   (e.g. after the audience clicks "approve") must not destroy what they did — it must
   leave existing rows alone and only fill in what's missing. This also means it is
   safe to run against a database that already has real ingested evidence from earlier
   development.
6. **No production guard needed beyond existing practice.** `db:migrate` already runs
   the same command in dev/CI/prod per AGENTS.md §19; seeding is a separate,
   never-automatic `npm run` script the user runs by hand, same as `db:studio`. It is
   not wired into `postinstall`, `db:migrate`, or any CI job.
7. **Demo script is a doc, not a slide deck or a new UI.** `docs/demo-script.md`
   covers: pre-demo checklist (env vars, `npm run dev`, optionally `npm run
   inngest:dev`), the click path through each module in the order that tells the
   traceability story (signal → matcher → generate → resolve flag → approve → export →
   audience switch → stakeholder share → impact map → field submission → offline
   banner), a line for each of the five required UX states in AGENTS.md §17.6 showing
   exactly where in the seeded data that state is already sitting, and an honest
   "what's not wired up yet" section (Pandoc/PDF export, Sentry, PostHog, WhatsApp/USSD
   real credentials — all inert-by-default per AGENTS.md §19's documented states,
   which is fine to say plainly rather than route around).
8. **`docs/` is a new top-level directory.** No such directory exists yet; created
   for this one file. Nothing else moves into it as part of this prompt.

## Files likely to change

- `prisma/seed.ts` — new.
- `package.json` — add `"db:seed": "tsx prisma/seed.ts"` (or the project's existing
  TS script runner if `tsx` is already a devDependency; use whatever the repo already
  uses for standalone TS scripts, confirmed during implementation) and register
  `"prisma": { "seed": "..." }` if `prisma db seed` compatibility is wanted — check
  installed Prisma version's expectations before adding.
- `docs/demo-script.md` — new.
- `.env.example` — add the four `SEED_*_EMAIL` vars with comments, appended to the
  existing list; no existing entry changes.
- `README.md` — one line pointing at `npm run db:seed` and `docs/demo-script.md`, if
  the README already documents `npm run` scripts (confirm during implementation before
  adding a new pattern to it).

## Evidence classification impact

Yes — this task's entire purpose is to populate the classification gate's states, so it
is examined in full rather than written off.

- **Classifications seeded:** all three. `public_published` (embedded, searchable,
  matcher-eligible — the EUDR regulation text, a Ghana Forestry Commission notice, two
  Tropenbos-style research summaries), `unpublished_internal` (one item left exactly
  where every new upload lands by schema default, demonstrating the pending-queue
  count), `community_sourced` (one field submission, entered through
  `createFieldSubmission` exactly as `/field/submit` would write it).
- **Enforcement point exercised:** `embedEvidenceCandidates`
  (`lib/ai/embeddings.ts:116`), which calls `partitionByClassification`
  (`lib/governance/gate.ts:52`) before any request is built. The seed script embeds
  only the items it has itself classified `public_published`; it must never call
  `embedEvidenceCandidates` with a `community_sourced` or `unpublished_internal`
  candidate to "test" the refusal path by triggering it — the refusal is proven by
  omission (those items simply have `embedding IS NULL` after seeding), matching how
  the pending-classification queue UI already reads that state.
- **What happens to blocked items:** the `unpublished_internal` and `community_sourced`
  seed rows are visible in the classification queue (`listPendingClassification`) and
  absent from Evidence Library search and Evidence Matcher candidates, exactly as
  `ELIGIBLE_EVIDENCE_WHERE` already enforces — nothing new to build, this is the
  existing gate rendering correctly once there is data to show it against.
- **Community-sourced data stays put:** the one seeded field submission is fabricated
  text authored for this prompt, not real Tropenbos field data, so there is no
  real-data-handling question here — but the seed script still must not embed it or
  send it to Gemini for any reason, proving the script itself respects the gate it is
  demonstrating.

## Hallucination-guard implications

One seeded flag, and it changes nothing about how flags are extracted, verified,
stored, or rendered — it is authored data written directly into the existing
`HallucinationFlag` shape so the existing UI has something real to show.

- The flag is written with `status: open`, a real `claimText` lifted verbatim from the
  seeded `BriefVersion.bodyText` (so `anchorFrom`/`anchorTo` genuinely index into that
  text — computed by locating the substring, not guessed), `reason: unsupported`, and
  `checkedEvidenceItemIds` set to the brief's actual seeded evidence set.
- This is what lets the demo show the real thing: slate, single settling pulse, blocks
  Programme Director approval server-side (not just a disabled button) until a Research
  Officer or Programme Director resolves it live during the walkthrough. No visual
  contract change; this prompt only supplies the data that makes the existing contract
  visible.
- The demo script explicitly walks the approval refusal — attempting to approve with
  the flag still open, seeing the server-side refusal, then resolving the flag and
  approving successfully — because that refusal is the single clearest proof of AGENTS.md
  §9.5 working, and it costs nothing extra to seed for.

## Security requirements

- The seed script is a local developer tool, never a route handler, never reachable
  over HTTP, and never imported by application code.
- It must fail loud (non-zero exit, clear message) rather than partially seed if
  `GEMINI_API_KEY`/equivalent or the database connection is missing — no silent
  fallback to unembedded "demo-ish" data presented as if seeding fully succeeded.
- No real credential, real staff email, or real Tropenbos data goes into the script or
  `docs/demo-script.md`. Every name, org, quote, and evidence excerpt is clearly
  fabricated (a closing note at the top of the seed file says so) so nobody mistakes
  seeded content for a real Tropenbos finding if it were ever screenshotted out of
  context.
- Seeded evidence text sent to Gemini for embedding is fabricated, non-sensitive, and
  fine to leave in the free tier's training-eligible flow per the same reasoning
  AGENTS.md §7.7 already allows for non-real data — this is not an exception to the
  gate, it is the gate correctly classifying synthetic public content as
  `public_published`.
- `.env.example` additions are placeholders only (`SEED_DIRECTOR_EMAIL=` with no
  value), matching the existing file's convention.

## Acceptance criteria

- `npm run db:seed` runs against a locally migrated database and a real `GEMINI_API_KEY`
  and completes without manual intervention, printing a short summary (counts per
  model) on success.
- Re-running `npm run db:seed` immediately after is a no-op that reports "already
  seeded" per row rather than erroring on unique-constraint violations or duplicating
  rows.
- After seeding: the evidence library shows items across all three classifications and
  a non-zero pending-classification count; the signal board shows multiple signals
  across at least two urgency lanes with real matcher output including one explicit
  gap; `/briefs/[id]` for the seeded EUDR brief renders a complete document with one
  visible open flag; attempting Programme Director approval on it is refused
  server-side until the flag is resolved; the stakeholder page shows at least one
  contact with brief-share history; the impact map has at least one verified influence
  event to draw; `/field` shows the seeded pending field submission in the research
  officer's review queue.
- `docs/demo-script.md` exists, names the pre-demo checklist first, and every click
  step references a real seeded record by name (not "a signal" but "the EUDR
  deforestation-free supply chains notice").
- No evidence body text, staff email, or fabricated-but-realistic content appears in
  any commit message, log line, or code comment in a way that could later be confused
  for real Tropenbos material.

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test` (must still pass unmodified and credential-free — confirms the seed
  script did not get wired into anything the suite depends on)
- Manual: `npm run db:migrate` on a scratch database, then `npm run db:seed` twice in a
  row, confirming the second run is a clean no-op.

## Exact manual test steps expected after implementation

1. Set `SEED_DIRECTOR_EMAIL` etc. in `.env.local` to four real reachable Google
   accounts (can be the implementer's own accounts for local verification).
2. `npm run db:migrate && npm run db:seed`; confirm the printed summary and a clean
   second run.
3. `npm run dev`; sign in with the `SEED_DIRECTOR_EMAIL` account; confirm the session
   lands as Programme Director, not Field Officer.
4. Visit the evidence library; confirm classification filter shows all three states and
   the pending-queue count matches the seed summary.
5. Visit the signal board; open the seeded EUDR signal; confirm its Evidence Matcher
   panel shows the seeded match set including the gap-outcome run on a different
   signal.
6. Open the seeded generated brief; confirm the open flag renders in slate with the
   settling-pulse treatment (or the reduced-motion instant equivalent); attempt
   approval and confirm the server-side refusal message; resolve the flag; approve
   successfully; confirm `BriefStatusChange` recorded the actor.
7. Export the approved brief to Word; confirm it downloads.
8. Run the audience switcher on the same brief; confirm a diff view appears and can be
   discarded without mutating the approved version.
9. Visit stakeholders; confirm the seeded contact's brief history includes the
   approved brief.
10. Visit the impact map; confirm the seeded verified influence event renders a drawn
    path.
11. Sign in as the seeded Field Officer account; confirm the pending field submission
    from seed data appears in their own history and is queued (not visible) for
    classification to anyone but Research Officer/Director.
12. Read through `docs/demo-script.md` once, end to end, confirming every referenced
    record actually exists after step 2.
