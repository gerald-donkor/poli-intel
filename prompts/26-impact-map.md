# 26 — Impact map

## Goal

Build the impact map: an animated evidence → brief → outcome lattice on `/impact`,
whose citation paths draw in over ~1.6s. It is the product's **only GSAP
surface** and the one cinematic moment in it.

`/impact` already carries a `ScreenPlaceholder` saying this screen is coming and
that "a map can only draw paths that already exist". Prompt 22 built the paths —
influence events, their briefs, and the evidence those briefs cited. This prompt
draws them and deletes the placeholder.

The map asserts nothing the record does not already hold. Every node is a stored
row and every line is a stored relation; there is no inference, no clustering,
and no model anywhere on this screen.

## Skills read

- `design-system` — the impact-map row of the component table, the ramp rules,
  the reserved glyph meanings, the one-GSAP-surface rule, `prefers-reduced-motion`
- `design_handoff_evibrief/design-system.md` — authoritative: the map's grid
  recipe (`grid-cols-1 laptop:grid-cols-[1fr_356px]`), its responsive row (860px
  min-width, horizontal pan below `laptop`, 460px min-height at `tablet`), the
  motion table's impact-map entry (~1.6s, citation-date order, unverified drawn
  last), and the implementation note on `pathLength="1"` + `stroke-dashoffset`
- `gsap-core` — tween vars, eases, `gsap.matchMedia()` for reduced motion
- `gsap-timeline` — sequencing, position parameter, labels, `defaults`
- `gsap-react` — `useGSAP()`, scope, `contextSafe`, SSR rules, cleanup
- `supabase-schema` — reading existing relations without forking a table
- `evidence-governance` — read to confirm this task has no AI data path (it does
  not; see below)

## Existing code inspected

- `app/(app)/impact/page.tsx` — the current screen: `LogInfluencePanel`,
  `QuarterlyReport`, the record section wrapping `InfluenceEventRail`, and the
  `ScreenPlaceholder` this prompt replaces
- `app/(app)/impact/event-rail.tsx` — `InfluenceEventRail({ events, canVerify })`
- `app/(app)/impact/labels.ts`, `actions.ts`, `schema.ts`
- `lib/db/influence.ts` — `listInfluenceEvents`, `InfluenceEventView`,
  `readQuarterlyImpactReport`, and its `briefEvidence` read
  (`QuarterlyReportEvidence`: `id`, `title`, `citationKey`, `eventCount`)
- `prisma/schema.prisma` — `InfluenceEvent`, `Brief`, `BriefEvidence`,
  `EvidenceItem`, `InfluenceEventType`, `InfluenceDetectionMethod`
- `app/globals.css` — `--color-accent` (#1D9E75), `--color-sage` (#C3D2C8),
  `--color-line`, `--color-ink-3`, the `prefers-reduced-motion` block
- `lib/auth/authorize.ts` — `canLogInfluenceEvent`, `canVerifyInfluenceEvent`
- `package.json` — **no `gsap` and no `@gsap/react`**; `motion` is installed

## Decisions and assumptions

**1. GSAP and `@gsap/react` are new dependencies, added here and used nowhere
else.** `AGENTS.md` §6 and §11.9 permit GSAP for the impact map and forbid it
everywhere else; Motion stays the UI animation library and is not used here. Add
both packages in this change. `useGSAP` is registered as a plugin
(`gsap.registerPlugin(useGSAP)`) and the map is the only module in the repository
that imports from `gsap`.

**2. The map draws influence paths, so its spine is the influence event.** A node
set is derived, not stored: the outcomes are `InfluenceEvent` rows, the briefs are
the briefs those events name, and the evidence is the `BriefEvidence` set of
exactly those briefs. A brief with no influence event has no path and does not
appear — the screen is the record of what reached policy, not a catalogue of
everything drafted.

**3. Evidence appears as title and citation key, and nothing else.** This follows
the precedent already set by `readQuarterlyImpactReport`'s evidence read: a title
and a citation key are the item's bibliographic identity, which is what a citation
path is made of. No `fullText`, no chunk, no excerpt, no `bodyText` from a brief.
See the governance section.

**4. The verified/unverified distinction is the map's whole point, and it is
carried twice.** Verified paths draw **solid accent** (`#1D9E75`); unverified
paths draw **dashed sage** (`#C3D2C8`) and **draw last**, per the handoff. Dash
versus solid means the information survives without colour (§11.13). Nothing on
this screen is red, and an unverified path is not an error — it is a lead nobody
has confirmed yet.

**5. Node shapes must not borrow the reserved governance glyphs.** `design-system`
rule 4 assigns the **circle** to a hallucination-guard review flag and the
**square** to a classification-pending hold. Using either as a node type here
would make two unrelated things look like the same thing. Nodes are therefore
**labelled rounded rectangles distinguished by column position and a column
heading**, not by a glyph. Column headings — Evidence, Brief, Outcome — are part
of the diagram.

**6. The screen adopts the handoff's grid, and the events rail becomes the right
column.** `grid grid-cols-1 laptop:grid-cols-[1fr_356px]` with the map left and
`InfluenceEventRail` right, replacing today's full-width record section. The log
panel and the quarterly report stay full-width above it. This is the handoff's
specified layout for this screen and is the reason the recipe exists.

**7. The map does not reflow, and that is deliberate.** Below `laptop` it keeps an
860px min-width and pans horizontally **inside its own panel** — the page itself
never scrolls horizontally. A three-column lattice compressed to 390px is
unreadable, and `design-system` names stacking its nodes as the wrong trade.

**8. Screen readers get the paths as text, not as a fake canvas.** The SVG is
`role="img"` with a summarising `aria-label`, plus a visually-hidden list stating
each path in words. It is not given invented interactive semantics, and the events
rail beside it already carries every event in full. The one real control is a
**Replay** button.

**9. Nodes are not interactive in this prompt.** No hover-to-highlight, no
click-to-filter, no tooltip. The rail is the detail surface and it already exists;
adding a second one would duplicate it. If Tropenbos wants selection later it is
its own prompt.

**10. Nothing on this screen mutates.** No Server Action is added. Verification
stays where it is, on the rail's existing `VerifyControl`.

## Files likely to change

**Dependencies**

- `package.json` / `package-lock.json` — add `gsap` and `@gsap/react`

**Data layer**

- `lib/db/influence.ts` — add `readImpactMap()`: the event → brief → evidence
  lattice, ids, titles, citation keys, verified flag and `detectedAt` only
- `lib/db/index.ts` — re-export it and its types

**Route**

- `app/(app)/impact/page.tsx` — fetch the lattice, adopt the grid recipe, drop
  the `ScreenPlaceholder`
- `app/(app)/impact/impact-map.tsx` (new) — client; the SVG canvas, the layout
  maths, the GSAP timeline, the replay control, the hidden text summary
- `app/(app)/impact/labels.ts` — the map's copy and its path-description sentence

**Nothing else.** No new component under `components/`, no change to
`event-rail.tsx`, no change to `globals.css` — the map's motion is GSAP, not a
keyframe token.

## Evidence classification impact

**None — no evidence data path.** This task makes no Gemini call of any of the
eight kinds in `evidence-governance`: no embedding, no summarisation, no
classification, no generation, no re-generation, no audience switch, no
translation, no fact-check. It never enters `lib/ai/` or `lib/governance/`.

What it reads from `evidence_item` is **`id`, `title`, and `citation_key`** — the
same three columns `readQuarterlyImpactReport` already reads for the donor report,
and the item's bibliographic identity rather than its content. **Never
`full_text`, never an `evidence_chunk`, never an excerpt, and never a brief's
`bodyText` beyond the first-line title helper the existing views already use.**

The gate's retrieval face (§7.5, §15.2) governs what may enter *retrieval* and
what is *searchable in the library*. This screen performs neither: it renders a
stored, human-confirmed historical relation between rows a person already
selected. Do not add a classification filter that would silently drop a path from
the record of what actually happened — and equally, do not widen the select to
carry body text on the grounds that the gate does not apply here. Titles only.

Nothing here reaches a log, a Sentry event, or a PostHog property (§7.6).

## Hallucination-guard implications

**None.** This task does not change what gets fact-checked, how claims are
extracted, how flags are stored, how flags render, or what a flag blocks. It
introduces no generation and touches no `HallucinationFlag` row.

One adjacent rule holds: the map **displays** verification state and never
changes it. There is no confirm control on the canvas — `canVerifyInfluenceEvent`
is enforced inside `verifyInfluenceEventAction` and reached only from the rail's
existing control (§8.8, §10.1). A drawn line must never become a second,
unguarded path to marking something confirmed.

## Implementation requirements

### Dependencies

1. `npm install gsap @gsap/react`. Register once at the top of the map module:
   `gsap.registerPlugin(useGSAP)`.
2. GSAP is imported in `app/(app)/impact/impact-map.tsx` and nowhere else. Do not
   add a GSAP import to any other file in this change, and do not replace an
   existing Motion animation with one.

### Data layer

3. `readImpactMap()` in `lib/db/influence.ts`, returning a serialisable lattice:
   - `outcomes`: `{ id, briefId, eventType, sourceTitle, sourceDocument,
     detectedAt, verified }[]`, ordered by `detectedAt` ascending — **citation-date
     order**, which is the order the timeline draws in
   - `briefs`: `{ id, title, briefType, audience }[]` — the briefs those outcomes
     name, title via the existing first-line helper
   - `evidence`: `{ id, title, citationKey }[]`
   - `links`: `{ evidenceId, briefId }[]` and the outcome's own `briefId`
4. One query per level, not an N+1 walk. Dates are ISO strings; no Prisma model
   instance escapes.
5. All Prisma access stays in `lib/db/`. No Prisma import in a route or component.

### Layout

6. `app/(app)/impact/page.tsx` fetches the lattice in the existing
   `Promise.all`, alongside `listInfluenceEvents` and the rest.
7. The record section becomes
   `grid grid-cols-1 gap-6 laptop:grid-cols-[1fr_356px]`: map left, rail right.
   Panel borders switch `border-top` → `border-left` when the rail becomes a
   column (`border-t laptop:border-t-0 laptop:border-l border-line`).
8. The map panel holds a **460px min-height** at `tablet` and up so paths stay
   legible, and an **860px min-width canvas that pans horizontally inside its own
   `overflow-x-auto` container** below `laptop`. The page must not scroll
   horizontally at any width (§11.15).
9. Delete the `ScreenPlaceholder` and its import if unused elsewhere in the file.

### The canvas

10. Plain SVG in JSX — no charting library, no force-simulation package. Node
    positions are computed deterministically: three fixed columns, each column's
    nodes distributed evenly down the available height. Deterministic so the
    diagram is the same on every render and on the server.
11. Nodes are rounded rectangles with a thin `line` stroke on `card` fill, their
    label truncated with an SVG `<title>`. **No circle, no square, no leaf, no
    tree, no icon asset** (§11.7, decision 5). Column headings sit above the
    columns as small-caps eyebrows.
12. Paths are `<path>` elements with `pathLength="1"`, animated by
    `stroke-dashoffset` from 1 to 0, per the handoff's implementation note. Draw
    them as gentle cubic curves between column edges, not straight diagonals.
13. Verified: `stroke-accent`, solid, 1.5px. Unverified: `stroke-sage`, dashed,
    1.5px. **Never red, never the urgency ramp** — urgency is a signal taxonomy
    and has no meaning here (§11.4).
14. Labels are Inter at 12px minimum. **The serif appears nowhere on this
    canvas** — nothing on it is quoted source material; the rail's `quotedText`
    is where the serif already lives (§11.6).

### The animation

15. One `gsap.timeline()` inside `useGSAP(..., { scope: containerRef })`. Refs or
    scoped selectors only — never an unscoped selector string.
16. Total ~1.6s. Order: evidence nodes fade in, then brief nodes, then **verified
    paths draw in citation-date order**, then outcome nodes, then **unverified
    dashed paths draw last**. Use the position parameter and labels, not chained
    `delay`.
17. `prefers-reduced-motion` is handled with **`gsap.matchMedia()`** and a
    `reduceMotion: "(prefers-reduced-motion: reduce)"` condition that renders the
    final state with `duration: 0`. The global CSS rule in `globals.css` kills CSS
    animation and **does not touch a JS-driven timeline** — this is the case that
    rule cannot cover, so it must be handled here explicitly (§11.10).
18. It plays once on mount. It does not loop, does not autoplay again on
    re-render, and does not replay on scroll — the generation stepper's breath
    remains the only looping animation in the product.
19. A **Replay** button re-runs the timeline. Wrap its handler in `contextSafe`
    so it cannot fire against unmounted nodes.
20. Cleanup is `useGSAP`'s own. Do not hand-roll a `useEffect` with
    `gsap.context()` when `useGSAP` is available, and never leave a timeline
    unreverted.
21. GSAP must not run during SSR. All of it lives inside the hook, in a
    `"use client"` module.

### States

22. **Empty** — no influence events at all: the map does not render, and the
    existing `EmptyImpactState` stays as the screen's answer. Do not draw an empty
    lattice or a skeleton.
23. **Partial path** — an outcome whose brief has no recorded evidence set (a
    manually generated brief, or one whose rows were removed) draws
    brief → outcome only, and the hidden summary says the evidence side is not
    recorded. **Never drop the path silently**, and never invent an evidence node
    to make the picture symmetrical.
24. **Rate-limited / flagged / offline / classification-pending** — not reachable
    on this route: it makes no Gemini call, persists no generation, is not a Field
    Officer surface, and reads no `evidence_item` classification. State this in a
    comment rather than building states that cannot occur (§17.6).

### Accessibility

25. `role="img"` on the SVG with an `aria-label` naming what it shows and how
    many paths. A visually-hidden `<ul>` beside it states each path as a sentence
    — evidence, brief, outcome, and whether it is confirmed — so the diagram's
    information is fully available without seeing it.
26. Node text 12px minimum; verify the accent-on-card and sage-on-card stroke
    pairings and every label pairing against 4.5:1 before finalising (§11.13).
27. The Replay button is a real `<button>`, keyboard-reachable, with a label that
    does not rely on an icon.

### Copy

28. Nothing implies the system found, proved, or verified an influence (§8.8). A
    path is *recorded*; an unverified path is *not confirmed yet*. A legend states
    plainly what solid and dashed mean — the distinction must be readable without
    hovering anything.

## Security requirements

- No new env var, no new external call, no new Route Handler, no new Server
  Action.
- The read runs in a Server Component; no client-side fetching library.
- No Prisma access outside `lib/db/`.
- No evidence body text, brief body text, or quoted source text in any log,
  Sentry event, or PostHog property (§7.6, §13.9).
- `/impact` stays behind the existing `(app)` auth layout and its
  `canLogInfluenceEvent` render gate; nothing on the no-login WhatsApp/USSD path
  reads it.

## Acceptance criteria

1. `/impact` renders the map for a Programme Director or Policy & Advocacy
   Officer, and the `ScreenPlaceholder` is gone.
2. A verified influence event draws a solid accent path; an unverified one draws
   a dashed sage path, and the dashed paths draw after the solid ones.
3. Paths draw in citation-date order; the whole sequence completes in ~1.6s and
   plays once.
4. With `prefers-reduced-motion: reduce`, the finished diagram appears instantly
   with no drawing animation.
5. Replay re-runs the sequence and leaves no orphaned timeline behind on
   navigation away.
6. An outcome whose brief has no evidence set still appears, as a
   brief → outcome path, and the hidden summary says so.
7. With no influence events, the map does not render and the existing empty state
   stands.
8. Nothing on the map changes a verification state, and no control on the canvas
   confirms anything.
9. A screen reader reaches every path as text; the SVG is not the sole carrier of
   any information.
10. Nothing on the route is red; `destructive` appears nowhere; no urgency-ramp
    colour is used on the canvas.
11. Usable with no horizontal *page* scroll at 390, 760, 1000, 1300 and 1600px;
    below 1000px the canvas pans inside its own container.
12. `gsap` is imported in exactly one file, and no existing Motion animation was
    replaced.
13. `npm run lint` and `npm run typecheck` clean of new errors; `npm run build`
    succeeds.

## Checks to run

- `npm install gsap @gsap/react`
- `npm run lint` (4 pre-existing errors expected; none new)
- `npm run typecheck`
- `npm run build`

Report exact output.

## Manual test steps

1. `npm run dev`, sign in as a Programme Director, open `/impact`.
2. With no events logged: confirm the empty state renders and no canvas appears.
3. Log an influence event against a brief that has an evidence set. Reload —
   confirm a dashed sage path draws from evidence → brief → outcome, last in the
   sequence, and that the legend explains the dash.
4. Confirm that event on the rail. Reload — the same path is now solid accent and
   draws earlier in the sequence.
5. Log a second event with an earlier `detectedAt` and confirm the draw order
   follows the citation date, not the insertion order.
6. Log an event against a brief with no evidence rows. Confirm the
   brief → outcome path still appears and the hidden summary states the evidence
   side is not recorded.
7. Press **Replay** — the sequence re-runs. Navigate to `/briefs` mid-animation
   and back; confirm no console warning and no stuck half-drawn path.
8. Enable `prefers-reduced-motion: reduce` in DevTools, reload — the finished
   diagram appears instantly.
9. Resize through 390 / 760 / 1000 / 1300 / 1600px. Below 1000px the canvas pans
   inside its panel; the page never scrolls horizontally. At `laptop` and up the
   rail sits to the right of the map.
10. With a screen reader, confirm each path is announced as a sentence and the
    Replay button is reachable and labelled.
11. Confirm no control on the canvas can confirm, verify, or edit an event.
