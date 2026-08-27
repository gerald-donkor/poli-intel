# Prompt 66 — Submission Tracker and Stakeholder CRM UX Refinement

## Goal

Refine the existing submission tracker and stakeholder CRM so Tropenbos Ghana staff can see policy windows, identify undated signals, maintain contact records, and understand brief engagement history without treating the product as an autonomous planner or sender.

This is the next unbuilt UI refinement scope because prompts 53-55, 63, and 65 have covered global chrome, radar, evidence governance, brief generation/audience switching, and brief editor/guard/Twi surfaces. The tracker and CRM are already implemented with the right data boundaries, so this prompt is a focused UX pass rather than a schema rewrite.

The scope covers:

1. `/tracker` policy window calendar/timeline, dated window list, empty and filtered-empty states.
2. `/tracker` undated signals quick drawer/rail, including date-entry affordances and truncation copy.
3. `/stakeholders` contact creation panel, grouped contact list, empty state, and card hierarchy.
4. `/stakeholders/[id]` contact record layout and brief engagement history.

## Skills read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)

## Existing code inspected

- `AGENTS.md` — workflow, UI roadmap, submission/human-control rules, roles, evidence governance, design rules, checks.
- `design_handoff_evibrief/design-system.md` — token system, warm institutional palette, urgency ramp, typography roles, responsive recipes, motion durations, component mapping.
- `prompts/65-brief-editor-hallucination-guard-and-twi-ux.md` — most recent executed roadmap-adjacent UI prompt.
- `app/(app)/tracker/page.tsx` — Server Component data loading, role-derived presentation permissions, page-level tracker comments.
- `app/(app)/tracker/tracker-board.tsx` — client boundary for selected day state, calendar/table composition, visible-window filtering.
- `app/(app)/tracker/window-calendar.tsx` — shadcn Calendar day markers and accessible day labels.
- `app/(app)/tracker/window-table.tsx` — dated policy window table, brief status display, date disclosure control.
- `app/(app)/tracker/window-date-control.tsx` — native date input, local validation, Server Action call, inline refusal state.
- `app/(app)/tracker/undated-panel.tsx` — undated signal backlog, date controls, truncation notice.
- `app/(app)/tracker/actions.ts` — `setSignalWindowAction` authorisation, validation, one-column update, revalidation.
- `lib/db/tracker.ts` — tracker read DTOs, dated/undated queries, one-column date update, no evidence body reads.
- `app/(app)/stakeholders/page.tsx` — CRM route-level role gate, grouped contact list, create panel.
- `app/(app)/stakeholders/create-panel.tsx` — in-place add-contact disclosure.
- `app/(app)/stakeholders/[id]/page.tsx` — contact detail layout, record panel, share history.
- `app/(app)/stakeholders/actions.ts` — stakeholder create/update authorisation and validation.
- `lib/db/stakeholders.ts` — stakeholder list/detail DTOs, share history reads, share logging semantics.
- `components/ui/*` — existing shadcn primitives available for composition, especially `Button`, `Calendar`, `Table`, `Sheet`, `Drawer`, `Badge`, `Empty`, `Separator`, `Field`, `Input`, `Select`, `Textarea`, `ScrollArea`, and `Tooltip`.
- `package.json` — available checks: `test`, `lint`, `typecheck`, `build`.

## Decisions and assumptions

1. This prompt is a UI and interaction refinement. Preserve the existing Prisma schema and do not add a new submission, reminder, task, or notification model.
2. The submission tracker remains a read view over existing `PolicySignal.windowClosesAt` plus linked brief statuses. It must not approve, submit, publish, send, schedule, or infer anything.
3. Date recording stays human-entered through `setSignalWindowAction`; no date suggestion, auto-fill from urgency, or AI extraction is introduced.
4. The stakeholder CRM remains available only to Programme Director and Policy & Advocacy Officer. Field Officer and Research Officer access stays refused.
5. Share history remains an audit surface of human-logged brief sharing. Do not add automated outreach, emailing, WhatsApp sending, or stakeholder deletion.
6. Motion, if added, must be small authenticated-route UI motion: 150-300ms, CSS or Motion only, reduced-motion compliant. No GSAP in this scope.
7. The existing duplicate prompt number `60-*` is repository history. Do not renumber or overwrite prompts. This file is `66` because the highest existing prompt number is `65`.

## Files likely to change

- `app/(app)/tracker/page.tsx`
- `app/(app)/tracker/tracker-board.tsx`
- `app/(app)/tracker/window-calendar.tsx`
- `app/(app)/tracker/window-table.tsx`
- `app/(app)/tracker/window-date-control.tsx`
- `app/(app)/tracker/undated-panel.tsx`
- `app/(app)/tracker/labels.ts`
- `app/(app)/stakeholders/page.tsx`
- `app/(app)/stakeholders/create-panel.tsx`
- `app/(app)/stakeholders/[id]/page.tsx`
- `app/(app)/stakeholders/stakeholder-form.tsx`
- `app/(app)/stakeholders/labels.ts`
- `components/ui/*` only if a small composition-compatible fix is required
- `app/globals.css` only if a missing existing animation utility or responsive token fix is required

## Implementation requirements

1. **Tracker Layout and Timeline**
   - Keep `/tracker` as a Server Component read path with one small client boundary for selected-day UI state.
   - Rework the dated-window surface into a clearer policy-window timeline: calendar remains the month overview, while the adjacent list/table makes soonest deadlines, closed unanswered windows, linked briefs, and gaps scannable.
   - On `laptop` and wider, use a stable two-column structure with a sticky calendar/summary rail and a flexible timeline/table pane. On smaller screens, stack calendar first, then selected/all windows, then undated backlog.
   - The page frame must stay `w-full max-w-[1440px] mx-auto` with no horizontal page scroll at 320px-1600px.
   - If the table remains, it may scroll inside its own panel only; the page itself must not horizontally scroll. Consider replacing low-density table rows with responsive timeline rows/cards if that better satisfies mobile readability.
   - Urgency remains the warm-to-cool ramp: immediate bronze, near-term olive, horizon teal, watch slate. Use a 3px left rule and small-caps eyebrow; never red/amber/green and never a full-card urgency fill.
   - Closed unanswered windows use watch/slate or neutral governance styling, not destructive styling or alarm copy.

2. **Calendar Interaction**
   - Keep shadcn `Calendar`/`CalendarDayButton` semantics and keyboard behavior.
   - Mark days with small dots or count markers only. Do not fill entire day cells with urgency colors.
   - Every marked day needs an accessible label naming the date, count, and soonest urgency.
   - Selecting a day should visibly update the adjacent list with a 150-240ms crossfade using the existing count-fade pattern or an equivalent reduced-motion-safe transition.
   - Provide a clear "show all recorded windows" control when filtered to one day. It must be keyboard reachable and at least 44px high on mobile.

3. **Undated Signals Quick Drawer/Rail**
   - Convert the undated backlog from a long secondary section into a quick drawer, side rail, or compact expandable backlog that stays visible as a count near the tracker heading/calendar.
   - Do not hide the backlog entirely; undated signals are the governance-adjacent gap in the tracker. The count must be visible above the fold on desktop and near the top of the stack on mobile.
   - Use plain copy: "No closing date recorded." Do not say the product inferred, suggested, estimated, or detected a closing date.
   - Each undated signal entry should expose title, geography, detected date, urgency eyebrow, and date-entry control for authorised roles.
   - If the 40-item limit is reached, keep the truncation notice visible and link to `/signals`.
   - Date entry must remain a native date input using the existing shared Zod schema and Server Action. Do not add a custom calendar picker for writing dates.

4. **Window Date Control**
   - Preserve server-side authorisation in `setSignalWindowAction`; UI hiding is presentation only.
   - Improve the inline pending/saved/refused feedback so a user can tell whether the date was recorded without a layout jump.
   - Use watch/slate inline alert styling for validation/refusal messages, never destructive red.
   - Buttons must be stable height: at least 44px on mobile, compact to 32-36px on tablet/desktop if the surrounding form is dense.
   - Use shadcn form composition where practical (`Field`, `FieldGroup`, `FieldLabel`, `FieldError`) without broad rewrites.

5. **Stakeholder List**
   - Keep the route-level role gate and the action-level write gates.
   - Refine the page into a quiet CRM work surface, not a generic card dashboard. The hierarchy should support repeated scanning: contact name, organisation/role, audience type, language, and share count.
   - Keep grouping by `AUDIENCE_TARGET_ORDER`, not by count or recent activity. Ungrouped contacts remain last with plain labeling.
   - Make the add-contact disclosure more compact when closed and easier to use when open. It should not become a modal.
   - Contact cards should have stable heights within a row where possible, clear focus states, and no text clipping for long names or organisations.
   - Prefer existing `AudienceTypeBadge`, `Badge`, `Empty`, `Separator`, and `Button` primitives. Do not introduce a second CRM component system.

6. **Stakeholder Detail and Brief Engagement History**
   - Make brief history the primary surface and contact record the secondary rail on desktop; stack brief history before the record on mobile.
   - Each share-history item should read like an engagement log entry: brief title, brief type, audience written for, current brief status, who logged it, date, and note.
   - Keep the distinction between a contact's `AudienceTarget` and a brief's `BriefAudience`; do not map or collapse the enums.
   - Use IBM Plex Mono for timestamps/counts, Inter for staff notes and UI text. Do not use Source Serif unless rendering verbatim source/policy material, which this scope does not do.
   - Empty share history should name the real next step: open briefs and log a share from the brief page. Do not imply the CRM can send a brief.
   - Preserve the no-delete decision unless a later spec explicitly creates an archival workflow.

7. **Responsive and Accessibility Requirements**
   - Verify 320px, 390px, 760px, 1000px, 1300px, and 1600px widths.
   - No horizontal page scroll, clipped controls, overlapping panels, or text below 12px.
   - Desktop Officer/Director surfaces may be dense, but mobile must stay readable with one primary column and 44px tap targets.
   - All drawers/sheets need `SheetTitle`/`DrawerTitle` and descriptions. Visually hidden titles are acceptable when the visible heading already exists elsewhere.
   - Keyboard users must be able to select calendar days, clear filters, open/close the undated drawer, record dates, add/edit contacts, and follow share-history links.
   - Enabled interactive controls need `cursor-pointer`; disabled controls need an appropriate disabled cursor/state.
   - Respect `prefers-reduced-motion`. Any added crossfade or drawer transition must become instant under reduced motion.

## Evidence classification impact

None — no evidence data path.

This scope does not touch, store, move, read, or transmit `EvidenceItem` body text, `EvidenceChunk` text, embeddings, evidence classifications, or any AI-layer entry point. The tracker reads `PolicySignal` metadata and linked brief ids/types/audiences/statuses through `lib/db/tracker.ts`; it deliberately does not join through `BriefEvidence` or load evidence bodies. The CRM reads contact records and share history through `lib/db/stakeholders.ts`; it reads the latest brief version body only to derive the brief display title with `firstLine`, and does not use that prose for Gemini, search, matching, classification, telemetry, or export.

Classifications involved: none in this prompt. The enforcement point remains the existing governance gate for AI-layer work, not these routes. If implementation accidentally introduces an evidence read or model call, stop and update the prompt before coding.

## Hallucination-guard implications

None.

This prompt does not change brief generation, fact-checking, claim extraction, flag storage, flag rendering, flag resolution, or approval blocking. The tracker may display brief status only; it must not add approval/submission controls or bypass the existing server-side rule that unresolved hallucination flags block Programme Director approval on the brief route.

## Security requirements

- Preserve `requireStaffUser()` on Server Component route reads.
- Preserve `canSetSignalWindow` and `canManageStakeholders` render checks as presentation only; Server Actions remain the enforcement point.
- Every mutation must continue to authorise before validation and database writes.
- Do not add Route Handler mutations for app forms.
- Do not import Prisma, AI modules, or server-only helpers into client components.
- Do not log stakeholder names, organisations, notes, brief prose, signal titles, or raw errors to Sentry/PostHog/console.
- External links, if added, must use `target="_blank"` with `rel="noreferrer"`.
- Do not add automated sending, reminders, status transitions, auto-submission, auto-publishing, or hidden background jobs.

## Acceptance criteria

1. `/tracker` presents calendar, dated windows, and undated backlog as one coherent policy-window tracker with no autonomous planning language.
2. Undated signal count is visible near the top of the tracker and opens a usable drawer/rail/expandable backlog without burying the issue below the fold.
3. Dated windows are scannable by closing date, urgency, geography, and linked brief status, with empty/no-brief states that name the next manual step.
4. Calendar markers remain non-filled day dots/counts with accessible labels and keyboard selection.
5. Date recording remains a native date input backed by `setSignalWindowAction`, with stable inline pending/refusal feedback and no layout jump.
6. `/stakeholders` supports fast scanning of grouped contacts, long text does not clip, and the add-contact panel is compact when closed and ergonomic when open.
7. `/stakeholders/[id]` makes share history the primary surface, with engagement-log rows that show brief title, type, audience, status, actor, date, and note.
8. CRM surfaces never imply the product sent a brief; every share is described as logged by a person.
9. All updated screens work at 320px, 390px, 760px, 1000px, 1300px, and 1600px without horizontal page scroll.
10. Keyboard navigation, focus states, drawer/sheet accessibility, and reduced-motion behavior are verified.

## Checks to run

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Report exact output. If a check fails because of a known pre-existing issue outside touched files, identify it separately and report whether touched files introduced any new failure.

## Manual test steps

1. Start the app with `npm run dev`.
2. Sign in as a Policy & Advocacy Officer and open `/tracker`.
3. At 390px, 760px, 1000px, 1300px, and 1600px widths, verify the calendar, window list/timeline, and undated backlog reflow without horizontal page scroll.
4. Select a marked calendar day using keyboard and pointer. Confirm the dated-window list updates, the accessible label names the window count, and "show all recorded windows" restores the full list.
5. Open the undated backlog drawer/rail, record a closing date for one signal, and confirm the count/list refreshes without implying the date was inferred.
6. Try a validation failure in the date control and confirm the message is inline watch/slate styling, not red or a toast.
7. Sign in as a role that cannot record dates and confirm controls are hidden or disabled in the UI, then verify the Server Action would still refuse if invoked.
8. Open `/stakeholders` as a Programme Director or Policy & Advocacy Officer. Confirm grouped contacts, long contact names, language, audience type, and share counts are legible at mobile and desktop widths.
9. Open the add-contact panel, create a contact, and confirm the page returns to a stable scanned list without a modal workflow.
10. Open `/stakeholders/[id]` for a contact with and without share history. Confirm the history appears before the record on mobile, as the primary pane on desktop, and never implies the app sent anything automatically.
