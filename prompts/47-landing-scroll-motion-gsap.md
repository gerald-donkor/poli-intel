# 47 — Landing scroll narrative: GSAP, ScrollTrigger, SplitText

Executes **after** `46-landing-visual-polish-and-google-mark.md`. Prompt 46 builds
the artwork and the Google mark; this prompt animates them. Running 47 first
leaves it with nothing to animate.

## Goal

Give the unauthenticated landing surface (`/signin`) a scroll-driven motion
narrative built on GSAP: SplitText line/word reveals with a blur lift, a
zoom-out on the contour artwork paired with a zoom-in on the sign-in card,
scrubbed parallax, DrawSVG line-drawing on the evidence lattice, batched card
reveals, and snapped number counters.

Scope is `app/signin/` and the AGENTS.md amendment below. No authenticated route,
no `/field` route, and no governance surface is touched.

## The rule this changes, and why

**This prompt deliberately deviates from `AGENTS.md` §6 and §11.9, at the user's
explicit request.** Those rules currently read "GSAP anywhere except the impact
map" as a prohibition and cap UI motion at 150–300ms. A scroll narrative on the
landing page breaks both. Per §2.1 a deviation is legitimate only when the user
explicitly asks, the reason is recorded, and **the rule is intentionally
changed** — so amending AGENTS.md is part of this prompt's work, not a follow-up.

The carve-out is narrow and principled. The motion budget exists for two
reasons: authenticated working surfaces must stay calm under pressure, and
governance state — urgency reclassification, guard flags, the classification
queue — must never be animated, because silent movement is how a reviewer gets
surprised or a backlog gets missed. **The landing page renders none of that.** It
is the public front door: no signal, no flag, no evidence, no queue count, no
product data of any kind. Motion there does the job §11.9 actually asks of it —
it explains the traceability pipeline to someone who has never seen the product.

### The amendment (part of this implementation)

`AGENTS.md` §6 "Do not use" bullet becomes:

> - GSAP outside the impact map and the unauthenticated landing surface
>   (`app/signin/`), or Motion for the impact map

`AGENTS.md` §11.9 gains a second sentence:

> The unauthenticated landing surface (`app/signin/`) is the one exception to the
> duration cap: it carries a scroll narrative whose reveals run to ~1.2s and
> whose scrubbed sequences are tied to scroll position rather than a clock. It
> renders no signal, flag, evidence, or queue state, so none of the reasons the
> cap exists apply to it. Every authenticated route stays at 150–300ms.

`AGENTS.md` §3 gains `gsap-scrolltrigger`, `gsap-performance`, and `gsap-utils`
to the GSAP skill list, and its "the impact map's line-drawing sequence only"
gloss becomes "the impact map and the landing surface".

**What the amendment does not touch:** §11.10 (`prefers-reduced-motion`, and
never animating an automatic urgency reclassification) and §11.13 (WCAG 2.1 AA)
stay hard requirements, in full, on this surface. §11.11 "if in doubt, cut the
animation" still governs every individual choice below.

## Skills read

- `gsap-core` — tween methods, eases, stagger, `gsap.matchMedia()`
- `gsap-timeline` — sequencing and the position parameter
- `gsap-scrolltrigger` — `start`/`end`, `scrub`, `toggleActions`, `batch()`,
  `clamp()`, refresh order, cleanup
- `gsap-plugins` — SplitText (`autoSplit`, `onSplit`, `mask`, `aria`), DrawSVG
- `gsap-react` — `useGSAP()`, `scope`, `contextSafe`, SSR rules
- `gsap-performance` — transform/opacity only, `will-change` discipline, stagger
  over N tweens, pin only what is needed
- `gsap-utils` — `snap` for the counters, `clamp` for trigger bounds
- `design-system` (project) + `design_handoff_evibrief/design-system.md`
- `frontend-design` (vendor)

Skills re-enabled from `.agents/skills.disabled/` for this work (§3):
`gsap-scrolltrigger`, `gsap-performance`, `gsap-utils`, `gsap-frameworks`.
**`eval-engineering` was left disabled** — it covers LLM evaluation suites, has
no bearing on landing-page motion, and is not on §3's approved list.

## Existing code inspected

- All of `app/signin/` as it stands after prompt 46
- `package.json` — `gsap@^3.15.0`, `@gsap/react@^2.1.2`, `motion@^12.43.0`
- `node_modules/gsap/` — confirmed `ScrollTrigger.js`, `SplitText.js`,
  `DrawSVGPlugin.js` all present; GSAP 3.15 ships every plugin free, so no
  `.npmrc`, no auth token, no private registry
- `app/globals.css` — the `prefers-reduced-motion` base rule

## Decisions and assumptions

### 1. One animation system per surface: GSAP takes `app/signin/` outright

`landing-hero.tsx` and `pipeline-preview.tsx` currently use Motion
(`motion/react`). Running Motion and GSAP on the same page means two schedulers,
two reduced-motion mechanisms, and two cleanup models fighting over the same
nodes. **Motion is removed from `app/signin/` entirely** and its fades are
re-expressed in the GSAP timeline. Motion stays the system everywhere else in the
product; this is a surface-level swap, not a dependency change.

### 2. Server Components stay Server Components

Rather than marking every section `"use client"` to hold a `useGSAP()` call, one
client component — `app/signin/landing-motion.tsx` — wraps the page's children
and owns the entire timeline, scoped to its own ref. Sections stay server-rendered
and expose targets as `data-anim="…"` attributes.

`capabilities-grid.tsx`, `landscape-section.tsx`, and `landing-footer.tsx` are
server components today and **stay** server components. Only
`pipeline-preview.tsx` keeps `"use client"`, because it has real `useState` for
the active stage.

### 3. Everything is a `.from()`, so the server HTML is the final state

Entrances use `gsap.from()` / `gsap.fromTo()` created inside `useGSAP()`. The
SSR'd markup is already the finished layout: nothing is hidden by default CSS, so
there is no flash of invisible content if JS is slow, blocked, or broken, and no
CLS. A visitor with JS disabled gets the complete page, statically.

This rules out the common `opacity-0` + "reveal on scroll" pattern — that pattern
leaves content permanently invisible when the script fails, which on a page whose
job is institutional credibility is unacceptable.

### 4. `prefers-reduced-motion` is handled by `gsap.matchMedia()`, not CSS

The global CSS rule in `globals.css` kills CSS animation but **cannot** stop
JS-driven animation. The whole timeline is built inside `gsap.matchMedia()` with
a `reduceMotion: "(prefers-reduced-motion: reduce)"` condition. When it matches,
**no tween and no ScrollTrigger is created at all** — since §3 means the DOM is
already in its final state, doing nothing is exactly correct. No "instant"
tweens, no `duration: 0` stand-ins.

The same `matchMedia` call carries `isLaptop: "(min-width: 1000px)"` so heavier
effects (parallax scrub, the pinned lattice sequence) exist only where there is
room for them, and are auto-reverted when the query stops matching.

### 5. The animation inventory

Each one earns its place; none is a flourish for its own sake.

**On load (hero, no scroll):** one timeline, ~1.2s total.

| # | Target | Effect |
|---|---|---|
| 1 | Institutional badge | `y: 8`, `autoAlpha: 0` → in, 0.35s |
| 2 | `h1` | SplitText `type: "lines, words"`, `mask: "lines"`; words rise from `yPercent: 110` with `filter: blur(10px)` → 0, stagger 0.02, 0.7s, `power3.out` |
| 3 | Lede paragraph | SplitText by lines, mask, `y: 14` + blur 6px, stagger 0.06 |
| 4 | Telemetry metric cards | stagger 0.05, `y: 12`, `autoAlpha: 0` |
| 5 | Sign-in card | **zoom-in**: `scale: 0.955`, `y: 18`, `filter: blur(8px)` → 0, 0.6s `power2.out`, overlapping (2) at `-=0.35` |
| 6 | Contour field artwork | **zoom-out**: `scale: 1.08` → 1 over 1.1s, `ease: "none"` |

**On scroll (ScrollTrigger):**

| # | Target | Trigger behaviour |
|---|---|---|
| 7 | Contour field | `scrub: 1` parallax, `yPercent: -12` across the hero, laptop+ only |
| 8 | Header | `toggleClass` at `start: "top -80"` — border and shadow appear once the hero scrolls under it |
| 9 | Pipeline section | timeline, `start: "top 70%"`, `toggleActions: "play none none none"`: the three stage cards rise + unblur (stagger 0.12), then DrawSVG draws the lattice connectors `0% 0%` → `0% 100%` at 0.5s each, accent solid first, dashed sage gap-path last |
| 10 | Capabilities grid | `ScrollTrigger.batch` with `batchMax: 4`, `interval: 0.08`, `start: "top 85%"`, `once: true` — `y: 24`, blur 6px, `autoAlpha: 0`, stagger 0.08 |
| 11 | Landscape blockquote | SplitText by lines with `mask: "lines"`, `start: "top 75%"` — lines wipe up, stagger 0.09 |
| 12 | Landscape locator rings | rings scale from 0.7 with `stagger: { each: 0.08, from: "center" }`; connector drawn with DrawSVG |
| 13 | Landscape counters | `gsap.to({v:0}, …)` with `snap: { v: 1 }` writing `textContent`; `"14+"`/`"100%"` keep their suffix via a `onUpdate` formatter |
| 14 | Footer | single batched fade-up, `y: 16` |

**Not built, deliberately:** no ScrollSmoother (it hijacks native scroll and
breaks keyboard paging and browser find), no pinned full-viewport section (a
1.2m-tall pin is hostile on a laptop and worse on a phone), no horizontal
`containerAnimation` scroll, no ScrambleText, no Draggable, no GSDevTools in the
shipped bundle, no looping animation anywhere. §11.11 applied.

### 6. SplitText accessibility and font timing

- `aria: "auto"` (the default) on every split, so the source element keeps an
  `aria-label` and the generated line/word spans are `aria-hidden`. A screen
  reader reads the heading once, intact.
- `autoSplit: true` with the animation created **inside `onSplit()`** and
  **returned** from it, so a webfont finishing after hydration or a resize
  re-splits with correct line breaks and re-syncs progress instead of stranding
  half-animated spans.
- `font-kerning: none` on split headings only, to prevent the kerning jump.
- No `text-wrap: balance` on any split element — it interferes with splitting.
  Existing `text-balance` on the `h1` is removed and the width capped instead.
- SplitText is reverted by `useGSAP()`'s automatic cleanup; nothing manual.

### 7. Performance constraints

Only `transform`, `opacity`, and `filter` are animated — never `width`,
`height`, `top`, `left`, or `margin`. `autoAlpha` is used over raw `opacity` so
hidden elements leave the hit-testing path.

`filter: blur()` is the one genuinely expensive property here. It is capped at
10px, applied only to text runs and two cards, always animated **to** `blur(0px)`
and then cleared with `clearProps: "filter"` on complete so no element keeps a
blur layer alive after its entrance. `will-change` is set in CSS on the four
elements that actually animate on load and nowhere else.

Every ScrollTrigger is created in page order (hero → pipeline → capabilities →
landscape → footer) so refresh order matches layout order and no
`refreshPriority` juggling is needed.

### 8. Registration happens once, client-side

`app/signin/landing-motion.tsx` is the only module that imports GSAP:

```ts
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);
```

Plugins are imported from `gsap/ScrollTrigger`, `gsap/SplitText`,
`gsap/DrawSVGPlugin`. Nothing GSAP-related is imported into a Server Component,
a Server Action, a Route Handler, or a job — GSAP never runs during SSR (§5.3,
§18).

## Files likely to change

- `AGENTS.md` — §3 skill list, §6 GSAP bullet, §11.9 duration exception
- `app/signin/landing-motion.tsx` — **new**, client, owns the whole timeline
- `app/signin/page.tsx` — wrap sections in `<LandingMotion>`
- `app/signin/landing-hero.tsx` — drop `motion/react`, becomes a Server
  Component, add `data-anim` hooks
- `app/signin/pipeline-preview.tsx` — drop `motion/react`, keep `"use client"`
  for stage state, add `data-anim` hooks and stable ids on the lattice paths
- `app/signin/capabilities-grid.tsx` — `data-anim="capability-card"` per card
- `app/signin/landscape-section.tsx` — `data-anim` on quote, rings, counters;
  counters get a `data-count-to` and `data-count-suffix`
- `app/signin/landing-header.tsx` — scrolled-state classes
- `app/signin/landing-footer.tsx` — `data-anim` hooks
- `app/signin/evidence-lattice.tsx`, `landscape-locator.tsx`, `contour-field.tsx`
  (from prompt 46) — named ids/classes on the paths DrawSVG targets, and an
  explicit `stroke` + `stroke-width` on every drawn path (DrawSVG needs a visible
  stroke or it draws nothing)
- `app/globals.css` — a small `will-change` / `font-kerning` utility block for
  the split headings

No schema, action, job, auth, or data-layer file changes. `app/signin/actions.ts`
is untouched.

## Implementation requirements

1. **All GSAP runs client-side inside `useGSAP()`** with `{ scope: rootRef }`.
   No `gsap.*` or `ScrollTrigger.*` call at module scope, in a Server Component,
   or during SSR.
2. **Every selector is scoped.** No bare selector string escapes the wrapper's
   scope ref.
3. **The reduced-motion branch creates nothing.** Verified by asserting
   `ScrollTrigger.getAll().length === 0` in the dev check, not by eyeballing it.
4. **ScrollTrigger goes on the timeline, never on a child tween** — the skill's
   explicit "Do Not". No nested ScrollTriggered animation inside a parent
   timeline.
5. **`scrub` and `toggleActions` are never combined** on the same trigger.
6. **`markers: false`** — no dev markers reach the committed code, and GSDevTools
   is not imported.
7. **Cleanup is automatic via `useGSAP()`.** `gsap.matchMedia()` instances are
   reverted on unmount. No stray ScrollTrigger survives navigation to a
   dashboard route after sign-in.
8. **No new colour, token, or font.** Motion changes position, scale, opacity,
   blur, and stroke-dash only — never a fill or text colour, so nothing here can
   introduce a palette or contrast regression.
9. **The serif stays quotation-only** (§11.6). The landscape blockquote is split
   and animated but keeps `font-serif`; no split heading gains it.
10. **Keyboard and focus are unaffected.** No animation traps focus, no element
    is left `visibility: hidden`, no `pointer-events: none` outlives its tween,
    and tab order is unchanged. Focusing an element below the fold must not
    strand it mid-reveal — `once: true` reveals complete on trigger regardless.
11. **Counters are decorative duplicates of static text**, not the only source of
    the number: the SSR'd markup carries the final value, and the tween counts
    from 0 up to it. A blocked script leaves the correct figure on screen.
12. **Cursor rules (§11.16)** unchanged from prompt 46.

## Evidence classification impact

None — no evidence data path. `/signin` is the unauthenticated surface. This
prompt adds only client-side presentation code: no Prisma query, no Gemini call,
no embedding, no evidence text rendered, no classification read or written. The
numbers animated by the counters are static institutional facts already committed
in prompt 45 (landscapes, CREMA partners, network countries), not queried field
data. Nothing new is logged or transmitted, so §7.6's prohibition on evidence
text in logs and analytics payloads is not engaged.

## Hallucination-guard implications

None. This surface renders no generated prose, no extracted claims, and no
flags. Nothing changes about claim extraction, flag storage, flag rendering, or
what a flag blocks. Note specifically that §9.7's flag contract — slate, a single
gentle 900ms pulse, never a blink or a loop — is **not** relaxed by the §11.9
amendment: the amendment is scoped to `app/signin/`, and no flag renders there.

## Security requirements

- No secret, env var, or `NEXT_PUBLIC_*` value reaches the motion layer.
- GSAP stays a client-bundle dependency of one route group; it is never imported
  into a Server Action, Route Handler, Inngest job, or the AI layer (§18).
- No external script, CDN, or font host is added — GSAP is already a local npm
  dependency and all plugins ship in the public package.
- The page remains statically renderable for unauthenticated visitors; the
  `getCurrentStaffUser()` redirect in `page.tsx` is unchanged and still runs
  server-side before any markup is sent.
- No analytics or telemetry event is added to this surface.

## Acceptance criteria

- [ ] `AGENTS.md` §3, §6, and §11.9 carry the amendment, with the reason recorded.
- [ ] `motion/react` no longer appears anywhere in `app/signin/`.
- [ ] The hero timeline runs on load: badge, split heading with blur lift, lede,
      metrics, card zoom-in, artwork zoom-out — ~1.2s, no jank.
- [ ] Scrolling drives the parallax, header state, lattice DrawSVG sequence,
      batched capability cards, blockquote line wipe, locator rings, and counters.
- [ ] With JS disabled, the full page renders correctly and every number, heading,
      and paragraph is present and legible.
- [ ] With "Reduce motion" on, `ScrollTrigger.getAll()` is empty, nothing moves,
      and the page is identical to its final state.
- [ ] No `markers: true`, no GSDevTools import, no `scrub` + `toggleActions` pair,
      no ScrollTrigger on a child tween.
- [ ] Navigating from `/signin` into a dashboard route leaves no live
      ScrollTrigger or tween behind.
- [ ] No horizontal page scroll at 320, 390, 760, 1000, 1300, 1600px, with
      animation running and with it reverted.
- [ ] Screen reader announces each split heading and the blockquote once, intact.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` pass,
      with only the two known vendored lint errors.

## Checks to run

```
npm run lint
npm run typecheck
npm run test
npm run build
```

## Manual test steps

1. `npm run dev`, hard-reload <http://localhost:3000/signin>.
2. Watch the load sequence: the heading's words rise out of their line masks and
   come out of blur; the sign-in card scales up as the contour field settles out
   of its zoom. Nothing flashes invisible first.
3. Scroll slowly to the pipeline section — the three stage cards lift, then the
   lattice connectors draw, solid accent paths before the dashed gap path.
4. Continue past the capabilities grid — cards arrive in batches of up to four,
   not all at once and not one-by-one down a long chain.
5. In the landscape section, confirm the blockquote wipes line by line, the
   locator rings scale from the centre outward, and 2 / 14+ / 10 / 100% count up
   and land on exactly those values, suffixes intact.
6. Scroll back up: reveals do not replay or reverse (`once: true` / `play none
   none none`), and nothing re-blurs.
7. Enable "Reduce motion" in the OS, reload, and confirm the page is fully laid
   out and completely still. In DevTools console run
   `window.ScrollTrigger?.getAll?.().length` — expect `0` or `undefined`.
8. Disable JavaScript entirely and reload — the page is complete, the counters
   show their real figures, and the sign-in card is fully visible.
9. Resize through 320 / 390 / 760 / 1000 / 1300 / 1600px while scrolling. Parallax
   and the pinned-free lattice sequence appear only at 1000px+; nothing overflows
   horizontally at any width.
10. Sign in, land on the dashboard, then run
    `window.ScrollTrigger?.getAll?.().length` again — expect `0`.
11. Tab from the header to the footer with the page at the top: focus moves in
    DOM order, every focused control is scrolled into view and fully visible, and
    no reveal leaves a focused element blurred or transparent.
