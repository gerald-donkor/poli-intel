# Prompt 65 — Brief Editor, Hallucination Guard & Twi UX Refinement

## Goal

Refine the existing brief review and editor experience so a Tropenbos Ghana staff member can edit a draft, inspect citations, resolve hallucination-guard flags, and request Twi key-message rendering without losing context or confusing review states. This is the next unbuilt refinement surface after the Brief Generation & Audience Switcher UX work: it governs whether a draft is readable, traceable, and reviewable before any Director approval or community-facing use.

The scope is UX and interaction polish on the already-built surfaces, not a schema rewrite and not a new AI pipeline:

1. `/briefs/[id]/edit` document canvas, section navigation, citation insertion, citation side sheet, save-state feedback, and responsive editor grid.
2. `/briefs/[id]` hallucination-guard panel, flag resolution controls, Director approval block, citation list, and export notice placement.
3. `/briefs/[id]` Twi translation assist panel, including current/stale/empty/running/refused states.
4. Inline Tiptap citation chip and hallucination-flag mark styling where needed to meet the visual contract.

## Skills read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)
- `hallucination-guard` (`.claude/skills/hallucination-guard/SKILL.md`)
- `tiptap-editor` (`.claude/skills/tiptap-editor/SKILL.md`)
- `server-actions` (`.claude/skills/server-actions/SKILL.md`)
- `gemini-integration` (`.claude/skills/gemini-integration/SKILL.md`)
- `brief-output` (`.claude/skills/brief-output/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)

## Existing code inspected

- `AGENTS.md` — workflow, evidence governance, hallucination-guard, roles, design, checks.
- `design_handoff_evibrief/design-system.md` — editor grid recipe, slate guard flag treatment, citation chip styling, responsive breakpoints, motion durations.
- `prompts/63-brief-generation-and-audience-switcher-ux.md` — just-executed generation/audience UX scope.
- `app/(app)/briefs/[id]/page.tsx` — review page composition, permissions, rail order, export notices, translation placement.
- `app/(app)/briefs/[id]/edit/page.tsx` — edit route authorisation, document construction, open-flag mark application.
- `app/(app)/briefs/[id]/edit/brief-editor.tsx` — Tiptap setup, editor grid, section drawer, citation insertion, save-state handling, flag/citation activation.
- `app/(app)/briefs/[id]/edit/actions.ts` — autosave Server Action, version writing, validation and authorisation.
- `app/(app)/briefs/[id]/edit/evidence-sheet.tsx` — citation chip side sheet.
- `app/(app)/briefs/[id]/edit/cite-control.tsx` — citation insertion UI.
- `app/(app)/briefs/[id]/edit/save-state.tsx` — autosave feedback states.
- `app/(app)/briefs/[id]/edit/sections-nav.tsx` — document outline navigation.
- `app/(app)/briefs/[id]/flag-panel.tsx` — hallucination-guard panel, open/closed flag rendering and slate pulse.
- `app/(app)/briefs/[id]/flag-resolution.tsx` — resolve, dismiss, and reopen controls.
- `app/(app)/briefs/[id]/review-panel.tsx` — Director status transitions and approval block copy.
- `app/(app)/briefs/[id]/translation-panel.tsx` — Twi key-message rendering states and refusal display.
- `app/(app)/briefs/[id]/actions.ts` — flag resolution, status transitions, share logging, and Twi translation Server Actions.
- `app/(app)/briefs/[id]/citation-list.tsx` — recorded evidence set presentation.
- `app/(app)/briefs/[id]/brief-body.tsx` — read-only document display.
- `lib/briefs/extensions/citation-chip.ts` — inline Tiptap citation chip Node.
- `lib/briefs/extensions/guard-flag.ts` — inline Tiptap hallucination-flag Mark.
- `app/globals.css` — `flagPulse`, `flagMarkPulse`, `breathe`, `countFade`, design tokens, reduced-motion rules.
- `components/ui/*` — available shadcn primitives, including `Alert`, `Button`, `Field`, `Sheet`, `Popover`, `Tabs`, `Tooltip`, `Badge`, `Separator`, and `ScrollArea`.

## Decisions and assumptions

1. The existing implementation already has the critical server-side controls: autosave authorises before validating, saves new versions, flag resolution authorises server-side, approval re-reads open flags, and Twi translation re-runs the evidence gate. This prompt should preserve those controls and refine how they are presented.
2. The editor remains Tiptap-based and client-only through `immediatelyRender: false`; do not replace the editor or change the document storage contract.
3. The review page keeps governance surfaces ahead of secondary panels. On narrow screens the flag panel and Director approval block must appear before the document body.
4. Twi translation stays on demand and version-bound. Do not pre-compute, auto-run, or show stale Twi next to current English.
5. Use Motion only if a small authenticated-route transition genuinely clarifies state and stays within 150–300ms. Do not add GSAP here.
6. The existing untracked/deleted prompt files are unrelated workspace state. Do not restore, delete, renumber, or overwrite them.

## Files likely to change

- `app/(app)/briefs/[id]/page.tsx`
- `app/(app)/briefs/[id]/edit/page.tsx`
- `app/(app)/briefs/[id]/edit/brief-editor.tsx`
- `app/(app)/briefs/[id]/edit/evidence-sheet.tsx`
- `app/(app)/briefs/[id]/edit/cite-control.tsx`
- `app/(app)/briefs/[id]/edit/save-state.tsx`
- `app/(app)/briefs/[id]/edit/sections-nav.tsx`
- `app/(app)/briefs/[id]/flag-panel.tsx`
- `app/(app)/briefs/[id]/flag-resolution.tsx`
- `app/(app)/briefs/[id]/review-panel.tsx`
- `app/(app)/briefs/[id]/translation-panel.tsx`
- `app/(app)/briefs/[id]/citation-list.tsx`
- `app/(app)/briefs/[id]/brief-body.tsx`
- `lib/briefs/extensions/citation-chip.ts`
- `lib/briefs/extensions/guard-flag.ts`
- `app/globals.css` only if a missing token/keyframe or selector fix is required

## Implementation requirements

1. **Editor Layout and Document Canvas**
   - Keep the handoff grid: mobile single column, `laptop:grid-cols-[1fr_340px]`, `desktop:grid-cols-[236px_1fr_372px]` or an equivalent `minmax(0,...)` variant with no horizontal page overflow.
   - Promote guard flags above the document on mobile and keep the section nav as a `Sheet` below desktop.
   - Make the document canvas read like a working policy draft: warm card surface, restrained border, stable max line length around `70ch`, comfortable 14.5px body text, no serif for generated prose.
   - Ensure headings, paragraph spacing, editor focus, and empty/loading editor state look intentional rather than like a raw ProseMirror surface.
   - Keep toolbar controls stable in height across save states, citation controls, and section drawer. No layout jump when save status changes.

2. **Citation Chip and Evidence Sheet**
   - Citation chips remain inline atomic Tiptap nodes, not shadcn badges, and must carry `data-evidence-item-id`.
   - Visual contract: pill on `surface-tint`, `surface-tint-border`, `primary-ink`; filled dot for public-published/resolved evidence, hollow dot for pending/unverified display states.
   - Chip activation must work by click and keyboard (`Enter`/space), with `role="button"`, `tabindex="0"`, and a clear accessible label.
   - Clicking a chip opens the evidence in a `Sheet`, never a route change.
   - Evidence sheet should expose title, authors, year, country, citation key, classification badge, source link, and a short reminder that the item is displayed for review rather than reclassified here.
   - Verbatim source title/excerpt material uses Source Serif 4; all metadata and UI text use Inter; data/citation key uses IBM Plex Mono.

3. **Hallucination-Guard Panel and Inline Mark**
   - Restate and preserve the exact visual contract: a flag is a review prompt, rendered in slate/watch (`bg-watch-surface`, `border-watch-border`, `text-watch-ink`) with a round 16px icon, a single 900ms pulse settling to a steady soft 2px underline/outline, never red, never blinking, never an error toast, and no destructive variant.
   - Inline flagged claims use the stored flag Mark only. Do not infer flags from prose and do not embed flag state in the document JSON.
   - Clearing one flag must not re-pulse unrelated flags. Keep the pulse on a stable mounted element or otherwise ensure it fires once on first appearance only.
   - Active flag selection should visibly pair panel row and document span without changing meaning or using red.
   - Closed flags stay available as audit history at lower emphasis with hollow circular glyphs and no pulse.
   - Claim text quoted inside the panel uses the serif because it is verbatim draft material being reviewed.

4. **Flag Resolution Controls**
   - Keep the two distinct outcomes: `resolved` means checked against a source; `dismissed` means allowed through without that check. Do not collapse them into one "clear" action.
   - Require a reason in the UI and preserve server-side Zod validation.
   - Render refusal/validation messages in place, using watch/slate styling rather than red or generic toasts.
   - Buttons must be at least 44px high on mobile, can compact to 32px on tablet/desktop, and all enabled controls must show `cursor-pointer`.
   - Do not use optimistic updates for flag resolution.

5. **Director Approval Block**
   - Approval remains disabled, not hidden, while any open flags exist; the reason must sit inline near the control.
   - The Server Action remains the enforcement point and re-reads open flags before transition. Do not rely on the disabled button.
   - Improve the block's hierarchy so status, reason field, primary action, send-back, submit/publish, and blocked-by-flags note are scannable without implying the product made a decision.
   - Keep all status transitions human-triggered and recorded. No auto-approve, auto-submit, or auto-publish.

6. **Twi Translation Assist**
   - Keep translation on demand from `translateKeyMessagesAction`, never on page load.
   - Show exactly what will be translated: executive summary and recommendations/key messages, not the whole brief.
   - Current translation state must show version number, status label, model, prompt version, actor, and timestamp in low-emphasis mono where appropriate.
   - Stale translation state must clearly say which version was rendered and offer a fresh run without showing stale Twi beside current English.
   - Open flags should produce a watch-ramp notice, not a block. Translation is not gated on open flags; it carries the review caveat.
   - Rate limit, ineligible classification, missing API key, invalid output, and generic generation failure must render as typed, handled states. No evidence body text, English message text, or Twi text should be logged or sent to telemetry.
   - Twi and English generated prose both use Inter. Do not use the serif for generated translation text.

7. **Responsive and Accessibility Requirements**
   - Verify 320px, 390px, 760px, 1000px, 1300px, and 1600px widths.
   - No horizontal page scroll, clipped controls, overlapping panels, or text below 12px.
   - All panels need accessible headings. Sheets need `SheetTitle` and `SheetDescription` (visually hidden is acceptable where appropriate).
   - Keyboard users must be able to open citations, use the section drawer, resolve flags, run translation, and operate review controls.
   - Respect `prefers-reduced-motion`; any transition added here must become instant under reduced motion.

## Evidence classification impact

**Touches translation assist and citation display, both connected to evidence records.**

- **Classifications involved**: `public_published`, `community_sourced`, `unpublished_internal`.
- **AI call types involved**: translation assist is a Gemini call. It remains subject to the standing gate even though the model receives key-message prose, because the prose is derived from the brief's recorded evidence set.
- **Enforcement point**: `translateKeyMessagesAction` in `app/(app)/briefs/[id]/actions.ts` re-loads evidence with `loadEvidenceForGenerationContext(brief.evidenceItemIds)` and gates it via `gateEvidenceForGeneration` before calling `translateKeyMessages` in `lib/ai/translate.ts`.
- **Blocked items**: if any recorded evidence item has become `community_sourced` or `unpublished_internal`, the whole translation run returns `refused-ineligible-classification`; the UI must render a typed refusal listing item titles/classifications and direct the user to governance review rather than silently translating a partial subset.
- **Citation display**: the editor and evidence sheet may display the brief's recorded evidence metadata and classification, but must not expose a route for changing classification here and must not send evidence body text to client logs, Sentry, or PostHog.

## Hallucination-guard implications

**Changes flag rendering and review ergonomics, not the fact-check algorithm.**

- The post-generation fact-check pass, claim extraction, Zod validation, and flag storage are not changed by this prompt.
- Flag rendering must restate and preserve the exact visual contract: slate/watch surface and border, round 16px guard icon, gentle single 900ms pulse settling to a steady soft 2px underline/outline, never red, never blink, never alarm, never destructive variant, never error toast.
- Inline Tiptap flag marks must render stored flag records anchored to document positions. They must not infer flags from prose at render time and must not be persisted into `documentJson`.
- Unresolved flags continue to block Programme Director approval server-side in `changeBriefStatusAction` via the data-layer status transition logic.
- Flag dismissal/resolution remains restricted to Research Officer and Programme Director, excluding a reviewer clearing a brief they drafted, and records actor, timestamp, status, and reason.

## Security requirements

- Preserve server-side authorisation in every Server Action before validation or mutation.
- Do not move mutations into Route Handlers or browser-side data writes.
- Do not import AI modules into client components.
- Do not log prompt text, completion text, evidence body text, claim text, English key messages, Twi output, stakeholder information, or raw errors to Sentry/PostHog/console.
- Telemetry/logging, if touched, may include ids, counts, classifications, status names, model id, prompt version, and timings only.
- External evidence links must keep `target="_blank"` with `rel="noreferrer"`.

## Acceptance criteria

1. `/briefs/[id]/edit` renders a responsive 3-pane editor at desktop, stacked editor/governance surfaces on mobile, and never horizontally scrolls at 320px–1600px.
2. The document canvas looks like a polished policy draft workspace, with stable toolbar/save-state layout and no raw editor chrome.
3. Citation chips are keyboard-accessible and open a side sheet in place; they never navigate away from the draft.
4. The citation sheet presents source metadata clearly, uses serif only for verbatim source material, and does not offer classification editing.
5. Open hallucination flags render with the slate round-icon 900ms single-pulse contract; closed flags render lower-emphasis audit history with no pulse.
6. Selecting a flag in the panel scrolls to the document span and visually pairs both surfaces without using red.
7. Flag resolution keeps separate resolved/dismissed outcomes, requires a reason, handles refusals inline, and does not optimistically change state.
8. Programme Director approval is visibly blocked while flags are open and still refused server-side if attempted.
9. Twi translation assist handles current, stale, empty, running, rate-limited, missing-config, invalid-output, and ineligible-classification states without losing context.
10. All interactive controls have pointer cursor when enabled, not-allowed cursor when disabled, and 44px mobile tap targets.

## Checks to run

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Report exact output. If `npm run lint` still reports the known pre-existing vendored shadcn hook errors, identify them separately and report any new issues in touched files.

## Manual test steps

1. Start the app with `npm run dev`.
2. Sign in as a Policy & Advocacy Officer and open an editable draft at `/briefs/[id]/edit`.
3. At 390px, 760px, 1000px, 1300px, and 1600px widths, verify the editor grid reflows with no horizontal page scroll and that the guard panel remains visible before the document on narrow screens.
4. Open the section drawer below desktop, jump to a section, and confirm focus/scroll behaviour is usable by keyboard.
5. Insert a citation chip, activate it with click and keyboard, and verify the evidence sheet opens without route navigation.
6. Edit the document, wait for autosave, and verify save/saving/failed states do not shift the toolbar layout.
7. Open a brief with an open hallucination flag. Confirm the slate flag panel pulses once, the inline mark settles to a soft underline, and selecting either side scrolls to the other.
8. As a Research Officer or eligible Programme Director, resolve and dismiss separate flags with reasons; confirm inline validation/refusal handling and that closed flags move to lower-emphasis audit history.
9. As a Programme Director, confirm approval is disabled with an inline reason while flags are open and becomes available only after flags close.
10. Run the Twi translation assist on a brief with current public-published evidence. Confirm current translation metadata, stale-version handling after an edit, open-flag notice, and typed refusal rendering for a forced ineligible-classification or missing-config state.
