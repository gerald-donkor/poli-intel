# Prompt 64 — Evidence Picker Bulk Selection UX & Actions

## Goal

Add a dedicated bulk selection control ("Select all" / "Clear all") to the Evidence Picker (`/briefs/new`) so users do not have to click evidence checkboxes one-by-one to populate the maximum context limit (up to 8 items). The control should seamlessly handle:
1. One-click "Select all" (capped at the 8-item context limit, prioritizing matched evidence then visible library items).
2. One-click "Clear all" / Deselect all.
3. Master checkbox with tri-state support (`checked`, `indeterminate`, `unchecked`).
4. Filter-aware selection (selecting all currently visible/filtered items up to the cap).
5. Full keyboard navigation, ARIA states, and mobile touch targets (≥44px).

---

## Skills read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `web-design-guidelines` (`.agents/skills/web-design-guidelines/SKILL.md`)

---

## Existing code inspected

- `app/(app)/briefs/new/page.tsx` — Evidence retrieval and prefill loading for the brief generator.
- `app/(app)/briefs/new/generate-form.tsx` — Form state management and `evidenceItemIds` form field wiring.
- `app/(app)/briefs/new/evidence-picker.tsx` — Context size counter, filter input, match list, and library checklist rows.
- `lib/briefs/generation-limits.ts` — `GENERATION_EVIDENCE_CONTEXT_SIZE` constant (= 8).

---

## Decisions and assumptions

1. **Context Cap Priority**: "Select all" fills up to `GENERATION_EVIDENCE_CONTEXT_SIZE` (8 items) in rank/display order (signal matched items first in rank order, followed by library items or filtered search results).
2. **Tri-State Checkbox + Clear Button**:
   - Master checkbox is `checked` if all available items (or the max cap of 8) are selected.
   - Master checkbox is `indeterminate` if 1 to 7 items are selected (when more items are available).
   - Master checkbox is `unchecked` when 0 items are selected.
   - Clicking the master checkbox toggles between selecting all (up to 8) and deselecting all.
   - An explicit "Clear" action button appears alongside the count whenever any items are selected.
3. **Filter Awareness**: When a search filter is active in the library list, "Select all" prioritizes the visible filtered items up to the 8-item limit.
4. **Governed State Integrity**: Bulk selection only operates on the already-gated, eligible evidence list provided to the picker. It never bypasses the server-side re-verification gate inside `startBriefGeneration`.

---

## Files likely to change

- `app/(app)/briefs/new/evidence-picker.tsx`
- `app/(app)/briefs/new/generate-form.tsx`

---

## Implementation requirements

1. **Evidence Picker Bulk Selection Bar (`evidence-picker.tsx`)**:
   - In the evidence selection sub-header (beside `{selectedIds.length} / 8 selected`), render a bulk action bar with:
     - Master `Checkbox` and clickable label (`Select all (up to 8)` or `Select visible (up to 8)` when filtered).
     - Support indeterminate state (`checked="indeterminate"` or `checked="mixed"`) when partially selected.
     - "Clear" button (`variant="ghost"`, compact `h-7 text-[11.5px] text-ink-3 hover:text-ink cursor-pointer`) visible when `selectedIds.length > 0`.
   - Clicking "Select all" gathers the candidate IDs in order:
     - If matched items exist, include them first.
     - Include library items (or filtered library items if search query is active).
     - Slice to `GENERATION_EVIDENCE_CONTEXT_SIZE` (8 items).
     - Call `onSetSelected(newIds)` to update the form state in one atomic update.
   - Clicking "Clear" or unchecking the master checkbox calls `onSetSelected([])` to deselect all.

2. **Form Integration (`generate-form.tsx`)**:
   - Provide `onSetSelected: (ids: string[]) => void` callback to `EvidencePicker` that calls `form.setValue("evidenceItemIds", ids, { shouldValidate: form.formState.isSubmitted })`.
   - Maintain individual row toggle functionality via `onToggle`.

3. **Accessibility & Design Tokens**:
   - Keyboard accessible (`Tab`, `Space`, `Enter`).
   - Monospace tabular numbers for the counter.
   - `cursor-pointer` on all interactive labels, buttons, and checkboxes.
   - Touch targets ≥44px on mobile viewports.

---

## Evidence classification impact

**None — no evidence data path modification.**
- Bulk selection is a client-side selection convenience on the already-gated `listEligibleEvidence` items.
- The server-side governance gate in `startBriefGeneration` (`app/(app)/briefs/new/actions.ts`) continues to re-read and re-validate every selected ID against `gateEvidenceForGeneration` before any Gemini model call.

---

## Hallucination-guard implications

**None.**
- No changes to fact-checking, claim extraction, or flag rendering.

---

## Security requirements

- No untrusted or unclassified evidence is introduced.
- All form inputs continue to validate against `generateBriefSchema`.

---

## Acceptance criteria

1. Navigating to `/briefs/new` displays the bulk selection bar beside the context count (`X / 8 selected`).
2. Clicking "Select all" (or checking the master checkbox) selects the top 8 eligible evidence items in one action.
3. When partially selected (1–7 items), the master checkbox displays an indeterminate visual state.
4. Clicking "Clear" or unchecking the master checkbox clears all selections.
5. When filtering with search text, "Select all" selects the visible matching items up to the cap.
6. Individual item selection via row checkboxes continues to work as before.
7. Mobile and desktop layouts are fully responsive with no overflow.

---

## Checks to run

- `npm run build` — Verify compilation and types.
- `npm run lint` — Linting check.
- `npm test` — Playwright regression suite.

---

## Manual test steps

1. Navigate to `/briefs/new`.
2. Observe the evidence count `0 / 8 selected` and the "Select all" master checkbox.
3. Click "Select all": verify that 8 items are selected at once, the counter shows `8 / 8 selected`, and the master checkbox becomes checked.
4. Click "Clear": verify all selections are cleared and the counter returns to `0 / 8 selected`.
5. Check 2 items individually: verify the master checkbox displays the indeterminate dash mark.
6. Type a filter term in the search box (e.g. "Juabeso") and click "Select all": verify filtered items are selected up to the context cap.
