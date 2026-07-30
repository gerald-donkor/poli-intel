# 06 — Evidence ingestion and the classification gate

## Goal

Get a document into the knowledge base and hold it at the governance gate.

A Research Officer uploads a PDF or plain-text document with its metadata. The system
extracts the text, chunks it, and stores an `EvidenceItem` plus its `EvidenceChunk`
rows — all at `unpublished_internal`, the schema default, blocked from the AI pipeline.
The item then appears in a visible classification queue until a Research Officer or
Programme Director explicitly tags it, which is logged with actor and timestamp.

This prompt also builds **the gate itself** — the single structural chokepoint every
future AI-layer entry point passes through (`AGENTS.md` §7.2, `evidence-governance`).
Nothing in this prompt calls Gemini, so the gate ships here in its retrieval-filter
capacity and is consumed by the embedding pipeline in prompt 07.

**Why this is next.** The Evidence Matcher, Brief Generator, and hallucination guard all
depend on eligible evidence existing in the database, and §7's gate must exist in code
before any Gemini call path is written. Schema (`04`) and auth (`05`) are committed and
are its only dependencies.

## Skills read

- `evidence-governance` — the gate's values, its structural position, the `GateResult`
  shape, the refusal contract, the logging prohibition
- `supabase-schema` — the classification default, chunk storage, the 500MB budget and its
  "prune raw upload artefacts once extraction succeeds" rule
- `server-actions` — authorise-first ordering, colocation, shared Zod schemas, typed
  results, Route Handlers are for external callers only
- `design-system` — classification-pending treatment (square glyph, immediate ramp),
  evidence table rules, the five required states, responsive grid recipes
- `design_handoff_evibrief/design-system.md` — authoritative tokens and utility recipes
- `shadcn` — for `Table`, `Alert`, `Badge`, `Sheet`, `Field`, `Select` usage as installed

## Existing code inspected

- `prisma/schema.prisma` — `EvidenceItem` (with `classification @default(unpublished_internal)`,
  `sourceFileName`, `ingestedById`, `extractionCompletedAt`), `EvidenceChunk`,
  `EvidenceClassificationChange`, `IngestionLog`, `Classification`, `EvidenceSourceType`,
  `ImpactArea`, `IngestionOutcome`
- `lib/auth/authorize.ts` — `canIngestEvidence`, `canChangeEvidenceClassification`,
  `ActionRefusal`, `unauthorised()` already exist
- `lib/auth/session.ts` — `requireStaffUser`, `requireRole`, `getCurrentStaffUser`
- `lib/db/index.ts` — the data layer's public surface; nothing outside `lib/db/` builds a
  PrismaClient or writes SQL
- `lib/ai/config.ts` — `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`
- `app/(app)/evidence/page.tsx` — currently a `ScreenPlaceholder`
- `app/globals.css` — EviBrief tokens applied; `immediate-*` ramp present, `--destructive`
  deliberately unmapped
- `components/ui/` — full shadcn set installed
- `.env.example` — `UPLOADTHING_TOKEN` already listed

## Decisions and assumptions

1. **No schema change, no migration.** Every field this needs already exists from prompt
   04. If implementation finds a genuine gap, stop and say so rather than reaching for
   `prisma migrate dev` (`AGENTS.md` §19).

2. **Embedding is deliberately out of scope** and ships as prompt 07. This is a governance
   consequence, not a convenience: an item enters at `unpublished_internal`, so it is
   *ineligible for embedding at the moment it is ingested*. Embedding is triggered by
   classification to `public_published`, not by upload. Chunks are written here with
   `embedding` null and `embeddingModel` null; 07 backfills them through the gate.

3. **No Gemini call anywhere in this prompt.** In particular, **do not use Gemini's
   `countTokens` endpoint to size chunks** — that transmits evidence body text to the API
   and is exactly the breach §7 exists to prevent. Chunk sizing is local and approximate:
   a documented character-based approximation of 512 tokens with overlap, boundary-aware
   at paragraph then sentence, with the constants in one config module. Record the
   approximation in a comment so 07 does not mistake it for a measured token count.

4. **No Inngest.** It is not installed and this prompt does not install it. Extraction runs
   inside Uploadthing's `onUploadComplete` server callback. Accept the ceiling this
   implies for very large documents, state it in a comment, and note it as the trigger for
   moving ingestion to a job — do not pre-build that job.

5. **Extraction covers PDF and plain text only.** DOCX ingestion is not in the build list
   and is not invented here. Use `unpdf` for PDF text extraction unless inspection of the
   installed package shows a problem — it is serverless-friendly with no native
   dependencies. Verify its actual API against the installed package before writing calls.

6. **Raw uploads are pruned on successful extraction** (`supabase-schema`, §12.5). Once
   text is extracted and chunks are written, delete the file from Uploadthing. The upload
   holds the artefact only long enough to be read.

7. **`ActionRefusal` is not extended.** The gate's refusal is `GateResult.refused`, and no
   Server Action in this scope returns an ineligible-classification refusal. Adding the
   variant speculatively is over-engineering (`lib/auth/authorize.ts` says so explicitly).

8. **Filters and semantic search are not in this prompt.** The evidence table renders and
   the queue works; the filter rail and keyword/semantic search are prompt 08. Do not
   build the handoff's three-column `desktop:grid-cols-[216px_1fr_340px]` with an empty
   filter column — use a two-column table/detail layout now and leave a comment naming the
   prompt that adds the third.

## Files likely to change

**New**
- `lib/governance/gate.ts` — the gate; server-only
- `lib/ingestion/config.ts` — chunk size, overlap, accepted MIME types, max file size
- `lib/ingestion/extract.ts` — PDF and plain-text extraction
- `lib/ingestion/chunk.ts` — boundary-aware overlapping segmentation
- `lib/ingestion/ingest.ts` — orchestration: extract → chunk → persist → log → prune
- `lib/db/evidence.ts` — evidence and chunk queries and writes
- `lib/db/ingestion-log.ts` — ingestion log writes
- `lib/uploadthing/core.ts`, `lib/uploadthing/client.ts` — file router and typed client
- `app/api/uploadthing/route.ts` — Uploadthing route handler (external caller; thin)
- `app/(app)/evidence/new/page.tsx` + `upload-form.tsx` + `actions.ts` + `schema.ts`
- `app/(app)/evidence/queue/page.tsx` + `classify-panel.tsx`
- `app/(app)/evidence/actions.ts` — the classify action
- `app/(app)/evidence/evidence-table.tsx`
- `components/classification-badge.tsx`, `components/classification-pending-alert.tsx`

**Changed**
- `app/(app)/evidence/page.tsx` — replace the placeholder
- `lib/db/index.ts` — export the new data-layer functions
- `package.json` — add `uploadthing`, `@uploadthing/react`, `unpdf`, `react-hook-form`,
  `@hookform/resolvers`. Verify each against the installed Next 16.2 / React 19.2 / Zod 4
  before adding; if `@hookform/resolvers` does not support Zod 4 cleanly, say so and use
  the action's own Zod parse with a plain form rather than forcing a mismatched version.
- `.env.example` — only if a variable is genuinely missing; `UPLOADTHING_TOKEN` is present
- `AGENTS.md` §19 — no new script is expected; add one only if the change introduces one

## Implementation requirements

### The gate — `lib/governance/gate.ts`

This is the most important file in the prompt. Build it as described in
`evidence-governance`, not from improvisation.

- `server-only`.
- One exported partition function taking candidate items carrying at minimum
  `{ id, classification }` and returning
  `GateResult<T> = { eligible: T[]; refused: Array<{ id; classification; reason: "ineligible_classification" }> }`.
- Eligibility is `classification === Classification.public_published` and nothing else.
  Read the enum from `@/lib/generated/prisma/enums` — never a string literal, never a
  re-declared union.
- Export a companion Prisma `where`-fragment constant for the retrieval-filter half, so
  "only eligible evidence is searchable" is the same one fact as "only eligible evidence
  reaches a model" — not two rules that can drift apart.
- **No bypass of any kind**: no `force` parameter, no env var, no config key, no dev-mode
  branch, no commented sketch of a paid-tier path (§7.7).
- Refusals are returned, never thrown, for the ordinary ineligible case.
- Refusal reporting carries ids and classifications only — never body text (§7.6).

### Ingestion pipeline

- Accepted: `application/pdf`, `text/plain`. Enforce MIME type and a max file size in the
  Uploadthing file router *and* re-check server-side in the ingestion module.
- Extraction failure is a recorded `IngestionLog` row with `outcome` failed and a **short
  machine reason** — never the document text, never a stack trace containing it.
- Chunks: boundary-aware, overlapping, with `ordinal`, `charStart`, `charEnd`, and
  `sourcePage` where the PDF extractor gives it. `@@unique([evidenceItemId, ordinal])`
  already exists — write ordinals densely from 0.
- Persist the item and its chunks in **one transaction**, so a partial extraction never
  leaves an item with a truncated chunk set that later gets embedded as if complete.
- On success: set `extractionCompletedAt`, write a success `IngestionLog` with
  `extractedChars` and `chunkCount`, then prune the Uploadthing artefact.
- A zero-character extraction (scanned PDF with no text layer) is a **recorded failure with
  a real message to the user**, not a silent success with zero chunks. Say plainly that the
  document appears to have no extractable text layer.

### Server Actions

Order in every action: resolve session → authorise → validate → work → return typed result.

- **Upload metadata action** — `canIngestEvidence`. Creates the `EvidenceItem` shell with
  officer-supplied metadata. Never accepts a `classification` field from the client, from
  any path; the schema default is the only way the column gets its initial value.
- **Classify action** — `canChangeEvidenceClassification`. Writes the new classification
  **and** an `EvidenceClassificationChange` row with actor, previous value, new value, and
  optional reason, **in one transaction** (§10.8). An audit row that can fail independently
  of the change it records is not an audit trail.
- Shared Zod schemas in a `schema.ts` imported by both the action and the form. **No role
  list, no predicate, and no authorisation logic in a shared schema** — it ships to the
  browser (§10.10).
- `citationKey` is `@unique`; a collision is a field-mapped `invalid` result on that field,
  not a 500.

### UI

Read `design_handoff_evibrief/design-system.md` before writing any of this.

- **`/evidence`** — page header, the classification-pending `Alert` (immediate ramp,
  **square** outline glyph, live queue count, links to the queue), then the evidence
  `Table`. Table columns: title, source type, year, country, impact area, classification
  badge. Below 760px the Type and Classification columns drop and move into the detail
  panel (handoff, responsive table). Selected row = `surface-tint` background, never a
  checkbox alone.
- **`/evidence/queue`** — the triage surface. Items at `unpublished_internal`, oldest
  first, each classifiable into one of the three values with an optional reason. The queue
  count crossfades 180ms and the row collapses 200ms on tag (handoff motion table). The
  banner itself never animates idly.
- **`/evidence/new`** — the upload form. Metadata fields + dropzone. Sequenced, honest
  progress ("Uploading" → "Extracting text" → "Chunking"); **no indeterminate spinner**.
- **Classification badges** pair a glyph with the colour, always (handoff §"Status pills").
  `public_published` reads as eligible; the other two read as held. Never `destructive`,
  never red — it is not an error that an item is community-sourced.
- Extracted document text, where it is shown at all, is **quoted material and takes the
  serif** (`font-serif`, `border-l-2 border-accent pl-4`). Product chrome and any prose the
  system wrote takes Inter. This distinction is load-bearing (§11.6).
- Copy never implies the system classified, verified, or approved anything (§8.8).
  A newly ingested item is "awaiting classification", not "unverified".
- **Full responsiveness at 390 / 760 / 1000 / 1300 / 1600px** (§11.15). Mobile-first base
  layer, `tablet:` / `laptop:` / `desktop:` on top, no `mobile:` variant, no fixed pixel
  width on a page container, no horizontal page scroll. The classification-pending count
  **promotes above the fold** at small sizes rather than being hidden — it is a governance
  surface (`design-system`, responsive rules).
- WCAG 2.1 AA: keyboard-navigable table and queue, ARIA labels on classification badges,
  verify any colour pairing not already in the handoff.

## Evidence classification impact

**This task is the classification gate.** It touches ingestion, storage, the tagging
action, and the retrieval filter.

- **Classifications involved:** all three. Every ingested item enters at
  `unpublished_internal` via the schema default (`prisma/schema.prisma`,
  `EvidenceItem.classification`) — application code never sets the initial value and the
  upload action never accepts one from the client.
- **Enforcement points in code:**
  - `lib/governance/gate.ts` — the partition function and its `where`-fragment companion.
    The only door into eligibility, for both model calls and retrieval.
  - `app/(app)/evidence/actions.ts` — the classify action, guarded by
    `canChangeEvidenceClassification` (`lib/auth/authorize.ts:70`), writing the change and
    its `EvidenceClassificationChange` audit row in one transaction.
  - `lib/db/evidence.ts` — the evidence list query applies the gate's `where` fragment, so
    untagged evidence is not searchable (§7.5).
- **Of the eight gated call types, this prompt touches none** — there is no Gemini call in
  scope. It builds the chokepoint that prompt 07's embedding pass and every later
  generation, reframe, translation, and fact-check pass must enter through.
- **What happens to blocked items:** they are visible, never silent. They sit in
  `/evidence/queue`, are counted in the classification-pending `Alert` on `/evidence`, and
  are excluded from the evidence table's eligible listing. The next step is explicit: tag
  the item.
- **Logging:** `IngestionLog` stores ids, counts, outcomes, and short machine reasons only.
  No document text in any log line, error report, or analytics payload (§7.6, §13.9).

## Hallucination-guard implications

None — no generation, no claim extraction, no flag storage, and no change to flag
rendering or to what a flag blocks. Nothing in this prompt produces model output, so there
is nothing to fact-check. `HallucinationFlag` is untouched.

## Security requirements

- `UPLOADTHING_TOKEN` is server-only and never reaches browser code (§18).
- The Uploadthing route handler is an **external caller's** endpoint and stays thin — it
  authenticates the uploading user in the file router's middleware and delegates all work
  to `lib/ingestion/` (§5.3). No business logic in the route.
- The file router's middleware authorises with `canIngestEvidence` before issuing an upload
  token. An unauthorised user cannot obtain one.
- MIME type and size enforced server-side, not only in the browser.
- No Prisma query, extraction, or chunking in client code. `lib/governance/`,
  `lib/ingestion/`, and `lib/db/` are all `server-only`.
- Evidence body text never enters a log, a Sentry event, or a PostHog property.

## Acceptance criteria

1. A Research Officer can upload a text-layer PDF and see an `EvidenceItem` created with
   its chunks, at `unpublished_internal`, without any classification input.
2. The item appears in the classification queue and in the pending count immediately.
3. The item is **absent** from the eligible evidence listing until it is tagged
   `public_published`.
4. Tagging writes an `EvidenceClassificationChange` row with actor, previous value, new
   value, and timestamp; the count decrements.
5. A Policy & Advocacy Officer and a Field Officer are refused by the classify action
   server-side, not merely by a hidden button.
6. `lib/governance/gate.ts` exposes no path that returns eligible items without checking
   classification, and contains no flag, parameter, or branch that disables the check.
7. A scanned PDF with no text layer produces a recorded failure and a clear message.
8. Extraction failure leaves no orphaned half-ingested item.
9. Upload artefacts are deleted from Uploadthing after successful extraction.
10. No Gemini call, no `countTokens`, no embedding write anywhere in the diff.
11. `/evidence`, `/evidence/queue`, and `/evidence/new` are legible and usable at 390, 760,
    1000, 1300, and 1600px with no horizontal page scroll; the pending count is visible at
    every size.
12. No red anywhere; `--destructive` still unmapped and unused.

## Checks to run

- `npm run lint` — expect only the 4 known pre-existing errors in `components/ui/carousel.tsx`,
  `hooks/use-mobile.ts`, and `design_handoff_evibrief/support.js`
- `npm run typecheck`
- `npm run build` — new dependencies and a new route handler make this mandatory
- No `db:migrate` run is expected. If one becomes necessary, stop and report it rather
  than proceeding.

Report exact output. Never claim a check passed without running it.

## Manual test steps

1. Set `UPLOADTHING_TOKEN` in `.env.local`, then `npm run dev`.
2. Sign in. In `npm run db:studio`, set your `StaffUser.role` to `research_officer`.
3. Go to `/evidence` — the table is empty and the pending count reads 0.
4. Go to `/evidence/new`. Fill the metadata, upload a text-layer PDF, submit. Watch the
   three named progress stages; confirm no spinner appears.
5. Return to `/evidence`. The pending `Alert` reads 1 with a **square** glyph. The table
   does not list the item.
6. In Studio, confirm the `EvidenceItem` row is `unpublished_internal`, has
   `extractionCompletedAt` set, and has `EvidenceChunk` rows with dense ordinals from 0,
   `embedding` null. Confirm one success `IngestionLog` row with `extractedChars` and
   `chunkCount`, and no document text in it.
7. Open `/evidence/queue`, tag the item `public_published` with a reason. The row collapses
   and the count drops to 0. It now appears in the `/evidence` table.
8. In Studio, confirm the `EvidenceClassificationChange` row records your user id,
   `unpublished_internal` → `public_published`, the reason, and a timestamp.
9. Tag a second item `community_sourced`. Confirm it stays out of the eligible listing.
10. Set your role to `policy_advocacy_officer` in Studio, reload, and attempt to classify.
    Confirm a server-side refusal, not a client-side hide.
11. Upload a scanned image-only PDF. Confirm a clear "no extractable text layer" message,
    a failed `IngestionLog` row, and no orphaned `EvidenceItem`.
12. Confirm the Uploadthing dashboard no longer holds the successfully extracted files.
13. Resize `/evidence`, `/evidence/queue`, and `/evidence/new` through 390, 760, 1000,
    1300, and 1600px. Confirm no horizontal page scroll and a visible pending count at
    every width.
14. Enable `prefers-reduced-motion` and confirm the queue row collapse and count crossfade
    become instant state changes.
