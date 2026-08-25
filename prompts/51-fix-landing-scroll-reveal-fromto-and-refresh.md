# 51 — Fix landing scroll reveals using deterministic fromTo() tweens and ScrollTrigger.refresh()

Executes **after** `50-replace-batch-triggers-with-section-timelines.md`.

## Goal

On `/signin`, capability cards (`[data-anim="capability-card"]`), pipeline stages (`[data-anim="pipeline-stage"]`), and footer items (`[data-anim="footer-item"]`) failed to render, remaining invisible (`opacity: 0; visibility: hidden;`) when scrolled into view.

Root cause:
1. `gsap.from(target, { y: ..., autoAlpha: 0 })` reads the element's *current* DOM style as its target destination. When elements are initialized or re-rendered in React 19 / Fast Refresh / async font settlement while already at `autoAlpha: 0`, GSAP locks in `0` as the destination, animating from `0` to `0` and stranding elements permanently invisible.
2. `ScrollTriggers` created asynchronously inside `document.fonts.ready.then(...)` require an explicit `ScrollTrigger.refresh()` pass after timeline construction so trigger start/end offsets accurately reflect the post-font rendered document height.

Fix all section timelines on `/signin` to use deterministic `fromTo(target, { ...fromVars }, { ...toVars })` tweens (with explicit `autoAlpha: 1`) and invoke `ScrollTrigger.refresh()` after setting up the scroll reveals.

## Skills read

- `gsap-scrolltrigger` — `ScrollTrigger.refresh()`, trigger geometry, start/end calculation
- `gsap-core` — `gsap.fromTo()`, explicit initial and destination state definitions
- `gsap-react` — `useGSAP()` lifecycle and `contextSafe`
- `design-system` (project) — motion reliability and visual clarity (§11.9, §11.11)

## Existing code inspected

- `app/signin/landing-motion.tsx` — inspect `pipelineTl`, `capabilitiesTl`, `landscape-quote`, `locatorTl`, and `footerTl` in `createScrollReveals`.

## Decisions and assumptions

1. **Explicit `fromTo()` for All Section Scroll Tweens**:
   - Replace all `gsap.from()` calls in `createScrollReveals` with `gsap.fromTo()` specifying `{ y: ..., autoAlpha: 0 }` as the from-vars and `{ y: 0, autoAlpha: 1, ... }` as the to-vars.
   - For SplitText on `[data-anim="landscape-quote"]`, replace `.from()` with `.fromTo()` specifying `{ yPercent: 100 }` to `{ yPercent: 0 }`.
   - For locator rings on `[data-anim="locator-ring"]`, replace `.from()` with `.fromTo()` specifying `{ scale: 0.7, autoAlpha: 0 }` to `{ scale: 1, autoAlpha: 1 }`.
2. **Explicit `ScrollTrigger.refresh()` After Setup**:
   - At the conclusion of `createScrollReveals`, call `ScrollTrigger.refresh()` so all newly instantiated ScrollTriggers compute their start and end trigger geometry against the final settled DOM.

## Files likely to change

- `app/signin/landing-motion.tsx` — update all scroll timeline tweens to `fromTo()` and call `ScrollTrigger.refresh()`.

## Implementation requirements

1. In `app/signin/landing-motion.tsx`:
   - Update `pipelineTl` to use `fromTo` for `[data-anim="pipeline-stage"]`.
   - Update `capabilitiesTl` to use `fromTo` for `[data-anim="capability-card"]`.
   - Update `landscape-quote` SplitText to use `fromTo` for `self.lines`.
   - Update `locatorTl` to use `fromTo` for `[data-anim="locator-ring"]`.
   - Update `footerTl` to use `fromTo` for `[data-anim="footer-item"]`.
   - Call `ScrollTrigger.refresh()` at the end of `createScrollReveals`.
2. Pass `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Evidence classification impact

None — no evidence data path. This is visual motion architecture on the unauthenticated `/signin` page.

## Hallucination-guard implications

None.

## Security requirements

No new dependencies or network access.

## Acceptance criteria

- [ ] All 4 capability cards animate smoothly from `opacity: 0` to `opacity: 1` when scrolled into view on `/signin`.
- [ ] Pipeline preview stages and footer items animate cleanly to full opacity when scrolled into view.
- [ ] Hard-reloading at any scroll position renders all cards and sections fully visible and sharp.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.

## Checks to run

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Manual test steps

1. Run `npm run dev` and navigate to `http://localhost:3000/signin`.
2. Scroll to "Traceability Pipeline" and confirm the 3 stage buttons animate in to 100% opacity.
3. Scroll to "Core Capabilities" and confirm all 4 capability cards animate in staggered sequence to 100% opacity.
4. Scroll to "Landscape Reality" and "Footer", confirming all sections animate in completely.
5. Reload at multiple scroll positions to confirm no element is stranded or hidden.
