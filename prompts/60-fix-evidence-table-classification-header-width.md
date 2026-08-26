# Prompt 60: Fix Evidence Table Classification Header Width & Column Budgeting

## Goal

Ensure the "CLASSIFICATION" header text in the Evidence Library (`/evidence`) table displays fully without truncation or clipping (currently clipped as "CLASSIFICAT") by expanding the Classification column width budget to `112px` and tuning adjacent column widths.

---

## Skills Read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)

---

## Existing Code Inspected

- `app/(app)/evidence/evidence-table.tsx` — Table column definitions in `<colgroup>`, `<TableHeader>`, and `<TableBody>`.
- User screenshot `/home/dg/Pictures/screenshot-2026-08-26_12-18-21.png` showing the "CLASSIFICATION" header clipped to "CLASSIFICAT" due to `w-[80px]` constraint.

---

## Decisions and Assumptions

1. **Classification Column Width**:
   - The uppercase text "CLASSIFICATION" with tracking requires ~95px-100px.
   - Expand the Classification column in `<colgroup>`, `<TableHead>`, and `<TableCell>` to `w-[112px]`.
   - Set header tracking to `tracking-[0.04em]` and `text-[11px]` to ensure comfortable fit and alignment with the design system.
2. **Column Width Rebalancing**:
   - Rebalance fixed column widths:
     - `Type`: `w-[68px]` (`hidden sm:table-column`)
     - `Year`: `w-[42px]` (text-center)
     - `Country`: `w-[60px]` (`hidden md:table-column`)
     - `Impact Area`: `w-[100px]` (`hidden xl:table-column`)
     - `Classification`: `w-[112px]` (`hidden sm:table-column`)
     - `Match` (when searching): `w-[75px]`
     - `Title`: flexible `w-auto`
   - Total fixed column sum = 382px (or 457px with Match), leaving ample room (300px+) for the Title column on all desktop/laptop viewports without horizontal overflow.

---

## Files Likely to Change

- `app/(app)/evidence/evidence-table.tsx`

---

## Implementation Requirements

1. Update `app/(app)/evidence/evidence-table.tsx`:
   - Adjust `<colgroup>` with `<col className="hidden sm:table-column w-[112px]" />` for Classification.
   - Adjust `<TableHead>` for Classification: `w-[112px] text-[11px] tracking-[0.04em]` so the full word "CLASSIFICATION" renders cleanly.
   - Adjust `<TableCell>` for Classification: `w-[112px]`.
   - Ensure `Type` (`w-[68px]`), `Year` (`w-[42px]`), `Country` (`w-[60px]`), and `Impact Area` (`w-[100px]`) remain proportional and never cause horizontal scroll.

---

## Evidence Classification Impact

- **Classifications involved**: `public_published`, `community_sourced`, `unpublished_internal`.
- **Enforcement point**: Display formatting in table header and cells.
- **Impact**: UI presentation refinement; no changes to data classification gate or retrieval.

---

## Hallucination-Guard Implications

- **Impact**: None.

---

## Security Requirements

- DAL role checks remain intact.

---

## Acceptance Criteria

1. The "CLASSIFICATION" header text in the Evidence Library table displays completely with no clipped letters.
2. The table remains 100% responsive with zero horizontal scrolling.
3. `npm run lint` and `npm run build` pass with zero errors.

---

## Checks to Run

- `npm run lint`
- `npm run build`

---

## Exact Manual Test Steps

1. Open `http://localhost:3000/evidence` in the browser.
2. Check the table header and verify that "CLASSIFICATION" is fully visible and not cut off.
3. Verify that the table continues to have no horizontal scrollbar across desktop, laptop, and tablet viewports.
