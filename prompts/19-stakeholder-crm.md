# 19 — Stakeholder CRM

## Goal

Build the stakeholder CRM: contact records with brief history, at `/stakeholders`.

Three surfaces:

1. **`/stakeholders`** — the contact list, grouped by audience type, with a create form.
2. **`/stakeholders/[id]`** — one contact record: their details, an edit form, and their brief history in reverse-chronological order.
3. **A "Log a share" control on the brief detail page** (`/briefs/[id]`) — records that a named person sent this brief to a named stakeholder, on a date, with an optional note.

That third surface is what makes the first two more than an address book. `StakeholderBrief` is the join table the spec calls `brief_history[]`; without a way to write a row into it, the CRM has no history to show and the Impact Tracker (a later prompt) has no path from an influence event back to who the brief actually reached.

Scope explicitly **excludes** the submission tracker. Spec §5.5's route table puts "contact records, brief history, submission tracker" behind `/stakeholders`, but `AGENTS.md` §1 lists the submission tracker as its own build-list item — a calendar of upcoming policy windows with brief status, which is signal-and-deadline work, not contact work. It gets its own prompt. Do not build a calendar here.

## Skills read

- **`server-actions`** (project) — the mutation path, authorise-first ordering, the typed refusal shape, Zod schemas shared with React Hook Form, and the rule that authorisation never appears in a client-visible schema.
- **`design-system`** (project) — tokens live in `@theme`; no clinical white; the urgency ramp is not reused for non-urgency meaning; `--destructive` stays unmapped; the serif is quoted material only; responsive at every width with `tablet`/`laptop`/`desktop` as `min-width` variants.
- **`design_handoff_evibrief/design-system.md`** — authoritative. The Evidence Library grid recipe (`grid grid-cols-1 laptop:grid-cols-[1fr_320px] desktop:grid-cols-[216px_1fr_340px]`) and the side-panel rule (`border-t laptop:border-t-0 laptop:border-l border-line`) are the two this task reuses.
- **`supabase-schema`** (project) — read for the additive-migration path and the `npm run db:migrate:new` rule, since this task adds one column.
- **`shadcn`** (vendor) — `Table`, `Card`, `Dialog`/`Sheet`, `Select`, `Input`, `Textarea`, `Badge`, and the `data-slot` conventions.
- **`evidence-governance`** — read to confirm the conclusion recorded below, not because this task has an AI path.

## Existing code inspected

- `prisma/schema.prisma` — `Stakeholder` (lines ~757), `StakeholderBrief` (~774), `Brief.stakeholderShares` (~553), `AudienceTarget` (~78) and `BriefAudience` (~99) enums. Both models exist and are currently **written by nothing** — `grep` for "stakeholder" across `app/` and `components/` returns no hits.
- `lib/auth/authorize.ts` — **`canManageStakeholders(role)` already exists** and returns true for Programme Director and Policy & Advocacy Officer. Use it; do not write a second predicate. `ActionRefusal` and `unauthorised()` are here too.
- `lib/auth/session.ts` — `requireStaffUser()` for pages, `getCurrentStaffUser()` for actions.
- `app/(app)/evidence/actions.ts` — the reference Server Action: session → role predicate → `safeParse` → data layer → typed result. Copy this order exactly.
- `app/(app)/evidence/page.tsx` — the reference page: `requireStaffUser()` in the page body (not the layout), parallel reads, and a genuinely differentiated empty state.
- `app/(app)/briefs/page.tsx`, `app/(app)/briefs/[id]/page.tsx`, `review-panel.tsx`, `status-history.tsx` — the brief detail layout this task adds a panel to, and the existing pattern for rendering an actor + timestamp list.
- `app/(app)/briefs/labels.ts`, `app/(app)/signals/labels.ts` — `AUDIENCE_TARGET_LABELS` already exists in the signals labels module; `formatDecisionAt` / `formatGeneratedAt` already exist in the briefs labels module.
- `lib/ai/audience-profiles.ts` — `audienceLabel()`, `AUDIENCE_OPTIONS` for `BriefAudience`.
- `lib/db/index.ts` — the data layer's single public surface; every new query is exported from here.
- `components/app-nav.tsx` — four nav links, no `/stakeholders`.

## Decisions and assumptions

1. **One additive column, and only one.** `StakeholderBrief` records `sharedAt` and `note` but not *who* logged the share. Add `sharedById String? @map("shared_by_id")` with a `StaffUser` relation and `onDelete: SetNull`, matching how `Brief.createdById` is modelled. Rationale: the Impact Tracker traces an influence event back through the share, and "this brief reached the Ministry" is a materially weaker record than "Ama sent this brief to the Ministry on 4 August". Nullable because rows written before this column existed have no honest answer, and inventing one would be worse than a null. This is the **only** schema change; every other field the spec §4.1 stakeholder row names already exists.

2. **No `email` or phone field.** Spec §4.1 fixes the stakeholder columns to `id, name, organisation, role, audience_type, preferred_language, brief_history[]`. Adding contact channels is a plausible instinct and is out of scope — the product does not send anything to a stakeholder, and a stored personal email address is a data-protection surface this task has no mandate to open. If it is wanted later it is a recorded decision and its own migration.

3. **`Stakeholder.audienceType` is `AudienceTarget`, not `BriefAudience`, and the two are never collapsed.** The schema comment at line 75 is explicit that this needs a recorded decision and there isn't one. A stakeholder record therefore shows its `AudienceTarget` label and a brief shows its `BriefAudience` label, side by side, with **no mapping between them and no "this brief matches this contact" affordance**. Do not add a cross-walk table. If a share pairs `eu_regulator` framing with an `eu_institutions` contact, that is a human's judgment and the UI says nothing about it.

4. **Logging a share is not gated on brief status.** `canExportBrief` in `lib/auth/authorize.ts` already reasons that "a draft is exactly what someone needs to circulate for comment", and a share log is a record of what a person did, not a permission to do it. Refusing to log a real share would make the record less true, not the product safer. The panel shows the brief's status next to each share so the reader can see what was circulated.

5. **Logging a share is not a status transition and must not touch `Brief.status`.** `AGENTS.md` §8.2–8.3 reserves `submitted`/`published` for an explicit Programme Director action. Writing a `StakeholderBrief` row must not move a brief, must not enqueue anything, and must not be described in copy as submitting or publishing. The button says "Log a share"; the heading says "Shared with".

6. **Who may do what.** Read and write both go through `canManageStakeholders` — Programme Director and Policy & Advocacy Officer. A Field Officer is refused outright (§10.5, explicit). A Research Officer is refused too: §10.4 describes evidence and accuracy work with no CRM component, and §10.3 assigns stakeholder relationships to the Policy & Advocacy Officer. This is a deliberate reading; state it in a comment on the route so the next person sees the reasoning rather than re-deriving it.

7. **Deletion: not built.** No delete action for a stakeholder or a share. `StakeholderBrief` cascades from both parents already, and a CRM whose history can be quietly removed is a worse audit surface than one that cannot. Editing a contact's details is enough for the corrections this stage needs.

8. **`preferredLanguage` is a `String?` and stays one.** Offer a small fixed set in the form — English, Twi — as a shared const in the schema module, not a Prisma enum. The translation-assist prompt reads this field; an enum migration for two values is not warranted, and the free column leaves room for the third language that will inevitably appear.

9. **The nav gains a fifth link.** `/stakeholders` joins Signals, Briefs, Evidence, Impact in `components/app-nav.tsx`, placed after Briefs (contacts follow from the thing you send them). The existing comment there — that the list is presentation, never access control — stays true and stays accurate for the new link.

## Files likely to change

**Schema and migration**

- `prisma/schema.prisma` — `sharedById` on `StakeholderBrief`, plus the back-relation on `StaffUser`.
- `prisma/migrations/<timestamp>_stakeholder_share_actor/migration.sql` — authored with `npm run db:migrate:new -- stakeholder_share_actor`. **Never `prisma migrate dev`.** No vector column is involved, so no hand-written HNSW index; verify the generated SQL contains no `DROP INDEX` on `*_embedding_cosine_idx` before applying.

**Data layer**

- `lib/db/stakeholders.ts` (new) — `listStakeholders()`, `findStakeholderDetail(id)`, `createStakeholder(input)`, `updateStakeholder(input)`, `recordBriefShare(input)`, `listSharesForBrief(briefId)`, plus their DTO types. Prisma only; nothing else in the app touches these tables.
- `lib/db/index.ts` — re-export the above.

**Routes**

- `app/(app)/stakeholders/page.tsx` (new) — list, grouped by audience type.
- `app/(app)/stakeholders/schema.ts` (new) — the shared Zod schemas (`createStakeholderSchema`, `updateStakeholderSchema`, `logShareSchema`) and the `PREFERRED_LANGUAGES` const. **Shape only — no role list, no predicate, nothing from `lib/auth/authorize.ts`** (§10.10).
- `app/(app)/stakeholders/actions.ts` (new) — `createStakeholderAction`, `updateStakeholderAction`.
- `app/(app)/stakeholders/stakeholder-form.tsx` (new) — client, React Hook Form + the shared schema, used for both create and edit.
- `app/(app)/stakeholders/labels.ts` (new) — re-export `AUDIENCE_TARGET_LABELS` from the signals labels module rather than re-declaring it, plus a `formatSharedAt` helper if the briefs one does not fit.
- `app/(app)/stakeholders/[id]/page.tsx` (new) — the detail record and brief history.
- `app/(app)/briefs/[id]/share-panel.tsx` (new) — client, the "Log a share" dialog and the "Shared with" list.
- `app/(app)/briefs/[id]/actions.ts` — add `logBriefShareAction`.
- `app/(app)/briefs/[id]/schema.ts` — add `logShareSchema` (or import it from the stakeholders schema module; pick one home and import, do not duplicate).
- `app/(app)/briefs/[id]/page.tsx` — render `SharePanel`, reading shares alongside the existing brief detail read.

**Shell**

- `components/app-nav.tsx` — the fifth link.

## Implementation requirements

### Data layer

- Every query lives in `lib/db/stakeholders.ts` and returns a plain DTO, not a Prisma model with relations dangling. Follow the shape of `lib/db/briefs.ts`.
- `findStakeholderDetail` returns the contact plus its shares, each carrying the brief's id, title/type, audience, status, `sharedAt`, note, and the sharer's name. Order shares `sharedAt desc`.
- `recordBriefShare` is idempotent-safe against the composite primary key `(stakeholderId, briefId)`: a second log of the same pair **updates** `sharedAt`/`note`/`sharedById` rather than throwing a unique-constraint error. Return a discriminated result telling the action which happened, so the UI can say "Updated the share record" rather than pretending a duplicate was a new one. Never swallow the constraint into a silent catch.
- `listStakeholders` returns a share count per contact so the list can show it without an N+1.

### Server Actions

Order, in every action, no exceptions: `getCurrentStaffUser()` → `canManageStakeholders(staffUser.role)` → `safeParse` → data layer → typed result. Authorise **before** validating, so an unauthorised caller learns nothing from field errors.

- Return `{ ok: true, ... } | { ok: false, refusal: ActionRefusal }`, matching `classifyEvidenceAction` exactly. Do not throw across the action boundary for an expected outcome.
- Map Zod issues to `{ kind: "invalid", fieldErrors }` with the same reduction the evidence action uses.
- `revalidatePath` the affected routes: `/stakeholders`, `/stakeholders/[id]`, and `/briefs/[id]` for the share action.
- Actions stay short. No pipeline work, no Gemini, no job dispatch.

### Pages

- `requireStaffUser()` in the **page body**, not the layout — layouts do not re-render on navigation.
- After resolving the user, refuse the route for a role that fails `canManageStakeholders`: render a plain, calm "This area is for the policy team" panel rather than a crash or a redirect loop. The actions authorise independently regardless.
- Server Components fetch; no SWR, no client fetching (SWR is reserved for the signal dashboard).

### UI

Read `design_handoff_evibrief/design-system.md` first. The specifics:

**Layout.** The list page reuses the Evidence Library two-part shape without its filter rail: a single `max-w-[1440px] mx-auto` column at `p-4 tablet:p-6`, contacts grouped into `<section>`s by audience type with the same small-caps uppercase `text-meta` group heading the briefs list uses for status groups. The detail page is `grid grid-cols-1 laptop:grid-cols-[1fr_320px]` — brief history left, the contact's own details right — with the side panel taking `border-t laptop:border-t-0 laptop:border-l border-line` so the border flips when the column stacks.

**Typography.** Everything here is the product's own voice: **Inter throughout**. A share note is a staff member's own words, not quoted source material, so it is **not** the serif. IBM Plex Mono only for the share count and the dates. Nothing below 13px; 13px reserved for compact table rows, 14px standard.

**Colour.** `paper` background, `card` surfaces, `line` borders. **The audience-type grouping must not borrow the urgency ramp** — `bronze`/`olive`/`teal`/`slate` carry the urgency taxonomy and remapping a fill to a different meaning breaks it (`design-system` rule 2). Audience type renders as a neutral `Badge` on `surface-tint` with a text label, uniform across all five values. `--destructive` stays unmapped; the form's validation errors are plain `ink` text with an accent-ring focus state, never red.

**Iconography.** Abstract structural marks only — a thin-stroke circle or square, in the vocabulary already used by the evidence empty state. No people icons, no address-book icons, no leaf.

**Motion.** Micro-interactions 150–300ms on hover and the dialog. Nothing else. If in doubt, cut it.

**States.** Design all of them, not just the happy path:

- **Empty list** — no contacts yet, with a real next step (the create form), not a blank panel.
- **Empty history** — a contact with no shares says so plainly and points at `/briefs`.
- **Brief with no shares** — the panel on `/briefs/[id]` still renders, with its "Log a share" control and a one-line "Not logged as shared with anyone yet."
- **Unauthorised role** — the calm panel described above.
- Rate-limited, offline, classification-pending and flagged states do not apply here; there is no AI call, no queue, and no evidence path.

**Copy.** Never imply the system decided, verified, or sent anything. The product records what a person did. "Log a share", "Shared with", "Logged by Ama on 4 Aug" — never "Sent", never "Delivered".

**Accessibility.** WCAG 2.1 AA. Every form control labelled; the dialog gets a proper title and focus trap via the shadcn primitive; the audience badge carries an accessible label rather than colour alone (it is uniform-coloured by design, so the text is doing the work already); the brief-history list is a real list; keyboard reachable throughout; visible accent focus ring with offset.

**Responsive.** Verify at 390px, 760px, 1000px, 1300px, 1600px. No horizontal page scroll at any width. The brief-history rows stack to a labelled block below `tablet` rather than compressing a table; the detail grid collapses to one column below `laptop`.

## Evidence classification impact

**None — no evidence data path.**

Nothing in this task reads, writes, moves, or transmits an `EvidenceItem`, an `EvidenceChunk`, or a chunk embedding. The tables touched are `Stakeholder`, `StakeholderBrief`, and `StaffUser` (relation only). No Gemini call is made, so the §7 gate has no entry point to guard here — the gate is not weakened, it is simply not on this path.

Two adjacent things to keep true, both of them things a careless implementation could break:

- **A share note is staff-authored free text and must never be fed to a model**, now or later. Do not add it to any prompt-assembly module, and do not embed it. If a future task wants to search share notes, that is a keyword search over a Postgres column, not an embedding.
- **§7.6 still applies to logging.** No evidence body text, and no stakeholder personal data, in a Sentry event or a PostHog property. A named contact at a named ministry is exactly the kind of record Tropenbos cannot afford to leak into third-party telemetry. Log ids, never names.

## Hallucination-guard implications

**None.**

This task does not change what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks. No generation runs. The flag panel on `/briefs/[id]` is untouched.

One explicit non-change, because the new panel sits next to the flag panel: **logging a share is not gated on flag state, and adding such a gate is out of scope.** `AGENTS.md` §9.5 makes an unresolved flag block **Programme Director approval** and nothing else; `canExportBrief` already records the same reasoning for the Word export. Inventing a second thing a flag blocks would quietly change the guard's contract. The share panel must not read flag state at all.

## Security requirements

- Every action authorises server-side, inside the action, before any work. UI hiding is presentation only (§10.1).
- The shared Zod schema module carries **shape only**. No role names, no predicates, nothing imported from `lib/auth/authorize.ts` — that module is `server-only` and must stay unreachable from client code (§10.10).
- Validate on the server regardless of what the client validated.
- No new env vars, no new external calls, no new secrets.
- `lib/db/stakeholders.ts` is `server-only` like the rest of the data layer.
- No stakeholder name, organisation, or share note in any log line, error report, or analytics payload.
- The share action must not accept a `sharedById` from the client — it comes from the session, server-side, always.

## Acceptance criteria

1. `/stakeholders` lists contacts grouped by audience type, with a share count per contact, and a working create form.
2. `/stakeholders/[id]` shows the contact's details, an edit form that persists, and their brief history newest-first with each entry naming the brief, its status, who logged the share, and when.
3. `/briefs/[id]` has a "Shared with" panel listing existing shares and a "Log a share" control that writes a `StakeholderBrief` row carrying the acting user's id.
4. Logging the same brief–stakeholder pair twice updates the existing row and says so; it does not error and does not create a duplicate.
5. A Research Officer and a Field Officer are refused on all three surfaces and on all three actions, with the refusal coming from the action, not only from a hidden control.
6. `Brief.status` is unchanged by every path in this task — verifiable by reading the brief's status history after logging a share.
7. The migration is additive, authored via `npm run db:migrate:new`, contains no `DROP INDEX`, and applies cleanly with `npm run db:migrate`.
8. No new Gemini call, no new Inngest event, no new env var.
9. Every screen is usable with no horizontal page scroll at 390px, 760px, 1000px, 1300px, and 1600px.
10. `--destructive` remains unmapped and nothing rendered by this task is red; the urgency ramp is not reused for audience type.
11. `npm run lint` and `npm run typecheck` are clean apart from the four known pre-existing errors in `components/ui/carousel.tsx`, `hooks/use-mobile.ts`, and `design_handoff_evibrief/support.js`.

## Checks to run

```
npm run db:migrate:new -- stakeholder_share_actor   # then READ the generated SQL before applying
npm run db:migrate
npm run lint
npm run typecheck
npm run build
```

Report the exact output of each. `npm run build` is included because this task adds routes.

## Manual test steps

1. `npm run dev`, sign in as a Programme Director.
2. Open `/stakeholders`. Expect the empty state with a real next step, not a blank panel.
3. Create a contact — name, organisation, role, audience type `ministry`, preferred language English. Expect it to appear under a "Ministry" group.
4. Create a second contact with audience type `community_governance` and preferred language Twi. Expect a second group.
5. Submit the form with an empty name. Expect a field-level error in plain ink, no red, and no navigation.
6. Open the first contact. Expect the details panel, the edit form, and an empty-history state pointing at `/briefs`.
7. Edit the organisation, save, and confirm it persists after a reload.
8. Open any existing brief at `/briefs/[id]`. Expect a "Shared with" panel reading "Not logged as shared with anyone yet."
9. Log a share against the first contact with a note. Expect the panel to list it as "Logged by <you> on <date>".
10. Reload `/briefs/[id]` and confirm the brief's **status is unchanged** and its status history has gained no entry.
11. Open `/stakeholders/[id]` for that contact. Expect the share in the history with the brief's title, type, audience, and status.
12. Log a share of the **same** brief to the **same** contact again with a different note. Expect one row, updated, with a message saying the record was updated — not a duplicate and not an error.
13. Change your own `StaffUser.role` to `research_officer` in `npm run db:studio`, reload `/stakeholders`, and expect the calm refusal panel. Then, with the browser devtools network tab, confirm the create action also refuses server-side rather than only being hidden.
14. Repeat step 13 as `field_officer`.
15. Set the role back to `programme_director`.
16. Resize `/stakeholders`, `/stakeholders/[id]`, and `/briefs/[id]` to 390px, 760px, 1000px, 1300px, and 1600px. Confirm no horizontal page scroll, the detail grid collapses to one column below 1000px, its panel border flips from left to top, and no text drops below 13px.
17. With `prefers-reduced-motion: reduce` set in devtools, confirm the dialog and hover states change instantly with no animation.
