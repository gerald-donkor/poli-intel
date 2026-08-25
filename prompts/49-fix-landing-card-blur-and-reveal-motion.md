# 49 — Fix landing card blur artifacts and streamline scroll reveal motion

Executes **after** `48-landing-scroll-reveal-refresh-fix.md`.

## Goal

In `/signin`, the capability cards (`app/signin/capabilities-grid.tsx`) and pipeline cards (`app/signin/pipeline-lattice.tsx`) use `filter: "blur(6px)"` alongside `y` offsets and staggered `autoAlpha` in their GSAP `.from()` entrance tweens in `app/signin/landing-motion.tsx`.

When cards animate into view (or if paused/scrolled through mid-transition), cards in the same horizontal row display at disparate blur levels — one card sharp and vivid while adjacent cards look degraded, fuzzy, and broken. Furthermore, CSS `filter: blur(...)` applied to container elements containing text, borders, and shadows causes subpixel rasterization overhead and visual fuzziness across Chromium browsers.

Fix this by eliminating the `filter: blur()` property on card containers across the landing motion controllers, replacing them with clean, crisp, institutional transforms and opacity reveals (`y` translation + `autoAlpha`), ensuring cards remain visually sharp, calm, and performant at all scroll positions.

## Skills read

- `design-system` (project) — motion budget, institutional restraint, "if in doubt, cut the animation" (§11.11)
- `gsap-core` — `.from()`, `clearProps`, clean tween properties
- `gsap-scrolltrigger` — `ScrollTrigger.batch()` callback ergonomics
- `gsap-react` — `useGSAP()` context and cleanup

## Existing code inspected

- `app/signin/landing-motion.tsx` — inspect `[data-anim="capability-card"]`, `[data-anim="pipeline-stage"]`, and `[data-anim="signin-card"]` where `filter: blur(...)` is applied to whole container blocks.
- `app/signin/capabilities-grid.tsx` — verify card DOM structure and data attributes.
- `app/signin/pipeline-lattice.tsx` — verify pipeline stage card attributes.

## Decisions and assumptions

1. **Remove container `filter: blur(...)` from card reveals**:
   - `[data-anim="capability-card"]`: Remove `filter: "blur(6px)"` and `clearProps: "filter"`. Reveal using clean `y: 20`, `autoAlpha: 0`, `duration: 0.45`, `stagger: 0.06`, `ease: "power2.out"`.
   - `[data-anim="pipeline-stage"]`: Remove `filter: "blur(6px)"` and `clearProps: "filter"`. Reveal using clean `y: 16`, `autoAlpha: 0`, `duration: 0.45`, `stagger: 0.1`, `ease: "power2.out"`.
   - `[data-anim="signin-card"]`: Remove `filter: "blur(8px)"` from the hero sign-in card tween, using smooth scale (`0.97` to `1`), `y: 14`, and `autoAlpha: 0` to `1` with `ease: "power2.out"`.
2. **Preserve typography SplitText motion**:
   - Heading/lede text reveals (which operate on masked text lines/words rather than complex card containers) can retain their subtle typography mask/blur or clean fade per existing design specs.
3. **Preserve batching and scroll trigger boundaries**:
   - The ScrollTrigger initialization, scroll reset, `document.fonts.ready` gating, and unmount cleanup established in prompt 48 remain intact.

## Files likely to change

- `app/signin/landing-motion.tsx` — remove container blur filters and refine tween parameters.

## Implementation requirements

1. Remove `filter: "blur(...)"` and `clearProps: "filter"` from `[data-anim="capability-card"]`, `[data-anim="pipeline-stage"]`, and `[data-anim="signin-card"]` in `app/signin/landing-motion.tsx`.
2. Ensure card entrance transitions rely strictly on hardware-accelerated transforms (`y`, `scale`) and `autoAlpha` for crisp text rendering and consistent clarity.
3. Keep all existing ScrollTrigger logic, font-readiness gating, and `prefers-reduced-motion` compliance intact.
4. Pass all typecheck, lint, and test suites.

## Evidence classification impact

None — no evidence data path. This is purely visual motion refinement on the unauthenticated `/signin` landing page. No database queries, AI models, or evidence assets are touched.

## Hallucination-guard implications

None.

## Security requirements

No external scripts or dependencies introduced.

## Acceptance criteria

- [ ] When scrolling to the "Core Capabilities" section on `/signin`, all cards reveal smoothly without any blurred, fuzzy, or low-resolution text states.
- [ ] Adjacent cards on the same horizontal row appear crisp and readable without jarring blur discrepancies.
- [ ] Pipeline stage cards and the hero sign-in card animate cleanly without container blur artifacts.
- [ ] `prefers-reduced-motion` remains respected with zero animation.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass cleanly.

## Checks to run

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Manual test steps

1. Run `npm run dev` and navigate to `http://localhost:3000/signin`.
2. Scroll down to the capabilities grid and observe the card entrance animation: verify cards enter cleanly with transform and opacity without any blur filter or fuzziness.
3. Check the pipeline stage cards and verify crisp entrance without blur.
4. Inspect at multiple viewport sizes (mobile, tablet, desktop) to ensure consistent, sharp presentation across columns.
