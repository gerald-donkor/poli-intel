# 25 — Submission tracker

## Goal

Build the submission tracker: a calendar view of upcoming policy windows with the
status of the brief answering each one, at a new `/tracker` route.

This is the last piece of the brief lifecycle that has no home. A signal is
detected, matched, drafted, reviewed, approved, submitted — and today nothing in
the product says *by when*. A policy window closes and the only record that it
ever existed is a signal card in a kanban column that never changes colour.
Spec §3.2's framing is that windows "open briefly and close"; missing one costs
years. The tracker is where a Programme Director sees, in one view, which windows
are closing and whether a brief exists for each.

Scope is a **read view over existing data plus one date**. It is not a new
planning tool, not a task manager, not a reminder engine, and it does not send
email. It adds one nullable date column, one Server Action to set it, one route,
and one Prisma read.

## Skills read

- `supabase-schema` — extending a core entity rather than forking one, migration
  discipline, the 500MB budget, why a new index must earn its bytes
- `server-actions` — authorise → validate → write, colocation, typed refusals,
  Zod shape-only schemas shared with React Hook Form
- `design-system` — the warm→cool urgency ramp, no red anywhere, serif reserved
  for quoted material, the five required states, responsive rules at every width
- `design_handoff_evibrief/design-system.md` — authoritative tokens, breakpoints
  (`tablet` 760 / `laptop` 1000 / `desktop` 1300), component recipes
- `shadcn` — `Calendar`, `Table`, `Badge`, `Empty` composition
- `evidence-governance` — read to confirm this task has no AI data path (it does
  not; see below)

## Existing code inspected

- `prisma/schema.prisma` — `PolicySignal` (lines ~347–405), `Brief` (~607–648),
  `BriefStatus`, `Urgency`, `BriefStatusChange`
- `app/(app)/signals/` — `actions.ts`, `schema.ts`, `labels.ts`,
  `signal-board.tsx`, `signal-card.tsx` — the established action shape, the
  URGENCY_ORDER convention, and the urgency left-rule card treatment
- `app/(app)/briefs/page.tsx` and `app/(app)/briefs/labels.ts` — brief status
  labels and list rendering already in use
- `lib/auth/authorize.ts` — the `can*` predicate convention
- `lib/db/` — `signals.ts`, `signal-board.ts`, `briefs.ts`; the data layer is the
  only thing that talks to Prisma
- `components/app-nav.tsx` — the five nav links
- `components/ui/calendar.tsx`, `table.tsx`, `empty.tsx`, `badge.tsx`
- `prisma/migrations/` — existing migration SQL, for the additive-column pattern

## Decisions and assumptions

**1. Its own route, `/tracker`.** Confirmed with the user. Spec §5.5's route
table folds the tracker into `/stakeholders`, but §5.3 lists it as its own
interface component and its content is signals and briefs, not contacts. Burying
a deadline view inside the CRM makes it findable only by someone who already
knows it is there. Nav gains a sixth item. *This is a deliberate divergence from
the spec's route table and is recorded here as such.*

**2. The window's closing date is a human-set nullable column.** Confirmed with
the user. `PolicySignal` gains `windowClosesAt DateTime?`. It is set by a person
and by nothing else:

- **Never derived** from `urgency` + `detectedAt`. The urgency bands are ranges
  ("<4 weeks"), and rendering a derived hard date on a calendar a Director plans
  around would present a fabricated deadline as fact. The schema's own comment on
  `audienceTarget` already states the norm this follows: *absent is honest; wrong
  is not.*
- **Never model-written.** The radar's classification call does not touch this
  column in this prompt. A Gemini-extracted consultation deadline is a plausible
  later feature and an explicit non-goal here — it would put a model-invented
  date in front of a Director with no indication of its provenance.
- Nullable, no default. A signal with no date is *undated*, and undated signals
  are listed beside the calendar rather than hidden.

**3. The tracker reads, it does not plan.** No new "submission" entity. A window's
brief status is `brief.status` on briefs already linked to that signal via
`brief.signalId`. Nothing on this route mutates a brief.

**4. The one mutation is setting or clearing a window date.** Restricted to
Programme Director and Policy & Advocacy Officer — the same two roles that may
already reclassify a signal's urgency (`canReclassifySignal`), because both
answer the same question: how soon does someone need to act on this. Research
Officer and Field Officer may not.

**5. No audit table for the date.** `BriefStatusChange`,
`SignalReclassification`, and `EvidenceClassificationChange` exist because
`AGENTS.md` §8.3, §8.6 and §10.8 name those three transitions specifically. A
window date is a scheduling annotation, not a status transition or a
classification, so it does not earn a fourth audit table against the 500MB
budget. `updatedAt` on the signal moves. If the user wants it audited, that is a
follow-up prompt, not a silent addition here.

**6. Only briefs and signals already visible to staff appear.** No new
visibility surface; the tracker shows what `/signals` and `/briefs` already show.

## Files likely to change

**Schema and migration**

- `prisma/schema.prisma` — add `windowClosesAt DateTime? @map("window_closes_at")`
  to `PolicySignal`, with a comment stating it is human-set, never derived, never
  model-written; add `@@index([windowClosesAt])`
- `prisma/migrations/<timestamp>_add_signal_window_closes_at/migration.sql` —
  authored via `npm run db:migrate:new -- add_signal_window_closes_at`. Read the
  generated SQL before applying: it must be `ALTER TABLE ... ADD COLUMN` plus a
  `CREATE INDEX`, and must contain **no** `DROP INDEX` on
  `evidence_chunk_embedding_cosine_idx` or `policy_signal_embedding_cosine_idx`

**Data layer**

- `lib/db/tracker.ts` (new) — one read returning dated windows in a date range
  plus the undated list, each with its signal fields and its briefs' id, type,
  audience and status; one write setting/clearing `windowClosesAt`
- `lib/db/index.ts` — re-export

**Route**

- `app/(app)/tracker/page.tsx` (new) — Server Component, fetches initial data
- `app/(app)/tracker/labels.ts` (new) — window-state labels and copy
- `app/(app)/tracker/schema.ts` (new) — the shared Zod schema, shape only
- `app/(app)/tracker/actions.ts` (new) — `setSignalWindowAction`
- `app/(app)/tracker/window-calendar.tsx` (new) — client, shadcn `Calendar` with
  dated days marked
- `app/(app)/tracker/window-table.tsx` (new) — the data table half
- `app/(app)/tracker/window-date-control.tsx` (new) — client, sets/clears a date
- `app/(app)/tracker/undated-panel.tsx` (new)

**Auth and nav**

- `lib/auth/authorize.ts` — `canSetSignalWindow(role)`
- `components/app-nav.tsx` — add `{ href: "/tracker", label: "Tracker" }`, placed
  after Briefs (lifecycle order: Signals → Briefs → Tracker)

## Evidence classification impact

**None — no evidence data path.** The tracker reads `policy_signal` and `brief`
rows and writes one date to `policy_signal`. It never reads `evidence_item`,
`evidence_chunk`, `full_text`, or a chunk body; it never calls the AI layer, an
embedding, or the matcher; and it never enters `lib/ai/` or `lib/governance/`.
The one write is a scalar date on a signal, and `policy_signal` carries no
classification field because signals are detected public documents, not evidence.
No governance gate is bypassed because no gate is on this path.

The one thing to hold: a brief's row is read for `id`, `briefType`, `audience`
and `status` only. Do not join through `BriefEvidence` to evidence bodies to
enrich a calendar cell — the tracker has no reason to load evidence text, and
loading it would put classified material on a page that has no need of it.

## Hallucination-guard implications

**None.** This task does not change what gets fact-checked, how claims are
extracted, how flags are stored, how flags render, or what a flag blocks. It
introduces no generation and touches no `HallucinationFlag` row.

One adjacent rule holds and must not be weakened: the tracker **displays** brief
status and never advances it. There is no "mark submitted" control on this route.
Approval and submission remain the Programme Director's explicit actions on the
brief itself, still refused server-side while unresolved flags exist
(`AGENTS.md` §9.5, §10.7). A calendar must not become a second, unguarded path to
a status change.

## Implementation requirements

### Schema

1. `windowClosesAt DateTime? @map("window_closes_at")` on `PolicySignal`, with a
   doc comment stating: human-set only; never derived from urgency; never written
   by the classification call; absent means nobody has recorded a date, which is
   different from "no deadline".
2. `@@index([windowClosesAt])` — the tracker's primary query is a date-range scan
   over this column, so the index is a real query path, not speculative.
3. Author with `npm run db:migrate:new -- add_signal_window_closes_at`, read the
   SQL, then `npm run db:migrate`. **Never `prisma migrate dev`** (`AGENTS.md`
   §19).

### Data layer

4. All Prisma access in `lib/db/tracker.ts`. No Prisma import in a route file.
5. `getTrackerWindows({ from, to })` returns:
   - `dated`: signals with `windowClosesAt` in range, ascending, each carrying
     `id, title, urgency, geography, impactArea, windowClosesAt, detectedAt` and
     `briefs: { id, briefType, audience, status }[]`
   - `undated`: signals with `windowClosesAt: null` whose `status` is not
     `archived`, most recently detected first, capped at a sensible bound
6. `setSignalWindowClosesAt(signalId, date | null)` — a single update.
7. Derive nothing. If a signal has no date, return null; do not synthesise one
   from urgency at any layer.

### Server Action

8. `setSignalWindowAction` in `app/(app)/tracker/actions.ts`, `"use server"`.
9. Order: resolve session → `canSetSignalWindow(role)` → Zod parse → write →
   `revalidatePath("/tracker")`. Authorise before validating.
10. Typed result, matching the existing shape:
    `{ ok: true; windowClosesAt: string | null } | { ok: false; refusal: ActionRefusal }`.
    Refusal copy names the roles plainly, as `reclassifySignalUrgencyAction` does.
11. `app/(app)/tracker/schema.ts` is **shape only** — a signal id and a nullable
    ISO date. No role, no role list, no statement about who may set a date. It
    ships to the browser. `canSetSignalWindow` lives in the `server-only`
    `lib/auth/authorize.ts`.
12. Reject a date more than, say, five years out and any unparseable value in the
    schema; a typo'd year should not silently create a window in 2225.

### Authorisation

13. `canSetSignalWindow(role)` → Programme Director, Policy & Advocacy Officer.
    Comment why it mirrors `canReclassifySignal`.
14. The date control is hidden for roles that may not use it — and the hiding is
    presentation, never the control.

### UI — the combination view

Spec §5.5 specifies "shadcn Calendar + data table combination view". Build both
halves as one screen, not two tabs.

15. **Layout.** Mobile-first single column: calendar first, then the window
    table, then the undated panel. At `laptop:` the calendar becomes a sticky
    left rail (~320px) with the table beside it; at `desktop:` widen gutters and
    cap at 1440px centred. No horizontal page scroll at any width; if the table
    cannot reflow, it scrolls inside its own container, never the page.
16. **Calendar.** Days with a closing window are marked — a small filled dot in
    the day cell, coloured by the *highest* urgency closing that day, using the
    warm→cool ramp (immediate bronze → near-term olive → horizon teal → watch
    slate). Never red/amber/green. Never a filled day background. Selecting a day
    filters the table to that day; a visible "showing all upcoming" reset clears
    it. The mark must not be colour-only — pair the dot with an accessible name
    on the day ("2 windows closing, 1 immediate").
17. **Table.** Columns: window date (mono, plus a plain-language relative form —
    "in 9 days", "closed 3 days ago"), signal title, urgency, geography, brief
    status. A row with no brief renders "No brief drafted" plus a link to the
    signal, not an empty cell. A row with several briefs lists each with its
    audience. Brief status uses the existing brief-status labels, imported, not
    re-declared.
18. **Overdue is not an alarm.** A window whose date has passed with no
    `submitted`/`published` brief is marked "window closed" in slate with a plain
    line of copy. It is not red, does not pulse, and does not use the
    `destructive` variant — nothing in this product is red (`design-system` §2).
19. **Undated panel.** Signals with no recorded date, each with a control to set
    one. Copy states plainly that no date has been recorded — never implies the
    system estimated or inferred anything (`AGENTS.md` §8.8).
20. **Typography.** All tracker copy is Inter. The serif is not used on this
    route — nothing here is quoted source material. Dates and counts are IBM Plex
    Mono. Minimum 13px in compact table rows.
21. **Copy.** Never "the system flagged this window", never "verified", never
    "recommended". A window is *recorded*; a brief is *drafted* or *submitted*.

### The required states

22. **Empty** — no windows recorded at all: an `Empty` composition naming the
    real next step ("Windows are recorded on a signal. Open Signals to record a
    closing date."), with a link to `/signals`.
23. **Empty (filtered)** — a selected day with nothing closing: distinct from the
    above, with a one-click reset.
24. **Classification-pending** — if `components/classification-pending-alert.tsx`
    is already a global surface on this layout, it stays visible here and is
    never what gets hidden at a smaller width. Do not add a second copy.
25. **Rate-limited / flagged / offline** — not reachable on this route: it makes
    no Gemini call, persists no generation, and is not a Field Officer surface.
    State this in a comment rather than building a state that cannot occur.

### Motion and accessibility

26. Motion only where it explains something: a 150–300ms crossfade when the table
    re-filters on day selection. Nothing else. No entrance animation on rows. If
    in doubt, cut it. `prefers-reduced-motion` → instant.
27. Keyboard: the calendar is keyboard-navigable (shadcn `Calendar` gives this —
    verify, do not assume), the table is reachable in tab order, and the date
    control is operable without a pointer.
28. ARIA labels on urgency marks and on brief-status badges. Verify every new
    colour pairing against 4.5:1 before finalising.

## Security requirements

- No new env var, no new external call, no new Route Handler.
- The mutation is a Server Action, authorised server-side inside the action.
- The read runs in a Server Component; no client-side fetching library — SWR is
  reserved for the signal dashboard's polling only.
- No Prisma access outside `lib/db/`.
- No evidence body text, brief body text, or signal summary text in any log,
  Sentry event, or PostHog property (`AGENTS.md` §7.6, §13.9).
- The tracker is a staff route behind the existing `(app)` auth layout; it must
  not be reachable unauthenticated, and nothing on the no-login WhatsApp/USSD
  path reads or writes it.

## Acceptance criteria

1. `/tracker` renders for an authenticated staff user and appears in nav.
2. A signal with `windowClosesAt` appears on the calendar and in the table with
   its urgency mark and its briefs' statuses.
3. A signal with no date appears in the undated panel and nowhere on the
   calendar. No date is invented for it anywhere in the stack.
4. A Programme Director or Policy & Advocacy Officer can set and clear a window
   date; the change persists and the view updates.
5. A Research Officer or Field Officer calling `setSignalWindowAction` directly
   receives an `unauthorised` refusal — verified by role, not by a hidden button.
6. A past window with no submitted brief reads "window closed" in slate. Nothing
   on the route is red, and `destructive` appears nowhere.
7. No control on `/tracker` changes a brief's status.
8. Empty, filtered-empty, and undated states all render with real next steps.
9. Usable with no horizontal page scroll at 390, 760, 1000, 1300 and 1600px.
10. The migration adds one column and one index and drops no `*_embedding_cosine_idx`.
11. `npm run lint` and `npm run typecheck` clean of new errors; `npm run build`
    succeeds.

## Checks to run

- `npm run db:migrate:new -- add_signal_window_closes_at`, then read the SQL
- `npm run db:migrate`
- `npm run lint` (4 pre-existing errors expected; none new)
- `npm run typecheck`
- `npm run build`

Report exact output.

## Manual test steps

1. `npm run db:migrate`, then restart `npm run dev` — a fresh `prisma generate`
   needs a dev-server restart or the new field's queries fail on stale DMMF.
2. Sign in as a Programme Director. Nav shows **Tracker**; open `/tracker`.
3. With no dates recorded: the empty state names the next step and links to
   `/signals`.
4. In the undated panel, set a closing date ~2 weeks out on an Immediate signal.
   Confirm it moves onto the calendar with a bronze dot and into the table with
   "in 14 days".
5. Set a date in the past on another signal with no submitted brief. Confirm it
   reads "window closed" in slate — not red, no pulse.
6. Open a day with a window; confirm the table filters and the reset restores the
   full list. Repeat with the keyboard only.
7. Generate or open a brief linked to a dated signal and move it to `reviewed`.
   Reload `/tracker` and confirm the row's brief status follows.
8. Confirm no control on `/tracker` can approve, submit, or publish a brief.
9. Sign in as a Research Officer: the date control is absent. Invoke
   `setSignalWindowAction` from the console with a valid payload and confirm the
   refusal.
10. Resize through 390 / 760 / 1000 / 1300 / 1600px — no horizontal page scroll,
    calendar and table both legible, undated panel reachable.
11. With `prefers-reduced-motion: reduce`, confirm the filter change is instant.
