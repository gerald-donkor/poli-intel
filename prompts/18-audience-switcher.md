# 18 — The audience switcher: same evidence, reframed

## Goal

Open Phase 3 with the first thing it asks for. Spec §7's Phase 3 leads with
audience tailoring, and §1's build list carries it as two bullets — *"audience
tailoring — reframing engine covering the five audience profiles"* and
*"audience switcher — one-click reframe of an existing brief"*. **They are one
body of work and ship together**: the engine with no switcher is unreachable
from the product, and the switcher with no engine is a tab strip that does
nothing. Splitting them would put a half-feature on `main` and make the second
prompt a rewrite of the first.

Everything the reframe needs already exists and is currently used exactly once.
`AUDIENCE_PROFILES` holds all five profiles with their framing emphasis and tone
(`lib/ai/audience-profiles.ts`), and `buildGenerationSystemPrompt` already takes
an audience — but the only caller ever passes the one chosen on the generation
form, so four of the five profiles have never been sent to a model. This prompt
is what makes that table earn its place.

`brief-output` rule 4 is the whole design constraint, and it is a perceptual
claim before it is a technical one:

> Audience switching reframes the **same** evidence — it must read as "same
> evidence, reframed", not "new document loaded". Citations stay anchored; diff
> against the current draft rather than replacing it wholesale.

Three things, one change:

- **The reframe engine** — re-read the brief's recorded evidence set, re-gate it,
  re-generate against a different audience profile, re-run the fact-check pass,
  and land a new version. Server-side, and reachable only through the existing
  gated door.
- **The review step** — the reframed draft is shown as a **diff against the
  current version** and committed by an explicit human action. Nothing is written
  until a person presses the button.
- **The switcher** — a `Tabs` control on the brief, five audiences, current one
  selected, with the 260ms crossfade and position-anchored citation chips the
  handoff specifies.

**Explicitly out of scope, and named so the boundary is deliberate:**

- **Translation assist.** §1 lists Twi rendering of key messages as its own
  bullet, `brief-output` rule 6 gives it its own on-demand semantics, and
  `tiptap-editor` puts it in an inline `Popover` beside the source text, not in
  the document. It is a different Gemini call with a different UI and a different
  audience question. Its own prompt.
- **Re-generation for the same audience.** A "regenerate this brief" control is a
  different feature with a different justification — the officer is unhappy with
  the output, not addressing a different reader — and it needs its own answer to
  "what happens to the version they were editing". This prompt adds the machinery
  it would use and deliberately does not add the control.
- **A sixth audience, or editing the five.** The profiles are spec §3.4 verbatim
  and `BriefAudience` is a schema enum (§12.7). Nothing here adds a profile
  editor.
- **Diffing arbitrary versions.** The version history panel showing any two
  versions side by side is a real feature and is not this one. The diff here
  exists to answer one question — "what would switching change?" — before the
  switch happens.
- **The stakeholder CRM and the submission tracker.** Also Phase 3, also their
  own prompts. Neither is a dependency of this.

## Skills read

- `brief-output` — rule 4 (the diff-not-replace contract, and the perceptual
  claim it protects), rule 3 (the five profiles live in one config location),
  rule 5 (a brief records its signal, evidence set, audience, version and
  generating model — the reason for decision 2), rule 7 (the three named progress
  stages).
- `evidence-governance` — call types 5 and 6, **re-generation and audience
  switching are not exempt**, and the standing rule that being cleared once does
  not clear the evidence forever (§7.8). Also the whole-run refusal shape the
  existing generation door already implements.
- `gemini-integration` — the centralised config, the two calls a reframe costs,
  the 429 degradation contract (retry timing, draft never lost), Zod validation
  with one retry then a recorded failure, and the sequenced progress states.
- `hallucination-guard` — the ordering rule (`fact-check before persist`), and
  the rule that decides decision 4: **a reframe is new output, so it runs a new
  pass and produces new flags, and does not inherit the previous version's
  cleared state**.
- `tiptap-editor` — "audience switching is a diff, not a reload", citation chips
  position-anchored via `LayoutGroup`/`layoutId` rather than remounted, and the
  reminder that the switcher control is `Tabs`.
- `server-actions` — authorise first inside the action, the role matrix (§10.3:
  a Policy & Advocacy Officer generates and refines briefs; §10.2: the Director
  has full access), the typed-result error shape, and the rule that a shared Zod
  schema may describe shape but never authority.
- `design-system` — the switcher's `Tabs` mapping, the 260ms crossfade, the
  generation stepper (three named stages, no indeterminate spinner), the
  rate-limit alert in slate/olive and never `destructive`, and the responsive
  rule that the flag panel is never what gets dropped at a smaller width.
- `supabase-schema` — read for the migration in decision 2, and for the standing
  `never run prisma migrate dev` rule.

## Existing code inspected

- `app/(app)/briefs/new/actions.ts` — the **three-stage generation flow**
  (`startBriefGeneration` → `draftBriefAction` → `verifyBriefAction`) this
  reframe follows rather than reinvents. Stage 1 authorises, re-reads evidence
  from the database, and gates; stage 2 generates and parks the validated draft
  on the attempt row; stage 3 fact-checks and persists in one transaction. The
  split exists so a 429 between stages cannot lose a draft, which is exactly as
  true for a reframe.
- `lib/ai/evidence-context.ts` — `gateEvidenceForGeneration` is the **only**
  constructor of `GatedEvidenceContext`, and the generation and fact-check doors
  accept nothing else. The reframe needs no new gate, and must not add one: it
  goes through this door like everything else.
- `lib/ai/generate-brief.ts` — `generateBrief` already takes `audience`;
  `assembleBodyText` is the deterministic draft → `bodyText` renderer that flag
  anchors index into.
- `lib/ai/brief-prompt.ts` — `buildGenerationSystemPrompt({ briefType, audience })`
  and `PROMPT_VERSION`. The audience profile is already threaded into the system
  prompt; nothing about the prompt assembly needs to change for this feature.
- `lib/ai/fact-check.ts` — `factCheckDraft` and `anchorClaim`. Anchors are
  character offsets into `bodyText`.
- `lib/db/briefs.ts` — `persistGeneratedBrief` (the only writer of a `Brief` row,
  one transaction, brief + evidence set + version 1 + flags + attempt closed);
  `saveBriefVersion`, whose comment already states the rule this prompt
  implements the other half of — *"a regeneration or an audience switch is a
  different matter — that is new output, a new pass, and new flags — and it does
  not come through here"*; and `isEditableStatus`, which is `draft` only.
- `lib/db/brief-generation.ts` — `createBriefGeneration`, `markBriefDrafting`,
  `recordBriefDraft`, `failBriefGeneration`, `findOwnedBriefGeneration`. The
  attempt row already carries `policyText`, `evidenceItemIds`, `audience`,
  `draftJson`, `stage` and `failureReason`.
- `prisma/schema.prisma` — `Brief.audience` is a single column and
  `BriefVersion` has **no** audience column; `BriefGeneration.briefId` is
  `String? @unique` with a one-to-one `Brief.generation` back-relation. Both
  facts drive decision 2.
- `app/(app)/briefs/[id]/page.tsx`, `.../edit/page.tsx` — both already render
  `For {audienceLabel(brief.audience)}` in the header. That line is where the
  switcher goes.
- `lib/briefs/document.ts` (`buildDocumentFromDraft`) and `lib/briefs/body.ts`
  (`parseBriefBody`) — the block contract the diff operates over. A block is a
  heading line plus its prose, separated by one blank line.
- `design_handoff_evibrief/design-system.md` lines 234 and 293 — the switcher is
  `Tabs`, the crossfade is 260ms, and chips are shared-layout animated, never
  remounted.

## Decisions and assumptions

1. **A switch produces a new VERSION of the same brief, never a second brief
   row.** The whole claim of the feature is "same evidence, reframed"; a sibling
   `Brief` per audience would duplicate the evidence set, split the status
   history, and turn a reframe into navigation. It also keeps the recorded
   evidence set genuinely identical rather than merely equal, which is what makes
   the citations comparable across the switch.

2. **One migration, two changes, and both are honesty about the record.**
   - **`BriefVersion.audience`** — added, because `brief-output` rule 5 requires a
     brief to record its audience alongside its version, and once versions can
     differ in audience a single column on `Brief` cannot say which reader
     version 3 was written for. `Brief.audience` stays as the CURRENT audience,
     which is what the header and the brief list read. Existing rows are
     backfilled from `Brief.audience` in the migration, so the column is
     non-nullable and no version is ever ambiguous.
   - **`BriefGeneration.briefId` loses `@unique`** — it becomes a plain indexed
     column and `Brief.generation` becomes `Brief.generations`. The uniqueness
     was incidental to there having been exactly one attempt per brief; a brief
     that has been reframed twice has three attempts, and each is a real record of
     a real generation. The comment that its presence **is** the record that the
     fact-check pass ran is unaffected and stays.

   Written with `npm run db:migrate:new`, never `prisma migrate dev`. No vector
   column is touched, but the standing HNSW rule still governs how the migration
   is authored.

3. **The reframe reuses the ATTEMPT ROW and the three-stage flow, not a new
   pipeline.** A reframe is two Gemini calls on the free tier with a person
   watching, which is precisely the situation the stage split was built for: a
   429 at the fact-check stage must not discard a draft that cost a generation
   request. The attempt is created with the brief's own `policyText` and
   `evidenceItemIds`, read from the brief's **original** attempt row and its
   recorded `BriefEvidence` set respectively — never from the browser.

4. **New output, new pass, new flags — and the previous version's cleared flag
   state is NOT inherited.** `hallucination-guard` is explicit, and the reason is
   worth stating: a resolved flag records that a person checked a specific
   sentence against a specific source. Reframed prose is not that sentence.
   Carrying the resolution forward would silently transfer a human judgement onto
   text no human has read. This is the one place where this prompt deliberately
   behaves differently from `saveBriefVersion`, which carries flags forward
   because an edit is not new output.

5. **The reframed draft is REVIEWED BEFORE IT LANDS, as a diff.** Generating
   straight into a new version would make a one-click control overwrite the
   officer's working draft with model output, which is both the wholesale
   replacement rule 4 forbids and an autonomous write §8 forbids. So the flow is:
   choose an audience → the three stages run → **the diff is shown** → the
   officer presses "Use this version" or discards. Discarding leaves the brief
   exactly as it was; the attempt row records that the generation happened and
   was not taken up.

6. **The diff is per block, computed from the block contract that already
   exists.** `parseBriefBody` gives both documents the same block structure, so
   the diff is over headings and their prose: unchanged, changed, added, removed.
   Not a character-level diff — the point is to show that the evidence and the
   findings are the same while the framing moved, and a word-level rainbow works
   against that. Section-level is the altitude the claim is made at.

7. **Only a `draft` brief may be reframed.** `isEditableStatus` already draws
   this line and it is drawn in the right place: reframing a `reviewed` brief
   would change the document after the Director approved it, and reframing a
   `submitted` one would change a document that has left the building. A brief
   past `draft` is sent back first, exactly as editing requires.

8. **Authority is the generation matrix, not the editing matrix.** A reframe IS a
   generation, so it is Policy & Advocacy Officer and Programme Director —
   reusing the existing `canGenerateBrief` check rather than declaring a second
   one. A Research Officer may resolve the flags a reframe produces (§10.4) and
   may not produce them. A Field Officer reaches none of this.

9. **The switcher never reframes on hover, focus, or tab change alone.** Selecting
   a tab shows what switching would cost and asks; it does not spend two Gemini
   requests because a pointer moved. The current audience's tab is selected and
   inert.

10. **Nothing about status moves.** A reframe does not advance, reset, or
    re-open a brief's status, and writes no `BriefStatusChange` row. Status moves
    only through an explicit human decision (§8.3), and choosing a different
    reader is not one.

## Files likely to change

**New**

- `prisma/migrations/<timestamp>_brief_version_audience/migration.sql` —
  decision 2's two changes, with the backfill.
- `lib/briefs/diff.ts` — the block-level diff over `parseBriefBody` output. Pure,
  no Prisma, no React.
- `app/(app)/briefs/[id]/reframe/actions.ts` — the three stages, colocated with
  the route that uses them (§5.3).
- `app/(app)/briefs/[id]/reframe/schema.ts` — the shared Zod schema. Shape only,
  never authority.
- `app/(app)/briefs/[id]/reframe/page.tsx` — the reframe surface: the stepper
  while it runs, the diff when it lands.
- `app/(app)/briefs/[id]/reframe/reframe-diff.tsx` — the diff rendering and the
  commit / discard controls.
- `app/(app)/briefs/[id]/audience-switcher.tsx` — the `Tabs` control.

**Edited**

- `prisma/schema.prisma` — `BriefVersion.audience`, and `BriefGeneration.briefId`
  losing `@unique` with its back-relation becoming a list.
- `lib/db/briefs.ts` — `persistGeneratedBrief` writes the new `audience` column
  on version 1; a new `persistReframedVersion` writes the reframed version, its
  new flags, and the updated `Brief.audience` in one transaction.
- `lib/db/brief-generation.ts` — `createBriefGeneration` accepts the brief being
  reframed; the attempt lookups account for a brief having several.
- `lib/db/index.ts` — the new read/write surface.
- `app/(app)/briefs/[id]/page.tsx` — the switcher replaces the static audience
  line in the header.
- `app/(app)/briefs/[id]/edit/page.tsx` — the same header line, kept consistent.

## Implementation requirements

1. **Stage 1 authorises, re-reads, and re-gates.** The evidence set comes from
   the brief's recorded `BriefEvidence` rows read fresh from the database — never
   from the client, and never from a cached copy taken at generation time. It
   goes through `gateEvidenceForGeneration` like every other call path. An item
   downgraded since the brief was written **refuses the whole run** and names the
   items by title and classification, exactly as the generation form already
   does. There is no second gate, no bypass, and no "it was cleared before"
   branch (§7.8).

2. **Stage 2 generates, stage 3 fact-checks, and nothing persists before the
   pass has returned** (§9.1). The reframed `bodyText` is assembled with
   `assembleBodyText` so flag anchors index into the same string the reader sees,
   and the Tiptap document is built from the same draft so citation chips survive
   the switch.

3. **The commit is its own explicit action.** It re-reads the brief's status and
   `currentVersion` inside the transaction and refuses on `not-editable` or
   `conflict`, the same two object-level checks `saveBriefVersion` makes. It
   writes the new version, its new flags, and `Brief.audience`, in one
   transaction. Partial state here would produce a reframed document whose flags
   did not land.

4. **The diff renders at section altitude**, labelling each block unchanged,
   changed, added or removed. Changed blocks show both framings. Copy states what
   moved without claiming the system improved anything (§8.8) — "the executive
   summary was reframed", never "a better summary for this audience".

5. **The switcher is `Tabs`, the crossfade is 260ms, and citation chips are
   position-anchored** via Motion's `LayoutGroup`/`layoutId` rather than
   remounted (handoff lines 234, 293). `useReducedMotion()` is required — the
   global CSS rule does not disable JS-driven animation. If the shared-layout
   animation cannot be made to hold the chips still, cut the animation rather
   than shipping a remount that reads as "new document loaded", which is the one
   thing rule 4 forbids.

6. **The three named stages, no spinner.** "Reading evidence" → "Drafting" →
   "Verifying citations", reusing the existing generation stepper rather than a
   second one. A 429 mid-run surfaces retry timing in the slate/olive alert and
   preserves whatever the attempt row holds — never a generic error, never a lost
   draft (§13.4).

7. **Both new UI surfaces are fully responsive**, 320px to 1600px+, mobile-first,
   no horizontal page scroll. The diff's two framings stack into one column below
   `tablet` rather than becoming a side-by-side that overflows.

## Evidence classification impact

**Yes — call types 5 and 6, and this is exactly the case `evidence-governance`
singles out as the one implementations get wrong.**

- **The calls.** A reframe is call type 6 (audience switching) plus call type 8
  (the fact-check pass on its output), and the machinery it adds is what a future
  type 5 (re-generation) will use.
- **Not exempt, and the skill says so twice.** `AGENTS.md` §7.8 and
  `evidence-governance`'s "items 5, 6, and 7 are not exempt" both exist because
  "the evidence was already checked when this brief was generated" is the
  plausible-sounding argument that produces the bug. Being cleared once does not
  clear the evidence forever: an item reclassified to `community_sourced` since
  the brief was written must not reach a model because a brief drafted from it
  already exists.
- **The enforcement point, named.** `gateEvidenceForGeneration` in
  `lib/ai/evidence-context.ts`, called from stage 1 of
  `app/(app)/briefs/[id]/reframe/actions.ts`. It is the only constructor of
  `GatedEvidenceContext`, and `generateBrief` and `factCheckDraft` accept nothing
  else — so the reframe cannot reach a model without passing it, and this prompt
  adds no new door.
- **What happens to blocked items.** Whole-run refusal, not a filter: the reframe
  refuses and names the offending items by **title and classification only**,
  with the officer's next step being the classification queue. Generating from
  the remainder would silently reframe against a different evidence set than the
  one the brief records, which is the untraceability this product exists to
  prevent.
- **Logging stays ids, counts and outcomes** — brief id, attempt id, audience,
  item count, model, stage, outcome. Never a draft, never a prompt, never a
  completion, never an excerpt (§7.6, §13.9).

No bypass, no `force`, no env var, no anticipatory paid-tier branch.

## Hallucination-guard implications

**Yes, and the change is to what a flag is attached to, not to how it works.**

- **A reframe runs a full new pass and produces NEW flags.** Claim extraction,
  verification against the supplied context, the stored record, the anchor
  representation and the visual contract are all unchanged.
- **The previous version's cleared flag state is NOT inherited** — decision 4,
  and `hallucination-guard`'s own rule. This is the deliberate difference from
  `saveBriefVersion`, which carries flags forward with their resolutions intact
  because a human edit is not new output. Both behaviours are correct for their
  own case and the two must not be unified.
- **Ordering is unchanged and still structural**: fact-check, then persist. The
  commit transaction is reachable only after the pass has returned, exactly as
  `persistGeneratedBrief` is.
- **Approval is still refused server-side while flags are open** (§9.5). A
  reframe that produces flags therefore blocks approval again, which is correct
  and should not be softened: nobody has checked the new prose.
- **The visual contract, restated because flags render on the new version**:
  slate — the watch ramp, surface `#E7EDF2`, border `#C6D4DF`, text `#33495A`.
  A 16px **circle**, 2px stroke `#496375`, filled centre dot, because a square is
  the classification hold. `flag-pulse` **900ms, once**, settling to a steady 2px
  underline — no loop, no re-fire on re-render, no colour change during the
  pulse. Never red, never a blink, never an alarm, never an error toast, never
  shadcn's `destructive` variant. `prefers-reduced-motion` gets the settled state
  instantly. The flag panel is never what gets dropped at a smaller width; it
  promotes above the fold.
- **Copy stays in the guard's register**: a flag means the claim needs a person's
  eyes, never that it is false.

## Security requirements

- Every stage authorises inside the action, server-side, before doing work, and
  re-resolves the role from the database rather than trusting a session claim.
  Object-level too: the brief must exist, be `draft`, and the caller must hold
  the generation role (§10.1, §10.3).
- The shared Zod schema describes shape only — brief id, audience enum
  membership. It never encodes who may reframe (§10.10).
- `policyText` and `evidenceItemIds` for the reframe are read **server-side from
  the brief's own records**. Nothing about what reaches the model comes from the
  browser; the client sends a brief id and an audience and nothing else.
- No Gemini call, no Prisma query, and no prompt assembly runs in client code
  (§18). The switcher is presentation; the actions do the work.
- No evidence body text, draft text, prompt or completion in any log, Sentry
  event, or PostHog property (§7.6).
- The reframe adds no Route Handler, no webhook, and no unauthenticated path.

## Acceptance criteria

1. A `draft` brief shows a five-tab audience switcher with its current audience
   selected and inert; selecting another offers the reframe rather than starting
   one.
2. Running a reframe shows the three named stages in order and never an
   indeterminate spinner.
3. The result is presented as a section-level diff against the current version,
   with unchanged sections visibly unchanged. Nothing is written until the
   officer commits.
4. Discarding leaves the brief at its previous version and previous audience,
   with its existing flags untouched.
5. Committing creates version N+1, sets `Brief.audience` to the new audience,
   records the new audience on the version row, and writes the new pass's flags.
6. The previous version's resolved flags do **not** appear on the new version,
   and the previous version keeps them.
7. A brief that is `reviewed`, `submitted` or `published` offers no reframe, and
   the action refuses server-side even when called directly.
8. A Research Officer and a Field Officer are both refused server-side; a Policy
   & Advocacy Officer and the Programme Director are allowed.
9. Downgrading one item in the brief's evidence set to `community_sourced` and
   then reframing refuses the whole run, names that item by title and
   classification, and makes no Gemini call.
10. Citation chips stay position-anchored across the crossfade — they do not
    remount, and with `prefers-reduced-motion` the change is instant.
11. A reframe that produces open flags blocks Programme Director approval, and
    the approval action refuses server-side.
12. Both new surfaces are usable with no horizontal page scroll at 320, 390, 760,
    1000, 1300 and 1600px.
13. `npm run lint` and `npm run typecheck` are clean apart from the four
    pre-existing errors §19 names.

## Checks to run

- `npm run db:migrate:new -- brief_version_audience`, then read the generated SQL
  before applying
- `npm run db:migrate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Report the exact output of each.

## Manual test steps

1. `npm run dev`. Sign in as a Policy & Advocacy Officer and open a `draft` brief
   with at least one resolved flag and one open flag on its current version.
2. Confirm the header shows the five-tab switcher with the current audience
   selected. Select a different audience and confirm it offers the reframe rather
   than starting one.
3. Start the reframe. Watch the three stages, then read the diff: confirm the
   evidence findings are recognisably the same material and the framing has
   moved, and that unchanged sections are marked unchanged.
4. Discard. Confirm the brief is unchanged — same version, same audience, same
   flags, including the resolved one.
5. Reframe again and commit. Confirm version N+1, the header's audience updated,
   new flags present and open, and the previous version's resolved flag absent
   from the new version but still on the old one in the version history.
6. Confirm approval is now refused for the Programme Director while a new flag is
   open, and that the refusal comes from the server, not just a disabled button.
7. In `npm run db:studio`, downgrade one item in the brief's evidence set to
   `community_sourced`. Reframe again and confirm the whole run is refused, the
   item is named by title and classification, no excerpt appears anywhere, and
   the dev server log shows no Gemini request for the attempt.
8. Restore the classification. Send the brief to `reviewed` as the Director and
   confirm the switcher offers no reframe; call the action directly and confirm
   it refuses.
9. Sign in as a Research Officer and confirm the reframe is refused server-side,
   while resolving a flag still works.
10. At 320px and 390px, confirm the switcher and the diff are legible, stack into
    one column, and produce no horizontal page scroll. With
    `prefers-reduced-motion` enabled, confirm the crossfade is instant and the
    chips do not jump.
