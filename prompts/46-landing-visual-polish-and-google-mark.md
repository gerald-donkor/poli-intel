# 46 — Landing page visual polish, structural artwork, and the Google mark

## Goal

Raise the unauthenticated landing + sign-in surface (`/signin`) from "correct" to
"considered": add the Google logo to the sign-in action, introduce bespoke
structural artwork so the page has visual anchors instead of five stacked text
blocks, tighten the type scale where arbitrary pixel overrides fight the tokens,
and verify true responsiveness from 320px to 1600px+.

No new routes, no new copy sections, no scope beyond `app/signin/`.

## Skills read

- `design-system` (project) — token location, the four load-bearing rules, the
  `tablet`/`laptop`/`desktop` min-width model, motion budget
- `design_handoff_evibrief/design-system.md` (authoritative) — full `@theme`
  block, utility recipes, §"Iconography" line on abstract structural marks
- `frontend-design` (vendor) — layout and typographic judgment
- `shadcn` — `Button` composition; no new primitive is being added

## Existing code inspected

- `app/signin/page.tsx` — section composition and `alertCopy`
- `app/signin/landing-hero.tsx` — hero grid, telemetry metrics, sign-in card
- `app/signin/sign-in-button.tsx` — `useFormStatus` pending label
- `app/signin/landing-header.tsx`, `landing-footer.tsx`
- `app/signin/pipeline-preview.tsx`, `capabilities-grid.tsx`, `landscape-section.tsx`
- `design_handoff_evibrief/design-system.md` lines 1–140, 224, 243
- Screenshot supplied by the user: `~/Pictures/Screenshots/Screenshot_20260821_105948.png`

## Decisions and assumptions

### 1. "Complementing images" means bespoke structural artwork, not photography

`AGENTS.md` §11.7 and the handoff both forbid stock forest photography and any
leaf/tree glyph. Tropenbos is a research institution that happens to work on
forests; a hero photograph of a canopy is exactly the credibility mistake the
rule exists to prevent. There is also no licensed image asset in the repo.

So the page gets **inline SVG artwork built from the design system's own
vocabulary** — thin-stroke concentric contour rings echoing topographic maps,
lattice/node structures, and a schematic landscape locator. This is what the
handoff means by an image on this product, and it ships as vector: no network
request, no layout shift, theme-token coloured, crisp at every density.

Three pieces, all new components in `app/signin/`:

- `contour-field.tsx` — a wide, low-contrast topographic contour field used as a
  backdrop wash behind the hero column and behind the landscape section's card.
  `aria-hidden`, `pointer-events-none`, masked to fade out at the edges.
- `landscape-locator.tsx` — an abstract schematic of the two operational
  landscapes: nested contour rings with two labelled node markers (Juabeso-Bia,
  Sefwi-Wiawso) and a thin connector. Abstract geometry, no map outline of Ghana
  traced from a source we do not have rights to, no terrain illustration.
- `evidence-lattice.tsx` — a three-column node lattice (evidence → brief →
  outcome) used as the pipeline section's visual: solid accent links for
  traceable paths, dashed sage for the gap case. This deliberately mirrors the
  impact map's language from the handoff's component table so the landing page
  previews the product's real visual grammar rather than inventing a new one.

None of the three animate on load beyond the section's existing 220–280ms
Motion fade. No GSAP — that stays reserved for the impact map (§11.9).

### 2. The Google button becomes Google's light button, not a green button with a coloured logo

Google's brand terms require the multi-colour G to sit on white/light or on
Google's own blue/black. Dropping it into the current filled-`primary` green
button is off-spec for Google *and* muddies the palette.

The sign-in action therefore becomes the **light** treatment: `bg-card`, `border
border-line`, `text-ink`, the official four-colour G at 18px, `h-11 w-full`,
`cursor-pointer`, hover to `bg-stone`. Hierarchy is preserved by size, full
width, `shadow-raised`, and the fact that it is the only action on the card.

The G is a new `components/google-mark.tsx` — the official four-colour path
data, `aria-hidden` (the button's own text is the accessible name), `role`
omitted, fixed `size-[18px]`, `shrink-0`.

**On the red in the logo:** §11.4 bans red/amber/green *as urgency or status
colour*. The Google G is a third-party trademark, not a status signal, and is
not otherwise recolourable without breaching Google's terms. It carries no
product meaning and appears exactly once. Recorded here rather than left as a
silent contradiction.

The pending label stays text-only (`Signing in…`) — no spinner anywhere in this
product — and the mark stays visible while pending.

### 3. Arbitrary pixel sizes stop fighting the type tokens

Several nodes currently carry both a token class and an override, e.g.
`text-h2 ... text-[16px]` and `text-body ... text-[13px]`, where the last-declared
wins by accident rather than by decision. Every such pair is resolved to a single
token (`text-h3`, `text-body`, `text-meta`), and nothing lands below 12px.

### 4. `sm:` is replaced by the project's breakpoints

`landing-footer.tsx` uses Tailwind's default `sm:` once. The handoff defines
`tablet`/`laptop`/`desktop` for exactly this; the stray `sm:` becomes `tablet:`.

### 5. The hero's right column stops being top-heavy

The sign-in card's ring mark currently eats ~120px of empty space above the
heading. It shrinks and moves inline with the "Staff Workspace" eyebrow, and the
reclaimed height goes to a compact governance strip under the button that says
what the domain restriction actually means.

## Files likely to change

- `app/signin/sign-in-button.tsx` — Google light button treatment
- `components/google-mark.tsx` — **new**, official four-colour G
- `app/signin/contour-field.tsx` — **new**
- `app/signin/landscape-locator.tsx` — **new**
- `app/signin/evidence-lattice.tsx` — **new**
- `app/signin/landing-hero.tsx` — backdrop wash, card rebalance, metric type fixes
- `app/signin/pipeline-preview.tsx` — lattice artwork, responsive stage rail
- `app/signin/capabilities-grid.tsx` — type-token cleanup, 4-up → 2-up → 1-up check
- `app/signin/landscape-section.tsx` — locator artwork, contour wash
- `app/signin/landing-footer.tsx` — `sm:` → `tablet:`, type-token cleanup
- `app/signin/landing-header.tsx` — small-screen truncation of the status pill

No server, data, auth, or action file changes. `app/signin/actions.ts` is untouched.

## Implementation requirements

1. **Artwork is decorative and inert.** Every SVG is `aria-hidden="true"` and
   `pointer-events-none`, and carries no text a screen reader would announce.
   Colours come from theme tokens via `currentColor`/`stroke` classes, never
   hard-coded hex — with the single exception of the Google mark's brand colours.
2. **No new tokens, no `globals.css` change.** If a shade is needed, compose it
   from an existing token with an opacity modifier.
3. **The serif stays quotation-only.** The landscape blockquote keeps
   `font-serif`; no artwork label, caption, or heading may use it (§11.6).
4. **No leaf, tree, canopy, or terrain motif** in any of the three SVGs, and no
   raster asset added to `public/`.
5. **Motion budget unchanged.** No new animation; existing Motion fades keep
   their `useReducedMotion()` guard. Artwork is static.
6. **Cursor rules (§11.16).** The sign-in button and the pipeline stage triggers
   carry `cursor-pointer`; the disabled pending button carries
   `cursor-not-allowed`.
7. **Contrast.** Any new pairing (ink-3 on stone, sage strokes on paper,
   `text-ink` on `bg-card` for the Google button) is checked to 4.5:1 for text
   before it ships. Artwork strokes are non-text and exempt but stay above the
   3:1 non-text threshold where they carry structure.
8. **Responsiveness is verified, not assumed.** Base (unprefixed) classes are the
   phone layout; `tablet:`/`laptop:`/`desktop:` add columns. No horizontal page
   scroll at 320px. The pipeline stage rail scrolls inside its own
   `overflow-x-auto` container if it cannot stack.

## Evidence classification impact

None — no evidence data path. `/signin` is the unauthenticated marketing and
sign-in surface. It reads no `evidence_item`, renders no evidence text, makes no
Gemini call, and issues no Prisma query beyond the existing session lookup in
`page.tsx`, which this prompt does not touch. All copy is static institutional
prose already committed in prompt 45; the numbers in the telemetry and landscape
strips are product descriptions, not queried field data.

## Hallucination-guard implications

None. This surface renders no generated prose, no claims, and no flags, and
changes nothing about claim extraction, flag storage, flag rendering, or what a
flag blocks.

## Security requirements

- No secret, env var, or `NEXT_PUBLIC_*` value reaches the new components.
- The page stays statically renderable for unauthenticated visitors; the existing
  `getCurrentStaffUser()` redirect in `page.tsx` is unchanged.
- No external asset host — every image is inline SVG, so no new origin is
  introduced and no CSP or `next.config` change is needed.
- No analytics call is added to this surface.

## Acceptance criteria

- [ ] The sign-in action shows the official four-colour Google G beside
      "Continue with Google", on a light card-surface button, and still submits
      the existing `signInWithGoogle` Server Action.
- [ ] Pending state reads "Signing in…", keeps the mark, is `disabled`, and shows
      `cursor-not-allowed`.
- [ ] Three inline-SVG artwork pieces render in the hero, pipeline, and landscape
      sections — all abstract-structural, all `aria-hidden`, none photographic.
- [ ] No leaf/tree/forest imagery anywhere; nothing added to `public/`.
- [ ] No element carries two conflicting font-size classes; no text below 12px.
- [ ] No `sm:` / `md:` / `lg:` variants remain in `app/signin/`.
- [ ] No horizontal page scroll at 320, 390, 760, 1000, 1300, and 1600px.
- [ ] `prefers-reduced-motion` yields instant state changes; artwork is static.
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

1. `npm run dev`, open <http://localhost:3000/signin> signed out.
2. Confirm the Google G renders in colour on a light button; hover shows a
   pointer and a `stone` fill; keyboard-focus shows the accent ring with offset.
3. Click it — Google's consent screen opens (or the existing `AccessDenied`
   path); the button reads "Signing in…" with the mark intact and is not
   clickable during the transition.
4. Visit `/signin?error=AccessDenied` and confirm the guard alert still renders
   inside the card, above the button, and is not pushed off-screen at 390px.
5. Resize through 320 / 390 / 760 / 1000 / 1300 / 1600px. At each width: no
   horizontal scrollbar, artwork does not overflow its section, the telemetry
   grid reflows 2-up → 4-up, the capabilities grid reflows 1 → 2 → 4, and the
   pipeline rail stacks or scrolls inside its own container.
6. Enable "Reduce motion" in the OS and reload — sections appear instantly with
   no fade, and no artwork moves.
7. Tab from the header through to the footer: every interactive element takes a
   visible focus ring, and the sign-in button is reachable without a trap.
