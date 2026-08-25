# 52. Continuous Flowing Green Animation on Evidence Lattice

## Goal
Implement a continuous, smooth, looping "flowing green" animation on the Evidence Lattice diagram (`app/signin/evidence-lattice.tsx`) on the landing/sign-in page (`app/signin/`), depicting the continuous flow of verified landscape evidence from input sources through the central brief hub to policy outcomes.

## Skills Read
- `.claude/skills/design-system/SKILL.md`
- `.agents/skills/gsap-core/SKILL.md`
- `.agents/skills/gsap-react/SKILL.md`
- `.agents/skills/gsap-timeline/SKILL.md`

## Existing Code Inspected
- `app/signin/evidence-lattice.tsx` — the EvidenceLattice SVG component with nodes, traced links, and gap link.
- `app/signin/landing-motion.tsx` — the GSAP landing page controller using `useGSAP`, `matchMedia`, ScrollTrigger, and DrawSVGPlugin.
- `app/signin/pipeline-preview.tsx` — the pipeline preview component hosting `EvidenceLattice`.
- `app/signin/page.tsx` — signin / landing page layout.

## Decisions and Assumptions
1. **Flow Direction & Visual Metaphor**: The flow moves left-to-right from evidence nodes (`x=44`) -> central brief hub (`x=180, y=120`) -> outcome nodes (`x=316`). This visually reinforces EviBrief's core value proposition: evidence feeding into policy briefs which then unlock verified policy outcomes.
2. **Layering**: Underneath the flowing paths, retain static/subtle base paths (`stroke-accent/25`) so the topology of the lattice is always legible even between flow pulses.
3. **Evidence Gap Distinction**: Per `AGENTS.md` §15 and design system rules, the gap link on the bottom left remains distinct in dashed sage (`stroke-sage`), never showing active green flow, maintaining the integrity of the evidence classification gate.
4. **GSAP + Reduced Motion**: Drive the continuous flow using GSAP within `LandingMotion` (the dedicated GSAP surface for `app/signin/`), utilizing `pathLength="100"` on the SVG overlay paths and animating `strokeDashoffset` with `repeat: -1, ease: "none"`. When `prefers-reduced-motion` is active, `matchMedia` returns early and no continuous animation runs, leaving the clean static diagram.
5. **Central Hub Pulse**: Add a subtle ambient pulse to the central hub concentric ring (`stroke-sage` / `stroke-accent`) to give a harmonious rhythmic heartbeat as evidence flows into and out of the brief generator.

## Files Likely to Change
- `app/signin/evidence-lattice.tsx` — Update SVG structure to support base tracks, normalized `pathLength="100"` flow overlay paths with `data-anim="lattice-flow"`, and hub pulse element.
- `app/signin/landing-motion.tsx` — Add the continuous seamless looping flow animation to the pipeline section timeline in GSAP.

## Implementation Requirements
1. **EvidenceLattice SVG (`app/signin/evidence-lattice.tsx`)**:
   - Structure paths with static base tracks (`stroke-accent/20` and `stroke-sage/40`).
   - Add overlay flow paths with `pathLength="100"`, `strokeDasharray="16 84"` (or proportional flowing dash pattern), `stroke="currentColor"`, `className="stroke-accent"`, and `data-anim="lattice-flow"`.
   - Add `data-anim="lattice-hub-pulse"` on the central outer ring (`r=19`) with subtle opacity/scale pulse.
2. **LandingMotion (`app/signin/landing-motion.tsx`)**:
   - In `createScrollReveals`, when the pipeline section timeline triggers, start the continuous seamless looping tween for `[data-anim="lattice-flow"]` (`strokeDashoffset: -100`, `duration: 2.2`, `ease: "none"`, `repeat: -1`).
   - Add a subtle synchronized looping pulse on `[data-anim="lattice-hub-pulse"]` (`autoAlpha: 0.35` to `0.9`, `duration: 1.1`, `yoyo: true`, `repeat: -1`, `ease: "power1.inOut"`).
   - Ensure all animations are scoped to `rootRef` and cleanly reverted by `useGSAP` on component unmount.
3. **Accessibility**:
   - Maintain `aria-hidden="true"` and `focusable="false"` on the decorative SVG.
   - Respect `prefers-reduced-motion: reduce` unconditionally via `gsap.matchMedia()`.

## Evidence Classification Impact
none — no evidence data path. This is a decorative preview diagram on the unauthenticated landing/sign-in page.

## Hallucination-Guard Implications
none — no brief generation or guard verification takes place on this surface.

## Security Requirements
- Client-side visual only, no state mutations or external data fetches.

## Acceptance Criteria
- [ ] The EvidenceLattice on the landing page displays continuous flowing green streams along all verified paths from left to right.
- [ ] The gap link remains distinctly sage/dashed and does not show verified green flow.
- [ ] The animation runs at a smooth 60fps without layout shifts or memory leaks.
- [ ] Navigating away / unmounting cleans up all GSAP tweens cleanly.
- [ ] Users with `prefers-reduced-motion: reduce` see the static lattice without infinite animation loops.
- [ ] TypeScript check and build succeed without errors.

## Checks to Run
- `npx tsc --noEmit`
- `npm run build`

## Exact Manual Test Steps Expected After Implementation
1. Run `npm run dev` and open `http://localhost:3000/signin` in a browser.
2. Scroll to the "Traceability Pipeline" section (or observe on load).
3. Verify that green streams/pulses continuously flow along the curved lines from the evidence circles on the left through the center brief node to the outcome squares on the right.
4. Verify the bottom-left gap path remains dashed sage without flowing green.
5. In browser DevTools, toggle "Rendering -> Emulate CSS media feature prefers-reduced-motion: reduce" and verify all continuous animation pauses cleanly.
