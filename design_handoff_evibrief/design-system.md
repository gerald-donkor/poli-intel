# EviBrief Design System

Reference for engineers implementing the Tropenbos Ghana Policy Intelligence product (Next.js 16.2, Tailwind CSS 4.3, shadcn/ui). Extends the existing Tropenbos brand identity.

## Tailwind theme (`app/globals.css`)

Tailwind 4 is config-less — everything below goes in the `@theme` block. Token names generate the utilities noted in the comments.

```css
@import "tailwindcss";

@theme {
  /* Brand */
  --color-primary: #0F6E56;          /* bg-primary, text-primary, border-primary */
  --color-primary-hover: #0B5644;
  --color-primary-ink: #0B5644;      /* text on surface-tint */
  --color-accent: #1D9E75;
  --color-surface-tint: #E1F5EE;
  --color-surface-tint-border: #BFDFD3;
  --color-surface-tint-ink: #1A5A49;

  /* Neutrals — warm, never clinical white */
  --color-paper: #F7F5F0;            /* app background */
  --color-card: #FDFCF9;
  --color-stone: #EFECE4;
  --color-line: #E4E1D8;             /* border-line */
  --color-sage: #C3D2C8;
  --color-ink: #2C2C2A;
  --color-ink-2: #444441;
  --color-ink-3: #6B6B66;
  --color-ink-disabled: #8E8B84;

  /* Urgency ramp — warm to cool, never stoplight */
  --color-immediate: #8A6032;
  --color-immediate-ink: #5E4020;
  --color-immediate-surface: #F3EBE0;
  --color-immediate-border: #E0D2BE;
  --color-nearterm: #67743C;
  --color-nearterm-ink: #454E24;
  --color-nearterm-surface: #EDEFE1;
  --color-nearterm-border: #D6DBC2;
  --color-horizon: #0F6E56;
  --color-horizon-ink: #0B5644;
  --color-horizon-surface: #E1F5EE;
  --color-horizon-border: #BFDFD3;
  --color-watch: #496375;
  --color-watch-ink: #33495A;
  --color-watch-surface: #E7EDF2;
  --color-watch-border: #C6D4DF;

  /* Type */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-source-serif), Georgia, serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  --text-display: 2rem;              /* 32px — text-display */
  --text-display--line-height: 1.2;
  --text-display--letter-spacing: -0.02em;
  --text-h1: 1.5rem;
  --text-h1--line-height: 1.3;
  --text-h1--letter-spacing: -0.015em;
  --text-h2: 1.25rem;
  --text-h2--line-height: 1.4;
  --text-h3: 1rem;
  --text-h3--line-height: 1.5;
  --text-body: 0.875rem;
  --text-body--line-height: 1.6;
  --text-quote: 1rem;
  --text-quote--line-height: 1.6;
  --text-meta: 0.75rem;
  --text-meta--line-height: 1.4;
  --text-meta--letter-spacing: 0.06em;

  /* Radius */
  --radius-input: 3px;
  --radius-card: 6px;                /* rounded-card — the default */
  --radius-modal: 10px;

  /* Elevation */
  --shadow-raised: 0 1px 2px rgb(44 44 42 / 0.05);
  --shadow-overlay: 0 6px 16px -4px rgb(44 44 42 / 0.14);

  /* Motion */
  --ease-standard: cubic-bezier(0.2, 0.7, 0.3, 1);
}

@layer base {
  body { @apply bg-paper text-ink font-sans antialiased; }
  a { @apply text-primary no-underline hover:text-primary-hover hover:underline; }
}
```

Fonts load through `next/font/google` in `app/layout.tsx`, exposing the three CSS variables the theme references:

```ts
import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-source-serif" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });
// <html className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
```

### shadcn/ui alignment

shadcn components read `--primary`, `--background`, `--border`, etc. from `:root`. Alias them to the theme tokens rather than maintaining two palettes:

```css
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --card: var(--color-card);
  --card-foreground: var(--color-ink);
  --primary: var(--color-primary);
  --primary-foreground: var(--color-card);
  --secondary: var(--color-stone);
  --secondary-foreground: var(--color-ink-2);
  --muted: var(--color-stone);
  --muted-foreground: var(--color-ink-3);
  --accent: var(--color-surface-tint);
  --accent-foreground: var(--color-primary-ink);
  --border: var(--color-line);
  --input: var(--color-line);
  --ring: var(--color-accent);
  --radius: var(--radius-card);
  /* Deliberately unmapped: --destructive. Nothing in this product is red.
     Guard flags and rate-limit states use the watch/immediate ramps instead. */
}
```

### Common utility recipes

| Pattern | Classes |
|---|---|
| Card surface | `bg-card border border-line rounded-card shadow-raised` |
| Panel (flat) | `bg-card border border-line rounded-card` |
| Signal card, Immediate | `bg-card border border-immediate-border border-l-[3px] border-l-immediate rounded-card p-4 shadow-raised` |
| Urgency eyebrow | `text-[11px] font-semibold uppercase tracking-[0.06em] text-immediate` |
| Citation chip | `inline-flex items-center gap-1.5 rounded-full bg-surface-tint border border-surface-tint-border px-2 py-0.5 text-[11px] font-semibold text-primary-ink` |
| Quoted evidence | `font-serif text-quote text-ink border-l-2 border-accent pl-4` |
| Guard-flag panel | `bg-watch-surface border border-watch-border rounded-card p-4 text-watch-ink` |
| Classification-pending pill | `inline-flex items-center gap-1.5 rounded-full bg-immediate-surface border border-immediate-border px-2.5 py-1 text-[11.5px] font-semibold text-immediate-ink` |
| Data/score | `font-mono text-[11.5px] text-ink-3` |
| Focus state (global) | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper` |

The raw values behind these tokens follow, for reference and for anything built outside Tailwind.

## Colour

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#0F6E56` | Primary actions, active nav, headers, filled badges |
| `accent` | `#1D9E75` | Focus rings, verified marks, dividers on tinted surfaces |
| `surface-tint` | `#E1F5EE` | Callouts, selected rows, citation chips, active tab |
| `paper` | `#F7F5F0` | App background (never pure white) |
| `card` | `#FDFCF9` | Card/panel surface |
| `stone` | `#EFECE4` | Table headers, inactive tab track, muted chips |
| `border` | `#E4E1D8` | Default hairline border |
| `sage` | `#C3D2C8` | Muted icon strokes, disabled fills, unverified-link lines |
| `ink` | `#2C2C2A` | Primary text — 13.4:1 on paper |
| `ink-2` | `#444441` | Secondary text |
| `ink-3` | `#6B6B66` | Tertiary text, meta, captions |
| `ink-disabled` | `#8E8B84` | Disabled text |

Confirmed against the brief's values — no changes. All pairings below verified ≥ 4.5:1 (body text) or ≥ 3:1 (large text/UI) for WCAG 2.1 AA.

### Urgency scale (replaces red/amber/green)
A single warm→cool ramp. Order communicates the taxonomy — never remap fill to meaning outside this order.

| Stage | Rule/icon | Text | Fill | Border | Meaning |
|---|---|---|---|---|---|
| Immediate | `#8A6032` | `#5E4020` | `#F3EBE0` | `#E0D2BE` | Window < 4 weeks |
| Near-term | `#67743C` | `#454E24` | `#EDEFE1` | `#D6DBC2` | 1–3 months |
| Horizon | `#0F6E56` | `#0B5644` | `#E1F5EE` | `#BFDFD3` | 3–6 months |
| Watch | `#496375` | `#33495A` | `#E7EDF2` | `#C6D4DF` | > 6 months |

Applied as: 3px left border rule on kanban cards + small-caps eyebrow text in the stage colour. Never as a full card background fill — cards stay on `card` (#FDFCF9) so density remains readable.

### Relevance (independent of urgency — never share a ramp)
- Core: filled pill, `primary` bg, white text.
- Adjacent: `surface-tint` bg, `#0B5644` text, `#BFDFD3` border.
- Background: `stone` bg, `ink-2` text, `border` border.

### Guard/review states (slate, not red)
- Flag/alert surface: bg `#E7EDF2`, border `#C6D4DF`, text `#33495A`/`#3E5566`. Icon: 16px circle, 2px stroke `#496375`, filled centre dot.
- Classification-pending: bg `#F3EBE0`, border `#E0D2BE`, text `#5E4020`/`#6B5236`. Icon: small square outline (not a circle) — distinguishes "governance hold" from "review flag" at a glance.
- Offline/queued: bg `stone`, dot `#8E8B84` (grey, not urgency-coded); synced items switch the dot to `accent` (#1D9E75).

## Typography

Two families, one strict rule: **Inter is the product's own voice (drafted/generated/UI text). Source Serif 4 is exclusively quoted or verbatim material** (source excerpts, citations, policy language the product did not author). This distinction is load-bearing — never use the serif for generated prose or the sans for a direct quote.

- UI/body: **Inter** (400, 500, 600, 700)
- Quoted evidence: **Source Serif 4** (400 regular, 400 italic for attribution, 600 for rare emphasis)
- Data/mono: **IBM Plex Mono** (400, 500) — scores, IDs, timestamps, code

### Scale
| Role | Size / weight / family | Line height |
|---|---|---|
| Display | 32px / 600 / Inter, -0.02em | 1.2 |
| H1 | 24px / 600 / Inter, -0.015em | 1.3 |
| H2 | 20px / 600 / Inter | 1.4 |
| H3 | 16px / 600 / Inter | 1.5 |
| Body | 14px / 400 / Inter | 1.6 |
| Body (document canvas) | 14.5px / 400 / Inter | 1.65–1.75 |
| Quote | 15–17px / 400 / Source Serif 4 | 1.55–1.6 |
| Meta/eyebrow | 11–12px / 600 / Inter, +0.06em uppercase | 1.4 |
| Mono/data | 11–12px / 400–500 / IBM Plex Mono | 1.5 |

Minimum body size anywhere in the product: 13px (compact table rows only); 14px standard; never below 12px even for meta text.

## Spacing, radius, elevation

- Base unit: **8px**. Scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Card padding: 24px (16px in dense list rows). Section gap: 32px. Board/grid gutter: 16px.
- Radius: **3px** inputs · **6px** cards/panels (default) · **10px** modals/sheets · **999px** chips/pills/avatars.
- Elevation — borders before shadows, three steps only:
  1. Flat: `border: 1px solid #E4E1D8` only — default surface.
  2. Raised: adds `box-shadow: 0 1px 2px rgba(44,44,42,0.05)` — resting card.
  3. Overlay: `box-shadow: 0 6px 16px -4px rgba(44,44,42,0.14)` — popover, dialog, dragged card.

## Iconography

No literal leaf/tree glyphs anywhere. Where an icon is needed, use abstract/structural marks: thin-stroke circles, squares, and contour-adjacent concentric rings (echoing topographic maps). Prefer a labelled dot/square + text over an icon-only control. Governance states (flag vs. classification-pending) are distinguished by shape (circle vs. square), not just colour.

## Component → shadcn mapping

| Pattern | shadcn/ui primitive | Notes |
|---|---|---|
| Primary/secondary/ghost/disabled buttons | `Button` (variants: default, outline, ghost) | One primary action per view. Disable (don't hide) the approval button while a guard flag is open; show the reason inline next to it. |
| Signal card | `Card` + `Badge` + `dnd-kit` (Draggable/Droppable) | Urgency = 3px left border + eyebrow colour, never full-card fill. Relevance = `Badge`. |
| Kanban columns | `Card` (flat) as column container + custom scroll region | Column tint crossfades 240ms on card drop; never auto re-sorts under an active reviewer. |
| Citation chip | Custom inline mark (Tiptap `Mark` extension), not a shadcn component | Pill, `surface-tint` bg, filled dot = verified, hollow dot = pending. Opens evidence in a `Sheet` side panel, never a route change. |
| Audience switcher | `Tabs` | Underlying content cross-fades 260ms; citation chips are position-anchored across the transition (shared layout, not remount). |
| Evidence table | `Table` + custom relevance-bar cell | Relevance always renders as number + bar, never colour-only. Selected row = `surface-tint` background, not a checkbox alone. |
| Guard flag panel | `Alert` (custom slate variant, not `destructive`) | This is a review prompt, not an error — never map to shadcn's red `destructive` variant. |
| Classification-pending banner | `Alert` (custom amber-adjacent variant) + queue count | Square icon glyph, distinct from the circular guard-flag icon. |
| Command/search | `Command` (cmdk) | Keyword and semantic results merge into one ranked list; every result shows its score. |
| Status/classification pills | `Badge` (custom outline + solid variants per state table above) | Governance states (flagged, classification-pending, offline) always pair a glyph with the colour. |
| Generation sequence | Custom stepper (no shadcn primitive fits) built from `Progress` + a manual step list | Three named stages (Reading evidence → Drafting → Verifying citations); active stage gets a 2s 0.85–1.0 opacity breath — the only looping animation in the product. |
| Rate-limit state | `Alert` (slate/olive, not destructive) + inline countdown text | State names the retry time and preserves the user's in-progress draft; never a generic error toast. |
| Field Officer digest cards | `Card`, single message per card | 14px min body, 44px+ min tap target, no icon-only controls, plain-language labels ("Act this month" / "Background") — never expose internal taxonomy vocabulary (signal, urgency class, relevance score) in this surface. |
| Impact map | Custom SVG/GSAP canvas, no shadcn primitive | Evidence → Brief → Outcome, three-column force/lattice layout. Verified links solid teal/accent; unverified links dashed sage, drawn last. |

## Responsive behaviour

Desktop-first for the Director/Officer routes (`/signals`, `/briefs`, `/evidence`, `/impact`); mobile-first for `/field`.

Tailwind's default breakpoints don't line up with where these layouts actually break, so add two custom ones to `@theme` and write the layouts mobile-first with `min-width` variants:

```css
@theme {
  --breakpoint-tablet: 760px;
  --breakpoint-laptop: 1000px;
  --breakpoint-desktop: 1300px;
}
```

Grid recipes:

- Signal Dashboard board — `grid gap-4 grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4`
- Brief Editor — `grid grid-cols-1 laptop:grid-cols-[1fr_340px] desktop:grid-cols-[236px_1fr_372px]`
- Evidence Library — `grid grid-cols-1 laptop:grid-cols-[1fr_320px] desktop:grid-cols-[216px_1fr_340px]`
- Impact Map — `grid grid-cols-1 laptop:grid-cols-[1fr_356px]`
- Side panels — `border-t laptop:border-t-0 laptop:border-l border-line`
- Sidebars hidden below desktop — `hidden desktop:flex` (content moves into a `Sheet` drawer)
- Frames — `w-full max-w-[1440px] mx-auto h-auto laptop:h-[900px]`

The table below reads as max-width for design reference; implement it as the min-width variants above.

| Breakpoint | Signal Dashboard | Brief Editor | Evidence Library | Impact Map |
|---|---|---|---|---|
| ≥ 1300px (desktop, XL) | 4 urgency columns side by side | 3 columns: sections nav / document / evidence panel | 3 columns: filters / table / detail | Map + influence-events rail |
| 1000–1300px (laptop, landscape tablet) | 4 columns, narrower cards | Sections nav collapses to a drawer (hamburger in the breadcrumb bar); document + evidence panel remain | Filter panel collapses to a "Filters" drawer; table + detail remain | Unchanged |
| 760–1000px (tablet) | 2 columns, vertical scroll | Single column: document first, evidence/verification panel stacks beneath with the guard flag pinned at top | Single column: table, then detail panel beneath the selected row | Map stacks above the events rail; map holds a 460px min-height so paths stay legible |
| < 760px (mobile) | 1 column, urgency stage as a sticky section header | As above; top nav links collapse behind a menu | Table drops the Type and Classification columns (kept in the detail panel) | As above |

The influence-path diagram is the one element that does not reflow: below 1000px it keeps an 860px min-width and scrolls horizontally inside its panel. A three-column evidence→brief→outcome lattice becomes unreadable if compressed, so panning is the correct trade — do not attempt to stack its nodes.

Rules that hold at every size: frames never horizontally scroll; panel borders switch from `border-left` to `border-top` when a column becomes a stacked row; the guard-flag panel and the classification-pending queue count are never the content that gets hidden at a smaller size — they promote above the fold instead. XL screens cap layout width at 1440px and centre it rather than stretching columns indefinitely.

The `/field` route is single-column at every size and is never adapted upward into a desktop layout — a Field Officer on a laptop still gets the digest.

## Motion

Durations are fixed and short; nothing decorative. `prefers-reduced-motion` disables all of the below in favour of instant state changes.

| Interaction | Duration/easing | Behaviour |
|---|---|---|
| Micro-interactions (hover, toggle, chip) | 150–300ms | Standard ease-out |
| Match reveal (evidence search results) | 200ms, 70ms stagger | Fade + 8px rise, relevance order |
| Kanban drag | spring 380 stiffness / 30 damping | Card settles, doesn't snap; destination column tint crossfades 240ms |
| Audience switch | 260ms crossfade | Prose crossfades; citation chips animate position, stay anchored (shared-element, not remount) |
| Generation sequence | staged, total ≤60s | Each stage completes and fills visibly; active label breathes 0.85–1.0 opacity over 2s; no indeterminate spinner anywhere |
| Guard-flag pulse | 900ms, once | Background opacity 0→0.35→0 easing to a steady 2px underline. Never a hard blink, never a colour change on pulse |
| Classification queue count | 180ms crossfade | Decrements per item tagged; row collapses 200ms. Banner itself never animates idly |
| Impact map path draw | ~1.6s, GSAP, citation-date order | The one cinematic moment in the product; unverified/dashed paths draw last |
| Offline banner | 200ms slide, no bounce | Never overlays content |

### Implementation notes

Kanban drag and the audience-switch crossfade need shared-layout animation — use `motion` (Framer Motion) with `LayoutGroup` / `layoutId` on the citation chips. Everything else is CSS: define the keyframes in `globals.css` and expose them as `--animate-*` theme tokens so they're reachable as utilities.

```css
@theme {
  --animate-rise-in: riseIn 240ms var(--ease-standard) both;
  --animate-flag-pulse: flagPulse 900ms ease-out both;
  --animate-breathe: breathe 2s ease-in-out infinite;
  --animate-slide-down: slideDown 200ms ease-out both;
}
@keyframes riseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes flagPulse { 0% { background-color: rgb(73 99 117 / 0.32); } 100% { background-color: var(--color-watch-surface); } }
@keyframes breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
```

Staggered reveals set `animation-delay` per index via an inline style (`style={{ animationDelay: `${i * 70}ms` }}`) rather than nth-child rules. Impact-map paths animate `stroke-dashoffset` with `pathLength="1"`, sequenced by GSAP.

Honour reduced motion globally:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

Framer Motion additionally needs `useReducedMotion()` — the CSS rule above does not disable JS-driven animation.

Automatic urgency re-classification (a signal moving columns on its own) never animates or re-sorts while a reviewer has that view open — changes queue silently and apply on next load/refresh.
