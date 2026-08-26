# Prompt 60: Evidence Table Column Sizing & Full Text Display

## Goal

Ensure all cell text in the Evidence Library central table ([`app/(app)/evidence/evidence-table.tsx`](file:///home/dg/Projects/nextjs/poli-intel/app/(app)/evidence/evidence-table.tsx)) fully and clearly displays without truncation:
1. **Source Type**: Expand column width from `70px` to `92px` with `whitespace-nowrap text-[12px]`, allowing "Research", "Field data", and "Literature" to render in full without clipping ("Resear...", "Field d...", "Literat...").
2. **Country**: Expand column width from `65px` to `95px` with graceful line-wrapping (`whitespace-normal break-words leading-tight text-[12px]`), so longer geographies like "European Union" or "International" display cleanly without being cut off into "Europ...".
3. **Impact Area**: Expand column width from `105px` to `145px` with multiline wrapping (`whitespace-normal break-words leading-tight text-[11.5px]`), ensuring "Community forestry", "Diversified production", "Restoration", and "Cross-cutting" display their complete names without ellipsis truncation ("Community f...", "Diversified pr...").
4. **Year & Classification**: Maintain proportional sizing (`w-[48px]` for Year, `w-[88px]` for Classification badge) so the entire table remains 100% within the container width with zero horizontal scrollbar while giving every column adequate breathing room.

---

## Skills Read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)

---

## Existing Code Inspected

- [`app/(app)/evidence/evidence-table.tsx`](file:///home/dg/Projects/nextjs/poli-intel/app/(app)/evidence/evidence-table.tsx) — `<colgroup>` definitions, `TableHead`, and `TableCell` column styling with restrictive fixed widths and `truncate` classes.
- [`app/(app)/evidence/labels.ts`](file:///home/dg/Projects/nextjs/poli-intel/app/(app)/evidence/labels.ts) — Human-readable labels for `EVIDENCE_SOURCE_TYPE_LABELS` and `IMPACT_AREA_LABELS`.
- [`app/(app)/evidence/page.tsx`](file:///home/dg/Projects/nextjs/poli-intel/app/(app)/evidence/page.tsx) — Evidence Library responsive layout grid and filter bar.
- `screenshot-2026-08-26_12-10-05.png` — User-provided screenshot highlighting truncated metadata columns ("Resear...", "Field d...", "Europ...", "Community f...", "Diversified pr...").

---

## Decisions and Assumptions

1. **Eliminate Restrictive `truncate` on Metadata Columns**:
   - The `Type`, `Country`, and `Impact area` columns contain critical taxonomy values that must be immediately legible to research and policy officers at a glance.
   - Removing `truncate` and applying `whitespace-normal break-words leading-tight` (or `whitespace-nowrap` for short known values like Type) ensures that text never renders with an ellipsis (`...`).
2. **Harmonious `<colgroup>` Column Budgeting**:
   - Sizing budget inside the table container (typically ~810px on desktop):
     - `Title`: Flexible `w-auto min-w-[180px]`, `line-clamp-2 leading-snug`.
     - `Match` (when active): `w-[80px]`.
     - `Type`: `w-[92px]` (`hidden sm:table-column`, `whitespace-nowrap`).
     - `Year`: `w-[48px]` (`w-[48px]`, font-mono text-center).
     - `Country`: `w-[95px]` (`hidden md:table-column`, `whitespace-normal break-words`).
     - `Impact Area`: `w-[145px]` (`hidden xl:table-column`, `whitespace-normal break-words`).
     - `Classification`: `w-[88px]` (`hidden sm:table-column`, compact badge).
3. **Zero Horizontal Overflow Preservation**:
   - Sizing ensures the table perfectly fits within the `grid laptop:grid-cols-[1fr_320px] desktop:grid-cols-[1fr_340px]` layout with no horizontal scrollbar or clipping across all viewports.

---

## Files Likely to Change

- `app/(app)/evidence/evidence-table.tsx` [MODIFY] — Adjust `<colgroup>` col widths, remove `truncate` from metadata cells, and apply clean text wrapping and typography.

---

## Implementation Requirements

1. **Update `app/(app)/evidence/evidence-table.tsx`**:
   - Update `<colgroup>`:
     ```tsx
     <colgroup>
       <col className="w-auto" />
       {showMatch ? <col className="w-[80px]" /> : null}
       <col className="hidden sm:table-column w-[92px]" />
       <col className="w-[48px]" />
       <col className="hidden md:table-column w-[95px]" />
       <col className="hidden xl:table-column w-[145px]" />
       <col className="hidden sm:table-column w-[88px]" />
     </colgroup>
     ```
   - Update `<TableHead>` elements to match widths and padding.
   - Update `Type` `<TableCell>`: Replace `truncate w-[70px]` with `w-[92px] whitespace-nowrap text-[12px]`.
   - Update `Country` `<TableCell>`: Replace `truncate w-[65px]` with `w-[95px] whitespace-normal break-words leading-tight text-[12px]`.
   - Update `Impact area` `<TableCell>`: Replace `truncate w-[105px]` with `w-[145px] whitespace-normal break-words leading-tight text-[11.5px]`.
   - Update `Classification` `<TableCell>`: Set `w-[88px]`.

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

- DAL role checks (`requireStaffUser`) remain intact.

---

## Acceptance Criteria

- [ ] All source types ("Research", "Field data", "Literature") display in full without truncation.
- [ ] All countries ("Ghana", "European Union", etc.) display in full without being cut off into "Europ...".
- [ ] All impact areas ("Community forestry", "Diversified production", "Restoration", "Cross-cutting") display in full with clean wrapping where necessary, without ellipsis clipping ("Community f...").
- [ ] The table maintains a clean, balanced layout with zero horizontal scrollbars on desktop, laptop, tablet, and mobile.
- [ ] `npm run lint` and `npm run build` pass with zero errors.

---

## Checks to Run

- `npm run lint`
- `npm run build`

---

## Exact Manual Test Steps

1. Open `http://localhost:3000/evidence` in the browser.
2. Inspect the central evidence table rows.
3. Verify that the "Type", "Country", and "Impact Area" columns all display their full, unabbreviated text clearly (e.g. "Research", "European Union", "Community forestry", "Diversified production").
4. Verify that table headers and cells are aligned and legible with no horizontal scrollbar.
