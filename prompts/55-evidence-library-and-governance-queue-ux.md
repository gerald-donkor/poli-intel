# Prompt 55 — Evidence Library & Governance Queue UX Refinement

## Goal

Refine the Evidence Library (`/evidence`) and the Governance Classification Queue (`/evidence/queue`) to deliver an institutional, accessible, and responsive evidence exploration and triage experience for Tropenbos Ghana. This includes:
1. Filter rail with facet controls, counts, active filter badges, and responsive side-sheet toggle on mobile/tablet viewports.
2. Evidence table with `number + bar` relevance scoring, clear selection states (`bg-surface-tint` with `border-l-2 border-primary`), and staggered reveal motion.
3. Evidence detail pane and mobile side-sheet preview with Plex Mono citation keys, Source Serif 4 quoted excerpts, metadata badges, and brief context.
4. Three-way classification queue triage surface with square glyphs, note capture, 200ms smooth row collapse, and 180ms queue count crossfade.

---

## Skills read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `web-design-guidelines` (`.agents/skills/web-design-guidelines/SKILL.md`)

---

## Existing code inspected

- `app/(app)/evidence/page.tsx` — Evidence Library page layout, classification pending banner, semantic status alert, and search orchestration.
- `app/(app)/evidence/filter-rail.tsx` — Filter rail facets, search input, responsive filter sheet drawer.
- `app/(app)/evidence/evidence-table.tsx` — Evidence table, match score cells, row selection, detail pane, excerpt quotes.
- `app/(app)/evidence/queue/page.tsx` — Classification queue page, role verification, breadcrumbs.
- `app/(app)/evidence/queue/classify-panel.tsx` — Queue item cards, 3-way classification actions, row collapse animation, count crossfade.
- `components/classification-badge.tsx` — 3-way square-glyph classification badge presentation.
- `components/classification-pending-alert.tsx` — Governance hold alert banner with square glyph.
- `design_handoff_evibrief/design-system.md` & `EviBrief Screens.dc.html` (frame `1c`) — Table styling, relevance bars, facet rail, serif excerpts, and responsive breakpoints.

---

## Decisions and assumptions

1. **Square Glyphs for Governance**: In accordance with the design system, all classification states strictly use square glyphs (never circular badges, which are reserved for hallucination-guard flags).
2. **Relevance Number + Bar Rendering**: Search relevance scores are rendered as a numeric score (Plex Mono) alongside a proportional horizontal bar in `primary` / `surface-tint`, never as color alone.
3. **Quoted Excerpts in Source Serif 4**: All verbatim document excerpts and matched passages are set in `Source Serif 4` (`font-serif text-quote border-l-2 border-accent pl-4 text-ink`). Summaries and metadata remain in `Inter` (`font-sans`).
4. **Selected Row Presentation**: The active row in the evidence table is highlighted with a `bg-surface-tint` fill and a distinct left border indicator, ensuring high contrast and clarity.
5. **Responsive Detail Sheet**: On tablet and mobile viewports (< 1000px), row selection opens a dedicated responsive Sheet preview if the detail pane is collapsed or stacked.

---

## Files likely to change

- `app/(app)/evidence/page.tsx`
- `app/(app)/evidence/filter-rail.tsx`
- `app/(app)/evidence/evidence-table.tsx`
- `app/(app)/evidence/queue/page.tsx`
- `app/(app)/evidence/queue/classify-panel.tsx`
- `components/classification-badge.tsx`
- `components/classification-pending-alert.tsx`

---

## Implementation requirements

1. **Filter Rail & Search Bar Polish (`filter-rail.tsx`)**:
   - Clean search input with submit-only trigger, keyword/semantic explanation label, and clear button when active.
   - Filter rail with facet controls for Source Type, Impact Area, Country, and Year.
   - Display active filter count pill on the mobile sheet trigger button.
   - Smooth transition state (`opacity-60 pointer-events-none`) during navigation transitions.

2. **Evidence Table & Match Cell Polish (`evidence-table.tsx`)**:
   - Table headers in `bg-stone` with small-caps uppercase styling (`text-[11.5px] font-semibold tracking-[0.06em] text-ink-2`).
   - Match cell renders score in IBM Plex Mono alongside a proportional progress bar (`bg-primary` on `bg-stone`).
   - Selected row has `bg-surface-tint` and smooth hover transitions.
   - Staggered reveal animation (70ms apart, 8px rise) for search results, respecting `prefers-reduced-motion`.

3. **Evidence Detail Pane & Excerpts (`evidence-table.tsx`)**:
   - Detail header with Plex Mono citation key (`text-primary text-[11px] font-mono`), bold title, and classification badge.
   - Structured metadata grid (`Authors`, `Year`, `Country`, `Source type`, `Impact area`, `Ingested`, `Embedding state`).
   - Quoted excerpt in `Source Serif 4` with `border-l-2 border-accent pl-4 text-ink bg-card`.
   - Action controls ("Ingest document", "Add to brief" / "Open source URL" links where applicable).

4. **Classification Queue & Governance Triage Polish (`classify-panel.tsx` & `queue/page.tsx`)**:
   - Breadcrumbs: `Evidence > Classification Queue`.
   - 3-way classification choice cards with clear hints and square glyphs:
     - `public_published`: Green/horizon square fill.
     - `community_sourced`: Slate/watch square outline.
     - `unpublished_internal`: Amber/immediate square outline.
   - Smooth 200ms row collapse on classification, 180ms queue count crossfade, and zero animation under `prefers-reduced-motion`.
   - Note input field with user attribution hint.

5. **Responsiveness**:
   - Layout scales cleanly across 320px, 390px, 760px, 1000px, 1300px, and 1600px viewports.
   - Below desktop (1000px), filter rail transforms into a filter drawer Sheet, and table maintains horizontal scroll safety without breaking layout.

---

## Evidence classification impact

**none — no evidence data path.**
This task refines the visual presentation and user interaction for the Evidence Library and Classification Queue. It does not ingest, reclassify, or transmit unclassified evidence to model endpoints outside the existing Server Actions.

---

## Hallucination-guard implications

**none.**
This task does not alter fact-check pass execution, flag persistence, or verification rules.

---

## Security requirements

- Role authorization for classifying evidence (Research Officer, Programme Director) remains strictly enforced inside Server Actions.
- Unclassified evidence remains completely hidden from the public evidence library search and is accessible only in the triage queue.

---

## Acceptance criteria

- [ ] Filter rail supports source type, impact area, country, and year facets with clear active state badges.
- [ ] Relevance score in the evidence table renders as `number + bar` cell in IBM Plex Mono and primary green bar.
- [ ] Detail pane displays Plex Mono citation key, metadata dl list, and Source Serif 4 excerpt block.
- [ ] Classification queue renders 3-way choices with square glyphs and smooth 200ms row collapse.
- [ ] Responsive across all defined breakpoints (320px to 1600px).
- [ ] Passes `npm run typecheck`, `npm run lint`, and `npm run test`.

---

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run test`

---

## Exact manual test steps expected after implementation

1. Navigate to `/evidence`.
2. Test searching for keywords (e.g. "cocoa" or "tenure") and verify search results render with `number + bar` match scores.
3. Test filter rail facets (Country, Year, Source Type, Impact Area) and verify instant filter navigation.
4. Click different table rows and verify the detail pane updates with citation key and Source Serif 4 excerpt.
5. On mobile/narrow viewport (< 1000px), verify the "Filters" sheet trigger opens the filter drawer.
6. Navigate to `/evidence/queue`.
7. Verify breadcrumbs `Evidence > Classification Queue`.
8. Tag an item and verify the 200ms smooth row collapse and queue count decrement.
