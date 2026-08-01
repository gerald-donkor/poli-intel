# 10 — Brief editor: Tiptap, citation chips, flag Mark, versioned autosave

## Goal

Make a generated draft **editable**, at `/briefs/[id]/edit`, with the two custom
extensions that carry EviBrief's traceability contract:

- a **citation-chip Node** that links to a real `evidence_item` in the brief's
  recorded set and opens it in a `Sheet` — never a route change
- a **hallucination-flag Mark** that renders the stored flag records over the
  claims they anchor to, in slate, one 900ms pulse, then a steady 2px underline

plus **debounced autosave through a Server Action that writes a new
`BriefVersion` every time** (§8.7 — no prior version is ever overwritten), with a
visible saved / saving / failed state that never loses the buffer.

This is the last unbuilt Phase 1 item in the spec (§10.1 Phase 1: "Basic brief
editor with export to Word and Google Docs"). Everything downstream of a
generated draft — flag resolution, Director approval, export, the audience
switcher — is blocked until the draft is a document a person can edit.

**Explicitly out of scope, and named here so the boundary is deliberate:**

- **Flag resolution / dismissal and the approval refusal → prompt 11.** The
  read-only brief page already says so in words ("Clearing a flag, and the
  approval it blocks, arrive with the review screen"), and `server-actions`
  scopes the approval refusal with the review work. This prompt renders flag
  state and carries it forward across edits; it does not clear it.
- **Export (docx / Pandoc PDF / Google Docs) → prompt 12.** It is a Route
  Handler and a document-model mapping, a coherent body of work of its own, and
  it depends on the storage decision this prompt makes.
- **Audience switcher, translation assist, re-generation.** All Gemini calls,
  all Phase 3, all gated (§7.8).

`tiptap-editor`'s build order puts the citation Node and the flag Mark in
Phase 2, "alongside the fact-check pass landing". The fact-check pass landed in
prompt 09, so that precondition is met — building them now is the sequence the
skill states, not ahead of it.

## Skills read

- `tiptap-editor` — SSR, document storage, chips, the flag Mark, autosave,
  and the explicit note that **no Tiptap API signature may be written from
  memory**: read the installed package's own docs and types
- `hallucination-guard` — the flag record, the exact visual contract, and the
  rule that the Mark **renders stored state and never decides what to flag**
- `server-actions` — authorise-first ordering, typed `ActionRefusal`, colocation
- `design-system` + `design_handoff_evibrief/design-system.md` — the Brief
  Editor grid recipe, the citation-chip recipe, the guard-flag panel recipe, the
  motion table, the serif rule
- `evidence-governance` — read and applied: see the classification section below

## Existing code inspected

- `prisma/schema.prisma` — `Brief`, `BriefVersion` (already carries
  `documentJson Json?`), `HallucinationFlag` (already carries
  `anchorFrom`/`anchorTo`/`claimText`/`status`), `BriefStatusChange`. **No
  migration is needed for this prompt.**
- `lib/ai/generate-brief.ts` — `briefDraftShape` (each finding carries
  `citations: string[]` of evidence item ids, validated against the supplied
  set) and `assembleBodyText` with its stated block contract
- `lib/briefs/body.ts` — `parseBriefBody`, the exact inverse, carrying each
  block's character offset
- `lib/ai/fact-check.ts` — `anchorClaim`: anchors are **character offsets into
  `bodyText`**, `0/0` meaning "could not be located"
- `lib/db/briefs.ts` — `persistGeneratedBrief` (the only writer of a `Brief`
  row), `findBriefDetail`, `listBriefs` (title = version's first line)
- `app/(app)/briefs/[id]/` — `page.tsx`, `brief-body.tsx`, `citation-list.tsx`,
  `flag-panel.tsx`: the read-only view, and `GuardFlagIcon`
- `lib/auth/authorize.ts` — the predicate set and `ActionRefusal`
- `app/globals.css` — `--animate-flag-pulse` (900ms, `both`, no loop) already
  defined; breakpoints `tablet` 760 / `laptop` 1000 / `desktop` 1300
- `package.json` — **no Tiptap, no Motion installed**

## Decisions and assumptions

1. **Storage format: Tiptap JSON in `BriefVersion.documentJson`, with
   `bodyText` kept as the canonical plain-text mirror, regenerated from the
   document on every save.** `bodyText` is already load-bearing elsewhere — it
   is the brief list's title source, the fact-check pass's coordinate space, and
   what export will map from. So the document is the edit surface and `bodyText`
   is its deterministic projection. Never let the two diverge: one function
   builds the doc, one function renders the text, and they are inverses of each
   other exactly as `assembleBodyText` / `parseBriefBody` already are.

2. **Per-finding citations reach the reader through `documentJson`, not through
   `bodyText`.** The draft's `findings[].citations` are currently discarded at
   persist time — `assembleBodyText` does not emit them and there is no column
   for them. Rather than change the `bodyText` contract (which would move every
   existing flag anchor), `persistGeneratedBrief` gains a `documentJson`
   argument, and the generation path builds the Tiptap document **from the
   draft** with citation chips already inline at the end of each finding.
   `bodyText` and every anchor computed against it are **unchanged**.

3. **Briefs generated before this prompt have `documentJson = null`.** The
   editor falls back to building a document from `bodyText` via the block
   contract. Those briefs open and edit correctly; they simply have no chips
   until someone inserts them. No backfill, no migration.

4. **Flag anchors: character offsets are mapped to Tiptap positions at document
   build time, not stored twice.** The builder knows each block's offset (it is
   building from the same structure `parseBriefBody` reads), so the mapping is
   computed, applied as Marks, and thrown away. On save, the Mark's *current*
   document position is mapped back to a character offset in the regenerated
   `bodyText` and stored on the new version's flag rows. `claimText` is the
   re-anchoring key when the mapping fails; `0/0` keeps its existing meaning
   ("recorded, rendered from `claimText`, position unavailable") and such a flag
   renders in the panel only, with no Mark.

5. **An edit-derived version inherits its flags, with status and resolution
   metadata intact.** A regeneration or an audience switch does not (that rule
   stands, and prompt 11+ owns it). The reason: flags block approval, so if a
   plain edit dropped them, typing one word would silently clear the governance
   hold; and if it reopened resolved ones, no flag could ever stay resolved
   through an edit. Both are wrong. Editing carries flags forward, re-anchored.

6. **Who may edit: Programme Director and Policy & Advocacy Officer** —
   §10.3's "generates and refines briefs". Research Officer and Field Officer
   get no edit route. §10.4's "annotates gaps" for the Research Officer is
   real but reads as review annotation, not document authorship; it ships with
   the review work in prompt 11 rather than being guessed at here.

7. **Autosave debounce: 1200ms of inactivity, and a save is skipped when the
   document is unchanged.** The debounce interval is also the version-history
   density decision (`tiptap-editor`), and 1200ms keeps a normal editing session
   to a readable number of versions rather than one per pause.

8. **Autosave never touches `brief.status`** (§8.3). No status control is added
   in this prompt at all — a disabled Approve button with nothing behind it
   would imply the capability exists and is switched off, which the read-only
   page deliberately avoided.

9. **Motion is not installed and is not installed here.** The flag pulse is the
   existing CSS keyframe. Shared-layout chip animation belongs to the audience
   switch, which is not in this prompt.

10. **Tiptap package names, versions, extension APIs, SSR options, and React
    bindings are read from the installed package at implementation time.**
    Nothing in this prompt asserts a Tiptap API signature. Install, then read
    `node_modules/@tiptap/*` docs and types, and read
    `node_modules/next/dist/docs/01-app/` for the current client-component
    rules before writing the editor component.

## Files likely to change

New:

- `lib/briefs/document.ts` — the document model, shared: node/mark names, the
  `BriefDocument` type, `buildDocumentFromDraft`, `buildDocumentFromBodyText`,
  `documentToBodyText`, and the offset↔position mapping. Client-visible; holds
  no governance rule, no role, no eligibility predicate (§10.10) — same
  reasoning as `lib/briefs/body.ts`.
- `lib/briefs/extensions/citation-chip.ts` — the Node
- `lib/briefs/extensions/guard-flag.ts` — the Mark
- `app/(app)/briefs/[id]/edit/page.tsx` — Server Component, fetches, authorises
- `app/(app)/briefs/[id]/edit/actions.ts` — `saveBriefDraft`
- `app/(app)/briefs/[id]/edit/schema.ts` — the shared Zod schema
- `app/(app)/briefs/[id]/edit/brief-editor.tsx` — the client editor
- `app/(app)/briefs/[id]/edit/sections-nav.tsx` — the desktop third column
- `app/(app)/briefs/[id]/edit/evidence-sheet.tsx` — chip → `Sheet`
- `app/(app)/briefs/[id]/edit/save-state.tsx` — saved / saving / failed
- `app/(app)/briefs/[id]/edit/cite-control.tsx` — insert a chip from the set

Changed:

- `lib/db/briefs.ts` — `persistGeneratedBrief` takes `documentJson`;
  new `saveBriefVersion` (new version + carried-forward flags, one transaction);
  `findBriefDetail` / a new `findBriefForEdit` returns `documentJson`,
  `currentVersion`, `createdById`, and the flag rows
- `lib/ai/../briefs/new/actions.ts` (the verify stage) — build and pass the
  document
- `lib/auth/authorize.ts` — add `canEditBrief`
- `app/(app)/briefs/[id]/page.tsx` — an **Edit** link, shown only to roles that
  may edit (presentation; the route authorises)
- `app/(app)/briefs/[id]/flag-panel.tsx` / `citation-list.tsx` — reused by the
  edit route if they fit unchanged; extended, not duplicated, if they don't
- `app/globals.css` — only if the chip or the flag underline needs a keyframe or
  token that does not already exist
- `package.json` — Tiptap dependencies
- `AGENTS.md` §19 — only if a script is added (none is expected)

## Implementation requirements

### Document model (`lib/briefs/document.ts`)

- One module owns the shape. `buildDocumentFromDraft(draft, evidence)` and
  `buildDocumentFromBodyText(bodyText)` both produce the same node vocabulary:
  document title as `heading level 1`, section dividers (single-line blocks) as
  `heading level 2`, block headings as `heading level 3`, prose lines as
  paragraphs.
- `documentToBodyText(doc)` is the inverse and **must round-trip**: for any
  document built from a `bodyText`, `documentToBodyText(buildDocumentFromBodyText(t)) === t`.
  Citation chips render to nothing in `bodyText` — they are document-level
  metadata, and emitting them would change the coordinate space anchors live in.
- Offset↔position mapping is a pure function pair in this module, unit-testable
  by inspection, with the `0/0` case handled explicitly.

### Citation chip Node

- Inline, atomic, carries `evidenceItemId` and the display `citationKey`.
- **A chip that cannot resolve to an item in the brief's recorded evidence set
  is not rendered as a chip** — it degrades to plain text. A chip pointing at
  nothing is decoration, and this product's claim is traceability (§15.5).
- Visual: `inline-flex items-center gap-1.5 rounded-full bg-surface-tint border
  border-surface-tint-border px-2 py-0.5 text-[11px] font-semibold
  text-primary-ink` — the handoff recipe, verbatim. Filled dot = the item is
  `public_published` and resolvable (verified); hollow dot = pending.
- Click opens a `Sheet` with the evidence item's title, authors, year, country,
  citation key, classification badge, and source link. **Never a route change.**
  Quoted source material inside the Sheet is **serif**; the brief's own prose
  stays **sans** (§11.6). The Sheet is where that rule is most likely to be
  broken — do not set the metadata in the serif, only quoted text.
- Insert: select text → the cite control → a `Command` list of the brief's
  recorded evidence set only. No free-text id entry, no library-wide picker.
- Keyboard: the chip is focusable and opens on Enter/Space; removal via
  Backspace behaves as an atomic node.

### Guard-flag Mark

Restating the contract exactly, because it must not drift:

- Slate, on the watch ramp. **Never red, never `destructive`, never a toast,
  never a blink.**
- `animate-flag-pulse` — 900ms, **once**, background opacity 0 → 0.35 → 0,
  settling to a steady **2px underline** in `--color-watch-border`. No colour
  change during the pulse, no loop, and **no re-fire when React re-renders** —
  the pulse fires on first mount of the mark's decoration only.
- Icon shape where a flag is indicated inline or in the panel: **circle**
  (`GuardFlagIcon`, already built). A square means classification-pending — a
  different state entirely.
- `prefers-reduced-motion` gets the settled state instantly (the global rule in
  `globals.css` covers CSS animation; verify it does here too).
- The Mark **renders stored flag records**. It never scans text, never regexes,
  never infers a flag at render time.
- Clicking a flagged span scrolls the flag panel to that flag and vice versa.
  No control to clear it — prompt 11.
- The flag panel **promotes above the fold** below `laptop`; it is never the
  content that gets dropped (`design-system` responsive rules).

### Autosave

- Server Action, colocated, `saveBriefDraft`. Order, every time: resolve session
  → authorise (`canEditBrief`, plus the brief must exist and not be `submitted`
  or `published`) → validate with the shared Zod schema → write.
- Debounced 1200ms; no save when the serialised document is byte-identical to
  the last saved one.
- One transaction: create `BriefVersion` at `currentVersion + 1` with
  `documentJson` + regenerated `bodyText` + `createdById`, copy the previous
  version's flag rows across with re-anchored positions and their status and
  resolution metadata intact, and bump `brief.currentVersion`.
- **Concurrency:** the action takes the version the client edited from and
  refuses with a typed result if `brief.currentVersion` has moved. Two officers
  in the same document must not silently overwrite each other. The client keeps
  the buffer and surfaces the conflict; it does not discard the user's text.
- Save state is visible — **saving / saved <time> / failed, with retry**. A
  failed save keeps the buffer (`tiptap-editor`; same contract as the rate-limit
  degradation). **Never a silent failure.**
- `generatingModel` and `promptVersion` are null on a human-authored version.
  They describe a generation, and a human edit is not one.
- No status change, no `reviewedById`, no `BriefStatusChange` row (§8.3).

### Layout

- Brief Editor grid, from the handoff, verbatim:
  `grid grid-cols-1 laptop:grid-cols-[1fr_340px] desktop:grid-cols-[236px_1fr_372px]`,
  inside `w-full max-w-[1440px] mx-auto`.
- desktop ≥1300: sections nav / document / evidence + flag rail.
- laptop 1000–1300: sections nav collapses to a `Sheet` drawer triggered from
  the header; document + rail remain.
- tablet <1000: single column, document first, rail beneath — **with the guard
  flag panel pinned at the top of the rail**.
- <760: as above, no horizontal page scroll at 320px.
- Desktop-first (§11.14) but usable at every width (§11.15).
- Editor prose: sans, `max-w-[70ch]`, matching the read-only view's type scale
  so switching between the two does not reflow the reader's sense of the page.

### Copy

Never imply the system verified, approved, decided or endorsed anything (§8.8).
A flag says a claim is "not traceable to the supplied evidence" — never
"incorrect".

## Evidence classification impact

**Touched, but no new AI data path — and that is worth stating precisely rather
than waving at.**

- This task makes **no Gemini call**: no embedding, no generation, no
  re-generation, no translation, no fact-check. Nothing here enters the AI
  layer, so no new gate call site exists and none is added.
- It does **read and render evidence metadata** for chips and the Sheet:
  title, authors, year, country, citation key, classification. That is the same
  metadata the existing citation list already renders on the read-only page.
- **The chip's evidence set is the brief's recorded set**, which was already
  gated at generation time by `GatedEvidenceContext` — the only constructor that
  runs the gate. The cite control lists **only that set**, so the editor cannot
  introduce an ungated item into a brief. This is the enforcement point in code:
  `findBriefForEdit` selects the evidence set through `brief.evidenceSet`, and
  the cite control has no other source.
- **No evidence body text is written to logs, Sentry, or PostHog** (§7.6).
  Blocked items do not arise here: nothing ineligible is reachable, because the
  only evidence surface is a set that already passed the gate.
- Classification is displayed, never changed. No classification mutation exists
  on this route.

## Hallucination-guard implications

**Changed — three things, all of them contract-level.**

1. **Flag anchors move coordinate space.** They remain stored as character
   offsets into `bodyText` on the flag row; the editor maps them to Tiptap
   positions to render the Mark, and maps back on save. `claimText` stays the
   re-anchoring key and `0/0` keeps its meaning. `anchorClaim` in
   `lib/ai/fact-check.ts` is unchanged.
2. **Flags carry forward across an edit-derived version**, with status and
   resolution metadata intact (decision 5 above). Regeneration and audience
   switching still do not inherit cleared state.
3. **Flag rendering is introduced.** The exact visual contract, restated per
   §4's requirement: **slate (watch ramp), a gentle single 900ms pulse settling
   to a steady 2px soft underline; a round 16px icon with a filled centre dot;
   never red, never `destructive`, never a blink, never a loop, never an alarm,
   never an error toast; `prefers-reduced-motion` gets the settled state
   instantly.**

**What does not change:** what gets flagged, how claims are extracted, when the
pass runs (generation → validate → fact-check → persist, unchanged), and what a
flag blocks. Approval is not built yet, so nothing in this prompt weakens the
block — and nothing here lets a flag be cleared.

## Security requirements

- The edit route authorises server-side in the Server Component **and** the
  action authorises again inside itself. The link on the read-only page being
  hidden is presentation and is not the control (§10.1).
- Object-level, not role-only: the brief must exist, and a `submitted` or
  `published` brief is not editable.
- Server Actions are the only mutation path; no Route Handler is added.
- The shared Zod schema describes **shape only** — document JSON validity,
  version number, brief id. No role, no transition rule, no eligibility
  predicate in a client-visible module (§10.10).
- Document JSON is validated with Zod against the known node/mark vocabulary
  before it is written. An unrecognised node type is rejected, not stored:
  `documentJson` is rendered back into a rich-text surface, and an unvalidated
  blob from a client is exactly how that becomes an injection vector.
- Nothing server-only leaks into the client editor bundle — check that
  `lib/briefs/document.ts` imports nothing from `lib/auth/authorize.ts`,
  `lib/db/*`, or `lib/ai/*`.
- No evidence body text in any log, error report, or analytics payload (§7.6).

## Acceptance criteria

1. `/briefs/[id]/edit` loads a generated brief into a Tiptap editor with no
   hydration mismatch and no SSR crash.
2. A brief generated **after** this change shows citation chips inline at the
   findings whose citations the generator produced; each resolves to a real
   evidence item in the brief's recorded set.
3. A brief generated **before** this change (`documentJson = null`) opens,
   edits, and saves correctly, built from `bodyText`.
4. Clicking a chip opens a `Sheet` with that evidence item. The URL does not
   change.
5. Every open flag renders as a Mark over its claim, in slate, with one 900ms
   pulse settling to a steady 2px underline. No red anywhere. `0/0` flags appear
   in the panel only.
6. `prefers-reduced-motion` shows the settled state with no pulse.
7. Typing then pausing produces exactly one new `BriefVersion` per debounce
   window, and the previous version still exists unmodified.
8. `documentToBodyText` round-trips: the saved `bodyText` re-parses into the
   same blocks, and the brief list title is still correct after an edit.
9. Flags exist on the new version after a save, re-anchored, with status
   preserved.
10. A save from a stale version is refused with a typed result and the editor's
    buffer survives.
11. A Research Officer and a Field Officer are refused at the route, and refused
    again by the action if it is called directly.
12. No horizontal page scroll at 320, 480, 760, 1000, 1300, and 1600px; the
    guard-flag panel is above the fold in the single-column layout.
13. Generated prose is sans; quoted source material in the Sheet is serif.
14. `npm run lint`, `npm run typecheck`, and `npm run build` pass with no new
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

No migration is expected. If one turns out to be needed, it goes through
`npm run db:migrate:new` — never `prisma migrate dev`.

## Manual test steps

1. `npm run dev`, sign in as a Programme Director or Policy & Advocacy Officer.
2. Open `/briefs`, pick an existing brief, open it, click **Edit**.
3. Confirm the document renders with its headings and prose, and that any open
   flags are underlined in slate with a single pulse on load. Reload — the pulse
   fires once again, does not loop, and does not blink.
4. Enable "reduce motion" in the OS and reload: the underline is present
   immediately, with no pulse.
5. Type a sentence, stop. Watch the save state go **saving → saved**. Run
   `npm run db:studio` and confirm a **new** `brief_version` row exists, the
   previous row is untouched, `brief.current_version` has moved, and the new
   version's `hallucination_flag` rows carry the same statuses.
6. Select a phrase, use the cite control, pick an evidence item from the list.
   Confirm the list contains **only** this brief's evidence set. Click the
   inserted chip — a Sheet opens, the URL does not change.
7. Generate a **new** brief through `/briefs/new`, open its editor, and confirm
   citation chips are already present at the findings.
8. Open the same brief in two tabs. Edit and save in tab A, then edit in tab B —
   tab B is refused with a conflict message and its text is still on screen.
9. Sign in as a Research Officer and open `/briefs/[id]/edit` — refused, with the
   reason stated, not a blank page.
10. Resize from 1600px down to 320px. At every width: no horizontal page scroll,
    the flag panel is reachable without hunting, and below 1300px the sections
    nav is in a drawer.
11. Confirm no evidence body text appears in the dev-server terminal at any
    point.
