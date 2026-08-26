# Prompt 59: Fix Evidence Table Container Overflow & Column Locking

## Goal

Completely eliminate the horizontal scrollbar and clipping in the Evidence Library (`/evidence`) central pane by:
1. Adding `containerClassName` to `components/ui/table.tsx` to prevent the wrapping `data-slot="table-container"` from hardcoding `overflow-x-auto`.
2. Explicitly setting `containerClassName="overflow-hidden w-full"` on the `Table` in `EvidenceTable`.
3. Adding `<colgroup>` with locked column widths (`table-fixed`) and compact badge labels ("Public", "Community", "Internal") for table rows in `ClassificationBadge` to guarantee 100% fit within the available central column width without overflowing under the right pane.
4. Ensuring clean 3-pane responsiveness across desktop (3 columns), laptop (top filter drawer + 2 columns), tablet (stacked layout + preview drawer), and mobile viewports.

---

## Skills Read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)

---

## Existing Code Inspected

- `components/ui/table.tsx` — `Table` component which had hardcoded `className="relative w-full overflow-x-auto"` on `data-slot="table-container"`, overriding parent container boundaries.
- `app/(app)/evidence/evidence-table.tsx` — Table structure, column widths, match indicator, and detail pane layout.
- `components/classification-badge.tsx` — Badge rendering in table cells and detail panels.
- `app/(app)/evidence/page.tsx` — Three-pane responsive grid.

---

## Decisions and Assumptions

1. **Table Container Control**:
   - `components/ui/table.tsx`'s `Table` component wraps `<table>` with `<div data-slot="table-container" className="relative w-full overflow-x-auto">`. Passing `className` to `Table` only styles the `<table>`, leaving the wrapper `div` with `overflow-x-auto`.
   - Adding `containerClassName?: string` allows callers like `EvidenceTable` to pass `containerClassName="overflow-hidden w-full"`, eliminating any unwanted scroll containers.
2. **Strict Fixed Column Budgeting with `<colgroup>`**:
   - Use `<colgroup>` with explicit percentage/fixed widths for `table-fixed`:
     - `Title`: flexible `w-auto min-w-[160px]`, `whitespace-normal break-words line-clamp-2`.
     - `Match` (when active): `w-[75px]`.
     - `Type`: `w-[70px]` (`hidden sm:table-column`, truncated).
     - `Year`: `w-[48px]` (`w-[48px]`, font-mono text-center).
     - `Country`: `w-[65px]` (`hidden md:table-column`, truncated).
     - `Impact Area`: `w-[105px]` (`hidden xl:table-column`, truncated with tooltip).
     - `Classification`: `w-[80px]` (`hidden sm:table-column`, compact badge).
3. **Compact ClassificationBadge Labels for Table Cells**:
   - When `compact={true}`, `ClassificationBadge` renders concise labels ("Public", "Community", "Internal") with the square glyph and semantic token ramp, taking only ~55-70px and preventing column expansion. Full labels ("Public — published", etc.) remain in the detail panel.

---

## Files Likely to Change

- `components/ui/table.tsx`
- `app/(app)/evidence/evidence-table.tsx`
- `components/classification-badge.tsx`

---

## Implementation Requirements

1. **Update `components/ui/table.tsx`**:
   - Support `containerClassName?: string` prop on `Table` component: `className={cn("relative w-full overflow-x-auto", containerClassName)}`.
2. **Update `components/classification-badge.tsx`**:
   - Support compact label mapping when `compact` is true:
     - `public_published` -> "Public"
     - `community_sourced` -> "Community"
     - `unpublished_internal` -> "Internal"
3. **Update `app/(app)/evidence/evidence-table.tsx`**:
   - Pass `containerClassName="overflow-hidden w-full"` to `Table`.
   - Define `<colgroup>` with `<col>` definitions for all columns.
   - Set `truncate` / `whitespace-normal` on all `TableCell` elements to prevent any cell from forcing horizontal expansion.
   - Verify that the right detail pane is cleanly side-by-side with `border-l` on laptop/desktop and stacked on mobile/tablet.

---

## Evidence Classification Impact

- **Classifications involved**: `public_published`, `community_sourced`, `unpublished_internal`.
- **Enforcement point**: Display formatting only. Retrieval filtering and AI gate rules remain unchanged.
- **Impact**: UI presentation refinement.

---

## Hallucination-Guard Implications

- **Impact**: None — no changes to fact-check pipelines or guard flags.

---

## Security Requirements

- DAL role checks (`requireStaffUser`) remain intact. External links keep `rel="noreferrer"`.

---

## Acceptance Criteria

1. The central pane table has zero horizontal scrollbar across all viewport sizes (desktop, laptop, tablet, mobile).
2. The right detail pane is cleanly separated by a border and never overlaps or covers any table column.
3. All table columns fit 100% within the available width with no clipping.
4. `npm run lint` and `npm run build` pass with zero errors.

---

## Checks to Run

- `npm run lint`
- `npm run build`

---

## Exact Manual Test Steps

1. Open `http://localhost:3000/evidence` on desktop (≥ 1300px).
2. Verify all 3 panes are displayed simultaneously.
3. Verify that the center table has **no horizontal scrollbar** and no columns are hidden or sliding under the right pane.
4. Resize browser to laptop width (~1100px), tablet width (~800px), and mobile width (~390px), verifying clean responsive layouts with zero horizontal scroll.
