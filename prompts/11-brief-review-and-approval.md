# 11 — Brief review: flag resolution, the approval refusal, and the status chain

## Goal

Make the hallucination guard **bite**, and give a brief a way out of `draft`.

Three things, one body of work, all on `/briefs/[id]`:

- **Flag resolution and dismissal** — Research Officer and Programme Director
  only, never on a brief the actor drafted, recording actor, timestamp and
  reason (§9.6, §10.6).
- **The approval refusal** — the Programme Director's approve action **re-reads
  flag state inside itself and refuses while any flag is open** (§9.5). The
  button is disabled *and* the server refuses; only the second is the control.
- **The status chain** — `draft → reviewed → submitted/published`, each move an
  explicit human action recorded with actor and timestamp, plus the Director's
  **send back** with a required reason (§8.3, §10.2).

Everything the guard has produced since prompt 09 has been unresolvable, and
every brief in the system is stuck at `draft`. This prompt is where §9's
"unresolved flags block approval" stops being a comment and becomes a refusal,
and where the product's "AI drafts, humans decide" claim acquires the human
decision it names.

**Explicitly out of scope, and named so the boundary is deliberate:**

- **The Director's approval queue on `/dashboard`.** Spec §5.5 gives the
  Director their own route with a digest summary, an approval queue and
  influence highlights. That is a screen of its own and it needs the signal
  digest, which does not exist. This prompt puts the review surface on the brief
  itself, where the evidence and the flags already are.
- **The submission tracker** — the policy-window calendar and stakeholder
  linkage (spec §5.3). `submitted`/`published` are reachable here; the calendar
  that plans them is its own build item.
- **Notification of the originating officer on send-back.** Resend is not
  installed and no notification path exists. A sent-back brief shows its reason
  on the brief page; email arrives with the digest work.
- **Export** — still prompt 12. Its unresolved-flag notice depends on the flag
  states this prompt makes reachable, not the other way round.
- **Audience switching, re-generation, translation.** All Gemini calls, all
  gated, all later.

## Skills read

- `hallucination-guard` — the flag record, who may clear one, the two
  load-bearing orderings, and the visual contract this prompt must not drift
  from
- `server-actions` — authorise-first ordering, the role matrix, the four
  restrictions that get broken most often (this prompt implements three of
  them), the typed refusal set
- `design-system` + `design_handoff_evibrief/design-system.md` — the slate guard
  panel, the `Alert` custom variant, disabled-not-hidden, no red anywhere
- `tiptap-editor` — only for what it says about flag dismissal being a Server
  Action with server-side enforcement, and so the editor's flag rendering stays
  consistent with the panel's
- `evidence-governance` — **read and checked, not applicable**: see the
  classification section below. This task makes no Gemini call and adds no AI
  entry point, so there is no gate call site to add.

## Existing code inspected

- `lib/auth/authorize.ts` — `canApproveOrRejectBrief`, `canSubmitOrPublishBrief`
  and `canDismissFlag` all exist and **have no callers anywhere in the
  codebase**. `canDismissFlag` is already object-level: it takes the brief's
  `createdById` and the actor's id as required arguments precisely so a caller
  cannot perform only the role half. `ActionRefusal` has no
  `refused-unresolved-flags` variant yet, and its comment says so explicitly —
  the variant ships with the feature that produces it, which is this one.
- `prisma/schema.prisma` — `BriefStatusChange` (id, briefId, actorId,
  `previousStatus` **nullable**, newStatus, `reason` nullable, changedAt) and
  `HallucinationFlag` (`status`, `resolvedById`, `resolvedAt`,
  `resolutionReason`) both already carry every column this needs. `BriefStatus`
  is `draft | reviewed | submitted | published`; `FlagStatus` is
  `open | resolved | dismissed`. **No migration is needed for this prompt.**
- `lib/db/briefs.ts` — `findBriefDetail` (current version, its flags, the
  evidence set) selects neither `createdById` nor the flags' resolution
  metadata, and reads no status history. `saveBriefVersion` blocks editing at
  `submitted`/`published` only. Nothing in the file writes a status.
- `app/(app)/briefs/[id]/page.tsx`, `flag-panel.tsx`, `citation-list.tsx` — the
  read-only view. `FlagPanel` is already a client component with an optional
  `onSelectFlag`/`activeFlagId` pairing added in prompt 10, and already renders
  the exact slate contract; it filters to `status === open` and says in words
  that clearing arrives with the review screen.
- `app/(app)/briefs/[id]/edit/` — the editor, its `saveBriefDraft` action, and
  `canEditBrief` (Programme Director + Policy & Advocacy Officer).
- `app/(app)/briefs/labels.ts` — `BRIEF_STATUS_LABELS`, `FLAG_REASON_LABELS`,
  `FLAG_REASON_DETAIL`, `formatGeneratedAt`.
- `spec §4.1` line 320 — `status (draft/reviewed/submitted/published)`. The
  spec's own data model, which decides the question below.

## Decisions and assumptions

1. **"Reject" is a send-back with a recorded reason, not a fifth status.** Spec
   §5.2 names three Director actions — approve, send back for changes, reject —
   but the spec's own data model fixes `status` to four values, and where this
   file and the spec disagree the spec wins (§2). So both declining actions
   return the brief to `draft` and are told apart by the **reason on the
   `BriefStatusChange` row**, which is what that column is for. The cost is
   real and stated: the brief list cannot show "rejected" as distinct from
   "sent back", and the distinction lives in the history. Adding a `rejected`
   value later is a migration and a spec amendment, in that order — not a
   decision to smuggle in here.

2. **A decline is recorded even when it moves nothing.** Declining a brief that
   is still `draft` writes a `BriefStatusChange` with `previousStatus = draft`
   and `newStatus = draft`. The row records a **decision**, not only a
   transition, and the reason is its payload; a Director's "not yet, and here is
   why" that left no trace would be the same as no review at all. `reason` is
   **required** on every decline and optional on an approval.

3. **A `reviewed` brief is not editable.** `saveBriefVersion` extends its
   not-editable set from `submitted`/`published` to include `reviewed`, and
   `canEditBrief`'s callers follow. The reason: approval attaches to a document,
   and if editing continued after approval a Director's approval would sit on
   text they never read. The alternative — automatically returning an edited
   brief to `draft` — moves a status without an explicit human action, which
   §8.3 forbids. Blocking the edit violates nothing and costs one extra step: a
   Director who wants changes **sends the brief back first**, which is exactly
   what send-back is for.

4. **The approved version is pinned structurally, not stored.** There is no
   version column on `BriefStatusChange` and none is added. Because decision 3
   makes a brief immutable from `reviewed` onward, the version that was approved
   *is* `brief.currentVersion`, and it cannot change under the approval. A
   stored copy would be a second place for the same fact to live.

5. **Approval re-reads flag state inside the transaction**, against the
   **current version's** flags. Not against a count passed from the client, not
   against a value read when the page rendered. Flag state belongs to a version
   (§8.7), and the window between render and click is exactly where a flag gets
   opened or a new version gets written.

6. **`resolved` and `dismissed` are different outcomes and both are recorded.**
   Resolved means a person checked the claim against a source and it holds.
   Dismissed means the claim is being let through without that check — for
   instance because the sentence was rewritten or removed. Both require a
   reason, both record actor and timestamp, and **both stop blocking approval**.
   The two are not collapsed into one "clear" button, because the difference is
   the entire audit value of the record.

7. **Reopening a cleared flag is allowed, by the same roles, and recorded.** A
   reviewer who cleared the wrong flag must be able to say so, and a flag that
   could only ever be closed would push people toward not clearing anything.
   Reopening clears `resolvedById`/`resolvedAt`/`resolutionReason` on the row and
   writes the reason of the reopening into the new state's own record.

8. **Nobody clears a flag on a brief they drafted — every role, not just the
   Policy & Advocacy Officer.** `canDismissFlag` already enforces exactly this
   and its comment already explains why; this prompt calls it rather than
   restating the rule in an action. A Programme Director who drafted a brief
   cannot clear its flags, and therefore cannot approve it either until someone
   else does — which is the guard working, not a bug.

9. **Submit and publish are two named actions, not a status dropdown.** Both are
   Programme Director only, both require the brief to be `reviewed`, both record
   actor and timestamp. A generic "set status" action would be a way to reach
   `submitted` from `draft` without an approval ever happening.

10. **No automatic anything.** No auto-approve, no scheduled publish, no
    transition triggered by a flag count reaching zero, not behind a flag
    (§8.2). Clearing the last flag **enables** a button; it never presses one.

## Files likely to change

New:

- `app/(app)/briefs/[id]/actions.ts` — `resolveFlagAction`, `reopenFlagAction`,
  `changeBriefStatusAction` (approve / send back / submit / publish), colocated
  with the route that uses them
- `app/(app)/briefs/[id]/schema.ts` — the shared Zod schemas (flag id, reason
  bounds, brief id, the requested transition). Shape only.
- `app/(app)/briefs/[id]/flag-resolution.tsx` — the per-flag resolve / dismiss /
  reopen control and its reason field
- `app/(app)/briefs/[id]/review-panel.tsx` — the Director's approve / send back /
  submit / publish surface, with the blocking reason stated inline
- `app/(app)/briefs/[id]/status-history.tsx` — who moved this brief, when, and
  why

Changed:

- `lib/db/briefs.ts` — `findBriefDetail` additionally returns `createdById`,
  each flag's resolution metadata and resolver name, and the status history;
  new `resolveHallucinationFlag` and `changeBriefStatus` (each one transaction,
  the latter re-reading flag state inside it); `saveBriefVersion`'s
  not-editable set gains `reviewed`
- `lib/db/index.ts` — the new exports
- `lib/auth/authorize.ts` — add the `refused-unresolved-flags` variant to
  `ActionRefusal` (its comment already reserves the name)
- `app/(app)/briefs/[id]/page.tsx` — resolve the caller's permissions
  server-side, render the review panel, the resolution controls and the history
- `app/(app)/briefs/[id]/flag-panel.tsx` — render cleared flags as well as open
  ones, with who cleared them and why; host the resolution control when the
  caller may use it. **Extended, not duplicated** — the editor renders the same
  component.
- `app/(app)/briefs/[id]/edit/page.tsx` and `.../edit/actions.ts` — a `reviewed`
  brief is no longer editable (decision 3); the existing "not available" panel
  gains the case
- `app/(app)/briefs/labels.ts` — flag-status and transition copy
- `app/(app)/briefs/page.tsx` — the list's status column is already there; only
  touch it if the open-flag count needs to read differently
- `AGENTS.md` §19 — only if a script is added (none is expected)

## Implementation requirements

### The actions

Order, every time, in every action: **resolve session → authorise for this
operation on this object → validate → do the work.** Authorise before
validating, so an unauthorised caller learns nothing from validation messages
about a brief they cannot touch.

**`resolveFlagAction({ flagId, outcome, reason })`**

- `outcome` is `resolved | dismissed`. Reason required, trimmed, bounded.
- Authorisation is `canDismissFlag(role, { createdById }, actorId)` — the brief's
  author is loaded from the flag's brief, server-side, and never accepted from
  the client.
- The flag must belong to the brief's **current version** and be `open`.
- Writes `status`, `resolvedById`, `resolvedAt`, `resolutionReason`.

**`reopenFlagAction({ flagId, reason })`** — same authorisation, inverse write,
reason required, and the flag must currently be cleared.

**`changeBriefStatusAction({ briefId, transition, reason })`**

Four named transitions, each with its own guard, all inside one transaction that
re-reads the brief:

| Transition | Role | From | To | Reason | Extra guard |
|---|---|---|---|---|---|
| `approve` | Programme Director | `draft` | `reviewed` | optional | **refuses while any current-version flag is `open`** |
| `send_back` | Programme Director | `draft` or `reviewed` | `draft` | **required** | — |
| `submit` | Programme Director | `reviewed` | `submitted` | optional | — |
| `publish` | Programme Director | `reviewed` | `published` | optional | — |

- Every one writes a `BriefStatusChange` row with actor, both statuses and the
  reason, in the same transaction as the `brief.status` update. A status that
  moved without its audit row is worse than no move at all.
- `approve` also sets `reviewedById` to the acting Director.
- A transition whose `from` does not match the brief's actual status is refused
  with a typed result, not applied. The UI's button state is not the control.
- **The approval refusal carries what is blocking it**: how many flags are open,
  never their text (§7.6).

### The refusal type

Add to `ActionRefusal`:

```
| { kind: "refused-unresolved-flags"; openFlagCount: number }
```

It carries a **count**, not the claims. The claims are already on screen in the
panel; putting them in a refusal payload is one more place evidence-adjacent
text can end up in a log.

### The panel

`FlagPanel` currently shows open flags and says clearing arrives later. It now:

- shows **open flags with their resolution control**, when the caller may use it
- shows **cleared flags**, collapsed by default, each with outcome
  (resolved/dismissed), who cleared it, when, and the reason — with a **reopen**
  control for those who may
- keeps the empty state's two existing variants, and keeps the exact visual
  contract below

**The visual contract, restated because it must not drift (§4's requirement):**
slate on the watch ramp — `bg-watch-surface border-watch-border text-watch-ink`,
never `destructive`, **never red anywhere in this feature, including the
resolution controls and every validation message they can produce**. A **round**
16px icon with a filled centre dot (`GuardFlagIcon`, already built) — a square
means classification-pending, a different state entirely. `animate-flag-pulse`,
900ms, **once**, no loop, no blink, no colour change during the pulse, and
**clearing a flag must not re-fire the pulse on the remaining ones** — the panel
re-rendering after a resolution is the most likely place that regression lands.
`prefers-reduced-motion` gets the settled state instantly. Never an error toast.

### The review panel

- Approve is **disabled, not hidden**, while a flag is open, **with the reason
  stated inline next to it** — "2 claims still need checking", never a bare
  greyed button. The server refuses regardless (§9.5).
- Send back requires its reason before the control is usable, and the same
  requirement is enforced server-side.
- Submit and publish appear only once the brief is `reviewed`, and are refused
  server-side otherwise.
- A role that may do none of this sees **no control and no disabled ghost** —
  the panel is simply not rendered for them, and the brief reads as before.
- Copy never implies the system decided, approved, verified or endorsed anything
  (§8.8). The Director approves; the product records it. A flag says a claim is
  "not traceable to the supplied evidence", never "incorrect", and clearing one
  says a person checked it, never that the system verified it.

### Layout and responsiveness

- The review panel sits in the existing right rail on `/briefs/[id]`, **above**
  the citation list, with the flag panel above it — governance surfaces first.
- At one column the existing order already puts the rail before the document;
  keep it. **The flag panel and the review panel are never what gets dropped or
  pushed below the fold** (design-system responsive rules).
- Usable at 320, 480, 760, 1000, 1300 and 1600px, no horizontal page scroll at
  any width. Reason fields are full-width at small sizes; no control is pushed
  out of reach.
- Density is the Officer/Director register: real information, calm surface, no
  admin-dashboard stat cards.

### Optimistic updates

Do **not** apply an optimistic update to a status transition or a flag
resolution. Both can be refused on authorisation grounds, and `server-actions`
is explicit: a person must never briefly see a brief approved that the server
then refuses. `useOptimistic` is for the kanban and evidence selection.

## Evidence classification impact

**Touched only as display, and no AI data path exists here.**

- This task makes **no Gemini call** — no embedding, no generation, no
  re-generation, no translation, no fact-check. It adds no entry point to the AI
  layer, so there is no new gate call site and none is added. That is why
  `evidence-governance` was read and found not to apply, rather than skipped.
- It **reads evidence metadata** — the titles already rendered in the flag
  panel's "checked against" line and in the citation list. Same metadata, same
  screen, no new surface.
- **No evidence body text, and no claim text, in any log, Sentry event or
  PostHog property** (§7.6). Action logging is ids, counts, statuses and
  outcomes. `refused-unresolved-flags` carries a count for exactly this reason.
- Classification is not read, written, or displayed differently by anything in
  this prompt. No classification mutation exists on this route.

## Hallucination-guard implications

**Changed, substantially — this prompt is where §9.5 and §9.6 are
implemented.**

1. **What a flag blocks becomes real.** `changeBriefStatusAction`'s `approve`
   transition re-reads the current version's flags inside its transaction and
   returns `refused-unresolved-flags` while any is `open`. The disabled button
   is separate and is not the control. Both ship.
2. **Flag state becomes mutable, under authority.** `resolved` and `dismissed`
   are reachable for the first time, only through `canDismissFlag` — Research
   Officer or Programme Director, never the actor who drafted the brief — and
   every change records actor, timestamp and reason. Reopening is equally
   authorised and equally recorded.
3. **Flag rendering gains cleared states.** The open state's contract is
   unchanged and restated above verbatim. Cleared flags render in the same slate
   family at lower emphasis, with a **circle** glyph, no pulse, and no red.
4. **Flags still belong to a version.** Prompt 10's carry-forward on edit is
   unchanged; approval reads the current version's flags; and decision 3 stops a
   brief changing under an approval at all.

**What does not change:** what gets flagged, how claims are extracted, when the
pass runs (generation → validate → fact-check → persist), how anchors are stored
or mapped, and the Mark's rendering in the editor.

## Security requirements

- Every action authorises server-side, inside itself, before validating and
  before any read of the object's contents.
- **Object-level, not role-only**, in two places: `canDismissFlag` takes the
  brief's author and the actor; every transition checks the brief's actual
  current status inside the transaction.
- Server Actions are the only mutation path. No Route Handler is added.
- The shared Zod schema describes **shape only** — ids, reason length, the
  transition's name as a value. **No role, no role list, no transition-permission
  table, and no flag-blocking rule** in a client-visible module (§10.10). Which
  roles may perform which transition lives in `lib/auth/authorize.ts`, which is
  `server-only`.
- Reason strings are trimmed and bounded before storage; they are staff-authored
  free text rendered back to staff, so they are rendered as text, never as
  markup.
- Logging: brief id, flag id, actor id, transition, outcome, counts. **Never
  claim text, never a reason string, never evidence text** (§7.6).
- `revalidatePath` the brief, the brief list, and nothing else.

## Acceptance criteria

1. A Programme Director opening a brief with open flags sees Approve
   **disabled with the reason stated inline**, and calling the action directly
   returns `refused-unresolved-flags` — verified by calling it, not by reading
   the button.
2. A Research Officer can resolve or dismiss an open flag with a reason; the
   flag's row records outcome, actor, timestamp and reason.
3. A Research Officer or Programme Director **who drafted the brief** is refused
   when clearing a flag on it, server-side.
4. A Policy & Advocacy Officer is refused when clearing any flag, and when
   attempting any transition.
5. With every flag cleared, Approve succeeds: `status` becomes `reviewed`,
   `reviewedById` is set, and one `BriefStatusChange` row exists with both
   statuses and the actor.
6. Send back requires a reason server-side, returns the brief to `draft`, and
   writes a row — including when the brief was already `draft` (the row records
   the decision).
7. Submit and publish are refused from `draft` and succeed from `reviewed`, each
   writing its own row.
8. A `reviewed` brief is not editable: `/briefs/[id]/edit` renders the
   not-available panel, and `saveBriefDraft` refuses if called directly.
9. Reopening a cleared flag restores `open`, clears the resolution metadata, and
   makes Approve refuse again.
10. No red anywhere on the screen, in any state, including every validation
    message; cleared flags carry a circle glyph and no pulse; clearing one flag
    does not re-pulse the others.
11. The status history reads as a plain account of who did what, when, and why.
12. No horizontal page scroll at 320, 480, 760, 1000, 1300 and 1600px; the flag
    and review panels are above the fold in the single-column layout.
13. `npm run lint`, `npm run typecheck` and `npm run build` pass with no new
    findings in this change's files.

## Checks to run

```
npm run lint
npm run typecheck
npm run build
```

Report exact output. The four known pre-existing lint errors
(`components/ui/carousel.tsx`, `hooks/use-mobile.ts`,
`design_handoff_evibrief/support.js`) are expected and are not to be "fixed".

No migration is expected — every column this needs already exists. If one turns
out to be needed, it goes through `npm run db:migrate:new`, never
`prisma migrate dev`.

## Manual test steps

1. `npm run dev`. Open a brief that has open flags as a **Programme Director**.
   Confirm Approve is disabled with the count stated beside it, and that Submit
   and Publish are absent.
2. Sign in as a **Research Officer** who did not draft it. Resolve one flag with
   a reason, dismiss another with a reason. Confirm both leave the open list,
   appear as cleared with actor, time and reason, and that neither pulses.
3. Run `npm run db:studio`: the two `hallucination_flag` rows carry `status`,
   `resolved_by_id`, `resolved_at` and `resolution_reason`.
4. Sign back in as the **Programme Director** and approve. Confirm the status
   reads Reviewed, and that `brief_status_change` has one row with
   `previous_status = draft`, `new_status = reviewed` and the actor.
5. Open `/briefs/[id]/edit` on the now-`reviewed` brief — the not-available panel
   renders with the reason, and nothing is editable.
6. Send it back with a reason. Confirm it returns to `draft`, the reason shows in
   the history, and the editor opens again.
7. Reopen a cleared flag with a reason. Confirm Approve is disabled again and
   that calling the approve action directly is refused.
8. As a **Policy & Advocacy Officer**, confirm no resolution control and no
   review panel render, and that calling either action directly is refused.
9. As the Director who **drafted** a brief, confirm the resolution control is
   refused server-side on that brief.
10. Approve, then submit. Confirm `submitted`, a second history row, and that
    both the editor and the review controls are closed off.
11. Resize 1600px → 320px: no horizontal page scroll, both governance panels
    reachable without hunting, reason fields usable at 320px.
12. Confirm no claim text and no reason string appears in the dev-server
    terminal at any point.
