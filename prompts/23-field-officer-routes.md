# 23 — Field Officer routes: submission, offline queue, cached reading

## Goal

Turn `/field` from the static placeholder the app-shell prompt left behind into the working
Field Officer surface described in `AGENTS.md` §17 and spec §5.2 / §5.4:

1. **Read** — the weekly digest screen renders real data: the last 30 signals and 10 briefs,
   in plain language, one message per card, cached for offline reading behind a service
   worker with a visible "offline — showing saved updates" banner.
2. **Write** — a lightweight submission form that posts a field observation into the
   knowledge base as an `EvidenceItem` at the schema-default `unpublished_internal`
   classification, blocked from the AI pipeline until a Research Officer tags it.
3. **Queue** — an offline submission queues locally in IndexedDB with a visible
   "waiting to send" indicator and syncs automatically when connectivity returns.
   Never a silent failure, never a silent queue (§17.2).
4. **Notify** — a Research Officer is notified of each new submission (§17.3, §12.8).

This is the last unbuilt write path into the evidence table, and it is what the WhatsApp
digest and USSD fallback (both still unbuilt) hang off. It does not build either of those.

## Skills read

- `evidence-governance` — the gate, the three classification values, the schema-level
  default, the "no auto-classification by source" rule, and the logging prohibition
- `server-actions` — colocation, authorise-first, shared Zod, the typed result shape, and
  the Auth.js v5 section (which owns the Field Officer auth question below)
- `design-system` — `/field` density rules, the offline/queued state colours (handoff
  line 187: bg `stone`, dot `#8E8B84` when queued, `accent` when synced), the Field Officer
  digest-card recipe (handoff line 242), the 200ms no-bounce offline banner (line 298),
  and the "never expose internal taxonomy vocabulary" rule
- `supabase-schema` — extend `EvidenceItem`, never fork a parallel table; `field_data`
  source type; the ingestion log as the durable thing a notification reads from
- `design_handoff_evibrief/design-system.md` — authoritative tokens, breakpoints, and the
  Field Officer card recipe

Read before implementing, not instead of: `node_modules/next/dist/docs/` for the current
service-worker / `public/` and Server Action surface in Next 16.2. Do not write the
service-worker registration from memory.

## Existing code inspected

- `app/field/layout.tsx` — already calls `requireStaffUser()`, already caps at 480px,
  already carries no desktop nav. Keep it; it needs no change.
- `app/field/page.tsx` — static placeholder: header, hard-coded offline strip, a dead
  "Send an update from the field" button, and a card that says "Built by the field-officer
  prompt". All of it is replaced by this prompt.
- `auth.ts` — Auth.js v5, one Google provider, domain-gated, no adapter, JWT, token carries
  `staffUserId` only.
- `lib/auth/session.ts` — `requireStaffUser`, `requireRole`, `landingPathForRole` (already
  routes `field_officer` → `/field`).
- `prisma/schema.prisma` — `EvidenceItem` (classification defaulted to
  `unpublished_internal`, `sourceType`, `citationKey @unique`, ingestion provenance
  columns), `EvidenceChunk`, `IngestionLog`, `EvidenceSourceType { field_data | research |
  literature }`.
- `lib/governance/gate.ts` — `partitionByClassification`, `ELIGIBLE_EVIDENCE_WHERE`,
  `PENDING_CLASSIFICATION`.
- `lib/ingestion/ingest.ts` — the upload → extract → chunk → log → prune orchestration and
  its typed `IngestOutcome`; the failure-message-per-machine-reason pattern to copy.
- `lib/db/*` — `evidence.ts`, `ingestion-log.ts`, `signals.ts`, `briefs.ts`, `digest.ts`.
- `lib/jobs/functions/*` — `embedEvidenceOnClassification` (the classification-triggered
  embed fan-out this submission must *not* reach), `sendMorningDigest` (the Resend +
  react-email + Inngest pattern to follow for the Research Officer notice).
- `emails/morning-digest.tsx`, `lib/email/send.ts` — email template and send pattern.

## Decisions and assumptions

**1. Auth: the existing SSO gate, and zero new auth code.**
The open client question (memory `field-officer-auth-open-question`, 2026-07-30) — will
Tropenbos issue Field Officers a Workspace / Cloud Identity account — is still unanswered.
It changes *who can obtain a session*, not a single line of this route: `/field` already
sits behind `requireStaffUser()`, and every action here authorises `field_officer` (plus
the roles above it) server-side. If the client later answers "no", the agreed fix is a
scoped invite path added at the auth layer, and this route inherits it untouched. So:
**do not build the invite path, do not add an adapter, do not add a provider.** Nothing in
this prompt has to be deleted whichever way the client answers.

**2. Classification: `unpublished_internal`, and the schema default does the work.**
§17.3 reads "enter as `community_sourced` at `unpublished_internal`", which names two
values from one enum. The reading taken here: `sourceType = field_data` records the
provenance, and `classification` is left to the schema default `unpublished_internal` —
the submission action never writes a classification at all. A Research Officer may
subsequently tag it `community_sourced`, which is equally AI-ineligible. Both readings
block the pipeline identically; this one keeps the safe state as the default and keeps
"no auto-classification by source" (`evidence-governance`) literally true.

**3. Photo capture is deferred, and this is the one piece of §17.1 not delivered here.**
Spec §5.2 step 2 says "text, optionally a photo". A field photo cannot follow the existing
PDF path: that path is *upload → extract text → prune the artefact*, and a photo has no
extraction and therefore no prune point. It would sit indefinitely on Uploadthing, which is
third-party storage — exactly what §7.6 forbids for community-sourced material. Delivering
it needs a Tropenbos-controlled storage decision (Supabase Storage in the project's own
bucket, most likely) that is an infrastructure call, not a code call. **Text-only
submission ships here; say so in the commit and in the test steps.** If you want the photo
in this prompt instead, say so on approval and it will be built on Supabase Storage with
that decision recorded in `AGENTS.md` §6.

**4. The cache feed is a Route Handler, and that is deliberate.**
A service worker cannot call a Server Component. `GET /api/field/cache` returns a read-only
static JSON snapshot for the SW to prefetch — no mutation, no form, session-cookie
authorised, `field_officer`-and-above only. That is within §5.3's "Route Handlers exist for
external callers… export downloads" carve-out, not a violation of "UI does not mutate
through Route Handlers". It never returns evidence body text.

**5. Offline queue lives in IndexedDB, not `localStorage`.**
A queued observation is user-authored text that must survive a tab close and a phone
restart. Replay is driven by the `online` event plus a check on mount — not the Background
Sync API, which is Chromium-only and would make the indicator lie on iOS Safari, the
likelier field device.

**6. Idempotent replay needs a client-generated key.**
Each queued submission carries a `crypto.randomUUID()` created at compose time, sent with
the submission and stored unique on the row. A replayed submission returns the existing
row's id rather than creating a duplicate. Without it, a flaky connection produces two
evidence items from one observation.

## Files likely to change

**Schema / migration**
- `prisma/schema.prisma` — add to `EvidenceItem`: `submissionKey String? @unique
  @map("submission_key")` (the idempotency key; NULL for every upload-path row) and
  `observedAt DateTime? @map("observed_at")` plus `locationNote String?
  @map("location_note")` for the landscape the observation came from. No new model.
- `prisma/migrations/<ts>_field_submissions/migration.sql` — authored via
  `npm run db:migrate:new -- field_submissions`. **Never `prisma migrate dev`** (§19); check
  the generated SQL contains no `DROP INDEX` on either `*_embedding_cosine_idx`.

**Data layer**
- `lib/db/evidence.ts` — `createFieldSubmission()` (returns existing row on submission-key
  conflict), `findFieldSubmissionsByStaffUser()`.
- `lib/db/digest.ts` or a new `lib/db/field.ts` — `findFieldDigestPayload()`: last 30
  signals and 10 briefs, selecting only the columns the field screen renders.

**Field surface**
- `app/field/page.tsx` — replaced: real digest cards, real offline banner, real submit CTA.
- `app/field/actions.ts` — `submitFieldObservation` Server Action (colocated, §5.3).
- `app/field/schema.ts` — Zod schema shared with React Hook Form.
- `app/field/submit/page.tsx` — the submission form screen.
- `app/field/submit/submission-form.tsx` — client component; RHF + the offline queue.
- `app/field/sent/page.tsx` — the officer's own recent submissions with per-item state
  (waiting to send / sent / needs review).
- `components/field/` — `digest-card.tsx`, `offline-banner.tsx`, `sync-status-pill.tsx`.
- `lib/field/queue.ts` — IndexedDB queue: `enqueue`, `list`, `remove`, `replayAll`.
  Client-only module.
- `lib/field/plain-language.ts` — enum → plain-language label maps (`Urgency.immediate` →
  "Act this month", `horizon` → "Coming later this year", …). This is where §11.12's "never
  expose internal taxonomy vocabulary" is enforced in one place.

**Offline shell**
- `public/field-sw.js` — service worker: precache the `/field` shell, network-first with
  cache fallback on `/api/field/cache`, stale-while-revalidate for static assets. Scoped to
  `/field` only — it must never intercept `/signals`, `/briefs`, or any Server Action POST.
- `app/api/field/cache/route.ts` — the read-only JSON snapshot.
- `components/field/sw-register.tsx` — registration, client-only, no-op when
  `serviceWorker` is absent.

**Notification**
- `lib/jobs/functions/notify-field-submission.ts` — Inngest function on
  `evidence/field.submitted`; emails Research Officers. Registered in `lib/jobs/index.ts`.
- `emails/field-submission-notice.tsx` — react-email template. **Subject and body carry the
  submission's title, the officer's name, and a link — never the observation body text**
  (§7.6). The Research Officer reads the text in the app, behind auth.

## Implementation requirements

### Authorisation
- `submitFieldObservation` resolves the session, then authorises: `field_officer`,
  `research_officer`, `policy_officer`, and `programme_director` may all submit an
  observation; every other outcome is a typed `unauthorised` result. Authorise **before**
  validating (`server-actions`).
- `/api/field/cache` performs the same resolution and returns 401 without a session. It is
  not public; the login-free path is WhatsApp/USSD, which this prompt does not build.
- `/field` remains unreachable to a signed-out caller (layout redirect already does this);
  the page itself re-resolves the caller rather than trusting the layout.

### The submission action
Order, exactly: resolve session → authorise role → validate with the shared Zod schema →
look up `submissionKey` → create or return existing → write an `IngestionLog` row → send
the `evidence/field.submitted` Inngest event → return a typed result.

- Fields: `title` (required, 3–120 chars), `observation` (required, 20–4000 chars),
  `locationNote` (optional, ≤120 chars), `observedAt` (optional date, never future),
  `submissionKey` (uuid).
- The action writes `sourceType: field_data`, `country: "Ghana"`, `ingestedById` = the
  submitting staff user, `fullText` = the observation, and a generated `citationKey`
  following the existing convention in `lib/db/evidence.ts`. **It does not write
  `classification`** (decision 2).
- Typed results: `{ ok: true, evidenceItemId, deduped: boolean }` |
  `{ ok: false, reason: "unauthorised" | "invalid" | "rate_limited" }` with field-mapped
  Zod errors for `invalid`. No throwing across the action boundary, no silent catch.
- The action is short. No chunking, no embedding, no Gemini — none of those may run on this
  path (see the governance section).

### The offline queue
- Submitting while offline (or on a failed round-trip) enqueues to IndexedDB and renders
  the queued state immediately: `stone` background, `#8E8B84` dot, the words "waiting to
  send". Never a toast that disappears; the item stays visible on `/field/sent` until it
  syncs.
- Replay fires on `window.online` and on mount of `/field` and `/field/sent`. On success
  the dot switches to `accent` and the item is removed from the queue.
- A replay that fails with `unauthorised` (session expired offline) stays queued and shows
  "sign in again to send" — never dropped, never silently retried forever.
- The queue is never cleared without a successful server result carrying an
  `evidenceItemId`.

### The digest screen
- One message per card (§11.12). Plain-language labels only — no "signal", no "urgency
  class", no "relevance score", no "Core / Adjacent / Background".
- 14px minimum body, 44px minimum tap target, no icon-only controls.
- Single column at every width, 320px → 1600px+, never adapted upward into a desktop
  layout. No horizontal page scroll at any width.
- Offline banner: 200ms slide, no bounce, never overlaying content, and it states what the
  reader is looking at ("showing updates saved on your phone"), with the saved-at time.
- Empty state (no signals, no briefs cached yet) is designed, not a blank column.

### Design constraints
- Nothing red anywhere — `--destructive` stays unmapped. The queued state is `stone` +
  grey dot; it is not an error.
- Governance and sync states pair a glyph with the colour, never colour alone.
- Serif is quoted material only; the digest's summaries are generated prose and stay in the
  sans.
- No leaf/tree/forest iconography.
- `prefers-reduced-motion` — the banner appears instantly, the sync dot does not animate.
- Copy never implies the system decided, approved, or verified anything (§8.8).

## Evidence classification impact

**Yes — this task creates evidence.** It is a write path into `evidence_item` and therefore
squarely inside the §7 gate.

- **Classifications involved:** the row is created at the schema default
  `unpublished_internal`. The action never sets a classification, and there is no
  auto-classification by source — a field submission is not trusted into eligibility by
  virtue of coming from a Tropenbos officer.
- **Enforcement point in code:** unchanged and untouched — `lib/governance/gate.ts`
  (`partitionByClassification`, `ELIGIBLE_EVIDENCE_WHERE`). This prompt adds **no** call
  into the AI layer. Specifically:
  - No embedding on submit. `embedEvidenceOnClassification` is triggered by a
    classification *change*, not by creation, so a field submission does not reach it. Do
    not add a fan-out event on create.
  - `sweepUnembeddedEvidence` filters on `ELIGIBLE_EVIDENCE_WHERE`; verify by reading it
    that an `unpublished_internal` row cannot be swept in.
  - No chunking on submit either — chunks exist to be embedded, and this text may not be.
    Chunking happens when a Research Officer classifies it `public_published`, on the
    existing path.
- **What happens to blocked items:** the submission is invisible to the Evidence Library's
  search (which filters on eligibility), invisible to the Evidence Matcher, and counted in
  the existing classification-pending queue on `/evidence/queue`. The Research Officer
  notification points there. The officer who submitted it sees it on `/field/sent` as
  "waiting for review" — plain language, not "unpublished_internal".
- **Logging:** the `IngestionLog` row, the Inngest event payload, the notification email,
  and every `console` line carry the evidence item id, the source type, and the actor id —
  **never the observation text**. The `/api/field/cache` payload contains signals and briefs
  only and no evidence body text at all.

## Hallucination-guard implications

**None.** This task generates no brief, extracts no claims, stores no flags, renders no
flags, and changes nothing about what a flag blocks. The digest screen renders brief
titles and summaries of already-approved briefs; it does not render brief bodies and
therefore renders no flag marks. No Gemini call happens anywhere on this path.

## Security requirements

- No new secret, no new env var. If one turns out to be needed, stop and ask rather than
  inventing a name.
- The service worker is scoped to `/field` and caches **GET** responses only. It must never
  cache or replay a Server Action POST, and never cache `/api/auth/*`.
- `/api/field/cache` is session-authorised and returns `Cache-Control: private, no-store`
  at the HTTP layer; the SW's copy is the only cached copy, and it lives in the browser's
  own storage on the officer's device.
- The IndexedDB queue holds the officer's own draft text on their own device. It is cleared
  on successful sync. Nothing writes it to a third-party service.
- No evidence body text in any Sentry event, PostHog property, log line, or email.
- Zod validates server-side regardless of what the client validated; the shared schema
  carries shape only, never authorisation.

## Acceptance criteria

1. `/field` renders real cached signals and briefs, one message per card, in plain
   language, single-column from 320px to 1600px+ with no horizontal page scroll.
2. A submission made online creates exactly one `EvidenceItem` with `sourceType =
   field_data` and `classification = unpublished_internal`, and appears in the
   `/evidence/queue` pending count.
3. A submission made offline persists across a page reload, shows "waiting to send" with
   the grey dot, and syncs automatically when the connection returns.
4. Replaying the same `submissionKey` twice creates one row, not two, and the second call
   returns `deduped: true`.
5. A Research Officer receives a notification email containing the title, the submitter, and
   a link — and no observation text.
6. The submitted item is absent from Evidence Library search results and from Evidence
   Matcher candidates until classified.
7. No Gemini call fires anywhere on this path — verifiable by the absence of any import
   from `lib/ai/` in the new files.
8. `prefers-reduced-motion` produces instant state changes with no slide and no pulse.
9. Signed-out access to `/field` and to `/api/field/cache` is refused.
10. No red anywhere; no leaf/tree iconography; no internal taxonomy vocabulary on the
    `/field` surface.

## Checks to run

- `npm run lint` — expect only the 4 known pre-existing errors (`carousel.tsx`,
  `use-mobile.ts`, two in `design_handoff_evibrief/support.js`). Any error in a new file is
  a failure.
- `npm run typecheck`
- `npm run build` — the service worker, a new Route Handler, and new routes all affect it.
- `npm run db:migrate:new -- field_submissions`, then read the generated SQL before
  `npm run db:migrate`. Confirm no `DROP INDEX` on `*_embedding_cosine_idx`.
- Report exact output. Never claim a check passed without running it.

## Manual test steps

1. `npm run dev`, plus `npm run inngest:dev` in a second terminal.
2. Sign in, then visit `/field`. Confirm digest cards render with plain-language labels and
   that no card says "signal", "urgency", or "relevance".
3. Resize from 320px to 1600px. Confirm single column throughout, no horizontal scroll, no
   clipped control, body text never below 14px.
4. Submit an observation. Confirm the success state, then open `/evidence/queue` and see the
   pending count increase by one and the item listed as awaiting classification.
5. Open the Inngest UI at <http://localhost:8288>. Confirm one `evidence/field.submitted`
   run, and read its output for the absence of observation text.
6. `npm run email` at <http://localhost:3100>. Open the field-submission notice and confirm
   it carries the title and a link and no observation body.
7. DevTools → Network → Offline. Reload `/field`: the saved digest renders with the offline
   banner and its saved-at time.
8. Still offline, submit a second observation. Confirm "waiting to send" with the grey dot,
   then reload the page and confirm it is still queued.
9. Go back online. Confirm it syncs automatically within a few seconds, the dot turns
   accent, and exactly one new row exists (check `npm run db:studio`).
10. Search the Evidence Library for a phrase from the submitted observation. Confirm zero
    results. Classify it `public_published` from `/evidence/queue` as a Research Officer,
    confirm the embed job now fires, and confirm it becomes searchable.
11. Sign out; visit `/field` and `/api/field/cache` directly. Confirm both refuse.
12. Enable "reduce motion" at the OS level and reload `/field` offline. Confirm the banner
    appears with no slide.
