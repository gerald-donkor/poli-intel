# Prompt 67 — Impact Tracker and Animated Map UX Refinement

## Goal

Refine the existing `/impact` surface so Tropenbos Ghana staff can record influence events, confirm what is donor-reportable, read the quarterly report, and understand the evidence-to-policy paths without treating the product as the author or verifier of impact.

This is the next unbuilt UI refinement scope because prompt 66 shipped the submission tracker and stakeholder CRM UX pass, while the roadmap's remaining authenticated UX work is the Impact Tracker and animated evidence-to-policy map. Prompt 26 already built the first GSAP lattice and prompt 22 already built the Impact Tracker data model and weekly detection path, so this prompt is a focused UX pass over existing implementation rather than a schema rewrite or a new AI pipeline.

The scope covers:

1. `/impact` page hierarchy, donor-facing summary, and responsive layout.
2. Influence event logger disclosure and form readability.
3. Quarterly report layout, confirmed/unconfirmed separation, and evidence-quality feedback.
4. Influence event rail hierarchy and confirmation affordance.
5. `ImpactMap` SVG/GSAP lattice polish, accessibility, replay, reduced motion, and responsive panning.

## Skills read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `gsap-core` (`.agents/skills/gsap-core/SKILL.md`)
- `gsap-timeline` (`.agents/skills/gsap-timeline/SKILL.md`)
- `gsap-react` (`.agents/skills/gsap-react/SKILL.md`)
- `gsap-performance` (`.agents/skills/gsap-performance/SKILL.md`)

## Existing code inspected

- `AGENTS.md` — resume workflow, UI roadmap, evidence governance, human approval rules, Impact Tracker role model, design system rules, checks.
- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — Policy Radar, Evidence Matcher, Brief Generator, and Impact Tracker intent; donor-facing proof and quarterly reporting context.
- `design_handoff_evibrief/design-system.md` — authoritative tokens, warm institutional palette, typography roles, impact-map grid recipe, 860px panning diagram rule, GSAP path draw timing, reduced-motion requirements.
- `design_handoff_evibrief/README.md` — impact-map frame intent: donor-facing proof screen, summary stats, influence paths, rail, verification note, most-cited evidence feedback.
- `design_handoff_evibrief/EviBrief Screens.dc.html` — visual intent for frame `1e`, including map composition, rail density, verified/unverified treatments, and contour-ring background motif.
- `prompts/26-impact-map.md` — initial map implementation contract and decisions already executed.
- `prompts/66-submission-tracker-and-stakeholder-crm-ux.md` — most recent UX refinement prompt structure and level of specificity.
- `app/(app)/impact/page.tsx` — Server Component data loading, role gate, current page order, map/rail grid, empty state.
- `app/(app)/impact/log-panel.tsx` — logger disclosure, default-open empty-record behavior.
- `app/(app)/impact/influence-form.tsx` — React Hook Form + Zod form, field composition, saved/refusal feedback, no optimistic logging.
- `app/(app)/impact/quarterly-report.tsx` — assembled report, quarter nav, confirmed-only event list, evidence list, unverified count.
- `app/(app)/impact/event-rail.tsx` — influence event cards, quoted text serif treatment, verified/unverified wording, confirmation control placement.
- `app/(app)/impact/verify-control.tsx` — Programme Director confirmation action UI, optimistic confirmation, rollback message.
- `app/(app)/impact/impact-map.tsx` — current SVG/GSAP implementation, deterministic lattice layout, replay button, hidden path summaries, reduced-motion `matchMedia`.
- `app/(app)/impact/labels.ts` — labels and copy for influence event types, detection methods, map legend, map aria label.
- `app/(app)/impact/schema.ts` — shared Zod schema for logging and confirming events.
- `app/(app)/impact/actions.ts` — Server Action authorisation, validation order, no logging of sensitive text.
- `lib/db/influence.ts` — Impact Tracker reads/writes, map DTO, quarterly report assembly, evidence-title-only reads, weekly detection support.
- `lib/impact/config.ts` — quarter parsing and reporting calendar.
- `package.json` — `gsap` and `@gsap/react` already installed; available checks are `test`, `lint`, `typecheck`, and `build`.

## Decisions and assumptions

1. This is a UI refinement. Preserve the current Prisma schema, Inngest jobs, AI detection flow, and Server Action contract unless a small read DTO is needed for summary counts.
2. The quarterly report remains assembled from stored rows. Do not introduce model-written donor prose, automatic export, or a "generate report" action unless it is only a clearer label for the existing assembled report section and does not call Gemini.
3. Confirmation remains a Programme Director action and is the only thing that makes an event count in the quarterly report. A Policy & Advocacy Officer may log records but cannot confirm them.
4. The map continues to draw only stored relations: `EvidenceItem` title/citation key → `Brief` title/type/audience → `InfluenceEvent`. It must not infer missing links, cluster nodes, score influence, or inspect evidence body text.
5. The handoff's map prototype uses dots for evidence/outcome and cards for briefs, but the implemented prompt 26 deliberately avoided circles and squares because those shapes are reserved for guard flags and classification holds. Keep that decision unless the local design system has since introduced an unambiguous alternate shape language. If changing node shape, do not use the guard circle or classification square meanings.
6. Do not add fake tabs. The prototype names "Influence paths / Geography / Timeline"; implement only views backed by available data. A timeline view can be built from influence events; a geography view should not appear unless the code already exposes reliable geography for the paths.
7. The signature element for this screen is the evidence-to-policy path drawing, not extra decoration. Use contour-ring background motifs only if they improve depth behind the lattice and do not reduce label/path contrast.
8. GSAP remains allowed only in `app/(app)/impact/impact-map.tsx` and the unauthenticated `app/signin/` landing surface. Do not add GSAP elsewhere in this refinement.
9. Prompt numbering follows repository history. There are duplicate `60-*` prompt files; do not renumber or overwrite them. This prompt is `67` because `66` is the highest existing prompt number.

## Files likely to change

- `app/(app)/impact/page.tsx`
- `app/(app)/impact/log-panel.tsx`
- `app/(app)/impact/influence-form.tsx`
- `app/(app)/impact/quarterly-report.tsx`
- `app/(app)/impact/event-rail.tsx`
- `app/(app)/impact/verify-control.tsx`
- `app/(app)/impact/impact-map.tsx`
- `app/(app)/impact/labels.ts`
- `lib/db/influence.ts` only if additional summary counts can be returned without evidence-body reads or N+1 queries.
- `components/ui/*` only for small shadcn-compatible composition fixes required by this page.
- `app/globals.css` only if a missing token-backed utility or map-specific reduced-motion/focus style is needed.

## Implementation Requirements

### Page Hierarchy and Summary

1. Keep `/impact` as a Server Component read path gated by `requireStaffUser()` and `canLogInfluenceEvent`. Do not introduce client-side fetching or SWR.
2. Replace the current all-prose header area with a clearer donor-facing summary strip beneath `PageHeader`: confirmed events for the selected quarter, unconfirmed records waiting for confirmation, briefs represented in the map, and cited evidence represented in the map.
3. Use real stored counts only. Do not show the prototype's hard-coded values such as "14 influence events" or "4.2 days" unless the value is calculated from current data.
4. Use IBM Plex Mono for counts and dates; Inter for labels and explanatory copy. Do not use Source Serif in the summary strip.
5. Preserve the page frame: `mx-auto w-full max-w-[1440px]` with responsive padding and no horizontal page scroll at any width.
6. Order the page for work: summary first, logger as a compact disclosure, quarterly report, then the record/map grid. If the record is empty, keep `LogInfluencePanel` open by default and keep the empty state directly actionable.

### Influence Event Logger

7. Keep `LogInfluencePanel` as an in-place disclosure, not a modal. People may need to log several records in sequence.
8. Make the closed state more compact and scannable: title, one-line explanation, and an "Add a record" button with stable height.
9. Improve form grouping without broad rewrites: brief/kind/date as the first row, description as the primary field, source link/title together, quoted line last.
10. The quoted line field remains the only form field where Source Serif is appropriate because it is copied from the citing document.
11. Preserve native date input and the "today or past" rule. Do not add a custom date picker.
12. Saved, pending, validation, and refusal states must be inline and stable, without layout jumps. Use watch/slate styling for refusals, never destructive red and never a toast.
13. Logging remains non-optimistic. The server result is truth because both admitted roles can see the control but the action still may refuse.

### Quarterly Report

14. Keep the report assembled, not generated. No Gemini call, no AI-written donor paragraph, no export path added in this prompt.
15. Make the confirmed/unconfirmed distinction impossible to miss: confirmed events are counted and listed; unconfirmed records are named separately as waiting and excluded from the report.
16. Refine the quarter selector into a compact segmented list or tab-like control using links, with `aria-current` on the active quarter. It must wrap cleanly on mobile.
17. Improve report sections so a Director can scan: summary, grouped confirmed records, evidence behind these records, and unconfirmed waiting count.
18. "Evidence behind these records" should become a clearer evidence-quality feedback block: show title, citation key, and count; do not read or show excerpts/body text.
19. If there are no confirmed records in the selected quarter, keep the existing honest empty state and add the next step: confirm waiting records in the rail or log one above.
20. Do not imply the app proved or verified influence. Copy should say records were logged, found, confirmed by a person, or assembled from stored rows.

### Event Rail and Confirmation

21. Keep the rail newest-first. It remains the detail surface for the map rather than adding tooltips or a second detail sheet.
22. Give the lead unconfirmed item and lead confirmed item clearer visual distinction using surface tint/watch-neutral panels and words, not red/green.
23. Verified/unverified must be distinguished by shape plus text, not colour alone. Avoid the guard flag circle and classification-pending square meanings.
24. Preserve Source Serif only for `quotedText`. Event descriptions, labels, and confirmation notes use Inter.
25. Keep source links external with `target="_blank"` and `rel="noreferrer noopener"`.
26. Programme Director confirmation stays in `VerifyControl`, backed by `verifyInfluenceEventAction`. Do not add any confirmation affordance to the map canvas.
27. `VerifyControl` should keep its optimistic UI, but rollback/refusal text must remain visible and stable if the action refuses.

### Impact Map

28. Keep the custom SVG/GSAP implementation. Do not introduce a charting library, physics engine, canvas package, or Motion for the map.
29. The map panel should feel like the main artifact: heading, concise intro, legend, replay control, and diagram in one coherent surface.
30. Add a subtle contour-ring background motif only if it sits behind the SVG paths without reducing contrast. No stock imagery, no leaf/tree icons, no decorative orbs.
31. Keep deterministic node placement: three columns, stable order, no force simulation randomness. The same stored record should render the same path order on every load.
32. Keep the map's 860px minimum canvas width and horizontal panning inside the map panel below `laptop`; never allow page-level horizontal scroll.
33. Preserve `tablet:min-h-[460px]` or stronger equivalent so paths stay legible on tablet and desktop.
34. Improve visual hierarchy of nodes if needed: brief nodes may carry surface-tint card treatment, evidence/outcome labels may be compact, but do not let any label drop below 12px.
35. Verified links remain solid accent/teal. Unverified links remain dashed sage and draw last. Do not borrow urgency colours for influence status.
36. Make hover or focus highlighting optional but, if implemented, it must be data-backed and accessible: highlighting a node dims unrelated paths to about 25% over 150ms, and keyboard focus must provide the same relationship cue. Do not make hover the only way to understand the diagram.
37. The SVG must keep `role="img"` or an equivalent accessible summary plus the existing hidden textual list of every path. The diagram cannot be the only carrier of path information.
38. Replay remains a real button with a visible label, not an icon-only control. It must have `cursor-pointer`, focus ring, and reduced-motion-safe behavior.

### GSAP and Motion

39. Keep GSAP imports scoped to `app/(app)/impact/impact-map.tsx` and `app/signin/landing-motion.tsx`. Verify with `rg "from \"gsap|from '@gsap|from \"@gsap"`.
40. Use one `gsap.timeline()` inside `useGSAP(..., { scope: containerRef })`. Use scoped selectors or refs only; never unscoped document selectors.
41. Sequence with timeline labels or position parameters, not chained `delay`.
42. Total path draw should remain about 1.6s: nodes appear, verified paths draw in citation-date order, outcomes land with the path, unverified dashed paths draw last.
43. Respect `prefers-reduced-motion` with `gsap.matchMedia()` and render the final state instantly for reduced motion. The global CSS media query does not disable JS-driven GSAP.
44. Do not loop. The generation stepper's breath is still the only looping animation in the authenticated product.
45. Clean up all timelines, matchMedia contexts, and replay handlers via `useGSAP` cleanup. Do not leave detached timelines or event listeners running.
46. Prefer transform/opacity animation and dash-offset drawing. Do not animate layout-heavy properties such as width, height, left, top, margin, or padding.

### Responsive and Accessibility

47. Verify 320px, 390px, 760px, 1000px, 1300px, and 1600px widths.
48. Desktop Officer/Director density is allowed, but the mobile stack must remain readable: summary, logger, report, map, rail, with controls at least 44px high where practical.
49. No horizontal page scroll, clipped controls, overlapping text, or labels below 12px. The map may pan inside its own panel only.
50. All links, buttons, disclosure triggers, quarter links, replay controls, and confirmation controls need visible focus states and pointer/disabled cursors.
51. Use shadcn primitives where they fit: `Button`, `Badge`, `Alert`, `Empty`, `Separator`, `Field`, `FieldGroup`, `Input`, `NativeSelect`, and `Textarea`. Do not build a second component system.
52. Avoid `space-x-*` and `space-y-*`; use flex/grid with `gap-*`.
53. Do not use `destructive`, stoplight colours, clinical white, generic dashboard cards, or startup-style copy.

## Evidence Classification Impact

No AI-governance entry point changes, but this screen does read the bibliographic identity of evidence used in recorded brief paths.

Classifications involved: none are loaded or changed by this prompt. The Impact Tracker map and quarterly report read `EvidenceItem.id`, `EvidenceItem.title`, and `EvidenceItem.citationKey` through `BriefEvidence`; they must not read `EvidenceItem.fullText`, `EvidenceChunk.text`, embeddings, excerpts, classifications, or source files. The exact enforcement point is the select shape in `lib/db/influence.ts`: `readImpactMap()` and `readEvidenceBehind()` must remain title/citation-key-only reads. If a change needs evidence body text, stop and update the prompt before implementing.

Blocked items: there is no evidence eligibility gate on this historical record view because it does not search, retrieve, embed, generate, translate, classify, or fact-check. Do not add a classification filter that silently removes historical paths; do not widen the read to body text on that basis. Nothing from this screen should be sent to Gemini, Sentry, PostHog, logs, email, WhatsApp, or USSD.

## Hallucination-Guard Implications

None.

This prompt does not change brief generation, claim extraction, fact-checking, hallucination-flag storage, hallucination-flag rendering, flag resolution, or Programme Director approval blocking. It may display brief status or influence confirmation status only. It must not add approval/submission controls or bypass the existing server-side rule that unresolved hallucination flags block brief approval.

## Security Requirements

- Preserve `requireStaffUser()` on the `/impact` route.
- Preserve role presentation checks, but keep Server Actions as the enforcement point.
- `logInfluenceEventAction` and `verifyInfluenceEventAction` must continue to resolve the session, authorise, validate, then mutate.
- Do not add Route Handler mutations for app forms.
- Do not import Prisma, AI modules, or server-only helpers into client components.
- Do not log influence descriptions, quoted text, source URLs, brief prose, evidence titles, stakeholder data, prompts, completions, or raw errors to Sentry/PostHog/console.
- Do not add automated submission, autonomous verification, auto-publishing, automated donor reporting, or new background jobs.
- External links must use `target="_blank"` and `rel="noreferrer noopener"`.
- Keep all secrets server-only; no `NEXT_PUBLIC_*` additions are expected.

## Acceptance Criteria

1. `/impact` reads as a coherent Impact Tracker work surface: summary, logger, quarterly report, map, and rail are visually connected without becoming a generic dashboard.
2. All summary counts are computed from stored data or existing DTOs; no hard-coded prototype metrics appear.
3. Influence logging remains manual, non-optimistic, authorised server-side, and visibly awaiting confirmation after save.
4. The quarterly report clearly includes only confirmed records and separately names unconfirmed records waiting for confirmation.
5. Evidence-quality feedback shows evidence title, citation key, and count only; no evidence body text or chunks are loaded.
6. The event rail remains the detail/confirmation surface, with quoted text in Source Serif and all other prose in Inter.
7. The map remains a deterministic stored-record lattice with verified solid links, unverified dashed links, dashed links drawn last, and no inferred paths.
8. GSAP usage remains scoped to the impact map and sign-in landing surface only.
9. Reduced motion renders the map final state instantly and replay does not create a looping or inaccessible animation.
10. The screen works at 320px, 390px, 760px, 1000px, 1300px, and 1600px with no horizontal page scroll outside the map's own panning container.
11. Keyboard navigation reaches quarter links, logger disclosure, form fields, source links, replay, and confirmation controls with visible focus states.
12. Copy never says the system proved, verified, endorsed, approved, or decided impact.

## Checks to Run

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `rg "from \"gsap|from '@gsap|from \"@gsap" app lib components`

Report exact output. If a check fails because of a known pre-existing issue outside touched files, identify it separately and report whether touched files introduced any new failure.

## Manual Test Steps

1. Start the app with `npm run dev`.
2. Sign in as a Programme Director and open `/impact`.
3. At 390px, 760px, 1000px, 1300px, and 1600px widths, verify summary, logger, quarterly report, map, and rail reflow without page-level horizontal scroll.
4. With no influence events, confirm the logger opens by default and the empty state names logging a record as the next step.
5. Add an influence record against a brief. Confirm inline saved feedback appears, the page refreshes, and the new record is waiting for Programme Director confirmation.
6. Confirm an unverified record as Programme Director. Confirm the optimistic state resolves, the rail updates, and the selected quarter report counts the record only after confirmation.
7. Open `/impact` as a Policy & Advocacy Officer. Confirm logging is available but confirmation controls are not rendered, and the Server Action would refuse if invoked.
8. Switch quarter links with keyboard and pointer. Confirm `aria-current` moves and confirmed/unconfirmed counts match the selected quarter.
9. Inspect the map: verified paths draw solid before unverified dashed paths, replay restarts the sequence, and the hidden textual path list remains present for screen readers.
10. Enable reduced motion at the OS/browser level and reload `/impact`. Confirm the map renders the final state without animated drawing and replay does not animate.
11. Check a record with a quoted line: the quote renders in Source Serif, while descriptions, labels, and report prose remain Inter.
12. Use browser devtools at 320px to confirm the map pans inside its panel and the document body does not horizontally scroll.
