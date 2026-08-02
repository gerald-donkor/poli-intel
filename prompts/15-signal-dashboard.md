# 15 — The signal dashboard: the urgency board, the signal detail, and the matched evidence

## Goal

Make the Policy Radar and the Evidence Matcher visible. Prompts 13 and 14 both
shipped with no user-visible UI, deliberately, and `/signals` is still a
`ScreenPlaceholder`. Everything they store — classified signals, their urgency
and relevance, the stored match set, and the run row that says `matched` /
`gap` / `failed` — is currently readable only in Prisma Studio.

Three things, one body of work:

- **The board** — `/signals`, four urgency columns in the warm→cool ramp order,
  signal cards carrying urgency as a 3px left rule and a small-caps eyebrow and
  nothing else. Never a filled card background, never red/amber/green.
- **Drag-to-reclassify** — dnd-kit plus `useOptimistic`, through a Server Action
  that authorises the caller and writes a `SignalReclassification` audit row
  with actor and timestamp (`AGENTS.md` §8.6, §10.1). The board never
  auto-advances a signal and never re-sorts under an active reviewer.
- **The signal detail** — `/signals/[id]`, with the matched-evidence panel
  reading `SignalEvidenceMatch`, the **gap empty state with a real next step**
  reading the latest `EvidenceMatchRun.outcome`, and the on-demand re-match that
  prompt 14 deferred to here.

**Explicitly out of scope, and named so the boundary is deliberate:**

- **Generate-from-signal.** `Brief.signalId` is nullable and the manual
  generator at `/briefs/new` is untouched. Wiring the matched set into a
  generation request is its own prompt — it changes the brief-generation
  contract (`brief-output`), not the signal surface — and shipping it here would
  put two prompts' worth of decisions in one review.
- **The morning digest email.** It consumes what this prompt renders and needs
  Resend, `react-email`, and a cadence decision (`inngest-jobs`). No Resend
  dependency is added here.
- **SWR live polling.** `AGENTS.md` §5.3 permits SWR *solely* for this board,
  and the prototype's "live · polled 40s ago" chip is real intent — but a poll
  that silently re-sorts a board is exactly what §11.10 forbids, so it needs the
  queue-and-apply-on-next-load behaviour designed rather than assumed. The board
  ships as a Server Component read with `revalidatePath` after a mutation.
- **Board filters, the Board/Table/Calendar tabs, and "assigned to me".** All
  three appear in the prototype. Filters are a second search surface and the
  Evidence Library's rail is the pattern they should follow; the Table and
  Calendar views are the submission tracker's territory; assignment needs an
  owner field that does not exist in the schema.
- **The 90-day auto-archive** the prototype's footnote mentions. That is an
  automatic status advance, and §8.5 says signals never auto-advance. If it is
  wanted it needs a recorded decision, not an incidental job.

## Skills read

- `design-system` — urgency as left rule and eyebrow only (rule 2), the serif
  reserved for quoted material (rule 3), `--destructive` deliberately unmapped,
  the kanban's "never auto re-sorts under an active reviewer", the five required
  states, the mobile-first breakpoint mechanics, and the reduced-motion rule that
  CSS alone does not satisfy for Motion.
- `design_handoff_evibrief/design-system.md` — authoritative. The signal-card
  utility recipe (line 137), the component mapping (lines 231–232), the board
  grid recipe `grid gap-4 grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4`,
  the per-breakpoint table, and the kanban drag motion spec (spring 380/30, 240ms
  destination tint crossfade).
- `design_handoff_evibrief/EviBrief Screens.dc.html` — read for intent only. The
  card anatomy it shows: deadline eyebrow, relevance badge, title, one-line
  summary, and a meta row reading "audience · N matches".
- `server-actions` — authorise first inside the action, the typed
  `ActionRefusal` result, `useOptimistic` on the kanban, and the standing rule
  that optimism is only for operations already known to be permitted.
- `evidence-matcher` — rule 4 (gaps surfaced, never a blank panel) and rule 5
  (the officer adds and removes matched evidence before generation).
- `evidence-governance` — §7.5's retrieval half: the matched-evidence panel must
  not become a way to read an item that has since been downgraded.
- `inngest-jobs` — the re-match trigger, and why it is not an inline Gemini call
  in a Server Action.

## Existing code inspected

- `app/(app)/signals/page.tsx` — the `ScreenPlaceholder` this replaces. Its
  `PageHeader` subtitle ("Acting on one is always your call") is already the
  right register and is kept.
- `app/(app)/evidence/page.tsx` — the read-path pattern to follow:
  `requireStaffUser()` in the page (not the layout, which does not re-render on
  navigation), parallel data reads, and role predicates resolved server-side and
  passed down as booleans.
- `app/(app)/evidence/actions.ts` — the Server Action shape: session → role
  predicate → Zod → work → `revalidatePath`, returning `ActionRefusal` rather
  than throwing.
- `lib/auth/authorize.ts` — the §10 matrix as named predicates. **There is no
  signal-reclassification predicate yet**; this prompt adds one. The file's own
  note says `ActionRefusal` has no `gap` variant because the Matcher did not
  exist — it exists now, and the variant is added here.
- `lib/db/signals.ts` — `createClassifiedSignal` and `recordRadarRun`. The
  board's read functions join this file's table and belong beside them.
- `lib/db/evidence-matches.ts` — `SignalEvidenceMatch` and `EvidenceMatchRun`
  as prompt 14 wrote them, including `rerankScore` nullable and `chunkOrdinal`
  stored so the passage can be quoted without re-running retrieval.
- `lib/jobs/functions/match-evidence.ts` — the pipeline the re-match reuses, and
  its `idempotency: "event.data.signalId"` key, which is why the re-match needs
  its own event rather than re-emitting `signal/detected` (see decision 5).
- `prisma/schema.prisma` — `SignalReclassification` already exists with
  `previousUrgency` / `newUrgency` / `previousRelevance` / `newRelevance` /
  `reason` / `actorId` / `changedAt`. **No migration is expected.**
- `app/globals.css` — the four urgency ramps are already defined as
  `--color-{immediate,nearterm,horizon,watch}{,-ink,-surface,-border}`, and
  `--destructive` is deliberately unmapped.
- `package.json` — **`@dnd-kit/*`, `motion`, and `swr` are all absent.** dnd-kit
  and Motion are added here; SWR is not (see out-of-scope).

## Decisions and assumptions

1. **Two routes, not one route with a Sheet.** The board is `/signals`; the
   detail is `/signals/[id]`. A signal detail carries the matched-evidence
   panel, the match-run history, and a mutation — it is a place someone works
   for several minutes and links a colleague to, which is a page. The Sheet
   pattern stays where the handoff puts it: the citation chip's evidence popout,
   which must never be a route change.

2. **Drag changes urgency and nothing else.** `SignalReclassification` records
   relevance on both sides too, so a drag writes the unchanged relevance into
   both `previousRelevance` and `newRelevance`. Inventing a relevance change from
   a column move would put a classification nobody chose into the audit log.

3. **Reclassification is Programme Director and Policy & Advocacy Officer.**
   §10.3 gives the officer signal monitoring; §10.2 gives the Director
   everything. A Research Officer's authority is over *evidence* classification
   (§10.4) and a Field Officer has no signal surface (§10.5). New predicate:
   `canReclassifySignal`.

4. **Optimism is safe here and only here.** `useOptimistic` moves the card
   instantly, and the drag is only offered to a caller whose role already
   permits it — `server-actions`' rule that optimism is never applied to
   something the server may refuse on authorisation grounds. A refusal rolls the
   card back visibly, with the refusal message; it never silently reverts.

5. **The re-match is a new event, not a re-emitted `signal/detected`.** The
   matcher function is idempotent on `event.data.signalId` for 24 hours, which
   is correct for detection and wrong for a deliberate human re-run. The
   pipeline body moves to one exported function that two Inngest functions call:
   the existing `signal/detected` subscriber, and a new `signal/rematch.requested`
   subscriber with the same throttle and no idempotency key. The Server Action
   sends the event and returns; **no Gemini call runs inline in an action**
   (`server-actions`, `AGENTS.md` §5.3).
   - The action returns "re-match queued", and the panel says so. It does not
     pretend to have results it does not have, and it does not spin.

6. **The matched-evidence panel re-reads eligibility.** A stored match is a
   historical fact; an item downgraded since is not something to render a title
   and an excerpt for (§7.5). The panel's query carries
   `ELIGIBLE_EVIDENCE_WHERE`, and any stored match filtered out by it is surfaced
   as a count — "1 matched item is awaiting re-classification" — rather than
   vanishing. That count is a governance surface and is never what gets hidden
   at a smaller size (`design-system`, responsive rules).

7. **The gap is read from the run row, never inferred.** The panel's state comes
   from the latest `EvidenceMatchRun`: `matched` renders the set, `gap` renders
   the empty state, `failed` renders what failed and offers the re-match, and
   **no run row at all** renders "not matched yet" — which is a fourth state and
   is exactly what prompt 14's run row exists to distinguish. An empty join is
   never read as a gap.

8. **The gap empty state carries two real next steps** (`evidence-matcher` rule
   4): broaden the search by re-running the match, and record it as a research
   gap. Recording a research gap has no table yet, so it is a link to the
   Evidence Library's ingest route with the signal's impact area preselected —
   an honest next step rather than a button that does nothing.

9. **Status transitions stay off this prompt's surface.** A signal sits at `new`
   and nothing here advances it. The board is grouped by *urgency*, not status,
   so no column move implies a status change, and §8.5's "never auto-advance
   past `reviewed`" is not tested by anything built here.

10. **Motion is added for the drag and for nothing else.** dnd-kit provides the
    drag mechanics; Motion provides the settle spring and the destination-column
    tint crossfade. `useReducedMotion()` is required alongside the global CSS
    rule, which does not disable JS-driven animation.

## Files likely to change

**New**

- `app/(app)/signals/signal-board.tsx` — the client board: columns, dnd-kit
  context, `useOptimistic`, reduced-motion handling.
- `app/(app)/signals/signal-card.tsx` — the card. Left rule + eyebrow, relevance
  badge, title, summary, meta row.
- `app/(app)/signals/actions.ts` — `reclassifySignalUrgencyAction`.
- `app/(app)/signals/schema.ts` — the shared Zod schema (shape only; no role, no
  predicate — it ships to the browser).
- `app/(app)/signals/[id]/page.tsx` — the detail read path.
- `app/(app)/signals/[id]/matched-evidence.tsx` — the panel and its four states.
- `app/(app)/signals/[id]/actions.ts` — `requestEvidenceRematchAction`.
- `lib/db/signal-board.ts` — the board query (signals grouped for rendering,
  with each signal's match count and latest run outcome) and the detail query.
- `lib/matcher/run-match.ts` — the pipeline body extracted from the job, so two
  Inngest functions share one implementation.
- `lib/jobs/functions/rematch-evidence.ts` — the `signal/rematch.requested`
  subscriber.

**Edited**

- `app/(app)/signals/page.tsx` — placeholder replaced.
- `lib/auth/authorize.ts` — `canReclassifySignal`, `canRequestEvidenceRematch`,
  and the `gap` variant its own comment says to add when the Matcher exists.
- `lib/jobs/client.ts` — the `signal/rematch.requested` event type.
- `lib/jobs/functions/match-evidence.ts` — body moved to `lib/matcher/run-match.ts`.
- `lib/jobs/index.ts` — register the new function.
- `lib/db/index.ts` — export the new read surface.
- `components/screen-placeholder.tsx` — untouched; still used by `/impact`.
- `package.json` — `@dnd-kit/core`, `@dnd-kit/sortable`, `motion`.

## Implementation requirements

1. **The board.** `grid gap-4 grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4`,
   written mobile-first — the unprefixed classes are the phone layout. Below
   760px the urgency stage becomes a sticky section header. Column order is the
   enum's declaration order and is never re-sorted. Each column shows its count
   and its window ("< 4 weeks", "1–3 months", "3–6 months", "> 6 months").

2. **The card.** `bg-card border border-{ramp}-border border-l-[3px]
   border-l-{ramp} rounded-card p-4 shadow-raised`, per the handoff's line 137.
   Urgency appears **only** as that rule plus the small-caps eyebrow; relevance
   is a separate badge on its own scale (Core filled primary, Adjacent
   surface-tint, Background stone). The summary is generated prose and is
   therefore **sans, never the serif** — the serif is quoted material only, and
   a signal summary is written by the classification call.

3. **Drag.** dnd-kit with keyboard sensors — the board must be operable entirely
   from the keyboard (`AGENTS.md` §11.13), with an ARIA live announcement on
   pick-up and drop. Motion's spring for the settle, 240ms tint crossfade on the
   destination column, and `useReducedMotion()` collapsing both to instant.

4. **The reclassify action.** Session → `canReclassifySignal` → Zod → the update
   and the `SignalReclassification` row **in one transaction** → `revalidatePath`.
   The audit row records actor and timestamp; a no-op drag (same column) writes
   nothing and returns early.

5. **The detail page.** Signal metadata, the source link (`rel="noreferrer"`,
   external), the classification set, the reclassification history, and the
   matched-evidence panel. Nothing on this page implies the system decided
   anything (§8.8).

6. **The matched-evidence panel's four states**, all designed, none a spinner or
   a blank div: `matched` (ranked list with similarity and rerank score as
   **number + bar, never colour alone**), `gap` (the empty state and its two next
   steps), `failed` (the machine reason, plainly worded, plus re-match), and
   `never run`. Plus the ineligible-match count from decision 6.

7. **The re-match action.** Session → `canRequestEvidenceRematch` → send
   `signal/rematch.requested` → return queued. It calls no model, runs no
   retrieval, and holds no request open.

8. **Every page fully responsive**, checked at 390/760/1000/1300/1600px, with no
   horizontal page scroll at any width (`AGENTS.md` §11.15).

## Evidence classification impact

**Touched, on two paths, and neither is a new model call.**

- **Retrieval face, in the UI.** The matched-evidence panel reads evidence
  titles, citation keys and chunk excerpts for items stored in
  `SignalEvidenceMatch`. Those items were `public_published` when the match was
  written, and may not be now. Enforcement point: the panel's query in
  `lib/db/signal-board.ts`, which carries `ELIGIBLE_EVIDENCE_WHERE` exactly as
  `listEligibleEvidence` does. Blocked items are **counted and surfaced** as
  "awaiting re-classification", never rendered and never silently dropped
  (§7.5, `evidence-governance`'s "refusal is data").
- **The re-match triggers a gated Gemini call.** The rerank is call type 1/2 in
  `evidence-governance`, and its enforcement point is unchanged: the branded
  `GatedRerankCandidates` in `lib/ai/rerank.ts`, whose single constructor calls
  `partitionByClassification`. Moving the pipeline body into
  `lib/matcher/run-match.ts` **must not** introduce a second entry point that
  takes raw candidates — the extracted function takes a `signalId` and reads
  everything else from the database, exactly as the job does now.

The new event carries `{ signalId }` and nothing else. No signal summary and no
evidence excerpt enters an Inngest payload, a log line, or a Server Action
result (§7.6, §13.9). No bypass, no `force`, no env var is added.

## Hallucination-guard implications

**None.** This prompt creates no brief, no version, and no flag, and it does not
touch `lib/ai/fact-check.ts`, the flag Mark, the flag panel, or the approval
refusal. Nothing here changes what is fact-checked, how claims are extracted, how
flags are stored, how flags render, or what a flag blocks.

One forward-looking connection, stated so it is not mistaken for a change: when
generate-from-signal is built, the matched set becomes `BriefEvidence` **after**
the officer's add and remove, and the fact-check pass verifies against that final
set — never against raw matcher output. Nothing here alters that.

## Security requirements

- Every Server Action authorises inside the action, server-side. The board hides
  the drag affordance for a role that may not reclassify, and that hiding is
  presentation, never the control (§10.1).
- `lib/auth/authorize.ts` stays server-only; no role name and no predicate enters
  `schema.ts`, which ships to the browser (§10.10).
- The signal's `sourceUrl` is external and untrusted: rendered as a link with
  `rel="noreferrer"`, never fetched, never embedded, never `dangerouslySetInnerHTML`.
- No new Route Handler, no client-side Prisma, no model call from browser code.
- Logging is ids, counts and outcomes. No evidence excerpt, no signal summary.

## Acceptance criteria

1. `/signals` renders four urgency columns in ramp order with real signals; no
   card has a filled urgency background and nothing on the page is red.
2. Dragging a card between columns updates it optimistically, persists the new
   urgency, and writes exactly one `SignalReclassification` row with the acting
   staff user and a timestamp. A same-column drop writes nothing.
3. A signal whose relevance is Core renders a filled primary badge; relevance
   never borrows an urgency colour.
4. The board is fully operable by keyboard, including the drag, with an audible
   announcement on pick-up and drop.
5. `/signals/[id]` renders the matched set with similarity and rerank score as
   number-plus-bar; a signal whose latest run is `gap` renders the empty state
   with two working next steps; a signal with no run row renders "not matched
   yet" rather than a gap.
6. A matched item downgraded to `unpublished_internal` disappears from the list
   and appears in the awaiting-re-classification count.
7. Re-match queues a run visible in the Inngest UI, writes a second
   `evidence_match_run` row, and replaces the match set. The action itself
   returns immediately and makes no Gemini call.
8. No brief is created, no signal status changes, and nothing auto-advances.
9. `prefers-reduced-motion` removes the drag spring and the column crossfade.
10. No horizontal page scroll at 390, 760, 1000, 1300 and 1600px.
11. `npm run lint` and `npm run typecheck` are clean apart from the four
    pre-existing errors §19 names.

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npm run build`

No migration is expected. If a schema change turns out to be needed, it goes
through `npm run db:migrate:new` and the generated SQL is read before applying.

Report the exact output of each.

## Manual test steps

1. `npm run dev` and `npm run inngest:dev`. Ensure at least four signals exist
   across different urgencies — trigger a radar run, or set urgencies in
   `npm run db:studio`.
2. Open `/signals`. Confirm four columns in ramp order, counts per column, and
   cards carrying a left rule and eyebrow only.
3. Drag a card from Watch to Immediate. Confirm it moves instantly, stays there
   after a refresh, and that Studio shows one new `signal_reclassification` row
   with your staff user id.
4. Drop a card back into its own column. Confirm no new audit row.
5. Tab to a card, pick it up and move it with the keyboard, and confirm the
   announcement is read out.
6. Sign in as a Research Officer (or change your role in Studio). Confirm the
   drag affordance is absent, and that calling the action anyway is refused —
   check the refusal is server-side, not just a hidden control.
7. Open a signal with matches. Confirm the ranked list, the scores as
   number-plus-bar, and that the excerpt is set in the serif while the signal's
   own summary is not.
8. In Studio, set one matched item to `unpublished_internal`. Refresh: it is
   gone from the list and counted as awaiting re-classification.
9. Open a signal whose latest run is `gap`. Confirm the empty state and both
   next steps, and that neither is a dead control.
10. Press Re-match. Confirm the run appears in the Inngest UI, a second
    `evidence_match_run` row is written, and the page reflects the new set after
    a refresh.
11. Check the board and the detail page at 390, 760, 1000, 1300 and 1600px.
12. Enable `prefers-reduced-motion` and confirm the drag and the column tint
    change instantly.
