# 41 — Responsive app navigation

## Goal

The header in `components/app-nav.tsx` does not adapt below `laptop`. Below
roughly 900px the six nav links are clipped mid-word inside a scrollbar-hidden
strip, and below `laptop` the search trigger disappears with no touch-reachable
replacement. Make the header usable and legible from 320px to 1600px+ without
inventing a new visual language.

## Skills read

- `design-system` — §Responsive ("there is no `mobile:` variant"; `tablet`
  760px / `laptop` 1000px / `desktop` 1300px are `min-width`, so unprefixed
  classes are the phone layout), "content moves into a `Sheet` drawer" when a
  navigation region collapses, no `destructive`, focus ring is accent + offset,
  micro-interactions 150–300ms, respect `prefers-reduced-motion`.
- `design_handoff_evibrief/design-system.md` — breakpoint tokens (lines 249–282),
  header chrome recipe, `bg-card` / `border-line` / `rounded-card` /
  `bg-surface-tint` active-tab pairing, 13px minimum type.
- `shadcn` — `Sheet` composition; `components/ui/sheet.tsx` is already vendored.

## Existing code inspected

- `components/app-nav.tsx` — the header. `NAV_LINKS` (six entries), the centre
  `<ul>` at line 71, the right cluster at line 93.
- `components/command-palette.tsx` — the trigger button at lines 178–190 is
  `hidden laptop:flex`, so below 1000px there is no way to open the dialog
  except ⌘K, which a touch device does not have. `triggerClassName` is already
  a prop, so the trigger's presentation is overridable from the header.
- `components/user-menu.tsx` — avatar dropdown, no responsive variants; fine
  as-is.
- `components/ui/sheet.tsx`, `components/ui/dropdown-menu.tsx` — available.
- `prompts/03-nav-search-trigger-single-line.md` — prior decision: the trigger
  label is "Search signals & evidence" and must never wrap.

## Diagnosis (what is actually wrong)

Evidence: `Screenshot_20260818_160545.png` and the ~39s screencast
(`Screencast_20260818_160425.webm`, frames extracted at 4s intervals).

1. **Links are clipped mid-word with no affordance.** The centre `<ul>` is
   `flex-1 overflow-x-auto` with both `scrollbar-width: none` and the WebKit
   scrollbar hidden. Once the six links exceed the available width the row
   scrolls inside itself, so the user sees `ls` (the tail of "Signals") on the
   left and `Ir` (the head of "Impact") on the right, with nothing indicating
   that a scroll region exists. At 320–400px only two or three links are
   reachable at all, and the active tab can sit entirely off-screen. The frame
   does not scroll horizontally — that part of the original intent holds — but
   the region is not usable by pointer or touch without a hidden gesture.
2. **Search is unreachable below `laptop`.** `hidden laptop:flex` on the palette
   trigger removes the control on every phone and tablet, and the ⌘K fallback
   named in its own label does not exist on those devices. This is a lost
   control, not a density decision.
3. **No collapsed navigation form exists.** The design system prescribes a
   `Sheet` drawer when a navigation region can no longer be shown inline; the
   header has no such fallback, so there is nothing to collapse *into*.
4. Minor, consequent: the wordmark is `hidden tablet:inline`, leaving only an
   18px square as the home affordance below 760px. That is acceptable once a
   drawer exists, and is not changed here.

## Decisions / assumptions

- **Breakpoint for the switch is `tablet` (760px).** Measured: six links at
  `text-[13px]` with `px-2.5` plus `gap-1` come to roughly 430px; the logo mark
  plus wordmark, the search trigger and the avatar consume the rest. At 760px
  the inline row fits with the wordmark shown and the search collapsed to an
  icon; below it, it does not. So: unprefixed = drawer, `tablet:` = inline row.
- **The drawer is a `Sheet` from the left**, holding the six links stacked as a
  single readable column with the same active treatment (`bg-surface-tint`,
  `text-primary`, `font-medium`) and `aria-current="page"`. It closes on
  navigation. Trigger is a labelled hamburger button (`aria-label="Open
  navigation"`, `aria-expanded` handled by the Sheet primitive).
- **Search gets an icon-only trigger below `laptop`**, same `onClick`, same
  dialog, `aria-label="Search signals and evidence"`, 32px square so it matches
  the existing trigger's height and stays above the 44px-ish touch target once
  padding in the header row is counted. The ⌘K `Kbd` is dropped in that form —
  it is a lie on touch. At `laptop:` and up the existing 240px labelled trigger
  is unchanged. This is done inside `command-palette.tsx` (two responsive forms
  of the same button), not by duplicating the component.
- The centre `<ul>` keeps `overflow-x-auto` as a safety net for very long labels
  at odd widths, but it is no longer the mechanism responsiveness relies on.
- No new tokens, no new colours, no icon beyond `lucide-react`'s `MenuIcon` and
  `SearchIcon` (both already used in the codebase). Nothing animated beyond the
  Sheet's own transition, which already respects `prefers-reduced-motion` via
  the global CSS rule.
- `/field` chrome is untouched — it is a separate surface (§11.12).

## Files likely to change

- `components/app-nav.tsx` — drawer + inline row, responsive variants.
- `components/command-palette.tsx` — second, icon-only trigger form below
  `laptop`.
- Possibly a small `components/app-nav-drawer.tsx` if `app-nav.tsx` grows past
  readable length; preferred only if it does.

## Evidence classification impact

None — no evidence data path. This is header chrome. It renders `NAV_LINKS`,
which are static hrefs, plus the existing `CommandIndex` prop, which is built
elsewhere and already governance-filtered upstream; this change neither reads,
stores, moves, nor transmits evidence, and adds no Gemini call.

## Hallucination-guard implications

None. Nothing here extracts claims, stores flags, renders flags, or gates
approval. No guard surface appears in the header.

## Security requirements

- The nav list stays presentation-only. Adding or hiding a link is not access
  control; every Server Action still authorises server-side (§10.1). No role
  checks are introduced here and none may be relied on.
- No new client-exposed data. `commandIndex` is the same prop already passed.
- Client component only; no data fetching, no mutation, no Route Handler.

## Acceptance criteria

- No horizontal page scroll at 320, 390, 760, 1000, 1300, 1600px.
- Below 760px: hamburger opens a Sheet listing all six destinations; each is
  tappable, the current one is marked `aria-current="page"`, and choosing one
  navigates and closes the drawer.
- At and above 760px: the six links render inline, unclipped, no mid-word
  truncation at any width up to 1600px+.
- The command palette is reachable by pointer/touch at every width — icon-only
  below 1000px, the labelled 240px trigger at and above it.
- Keyboard: hamburger, drawer links, search trigger and avatar are all in tab
  order with the accent focus ring; Escape closes the drawer and returns focus
  to the hamburger.
- Text stays ≥13px; active-tab and link colours are unchanged tokens.
- `prefers-reduced-motion` gives an instant drawer open/close.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`
(the header is in every app route's tree). Report exact output; the four known
pre-existing lint errors in `components/ui/carousel.tsx`, `hooks/use-mobile.ts`,
and `design_handoff_evibrief/support.js` are expected and untouched.

## Manual test steps

1. `npm run dev`, sign in, open `/evidence`.
2. DevTools responsive mode at 320px: confirm no horizontal page scroll, the
   hamburger is present, and the drawer lists all six destinations. Tap
   "Stakeholders" — it navigates and the drawer closes.
3. 390px, then 760px: confirm the switch from drawer to inline row happens at
   760px and no label is clipped at either side.
4. 1000px: the search trigger becomes the labelled 240px form; below it, the
   icon-only button opens the same dialog on click.
5. 1300px and 1600px: layout centres at 1440px max, unchanged from today.
6. Keyboard-only at 390px: Tab to the hamburger, Enter, Tab through the links,
   Escape — focus returns to the hamburger.
7. With "Reduce motion" enabled at OS level, the drawer opens with no transition.
