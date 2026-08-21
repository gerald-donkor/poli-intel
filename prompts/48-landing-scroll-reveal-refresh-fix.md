# 48 — Fix inconsistent capability-card reveal on `/signin` refresh

Executes **after** `47-landing-scroll-motion-gsap.md`. Prompt 47 built the scroll
narrative this prompt repairs; it does not revisit any of prompt 47's design
decisions except the one race condition described below.

## Goal

On `/signin`, refreshing the page while scrolled into the "Built for
Evidence-Based Policy Influence" capabilities grid (`app/signin/capabilities-grid.tsx`)
shows an inconsistent result from reload to reload: sometimes all four cards
render in their final state immediately; sometimes the first one or two cards
render correctly while the remaining cards are stuck part-way through their
entrance tween — visibly lower opacity, still blurred, slightly offset — and
never recover on their own. Screen recording evidence:
`/home/gdk26/Videos/Screencasts/Screencast_20260821_131934.webm`, frames
extracted and reviewed directly (not just described): at the first reload
captured, cards 1–2 render at full opacity/no blur while cards 3–4 sit at a
frozen partial-tween state for the remainder of the clip (multiple refreshes,
~15+ seconds), never completing until a later reload happens to land in the
fully-rendered state.

Fix the race so the capabilities grid (and any other batched/scroll-triggered
reveal built in prompt 47) renders deterministically on every reload,
regardless of scroll position at load time.

## Skills read

- `gsap-scrolltrigger` — `refresh()` timing, `batch()` semantics, `once`,
  `toggleActions`, what "refresh" recalculates and when it's safe to call
- `gsap-core` — `matchMedia()`, `.from()`, `overwrite`
- `gsap-react` — `useGSAP()` lifecycle and when child effects run relative to
  layout/fonts
- `design-system` (project) — motion budget context, unaffected by this fix

No `evidence-governance` read is required — confirmed below under "Evidence
classification impact."

## Existing code inspected

- `app/signin/landing-motion.tsx` — the entire scroll narrative from prompt 47,
  in particular:
  - `ScrollTrigger.batch('[data-anim="capability-card"]', { start: "top 85%", once: true, ... })`
    (lines ~234–250)
  - the single deferred refresh at the bottom of the effect:
    `void document.fonts?.ready.then(() => ScrollTrigger.refresh());` (line 348)
  - the equivalent footer batch (line ~330), which is exposed to the same race
- `app/signin/page.tsx` — confirms nothing resets scroll position or opts out
  of browser scroll restoration anywhere in the route
- `app/signin/capabilities-grid.tsx` — confirms the four cards are plain,
  identically-shaped DOM siblings (`data-anim="capability-card"`); nothing
  about their markup explains why only some are affected — the split is
  purely about timing, not structure
- `node_modules/gsap/ScrollTrigger.js` behavior for `batch()` and `refresh()`
  as documented in the `gsap-scrolltrigger` skill

## Root cause

Chrome (and Brave/Chromium generally) restores scroll position on a hard
reload by default. Reloading while scrolled into the capabilities section
means the page paints already past the batch's `start: "top 85%"` threshold
for some or all four cards — there is no future scroll *event* that will ever
cross that threshold for cards already above it.

`landing-motion.tsx` creates every ScrollTrigger, including the capability
card batch, before webfonts have necessarily settled, then separately calls
`ScrollTrigger.refresh()` once `document.fonts.ready` resolves (comment: "Line
breaks move when a webfont lands, which moves every trigger below it."). That
comment is correct and the refresh is necessary — but it creates a second,
asynchronous pass over trigger geometry that lands at an unpredictable time
relative to:

1. GSAP's own initial auto-refresh, which — evaluating pre-font-settle,
   possibly-wrong geometry — decides some already-scrolled-past cards have
   "entered" and fires the batch's `onEnter` tween for them immediately, and
2. that tween's own 0.55s run time.

If the fonts-ready refresh lands **before** a given card's batch tween starts,
geometry is correct by the time entry is evaluated and it behaves fine. If it
lands **during** that tween — a real possibility since Google Fonts loading is
network-dependent and not synchronized with a 0.55s local animation — the
recalculated trigger geometry (now using real font metrics, which reflow the
page and can shift the capabilities section's pixel offset) can put a card's
recomputed `start` position on the other side of the current scroll offset
from where it started. Because the per-card entry decision is now
inconsistent with the tween already in flight, and `once: true` gives the
batch no further hook to finish or reconcile that tween, the card is left
exactly where GSAP's internal state stopped updating it: a frozen partial
`y` / `autoAlpha` / `filter` value that never resolves to the final state.

This explains every observed symptom: it is timing-dependent (network font
load speed vs. a fixed local tween duration), it affects some cards and not
others (whichever cards' recomputed geometry happens to straddle the boundary
at the moment refresh lands), and a stuck card never recovers without a fresh
reload landing in a different part of the race.

The precondition that makes this race possible at all is that reloading lands
mid-section rather than at the top of the page. Prompt 47's own stated design
rule — "everything is a `.from()`... no `opacity-0` + reveal-on-scroll, which
strands content permanently when a script fails" — is exactly the failure mode
happening here, just triggered by a scroll-restoration/refresh-timing race
instead of a blocked script.

## Decisions and assumptions

### 1. Reset scroll to the top before any ScrollTrigger is created

Browser scroll restoration is disabled for this route
(`history.scrollRestoration = 'manual'` set at the top of the `useGSAP()`
effect, before `matchMedia`/ScrollTrigger setup, restored on cleanup) and the
window is scrolled to `{ top: 0 }` synchronously at the same point. This is
the primary fix: with every load starting at the top of the page, no batch or
ScrollTrigger is ever asked to decide the "already past, already entered"
question for content the visitor hasn't scrolled to yet, and the entrance
sequence replays identically on every reload — which is also better,
consistent, intended UX for a scroll narrative than resuming mid-scroll into
an unannounced section.

This is scoped to `app/signin/landing-motion.tsx` only. No other route's
scroll behavior changes.

### 2. Don't let a mid-flight refresh strand a tween, as defense in depth

Even with (1), keep the fix robust to any future page that might reasonably
load pre-scrolled (e.g. a deep link with a scroll-restoring back-navigation
within the same session, which `scrollRestoration = 'manual'` also prevents,
but is worth reasoning about explicitly). `ScrollTrigger.batch()` calls for
`capability-card` and `footer-item` gain `fastScrollEnd: true` is **not**
used (it changes unrelated leave behavior); instead the fonts-ready refresh is
moved to run through `ScrollTrigger.refresh(true)` only after confirming (via
the skill's documented guidance) that a full recalculation mid-animation is
safe, or — if the skill's guidance says otherwise — the fonts-ready refresh is
switched from being purely reactive to gating initial ScrollTrigger/batch
*creation* until fonts are ready, so there is only ever one geometry pass, not
two racing ones. Pick whichever of these the skill actually recommends; do not
guess at undocumented GSAP internals. Record which approach was taken and why
in the implementation.

### 3. No change to the animation inventory, tokens, or motion budget

This is a bug fix, not a redesign. The batch's `y: 24`, blur, `autoAlpha`,
stagger, duration, and `start: "top 85%"` threshold are unchanged. The footer
batch gets the same treatment for consistency, since it shares the identical
`ScrollTrigger.batch(...)` + `once: true` shape and is exposed to the same
race, even though it wasn't the one caught on camera.

## Files likely to change

- `app/signin/landing-motion.tsx` — scroll-restoration reset, and whatever
  refresh-timing fix (2) resolves to
- No change expected to `capabilities-grid.tsx`, `page.tsx`, or any other
  `app/signin/` file — this is purely a timing fix inside the motion
  controller

## Implementation requirements

1. `history.scrollRestoration` is set to `'manual'` for the lifetime of this
   component and restored to its prior value (`'auto'`) on cleanup, so
   navigating away and back elsewhere in the app is unaffected.
2. The window is scrolled to the top synchronously before `matchMedia`/
   ScrollTrigger setup runs, so no ScrollTrigger is ever created while the
   page is pre-scrolled.
3. The webfont-triggered `ScrollTrigger.refresh()` call is resolved per
   decision (2) above — either proven safe as a second pass, or restructured
   so trigger creation itself waits on font readiness. Whichever is chosen,
   no batch tween can be left in a partially-animated, unresolved state by a
   later geometry recalculation.
4. `prefers-reduced-motion` behavior (§11.10, unchanged from prompt 47) is
   unaffected: the reduced-motion branch still creates nothing, and the
   scroll-reset in (1)/(2) runs regardless of the `reduceMotion` condition
   (resetting scroll position is not itself motion).
5. No new dependency, token, color, or duration is introduced.
6. Cleanup remains automatic via `useGSAP()`; the added
   `history.scrollRestoration` restore is the one manual cleanup step and must
   run even if the component unmounts before fonts resolve.

## Evidence classification impact

None — no evidence data path. This is a timing fix inside client-side motion
code on the unauthenticated `/signin` surface. No Prisma query, Gemini call,
evidence text, or classification value is read, written, or touched.

## Hallucination-guard implications

None. No generated prose, claim, or flag exists on this surface; nothing about
extraction, storage, rendering, or approval-blocking changes.

## Security requirements

- No new dependency, script, or external host is introduced.
- `history.scrollRestoration` and `window.scrollTo` are standard browser APIs
  with no data implication; nothing here reads or transmits page content.
- The page remains statically renderable for unauthenticated visitors; the
  server-side `getCurrentStaffUser()` redirect in `page.tsx` is untouched.

## Acceptance criteria

- [ ] Hard-reloading `/signin` from a scroll position inside or past the
      capabilities grid always results in the visible cards rendering at
      their correct, final, fully-opaque, unblurred state within one frame —
      no card is ever left in a partial-tween state.
- [ ] Repeating the hard reload at least 10 times (including with the network
      throttled to simulate slow webfont loading, and with it unthrottled)
      produces the same correct result every time — no flakiness.
- [ ] The footer batch reveal is equally reliable under the same repeated-reload
      test.
- [ ] Scrolling from the top of a freshly loaded page still plays the full,
      correct entrance sequence exactly as prompt 47 specified (hero timeline,
      parallax, pipeline lattice draw, batched capability cards, blockquote
      wipe, locator rings, counters) — this fix changes *when* geometry is
      settled, not what plays.
- [ ] `history.scrollRestoration` is restored to its previous value when
      navigating away from `/signin` (e.g. after sign-in, into a dashboard
      route) — verified by checking `history.scrollRestoration === 'auto'`
      after navigation.
- [ ] "Reduce motion" behavior is unchanged: `ScrollTrigger.getAll()` is still
      empty when the OS preference is on.
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

1. `npm run dev`, open `http://localhost:3001/signin` (or whatever port `npm
   run dev` binds).
2. Scroll down until the capabilities grid ("Built for Evidence-Based Policy
   Influence") is roughly centered in the viewport.
3. Hard-reload (Ctrl+Shift+R) at least 10 times in a row. Confirm all four
   cards render fully visible, unblurred, and correctly positioned every
   single time — no card stuck fading, no card frozen mid-slide.
4. Repeat step 3 with DevTools Network throttling set to "Slow 3G" to widen
   the window in which the webfont-ready refresh could race a tween, and
   confirm the same reliability.
5. Repeat scrolled into the footer instead, and confirm the footer items are
   equally reliable across repeated hard reloads.
6. From the top of the page, reload once and watch the full entrance sequence
   play uninterrupted end to end, matching prompt 47's manual test steps 2–5.
7. Sign in, land on the authenticated dashboard, and in the console run
   `history.scrollRestoration` — expect `"auto"`.
8. Enable "Reduce motion" in the OS, reload while scrolled into the
   capabilities grid, and confirm the page is fully laid out and completely
   still (no partial-tween artifact, since no tween was ever created).
