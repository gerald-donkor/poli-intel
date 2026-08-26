# Prompt 62: Fix Classification Column Fit and Full Table Visibility

## Goal

Ensure the entire **"CLASSIFICATION"** column (both header and status badges) is 100% fully visible inside the table boundary with zero edge-clipping by:
1. Re-budgeting fixed column widths (`Type`: `82px`, `Year`: `44px`, `Country`: `75px`, `Impact area`: `115px`, `Classification`: `110px`, `Match`: `70px`, `Title`: flexible `w-auto`) to guarantee total column width is always ≤ container width (~670px available on 1300px desktop).
2. Adjusting header typography for "CLASSIFICATION" (`text-[11px] font-semibold tracking-normal uppercase`) to fit cleanly within `110px` without edge clipping.
3. Preserving zero text truncation (`...`), natural multi-line wrapping (`whitespace-normal break-words leading-tight`), and `align-top` row alignment.

---

## Skills Read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)

---

## Existing Code Inspected

- `app/(app)/evidence/evidence-table.tsx` — Table column definitions in `<colgroup>`, `<TableHeader>`, and `<TableBody>`.
- User screenshot `/home/dg/Pictures/screenshot-2026-08-26_14-24-38.png` showing the right edge of the table clipping the letters "ION" of "CLASSIFICATION" due to column widths exceeding available container space at 1300px.

---

## Decisions and Assumptions

1. **Root Cause Analysis**:
   - On a standard 1300px desktop screen, with the 216px Left Filter Rail and 340px Right Detail Pane, the available width for the Central Table is ~672px.
   - The previous column budget totaled 530px of fixed columns + 200px min-width on Title = 730px. Because 730px > 672px, the table overflowed by ~58px, causing the right edge of the last column ("CLASSIFICATION") to be sliced off by `overflow-hidden`.
2. **Proportional Column Budgeting**:
   - Fixed columns sum:
     - `Type`: `w-[82px]` (fits "Literature", "Field data", "Research")
     - `Year`: `w-[44px]` (centered font-mono)
     - `Country`: `w-[75px]` (wraps "European Union" cleanly onto 2 lines)
     - `Impact Area`: `w-[115px]` (wraps impact area descriptions cleanly)
     - `Classification`: `w-[110px]` (fits "CLASSIFICATION" header and badge)
     - `Match` (when active): `w-[70px]`
   - Total fixed column sum = **426px** (or 496px with Match).
   - `Title`: flexible `w-auto min-w-0` (takes remaining ~246px+ and wraps naturally).
   - Total table width = **672px** = **100% of container width**. Nothing overflows, and the Classification column is 100% fully displayed inside the table boundaries.

---

## Files Likely to Change

- `app/(app)/evidence/evidence-table.tsx`

---

## Implementation Requirements

1. Update `app/(app)/evidence/evidence-table.tsx`:
   - Adjust `<colgroup>` with:
     - `<col className="w-auto min-w-0" />` (Title)
     - `<col className="w-[70px]" />` (Match, when active)
     - `<col className="hidden sm:table-column w-[82px]" />` (Type)
     - `<col className="w-[44px]" />` (Year)
     - `<col className="hidden md:table-column w-[75px]" />` (Country)
     - `<col className="hidden xl:table-column w-[115px]" />` (Impact area)
     - `<col className="hidden sm:table-column w-[110px]" />` (Classification)
   - Update `<TableHead>` and `<TableCell>` classes to match these column widths and padding (`px-2.5 py-3`).
   - Set Classification `<TableHead>` to `text-[11px] font-semibold tracking-normal uppercase w-[110px]`.
   - Maintain `align-top`, `whitespace-normal break-words leading-tight`, and zero truncation (`...`) across all rows.

---

## Evidence Classification Impact

- **Classifications involved**: `public_published`, `community_sourced`, `unpublished_internal`.
- **Enforcement point**: Table rendering in `/evidence`.
- **Impact**: UI presentation refinement; no changes to data classification gate or retrieval.

---

## Hallucination-Guard Implications

- **Impact**: None.

---

## Security Requirements

- DAL role checks remain intact.

---

## Acceptance Criteria

1. The "CLASSIFICATION" column header and all classification badges are 100% fully displayed with zero edge-clipping.
2. All column text displays in full without any `...` truncation.
3. The table fits 100% within the central pane with no horizontal scrolling or overflow.
4. `npm run lint` and `npm run build` pass with zero errors.

---

## Checks to Run

- `npm run lint`
- `npm run build`

---

## Exact Manual Test Steps

1. Open `http://localhost:3000/evidence` in the browser.
2. Verify that the table header shows the complete text **"CLASSIFICATION"** inside the right border with comfortable margins.
3. Verify that all rows in the Classification column render their full badge without clipping.
4. Verify that all other columns (Title, Type, Year, Country, Impact Area) remain completely visible without any `...` truncation.
