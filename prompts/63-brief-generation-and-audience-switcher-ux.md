# Prompt 63 — Brief Generation & Audience Switcher UX Refinement

## Goal

Refine the Brief Generation workspace (`/briefs/new`), the 3-Stage Generation Stepper, the Audience Switcher (`/briefs/[id]`), and the Audience Reframing & Diff workspace (`/briefs/[id]/reframe`) to deliver a calm, credible, and fully responsive brief creation experience for Tropenbos Ghana. This includes:
1. **Brief Generation Form (`/briefs/new`)**: Responsive 2-column composition with character count formatting, radio options with distinct selected styles, public-only policy warning banner, and signal prefill card integration with urgency left borders.
2. **3-Stage Generation Stepper (`generation-stepper.tsx`)**: Real-request progress visualization ("Reading evidence" → "Drafting" → "Verifying citations") with square glyph markers, active-stage 2s opacity breath loop (`0.85–1.0`), halted/paused state handling, and zero indeterminate spinners.
3. **Rate-Limit & Governance Refusal Recovery (`generate-form.tsx` & `reframe-run.tsx`)**: Structured refusal alerts in slate/immediate palettes with retry countdown timing and one-click draft resumption from the interrupted stage without losing input or regenerations.
4. **Audience Switcher (`/briefs/[id]`)**: 5-audience tabs with 260ms smooth crossfade, framing emphasis and tone details, and anchored citation chips utilizing Motion `LayoutGroup` / `layoutId` that animate position without remounting.
5. **Audience Reframing & Section-Altitude Diff (`/briefs/[id]/reframe`)**: Pre-reframe cost explanation, 3-stage reframing run, and section-by-section diff view (`Reframed`, `Unchanged`, `New section`, `Not in the reframed draft`) with side-by-side framing comparisons, Source Serif 4 quoted excerpts, and Plex Mono summary metrics.

---

## Skills read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)
- `brief-output` (`.claude/skills/brief-output/SKILL.md`)
- `gemini-integration` (`.claude/skills/gemini-integration/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `web-design-guidelines` (`.agents/skills/web-design-guidelines/SKILL.md`)

---

## Existing code inspected

- `app/(app)/briefs/new/page.tsx` — Brief generation page shell, role check, breadcrumbs, classification-pending banner.
- `app/(app)/briefs/new/generate-form.tsx` — Form layout, radio group selection, refusal panels, submission handling.
- `app/(app)/briefs/new/generation-stepper.tsx` — 3-stage progress stepper, active breathing indicator, square markers.
- `app/(app)/briefs/new/evidence-picker.tsx` — Evidence selection checklist, context size counter, rerank scores, search filter.
- `app/(app)/briefs/new/signal-context.tsx` — Signal prefill card, urgency left border, source link.
- `app/(app)/briefs/new/actions.ts` — Server Actions for 3-stage generation pipeline and governance verification.
- `app/(app)/briefs/[id]/audience-switcher.tsx` — Audience tab switcher, motion layout group, citation chip list.
- `app/(app)/briefs/[id]/reframe/page.tsx` — Reframe entry page, status/role verification, audience profile resolution.
- `app/(app)/briefs/[id]/reframe/reframe-run.tsx` — Reframe runner, 3-stage execution, rate-limit recovery, commit/discard actions.
- `app/(app)/briefs/[id]/reframe/reframe-diff.tsx` — Section-altitude diff display, framing comparisons, metrics summary.
- `app/globals.css` — `@keyframes breathe` and `--animate-breathe` token.
- `design_handoff_evibrief/design-system.md` — Component mapping, motion constraints, typography rules, and responsive grid recipes.

---

## Decisions and assumptions

1. **Square Glyphs for Stepper & Governance**: Stepper stage markers and governance alerts strictly use square glyphs (`size-2.5 rounded-[1px]`), preserving circular marks exclusively for hallucination-guard review flags.
2. **Breathing Animation Isolation**: The active stage in `GenerationStepper` uses the 2s `0.85–1.0` opacity breath (`animate-breathe`), which is the only allowed looping animation in the entire application. When halted or under `prefers-reduced-motion`, it settles immediately to static opacity.
3. **Draft Preservation on Rate Limit**: If Gemini returns a 429 rate limit during drafting or verification, the state transitions to a halted alert with retry countdown while keeping the draft inputs, selected evidence, and attempt ID intact so the user can resume cleanly.
4. **Position-Anchored Citation Chips**: Citation chips in the Audience Switcher stay outside the tab panels and use Motion `LayoutGroup` + `layoutId="citation-[id]"` + `layout="position"` to smoothly animate into place when tab height changes, reinforcing that the evidence remains constant while framing shifts.
5. **Section-Altitude Diff (No Stoplight Colors)**: Reframe diffing avoids word-level red/green noise. It presents section-level status (`Reframed`, `Unchanged`, `New section`, `Not in reframed draft`) with `surface-tint` and `stone` left border indicators.

---

## Files likely to change

- `app/(app)/briefs/new/page.tsx`
- `app/(app)/briefs/new/generate-form.tsx`
- `app/(app)/briefs/new/generation-stepper.tsx`
- `app/(app)/briefs/new/evidence-picker.tsx`
- `app/(app)/briefs/new/signal-context.tsx`
- `app/(app)/briefs/[id]/audience-switcher.tsx`
- `app/(app)/briefs/[id]/reframe/page.tsx`
- `app/(app)/briefs/[id]/reframe/reframe-run.tsx`
- `app/(app)/briefs/[id]/reframe/reframe-diff.tsx`

---

## Implementation requirements

1. **Brief Generation Page & Form Polish (`/briefs/new`)**:
   - Header with clear breadcrumbs: `Briefs > New draft`.
   - Classification pending banner positioned above the fold.
   - Signal prefill card with 3px urgency left border (`border-immediate`, `border-nearterm`, etc.), relevance badge, landscape context, and external link with `cursor-pointer`.
   - Public policy notice in `Alert variant="pending"` advising that text will be sent to the model and must not contain confidential field data.
   - Textarea with monospace character counter (`tabular-nums`) and clear validation feedback.
   - Brief Type & Audience radio options: Card-like rows with `border-surface-tint-border bg-surface-tint` on selection, hover borders (`hover:border-sage`), and clear meta tags (`length target`, `word count`, `tone`, `framing emphasis`).
   - Evidence Picker: Context limit indicator (`X / 8 selected`), search filter within eligible evidence, rerank score rendering with `number + bar` cell in Plex Mono, clear distinction between matched and library items, and disabled state when at context cap.
   - Submit buttons with clear loading text (`Generating…`, `Resume generation`), cancel button, and research assistant disclaimer.

2. **3-Stage Stepper Component (`generation-stepper.tsx`)**:
   - Real-time progress bar reflecting current step completion percentage (`0%`, `33%`, `66%`, `100%`).
   - Step list:
     - Stage 1: `Reading evidence`
     - Stage 2: `Drafting`
     - Stage 3: `Verifying citations`
   - Completed stages show filled `bg-primary border-primary` square glyph and `text-ink-2`.
   - Active stage shows square outline `border-primary`, `text-ink font-medium`, and `animate-breathe` (2s opacity 0.85–1.0).
   - Halted stage displays static square outline with clear stalled indicator.
   - Zero indeterminate spinners anywhere in the component.

3. **Rate-Limit & Governance Refusal Feedback (`generate-form.tsx` & `reframe-run.tsx`)**:
   - `RefusalPanel` handles `refused-ineligible-classification` with square glyph alert listing de-classified items and link to classification queue.
   - `RefusalPanel` handles `rate-limited` in slate alert (`Alert variant="guard"`) with circular guard icon and retry countdown timing in minutes, preserving state to allow "Resume generation".
   - `RefusalPanel` handles `unauthorised` or `generation-failed` gracefully without generic red error boxes.

4. **Audience Switcher Polish (`audience-switcher.tsx`)**:
   - 5 audience tabs (`Ghana Ministry Official`, `Cocoa Company Sustainability Team`, `EU Regulator / DG ENV`, `Donor / Programme Officer`, `CREMA Community Governance`).
   - Active/current audience tab displays small-caps `Current` indicator.
   - 260ms smooth crossfade transition on tab content change, respecting `useReducedMotion()`.
   - Framing emphasis and tone details clearly displayed in a 2-column definition list.
   - Anchored citation chips wrapped in `LayoutGroup` with `layoutId="citation-[id]"` and `layout="position"` animating position smoothly across height shifts without unmounting.
   - Clear "Reframe for [Audience]" action button with explanatory note.

5. **Audience Reframe Workspace & Section-Altitude Diff (`/briefs/[id]/reframe`)**:
   - Pre-flight confirmation panel in `reframe-run.tsx` explaining what reframing does and what it costs.
   - 3-stage stepper execution matching the generation form.
   - Section-altitude diff (`reframe-diff.tsx`):
     - Metric summary row in Plex Mono (`X sections reframed · Y unchanged · Z new`).
     - Distinct section blocks with 3px left border (`border-surface-tint-border` for Reframed/New, `border-stone border-dashed` for Removed, `border-line` for Unchanged).
     - Side-by-side framing comparison (Current vs. Reframed) that collapses cleanly to a single stacked column on mobile/tablet viewports.
     - Source excerpts and verbatim policy text set strictly in `Source Serif 4` with accent border.
   - Sticky bottom decision bar allowing the user to "Commit reframed version" (advances brief version) or "Discard reframed draft".

6. **Responsiveness & Accessibility**:
   - Responsive scaling across 320px, 390px, 760px, 1000px, 1300px, and 1600px+.
   - Touch targets ≥44px on mobile, `cursor-pointer` on all interactive radio options, checkboxes, tabs, and buttons.
   - Full keyboard navigation and ARIA attributes for all steppers, tabs, radio groups, and diff containers.

---

## Evidence classification impact

**Touches AI pipeline generation and reframing entry points.**
- **Classifications involved**: Only `public_published` evidence is eligible.
- **Enforcement point**: Enforced server-side inside `startBriefGeneration` (`app/(app)/briefs/new/actions.ts`) and `startBriefReframe` (`app/(app)/briefs/[id]/reframe/actions.ts`) via `gateEvidenceForGeneration` in `lib/ai/evidence-context.ts`.
- **Refusal handling**: If any selected evidence is `community_sourced` or `unpublished_internal`, the actions return a typed `refused-ineligible-classification` response, rendered in the UI as an immediate-ramp square-glyph alert with links to the governance queue (`/evidence/queue`).

---

## Hallucination-guard implications

**No fact-check pass modifications.**
- The fact-check pass runs automatically in stage 3 (`verifyBriefAction` and `verifyReframeAction`) before any brief or reframed version is persisted.
- Unresolved flags continue to be stored as structured records and block Programme Director approval.
- Flag display and review mechanisms adhere to the slate styling and 900ms pulse visual contract.

---

## Security requirements

- Server Actions strictly authenticate and authorize caller roles (`Policy & Advocacy Officer`, `Programme Director`) before initiating brief generation or reframing.
- No prompt, completion, or unclassified evidence text is leaked to client logs, Sentry, or PostHog.

---

## Acceptance criteria

1. Navigating to `/briefs/new` displays the refined 2-column generation form with public policy notice, responsive radio options, and evidence picker.
2. Generating a brief triggers the 3-stage stepper with square markers, progress bar increments, and a 2s opacity breath loop on the active step without any indeterminate spinner.
3. Hitting a rate limit pauses generation, shows a slate alert with estimated retry countdown, and enables "Resume generation" without losing input or completed stages.
4. On `/briefs/[id]`, switching audience tabs displays a 260ms prose crossfade while citation chips smoothly animate their positions without reloading.
5. Initiating a reframe runs through the 3-stage sequence and displays the section-altitude diff with side-by-side framing comparison, summary metrics, and commit/discard actions.
6. All views are fully responsive from 320px to 1600px+ with zero horizontal page overflow, ≥44px tap targets, and `cursor-pointer` on all interactive controls.

---

## Checks to run

- `npm run build` — Typecheck and build verification.
- `npm run lint` — Linting check across owned code.
- `npx playwright test` — Run existing regression test suites.

---

## Manual test steps

1. Navigate to `/briefs/new` as a Policy & Advocacy Officer or Programme Director.
2. Verify breadcrumbs, public policy alert, textarea character counter, and radio option selection styling.
3. Select evidence items up to the 8-item limit and verify the selection counter and score bars.
4. Submit the form and observe the 3-stage stepper: verify square markers, progress bar updates, and the 2s opacity breath loop on the active stage.
5. Open an existing brief at `/briefs/[id]`, interact with the Audience Switcher tabs, and verify the 260ms prose crossfade and smooth position animation of the citation chips.
6. Click "Reframe for [Audience]", verify the pre-flight description, execute the reframe, and inspect the section-altitude diff with framing comparisons.
7. Test viewport responsiveness at 390px, 760px, 1000px, and 1300px to ensure proper stacking and no horizontal overflow.
