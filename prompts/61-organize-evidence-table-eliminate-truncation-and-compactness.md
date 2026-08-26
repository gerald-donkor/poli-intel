# Prompt 61: Organize Evidence Table, Eliminate Text Truncation & Improve Spacing

## Goal

Redesign the Evidence Library (`/evidence`) table layout to be spacious, well-organized, and readable with **zero text truncation (`...`) across all columns**:
1. Remove all `line-clamp-2` and `truncate` classes from Title, Citation Key, Type, Country, and Impact Area.
2. Enable clean natural multi-line text wrapping (`whitespace-normal break-words leading-relaxed`) with `align-top` vertical alignment.
3. Fix column header collision (e.g. "COUNTRY" and "IMPACT AREA") by providing generous horizontal cell padding (`px-3.5` to `px-4`) and comfortable column widths.
4. Ensure full text visibility with zero horizontal scrolling and a clean, spacious 3-pane layout on desktop, laptop, tablet, and mobile viewports.

---

## Skills Read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)

---

## Existing Code Inspected

- `app/(app)/evidence/evidence-table.tsx` — Table column definitions, cell truncation, and padding.
- `components/classification-badge.tsx` — Classification badge styling.
- User screenshot `/home/dg/Pictures/screenshot-2026-08-26_13-38-50.png` showing cramped columns, text clipped with `...` in Title, Type, Country, and Impact Area, and colliding header labels.

---

## Decisions and Assumptions

1. **Eliminate All Text Truncation (`...`)**:
   - Remove `truncate` and `line-clamp-2` from every table cell.
   - Apply `whitespace-normal break-words leading-snug` to all text columns (Title, Citation Key, Type, Country, Impact Area).
   - Set table cells to `align-top` so multi-line text wraps cleanly and lines up neatly at the top of each row.
2. **Generous Column Spacing & Proportions**:
   - Update `<colgroup>` and `<TableHead>` / `<TableCell>` widths and padding:
     - `Title`: flexible `w-auto min-w-[200px]`, wraps title and citation key fully without clipping.
     - `Match` (when active): `w-[85px]` with number + visual bar.
     - `Type`: `w-[95px]` (`hidden sm:table-column`, wraps cleanly).
     - `Year`: `w-[55px]` (font-mono text-center).
     - `Country`: `w-[100px]` (`hidden md:table-column`, wraps multi-word countries cleanly).
     - `Impact Area`: `w-[150px]` (`hidden xl:table-column`, wraps impact area names cleanly).
     - `Classification`: `w-[130px]` (`hidden sm:table-column`, renders badge with square glyph).
   - Apply `px-3.5 py-3` cell padding across all headers and cells to prevent column collisions.
3. **Table & Detail Layout Harmony**:
   - Maintain the clean responsive 3-pane layout (`desktop:grid-cols-[216px_minmax(0,1fr)]` on page, `laptop:grid-cols-[1fr_320px] desktop:grid-cols-[1fr_340px]` inside `EvidenceTable`), with zero horizontal scrollbar and seamless reflow on tablet and mobile viewports.

---

## Files Likely to Change

- `app/(app)/evidence/evidence-table.tsx`
- `components/classification-badge.tsx`

---

## Implementation Requirements

1. Update `app/(app)/evidence/evidence-table.tsx`:
   - Remove all instances of `truncate`, `line-clamp-*`, and `whitespace-nowrap` from table cells and title buttons.
   - Apply `whitespace-normal break-words align-top leading-snug` to all `TableCell` elements.
   - Adjust `<colgroup>` and `<TableHead>` / `<TableCell>` column widths to generous, well-proportioned dimensions (`Title`: flexible, `Type`: `w-[95px]`, `Year`: `w-[55px]`, `Country`: `w-[100px]`, `Impact area`: `w-[150px]`, `Classification`: `w-[130px]`, `Match`: `w-[85px]`).
   - Use `px-3.5 py-3` padding for all table headers and cells to ensure clear spacing between columns.
2. Update `components/classification-badge.tsx`:
   - Ensure the badge inside table cells renders cleanly with proper spacing and square glyph without truncation.

---

## Evidence Classification Impact

- **Classifications involved**: `public_published`, `community_sourced`, `unpublished_internal`.
- **Enforcement point**: Display formatting in table and detail pane.
- **Impact**: UI presentation refinement; no changes to data classification gate or retrieval.

---

## Hallucination-Guard Implications

- **Impact**: None.

---

## Security Requirements

- DAL role checks remain intact.

---

## Acceptance Criteria

1. All text in the Evidence Library table appears completely with **zero `...` truncation** in Title, Citation Key, Type, Country, or Impact Area.
2. Column headers have distinct visual spacing with no text collisions (e.g. between "COUNTRY" and "IMPACT AREA").
3. Multi-line table rows wrap naturally with `align-top` alignment and clean row padding.
4. Central table maintains zero horizontal scrolling.
5. `npm run lint` and `npm run build` pass with zero errors.

---

## Checks to Run

- `npm run lint`
- `npm run build`

---

## Exact Manual Test Steps

1. Open `http://localhost:3000/evidence` in the browser on desktop view (≥ 1300px).
2. Verify that long titles (e.g. "Fighting over forest: interactive governance of conflicts over forest and tree resources in Ghana") wrap cleanly onto multiple lines without `...`.
3. Verify that Type (e.g. "Literature", "Field data"), Country (e.g. "European Union", "Ghana"), and Impact Area (e.g. "Community forestry", "Diversified production") display their full text with no `...` truncation.
4. Verify that column headers have clear gaps and do not collide.
5. Resize to laptop, tablet, and mobile widths to confirm smooth responsive wrapping with no horizontal scrollbar.
