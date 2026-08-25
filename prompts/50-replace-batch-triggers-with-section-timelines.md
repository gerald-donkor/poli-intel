# 50 — Replace unstable ScrollTrigger.batch on landing cards with deterministic section timelines

Executes **after** `49-fix-landing-card-blur-and-reveal-motion.md`.

## Goal

On `/signin`, capability cards in `app/signin/capabilities-grid.tsx` and footer items in `app/signin/landing-footer.tsx` intermittently strand individual cards at low opacity (e.g. Card 3 at ~15% opacity while adjacent cards 1, 2, and 4 are fully rendered).

This is caused by `ScrollTrigger.batch('[data-anim="capability-card"]', ...)` which creates separate ScrollTrigger instances per card with interval timers and `overwrite: true`. When cards in the same row trigger slightly apart (or during scroll/font refresh), batch callbacks fire in pieces, causing GSAP to overwrite and freeze in-flight tweens on individual cards mid-animation.

Replace the flaky `ScrollTrigger.batch` calls for the capabilities grid and footer with deterministic, unified section-level timelines (`gsap.timeline({ scrollTrigger: { trigger: ... } })`) matching the proven, robust pattern used by the pipeline lattice and locator sections.

## Skills read

- `gsap-scrolltrigger` — `ScrollTrigger` section timeline vs `ScrollTrigger.batch` lifecycle
- `gsap-core` — timeline sequencing, `stagger`, `.from()`
- `gsap-react` — `useGSAP()` context tracking
- `design-system` (project) — motion reliability and visual clarity (§11.9, §11.11)

## Existing code inspected

- `app/signin/landing-motion.tsx` — inspect `ScrollTrigger.batch` on `[data-anim="capability-card"]` and `[data-anim="footer-item"]`.
- `app/signin/capabilities-grid.tsx` — inspect section container markup and add `data-anim="capabilities"`.
- `app/signin/landing-footer.tsx` — inspect footer container markup and add `data-anim="footer"`.

## Decisions and assumptions

1. **Section-Level ScrollTriggers Instead of Per-Element Batching**:
   - Capabilities section: Add `data-anim="capabilities"` to `<section>` in `capabilities-grid.tsx`. In `landing-motion.tsx`, replace `ScrollTrigger.batch` with `capabilitiesTl = gsap.timeline({ scrollTrigger: { trigger: '[data-anim="capabilities"]', start: "top 75%", toggleActions: "play none none none" } })`, animating `[data-anim="capability-card"]` with `{ y: 20, autoAlpha: 0, duration: 0.45, stagger: 0.08, ease: "power2.out" }`.
   - Footer section: Add `data-anim="footer"` to `<footer>` in `landing-footer.tsx`. In `landing-motion.tsx`, replace `ScrollTrigger.batch` with `footerTl = gsap.timeline({ scrollTrigger: { trigger: '[data-anim="footer"]', start: "top 90%", toggleActions: "play none none none" } })`, animating `[data-anim="footer-item"]` with `{ y: 16, autoAlpha: 0, duration: 0.45, stagger: 0.08, ease: "power2.out" }`.
2. **Deterministic, Atomic Execution**:
   - Because all cards in the section are animated by a single timeline tied to the parent section trigger, all cards start and complete deterministically together without interval splits or tween cancellations.
3. **Preserve Clean Opacity + Transform**:
   - Keep hardware-accelerated `y` translate and `autoAlpha` transitions with no container blur filters.

## Files likely to change

- `app/signin/capabilities-grid.tsx` — add `data-anim="capabilities"` attribute to section container.
- `app/signin/landing-footer.tsx` — add `data-anim="footer"` attribute to footer container.
- `app/signin/landing-motion.tsx` — replace `ScrollTrigger.batch` calls with section timelines.

## Implementation requirements

1. Add `data-anim="capabilities"` to `<section>` in `app/signin/capabilities-grid.tsx`.
2. Add `data-anim="footer"` to `<footer>` in `app/signin/landing-footer.tsx`.
3. In `app/signin/landing-motion.tsx`, remove both `ScrollTrigger.batch` blocks and instantiate single-trigger timelines for `[data-anim="capabilities"]` and `[data-anim="footer"]`.
4. Ensure all cards and footer items transition from `autoAlpha: 0` to `1` without dropping or freezing any element mid-flight.
5. Pass `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Evidence classification impact

None — no evidence data path. This is visual motion architecture on the unauthenticated `/signin` page.

## Hallucination-guard implications

None.

## Security requirements

No new dependencies or network access.

## Acceptance criteria

- [ ] All 4 capability cards always animate to 100% opacity and final layout together, with zero cards stranded at partial opacity.
- [ ] Scrolling into the capabilities section or footer triggers a smooth, staggered entrance every time.
- [ ] Hard-reloading at any scroll position renders all cards fully visible and sharp.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.

## Checks to run

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Manual test steps

1. Run `npm run dev` and open `http://localhost:3000/signin`.
2. Scroll to the "Core Capabilities" section and observe that all 4 cards animate in sequence to 100% full opacity, with no card washed out, faded, or left behind.
3. Scroll to the footer and confirm all footer elements animate smoothly and completely.
4. Hard-reload the page mid-scroll multiple times and verify that all cards remain crisp, fully opaque, and properly positioned every single time.
