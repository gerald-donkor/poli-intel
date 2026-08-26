# Prompt 58: Evidence Library Responsive Three-Pane Layout & Zero Horizontal Scroll

## Goal

Refactor the Evidence Library (`/evidence`) layout and table structure so that:
1. The **central pane (Evidence Table)** always fully displays all content without any horizontal scrollbar (`overflow-x-auto` eliminated, `table-fixed` column budgeting with clean text wrapping and truncation).
2. The **right pane (Evidence Detail)** is cleanly separated in layout, never overlapping, clipping, or sitting on top of the central table.
3. All **3 panes (Filters, Table, Detail)** are fully displayed simultaneously on desktop viewports, and cleanly reflow into responsive layouts on laptop, tablet, and mobile viewports with zero horizontal scrolling at any viewport width (320px to 1600px+).

---

## Skills Read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)

---

## Existing Code Inspected

- `app/(app)/evidence/page.tsx` — Evidence Library page component and layout grid.
- `app/(app)/evidence/evidence-table.tsx` — Central evidence table, detail preview pane, and mobile preview sheet.
- `app/(app)/evidence/filter-rail.tsx` — Left filter rail and top filter bar with sheet drawer.
- `components/classification-badge.tsx` — Governance classification badge component with square glyphs.
- `components/ui/table.tsx` — Shadcn table primitives (`Table`, `TableHead`, `TableCell`, `TableRow`).
- `design_handoff_evibrief/design-system.md` — Responsive breakpoints (`tablet: 760px`, `laptop: 1000px`, `desktop: 1300px`), Evidence Library recipe (`grid-cols-1 laptop:grid-cols-[1fr_320px] desktop:grid-cols-[216px_1fr_340px]`).
- Screen recording `/home/dg/Videos/screenrecording-2026-08-26_11-05-52.mp4` showing the central pane table horizontally scrolling under the right detail pane.

---

## Decisions and Assumptions

1. **Table Column Budgeting vs Overflow**:
   - The root cause of the horizontal scroll was combining `min-w-0 overflow-x-auto` with unconstrained table cell widths and shadcn's default `whitespace-nowrap` on `TableCell` and `TableHead`.
   - We will configure the central table as `w-full table-fixed overflow-hidden` with explicit, proportional column sizing so that table rows fill 100% of the available central pane width without overflowing or triggering a scrollbar.
   - Column layout budget:
     - **Title & Citation**: flexible `w-auto min-w-[180px]`, `whitespace-normal` with `line-clamp-2` for title and monospace citation key below.
     - **Match**: compact `w-[90px]` (number + bar indicator, only rendered when active query exists).
     - **Type**: `w-[75px]` (`hidden sm:table-cell`, text truncated cleanly).
     - **Year**: `w-[52px]` (`table-cell`, font-mono text).
     - **Country**: `w-[70px]` (`hidden md:table-cell`, text truncated cleanly).
     - **Impact Area**: `w-[115px]` (`hidden xl:table-cell`, text truncated cleanly with full tooltip and detail panel view).
     - **Classification**: `w-[125px]` (`hidden sm:table-cell`, rendered via compact `ClassificationBadge`).
2. **Three-Pane Architecture**:
   - **Desktop (≥ 1300px)**: 3-column layout: Left Filter Rail (`216px`) | Central Table (`1fr`) | Right Detail Pane (`340px`). All 3 panes are fully visible side-by-side.
   - **Laptop (1000px – 1299px)**: Top Filter Bar with search input and "Filters" Sheet trigger | Central Table (`1fr`) | Right Detail Pane (`320px`) side-by-side.
   - **Tablet (760px – 999px)**: Top Filter Bar with search input and "Filters" Sheet trigger | Full-width Central Table | Detail Pane stacked seamlessly below with a clear section header and "View details" sheet trigger.
   - **Mobile (< 760px)**: Top Filter Bar | Mobile-optimized evidence row cards/table (Title, Citation Key, Year, Classification pill, ≥ 48px touch target) | Detail Sheet automatically opens on tap to present complete metadata, excerpts, and actions.
3. **ClassificationBadge Compact Variant**:
   - Support a `compact` prop or streamlined table variant on `ClassificationBadge` (`px-2 py-0.5 text-[11px]`) preserving the square glyph and semantic color ramp while ensuring compact column width.

---

## Files Likely to Change

- `app/(app)/evidence/evidence-table.tsx`
- `app/(app)/evidence/page.tsx`
- `app/(app)/evidence/filter-rail.tsx`
- `components/classification-badge.tsx`

---

## Implementation Requirements

1. **Eliminate Horizontal Scrollbar in Central Pane**:
   - Remove `overflow-x-auto` from the evidence table wrapper in `evidence-table.tsx`.
   - Apply `w-full table-fixed` and ensure all table cells (`TableCell`, `TableHead`) override `whitespace-nowrap` where appropriate (`whitespace-normal` on title, `truncate` on text fields).
   - Verify that when browsing or searching evidence, the table occupies exactly 100% of the central pane with zero horizontal scrollbar.
2. **Clean Three-Pane Display & Layout Separation**:
   - Ensure the right pane (`<aside aria-label="Evidence detail">`) sits cleanly in its dedicated grid column (`laptop:grid-cols-[1fr_320px] desktop:grid-cols-[1fr_340px]`) on laptop and desktop viewports, with a crisp left border (`border-l border-line`).
   - The right pane must never overlap, float over, or cut off any table columns.
3. **Full Responsiveness across Breakpoints**:
   - **Mobile (< 760px)**:
     - No horizontal scroll on the viewport or table container (`overflow-x-hidden`).
     - Clear touch targets (≥ 48px row heights).
     - Tapping a row opens the full detail drawer in `SheetContent`.
   - **Tablet (760px – 1000px)**:
     - Search and filter bar at top.
     - Table expands across available width without overflow.
     - Detail pane rendered below table and/or available via drawer.
   - **Laptop & Desktop (≥ 1000px)**:
     - Table and detail pane displayed side-by-side.
     - At `≥ 1300px` (desktop), left filter rail, central table, and right detail pane all display simultaneously.
4. **Design System & Accessibility Compliance**:
   - Palette: Warm `paper #F7F5F0`, `card #FDFCF9`, `surface-tint #E1F5EE`, `line #E4DEC3`.
   - Typography: Sans for UI and metadata, Serif (`font-serif`) for quoted excerpts (`EvidenceExcerpt`), Mono for citation keys and dates.
   - Square glyphs for classification badges; never use `destructive` or pure red.
   - Full keyboard operability (Tab, Enter/Space to select rows) and ARIA semantics (`aria-current` on selected row).

---

## Evidence Classification Impact

- **Classifications involved**: `public_published`, `community_sourced`, `unpublished_internal`.
- **Enforcement point**: Only `public_published` items are retrieved in `searchEvidence` and displayed in the main Evidence Library (unclassified items are held at `/evidence/queue`).
- **Impact**: UI presentation only; does not alter the data classification gate or allow unclassified items into retrieval or model calls.

---

## Hallucination-Guard Implications

- **Impact**: None — this task refactors the Evidence Library layout and table responsiveness. No changes to claim extraction, fact-check pipelines, or guard flag rules.

---

## Security Requirements

- DAL role checks (`requireStaffUser`) and server-side filtering remain intact.
- External source links retain `rel="noreferrer"` and `target="_blank"`.

---

## Acceptance Criteria

1. On desktop viewports (≥ 1300px), all 3 panes (Filter Rail, Evidence Table, Evidence Detail) are fully displayed simultaneously without any horizontal scrollbar in the central pane.
2. The right detail pane is cleanly separated by a border and does not overlap or clip the central table.
3. Table columns adapt smoothly to viewport changes, wrapping and truncating appropriately.
4. On tablet and mobile viewports (< 1000px and < 760px), layout reflows cleanly with zero horizontal scroll, and tapping an evidence row opens the full detail drawer.
5. `npm run lint` and `npm run build` pass with zero errors.

---

## Checks to Run

- `npm run lint`
- `npm run build`

---

## Exact Manual Test Steps

1. Navigate to `http://localhost:3000/evidence` on a desktop viewport (≥ 1300px).
2. Verify all 3 panes are displayed side-by-side: Left Filter Rail, Center Table, Right Detail Pane.
3. Verify that the center table has **no horizontal scrollbar** and all columns (Title, Citation Key, Type, Year, Country, Impact Area, Classification) are fully displayed.
4. Click different evidence rows and verify the right detail pane updates immediately without any layout shift or overlap.
5. Perform a search (e.g. "agroforestry") and verify the Match score and bar render cleanly within the column layout without triggering horizontal scroll.
6. Resize the browser window to tablet width (~800px): verify the filter bar collapses to the top, table expands full width with no horizontal scroll, and detail preview is accessible below and via drawer.
7. Resize to mobile width (~375px - 420px): verify mobile row presentation, zero horizontal page scroll, and tapping a row opens the full detail drawer.
