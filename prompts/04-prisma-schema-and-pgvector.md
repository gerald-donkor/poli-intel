# 04 — Prisma schema, enums, and pgvector

## Goal

Stand up EviBrief's data foundation: Prisma ORM 7 wired to Supabase Postgres 18,
the five core entities plus the tables the rules in `AGENTS.md` imply, every
shared enum defined once, pgvector enabled with an explicit cosine similarity
index, the embedding dimensionality stated in exactly one authoritative place,
and a single server-only Prisma client in the data layer.

This task ships **schema, migration, client, config, and scripts only**. No UI,
no Server Actions, no Gemini calls, no seed data beyond what a migration needs.
Everything in Phase 1 — ingestion, classification, evidence search, the manual
brief generator — reads and writes these tables, and the enums land here so no
route ever re-declares them as a string union.

## Skills read

Project-specific:

- `supabase-schema` — the five entities, the schema-level classification
  default, the enum inventory with spec-verbatim values, chunk storage, the
  dimensionality rule, the 500MB budget, migrations-only.
- `evidence-governance` — why the classification default belongs in the schema
  and not in application code; the three values, verbatim; classification is
  never duplicated onto chunks.
- `hallucination-guard` — the minimum fields on a stored flag record, and the
  fact that flag state belongs to a brief *version*.
- `gemini-integration` — the embedding model and dimensionality this schema
  consumes, and the requirement to record which model produced a vector.
- `server-actions` — only for the session-strategy question: whether the Auth.js
  v5 setup needs adapter tables in this schema.

Vendor:

- `prisma-database-setup`, `prisma-cli`, `prisma-client-api` — provider config,
  migrate/generate mechanics, query surface.
- `prisma-upgrade-v7` — **read this even though there is nothing to upgrade.**
  It is the only skill that documents the v7 shape we are installing into: the
  `prisma-client` generator with a required `output`, the mandatory driver
  adapter for SQL providers, `prisma.config.ts`, explicit env loading, and the
  changed client entrypoint. Prisma v6 tutorials and training-data memory will
  produce a schema that does not generate.
- `supabase`, `supabase-postgres-best-practices` — enabling the pgvector
  extension, index choice and parameters, connection string shapes.

## Existing code inspected

- `package.json` — scripts are `dev`/`build`/`start`/`lint`/`typecheck`. Deps
  are UI-only: `@base-ui/react`, `cmdk`, `lucide-react`, `next` 16.2.12, `react`
  19.2.4, `recharts`, `shadcn`, Tailwind 4. **No Prisma, no Zod, no driver
  adapter, no Gemini SDK, no Auth.js.** There is no `prisma/` directory, no
  `prisma.config.ts`, and no migration history.
- No `.env`, no `.env.local`, no `.env.example` exists yet. `AGENTS.md` §18
  calls `.env.example` canonical, so this task creates it.
- `lib/` contains only `utils.ts` (the shadcn `cn` helper). There is no data
  layer yet; this task creates `lib/db/`.
- `app/` — root layout plus five placeholder routes under `app/(app)` and the
  `app/field` route group. Every page body is `ScreenPlaceholder`. **No route or
  component reads data**, so nothing existing needs rewiring.
- `components/` — `app-nav.tsx`, `page-header.tsx`, `screen-placeholder.tsx`,
  plus the vendored `components/ui`. None touched by this task.
- Installed versions confirmed from the registry at time of writing:
  `prisma` / `@prisma/client` **7.9.1**, `zod` **4.4.3**. Node in this
  environment is **v26.5.0** (v7 requires ≥20.19.0). Re-check the resolved
  versions in `node_modules/` after install and follow those, not this note.

## Decisions and assumptions

1. **Prisma 7, not 6.** Fresh install, so install current and build the v7 shape
   from the start: `prisma-client` generator with an explicit `output`,
   `prisma.config.ts`, and the `@prisma/adapter-pg` driver adapter. Do not
   scaffold the legacy `prisma-client-js` generator.

2. **Embedding dimensionality: 1536, pending verification of the model.**
   Two constraints collide here and the resolution is load-bearing:
   - pgvector's ANN index types (`hnsw`, `ivfflat`) cap out at **2000
     dimensions** for the `vector` type. A column wider than that cannot be
     indexed, and an unindexed vector column is a sequential scan on every
     retrieval — which `supabase-schema` calls out as unforgivable on the free
     tier.
   - Gemini Embedding models expose configurable output dimensionality
     (Matryoshka truncation) rather than a single fixed width.

   So: **verify from live docs or the installed SDK that Gemini Embedding 2
   supports a 1536-dimension output**, and if it does, use 1536 for both the
   column and the request. 1536 also halves vector storage against a 3072
   default, which matters against the 500MB budget. If verification shows no
   truncation option and the only output width exceeds 2000, **stop and ask** —
   do not write a wider column and quietly skip the index, and do not guess a
   number.

   The number lives in **one** TS constant, `EMBEDDING_DIMENSIONS`, in the
   central AI config module. The `schema.prisma` vector literal is the one
   unavoidable second copy (SQL DDL cannot import TypeScript); annotate it with
   a comment naming the constant, and have the data layer validate the length of
   any vector it is about to write against the constant, returning a typed error
   on mismatch. That is the cheap, real link — do not build a migration
   generator to avoid the duplicate.

3. **Auth.js session strategy: JWT, so no adapter tables.** `server-actions`
   describes a trimmed domain-restricted v5 setup; a JWT session needs no
   `Session`/`Account`/`VerificationToken` tables. This task therefore adds
   **no Auth.js adapter tables**. It *does* add a `StaffUser` model, because the
   schema independently needs a durable actor to reference: `brief.reviewed_by`,
   and every audit row that records "actor and timestamp" per `AGENTS.md` §8.3,
   §8.6, §10.8. `StaffUser` holds id, email (unique), name, `role` (enum), and
   timestamps — role assignment must survive a session, so it is a row, not a
   JWT claim invented at sign-in. If prompt 05 later needs adapter tables, they
   arrive in that change via a migration.

4. **Supabase project provisioning is not assumed.** If no Supabase project
   exists, create one via the `supabase` skill's documented path before running
   the migration; the region should be the one closest to Ghana that Supabase
   offers. `DATABASE_URL` (pooled, for Prisma Client) and `DIRECT_URL` (direct,
   for migrations) must both be present in `.env.local` before `migrate dev` is
   run. **If the connection strings are not available, stop and ask for them** —
   write the schema, the config, the client, the scripts, and `.env.example`
   first, and leave only the migration run outstanding. Do not invent
   placeholder credentials and do not fall back to a local Postgres.

5. **`vector` is an unsupported Prisma type.** Prisma has no native `vector`
   scalar. The mechanism has changed across releases, so **verify against the
   installed 7.x package** whether this project needs
   `Unsupported("vector(1536)")`, the `postgresqlExtensions` preview feature, or
   both, before writing it. The similarity query itself is raw SQL and belongs
   in `lib/db/` only — `AGENTS.md` §6's "no raw SQL" exclusion explicitly carves
   out the data layer's pgvector queries.

6. **Model names are Prisma-conventional PascalCase with `@@map`** to the
   spec's snake_case table names (`policy_signal`, `evidence_item`, `brief`,
   `influence_event`, `stakeholder`), so the spec's entity names stay the
   database's source of truth. Enum values are **spec-verbatim** — see
   `supabase-schema`'s enum table — and the urgency enum's declaration order is
   the warm→cool ramp order and must not be resorted.

7. **Brief versioning is a table, not a column.** `AGENTS.md` §8.7 forbids
   overwriting a prior version in place, and `hallucination-guard` requires flag
   state to belong to a version. So `Brief` carries current-state fields and a
   `BriefVersion` child holds each persisted body with its version number,
   generating model, and prompt version; flags hang off the version, not the
   brief.

8. **No speculative indexes and no third copy of the text.** Index only what a
   real Phase 1 query path uses: the vector similarity indexes, the FKs, the
   classification column (the Evidence Library filters and the gate both read
   it), and the retrieval metadata filters named in `AGENTS.md` §15.3. No
   tsvector column in this task — keyword search runs against existing columns
   until it earns a duplicate.

## Files likely to change

Created:

- `prisma/schema.prisma` — models, enums, `@@map`s, vector columns.
- `prisma/migrations/<timestamp>_init/migration.sql` — generated, then
  hand-extended with the pgvector extension and the similarity indexes (both
  are migration content per `supabase-schema`, never applied by hand in the
  Supabase SQL editor).
- `prisma.config.ts` — v7 config, explicit env loading, migration adapter.
- `lib/db/client.ts` — the single `PrismaClient` instance, driver-adapter
  construction, `server-only` import, dev hot-reload singleton guard.
- `lib/db/index.ts` — the data layer's public surface (re-export only what
  exists after this task).
- `lib/ai/config.ts` — server-only. `EMBEDDING_DIMENSIONS` and the embedding
  model identity constant, with the verification note from decision 2. Model
  IDs, temperature, token caps, and rate-limit budgets are `gemini-integration`'s
  business and arrive with the first Gemini call, not here — this file starts
  with only what the schema consumes.
- `.env.example` — the full `AGENTS.md` §18 table, keys only, no values.

Modified:

- `package.json` — add `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`,
  `zod`, and the scripts (below).
- `.gitignore` — confirm `.env*` (excluding `.env.example`) is ignored; add if
  not.
- `AGENTS.md` §19 — add the new scripts to the commands list, per its own
  standing instruction that a prompt introducing tooling updates that section in
  the same change.

Not touched: any file under `app/`, `components/`, `design_handoff_evibrief/`,
`hooks/`, or `lib/utils.ts`.

## Implementation requirements

### Packages and scripts

Install `prisma` and `@prisma/client` (7.x), the `@prisma/adapter-pg` driver
adapter and its `pg` peer, and `zod` (4.x — shared validation lands in prompt
05/06, but the version is pinned here so there is one Zod in the tree).

Add to `package.json`:

- `db:generate` — `prisma generate`
- `db:migrate` — `prisma migrate dev`
- `db:deploy` — `prisma migrate deploy`
- `db:studio` — `prisma studio`

Then update `AGENTS.md` §19 with these four. Do not reference a script name
anywhere before it exists.

### Schema content

**Enums** — declared once, values verbatim from `supabase-schema`:
`Urgency` (declaration order = the design system's warm→cool ramp),
`Relevance`, `ImpactArea`, `Geography`, `AudienceTarget`, `BriefType`,
`BriefStatus`, `SignalStatus`, `EvidenceSourceType`, `Classification`,
`StaffRole`. Keep the five brief-generation *audience profiles* out of
`AudienceTarget` — `supabase-schema` flags collapsing those two lists as
needing a recorded decision, and there isn't one.

**`Classification`** is exactly `public_published`, `community_sourced`,
`unpublished_internal`. On `EvidenceItem`:
`classification Classification @default(unpublished_internal)`, **required,
never nullable**. This is the single most consequential line in the schema —
the safe state is the default, so a row arriving by any unforeseen path is
already blocked from the AI pipeline.

**`PolicySignal`** — id, sourceUrl, sourceName, detectedAt, urgency, relevance,
impactArea, geography, summaryText, embedding (vector), embeddingModel, status
(`SignalStatus`), timestamps.

**`EvidenceItem`** — id, title, authors, year, sourceType, country, impactArea,
fullText, citationKey, classification (above), plus ingestion provenance.
Document-level metadata lives here; the vector lives on chunks.

**`EvidenceChunk`** — own table, FK to `EvidenceItem`, cascade delete. Chunk
text, ordinal, character offsets, source page where known, embedding (vector),
embeddingModel. **Classification is not duplicated onto chunks** — retrieval
joins to the parent. Chunks are 512-token overlapping segments; the chunker
arrives in prompt 06, but the columns it needs exist here.

**`Brief`** — id, signalId (nullable — the Phase 1 manual generator has staff
paste a policy document with no signal record), briefType, audience, status
(`BriefStatus`), currentVersion, the recorded final evidence set, reviewedById,
timestamps. The evidence set is the set the fact-check pass verifies against, so
it must be the *final* set after officer add/remove, not raw matcher output.

**`BriefVersion`** — FK to `Brief`, version number, bodyText / document JSON,
generatingModel, promptVersion, createdById, createdAt. Unique on
`(briefId, version)`. Prior versions are never overwritten.

**`HallucinationFlag`** — FK to `BriefVersion` (not `Brief`), a position anchor
into the document stable enough to survive ordinary editing around it, the
claim text as generated, a reason enum (`unsupported` / `altered` /
`misattributed`), the evidence items checked against, status (`open` /
`resolved` / `dismissed`), and on dismissal the actor, timestamp, and reason.
The anchor representation is decided here and must be one `tiptap-editor` can
map to a Mark — a JSON `{from, to}` range plus the claim text for
re-anchoring is sufficient; record the choice in a schema comment.

**`InfluenceEvent`** — id, briefId, eventType, sourceDocument, detectedAt,
description, verified.

**`Stakeholder`** — id, name, organisation, role, audienceType,
preferredLanguage, timestamps, plus the brief-history relation (a join table, so
`brief_history[]` is queryable — not a scalar array).

**`StaffUser`** — id, email (unique), name, role (`StaffRole`), timestamps.

**Audit rows.** `AGENTS.md` §8.3, §8.6, and §10.8 all require actor+timestamp
records, not a mutable column. Add the audit tables that satisfy them —
brief status transitions, signal reclassifications, and evidence classification
changes — each with actor FK to `StaffUser`, timestamp, previous value, new
value, and reason where the rule requires one. Keep them narrow.

**`IngestionLog`** — `AGENTS.md` §12.8 requires ingestion to be logged and
staff to be notified of new additions; a notification needs something durable to
read from. Rows record the evidence item, the source, the outcome, extraction
and chunk counts, and the timestamp. No document text.

### Migration content

The generated SQL needs hand-extension, in this order:

1. `CREATE EXTENSION IF NOT EXISTS vector;` — explicit, not assumed on.
2. The tables and enums Prisma generates.
3. Vector column types where Prisma cannot express them.
4. The similarity indexes — **cosine distance**, matching the retrieval order in
   `AGENTS.md` §15.1 — on `evidence_chunk.embedding` and
   `policy_signal.embedding`. Index type and parameters come from current
   pgvector guidance via the `supabase` skill; do not assume a build-time
   default and do not copy an ivfflat `lists` value from a blog post.

Then run `db:migrate` against Supabase and confirm it applies cleanly.

### Client

`lib/db/client.ts`: `import "server-only"` at the top, construct the v7 driver
adapter from `DATABASE_URL`, export one `PrismaClient`, and guard against
hot-reload duplication in dev via a `globalThis` singleton. Nothing outside
`lib/db/` imports `PrismaClient` directly. No `any`.

## Evidence classification impact

**Yes — this task creates the enforcement substrate for the section 7 gate,
though it makes no Gemini call itself.**

Classifications involved: all three — `public_published`,
`community_sourced`, `unpublished_internal`.

Enforcement point in code: `EvidenceItem.classification` in
`prisma/schema.prisma`, declared required with
`@default(unpublished_internal)`, and materialised as a `NOT NULL DEFAULT`
constraint in the init migration. This is the schema-level half of the gate that
`evidence-governance` and `supabase-schema` both require: the default is the
safe state, so every newly ingested item — upload, field submission, scrape,
bulk import, raw insert — is ineligible for the AI pipeline without any
application code remembering to set it.

What happens to blocked items: nothing yet at this layer, because there is no
retrieval path and no AI layer to refuse from. This task must not build a
partial gate. Specifically it must **not** add:

- a nullable or `public_published`-defaulted classification column "for dev
  convenience"
- a classification column on `evidence_chunk` (one copy, on the parent, joined
  at retrieval)
- any flag, env var, or column that could mark an item as bypassing
  classification
- any anticipatory paid-tier or "gate lifted" branch

The runtime gate — the typed `GateResult` chokepoint at the AI layer's entry —
belongs to the first task that makes a Gemini call. This task's job is to make
the database incapable of producing an unclassified row.

No evidence body text is logged, exported, or sent anywhere by this change.
`IngestionLog` records ids, counts, and outcomes only.

## Hallucination-guard implications

**Structural, not behavioural.** This task creates the storage the guard will
use and changes nothing about what gets checked or how a flag renders, because
neither exists yet.

What it fixes in place:

- Flags are **structured records anchored to a document position**, stored
  against a **`BriefVersion`** — not against `Brief`, not embedded in prose, not
  inferred at render time. Regenerating or audience-switching produces a new
  version and therefore new flags; cleared state is never inherited.
- The record carries the minimum field set from `hallucination-guard`: brief
  version, anchor, claim text as generated, reason
  (`unsupported`/`altered`/`misattributed`), evidence items checked against,
  status, and dismissal actor/timestamp/reason.
- The anchor representation is decided here and must be mappable to a Tiptap
  Mark.

Flag *rendering* is untouched by this task, so the section 9.7 visual contract
is unchanged and unimplemented: when it lands, a flag renders in **slate with a
gentle single pulse settling to a steady soft outline — never red, never a
blink, never an alarm, never an error toast.**

The approval block is likewise not implemented here. Nothing in this task lets
an approval path exist, so no server-side refusal is bypassed.

## Security requirements

- `DATABASE_URL`, `DIRECT_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are
  **server-only** and must never be prefixed `NEXT_PUBLIC_` (`AGENTS.md` §18).
- `lib/db/client.ts` and `lib/ai/config.ts` both start with `import
  "server-only"`. Prisma must be unreachable from browser code.
- `.env.example` contains **keys only, no values**. Real credentials go in
  `.env.local`, which stays gitignored. Never commit a secret.
- No `.env` file is committed in this change. Verify with `git status` before
  finishing.
- Supabase RLS is not a substitute for the authorisation this project does
  inside Server Actions; do not treat the schema as the access-control layer.
  Authorisation arrives in prompt 05.
- No raw SQL outside `lib/db/`.

## Acceptance criteria

1. `prisma/schema.prisma` exists with all eleven enums, the five core entities
   mapped to their spec table names, plus `EvidenceChunk`, `BriefVersion`,
   `HallucinationFlag`, `StaffUser`, the audit tables, and `IngestionLog`.
2. `EvidenceItem.classification` is required, typed `Classification`, and
   defaults to `unpublished_internal` **in the schema and in the generated
   migration SQL**. It is nullable nowhere and defaults to nothing else.
3. `evidence_chunk` has **no** classification column.
4. Enum values match `supabase-schema`'s table verbatim; `Urgency` is declared
   in warm→cool ramp order.
5. The init migration contains `CREATE EXTENSION IF NOT EXISTS vector;` and
   explicit cosine similarity indexes on both vector columns.
6. `EMBEDDING_DIMENSIONS` is defined once in `lib/ai/config.ts`; the only other
   occurrence of the number is the annotated `schema.prisma` vector literal, and
   the two agree.
7. The chosen dimensionality is ≤ 2000 and the similarity index actually builds.
8. `prisma.config.ts` exists and uses the v7 generator/adapter shape; the
   generated client imports resolve from the configured `output` path.
9. `lib/db/client.ts` is `server-only`, exports one client, and is the only
   module constructing `PrismaClient`.
10. `package.json` has the four `db:*` scripts and `AGENTS.md` §19 lists them.
11. `.env.example` matches the `AGENTS.md` §18 table, keys only.
12. No file under `app/` or `components/` is modified.
13. No `any`, no bypass flag, no anticipatory paid-tier branch, no seed data.
14. `npm run lint` and `npm run typecheck` report no new errors in files this
    task owns (the four known pre-existing lint errors in `components/ui/carousel.tsx`,
    `hooks/use-mobile.ts`, and `design_handoff_evibrief/support.js` remain and
    must not be "fixed").

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npx prisma validate`
- `npm run db:generate`
- `npm run db:migrate` — requires the Supabase connection strings; if they are
  not available, stop and report exactly this step as outstanding.
- `npm run build` — the new `server-only` modules and the generated client
  affect the build.

Report the exact output of each. Never claim a check passed without running it.

## Manual test steps

1. `npm run db:generate` — the client generates into the configured `output`
   path with no warnings about a deprecated generator.
2. `npm run db:migrate` — the migration applies to Supabase cleanly and prints
   the created migration name.
3. In the Supabase SQL editor, confirm the substrate rather than trusting the
   ORM:
   - `SELECT extname FROM pg_extension WHERE extname = 'vector';` returns a row.
   - `\d evidence_item` (or the equivalent
     `information_schema.columns` query) shows `classification` as `NOT NULL`
     with default `'unpublished_internal'`.
   - `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN
     ('evidence_chunk','policy_signal');` shows the cosine similarity indexes
     with the expected operator class.
   - `\d evidence_chunk` shows **no** classification column.
4. Prove the default is the safe state: `INSERT INTO evidence_item` with the
   minimum required columns and **no** classification, then select the row back
   — it must read `unpublished_internal`. Delete the row afterwards.
5. `npm run db:studio` — every expected model appears and the enum dropdowns
   show the spec-verbatim values.
6. `npm run build` — succeeds, and no bundle-analysis warning shows Prisma or
   `lib/ai/config.ts` reaching client code.
7. `npm run dev`, then load `/`, `/signals`, `/evidence`, `/briefs`, `/impact`,
   and `/field` — all still render their placeholders unchanged, with no
   server-only import error in the terminal.
8. `git status` — no `.env` or `.env.local` staged; `.env.example` is the only
   env file added.
