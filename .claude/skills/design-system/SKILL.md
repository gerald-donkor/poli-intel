---
name: design-system
description: Load for any EviBrief UI work — tokens, palette, urgency ramp, typography, component-to-shadcn mapping, responsive layout, motion. Points at design_handoff_evibrief/design-system.md as authoritative and states the rules that are load-bearing enough to break the product if ignored.
---

# Design system

Scope: **where the tokens live, which rules are non-negotiable, and how components map to shadcn primitives.** This skill deliberately does **not** fork a second copy of the token values.

**`design_handoff_evibrief/design-system.md` is authoritative.** Read it before writing UI. It holds the full `@theme` block, the shadcn variable aliasing, the `next/font/google` setup, the per-component utility recipes, the custom breakpoints, the grid recipes, and the keyframes. Where it and this skill disagree, the handoff wins. Where the handoff and the spec disagree on **scope**, the spec wins (`AGENTS.md` §2).

Also in `design_handoff_evibrief/`: `EviBrief Design System.dc.html` and `EviBrief Screens.dc.html` are browser-openable prototypes — **read them for intent, never copy them as code**. `support.js` is prototype runtime only and has no place in the application.

Layers on the vendor skills:

- **`shadcn`** — the CLI, component docs, registries, composition patterns
- **`frontend-design`** — general layout and typography judgment (Anthropic's, not the similarly-named Vercel skill)
- `shadcn-component-discovery`, `shadcn-component-review` — finding and reviewing components
- `web-design-guidelines` — general craft

Rules: `AGENTS.md` §11. Spec: §5.5–5.7.

## Current state, honestly

`app/globals.css` exists and currently carries a **default shadcn theme** — generic variables, `--destructive` mapped, Geist fonts. The EviBrief token block from the handoff has **not been applied yet**, and the three product fonts are not wired. A later prompt replaces that theme wholesale; until it does, don't assume a token named in the handoff resolves at runtime — check `globals.css`.

`components.json` and `components/ui/` exist. The intent is the **full shadcn component set installed up front** (`npx shadcn@latest add --all`, spec §5.5) rather than piecemeal additions — check what is actually present before adding.

## Tokens live in CSS

Tailwind 4 is **config-less**: tokens live in the `@theme` block in `app/globals.css`. There is no JavaScript config file to edit, and none should be created (`AGENTS.md` §11.1). If an instinct says to open a JS/TS Tailwind config, that instinct is from an older Tailwind.

shadcn's own variables (`--primary`, `--background`, `--border`, …) are **aliased to the theme tokens** in `:root` rather than maintained as a second palette. The exact aliasing block is in the handoff.

## The rules that break the product if ignored

### 1. No clinical white, and no invented brand

Tropenbos palette — primary `#0F6E56`, accent `#1D9E75`, surface tint `#E1F5EE` — extended by the handoff's warm neutrals. App background `paper #F7F5F0`; cards `card #FDFCF9`. **Never pure white, never a generic shadcn default theme, never a second design system** (`AGENTS.md` §11.2–11.3, §6).

### 2. Urgency is the warm→cool ramp, never a stoplight

Immediate **bronze** → Near-term **olive** → Horizon **teal** → Watch **slate** (`AGENTS.md` §11.4). Red/amber/green is prohibited: this is politically sensitive material and alarmist colour reads wrong for a diplomatic audience (spec §5.6).

**`--destructive` is deliberately unmapped. Nothing in this product is red.** Guard flags use the watch ramp; classification-pending and rate-limit states use the immediate/olive ramps. Never reach for shadcn's `destructive` variant — not for a flag, not for a validation error, not for a delete confirmation.

The ramp's **order carries the taxonomy**; never remap a fill to a different meaning.

**Urgency is carried by a card's 3px left rule and its small-caps eyebrow only — never a filled card background.** Cards stay on `card` so board density stays readable (`AGENTS.md` §11.5).

**Relevance is independent of urgency and never shares its ramp** — Core is a filled `primary` pill, Adjacent is surface-tint, Background is stone.

### 3. The serif is for quoted material only

**Inter is the product's own voice** — UI, and all generated prose. **Source Serif 4 is exclusively quoted or verbatim material**: source excerpts, citations, policy language the product did not author. IBM Plex Mono is data — scores, IDs, timestamps.

**This distinction is load-bearing; breaking it defeats the design** (`AGENTS.md` §11.6). It is the visual mechanism by which a reader can tell what the AI wrote from what a source said — in a product whose entire value proposition is traceability. Never set generated prose in the serif; never set a direct quote in the sans.

Minimum body size anywhere: 13px (compact table rows only), 14px standard, never below 12px.

### 4. No leaf, no tree, no forest photography

Abstract structural marks only — thin-stroke circles, squares, concentric contour rings echoing topographic maps (`AGENTS.md` §11.7). No stock forest imagery.

**Governance states are distinguished by shape, not colour alone**: a **circle** is a review flag (hallucination guard); a **square** is a classification-pending governance hold. Someone must be able to tell them apart at a glance, and colour-blind users must be able to tell them apart at all. Prefer a labelled dot/square plus text over an icon-only control.

### 5. No generic admin dashboard, no startup tone

Sidebar-plus-stat-cards with no point of view is the anti-pattern (spec §5.6). The subject matter — deforestation, land rights, policy influence — is serious. Calm, credible, unhurried under pressure (`AGENTS.md` §11.8).

### 6. Density is role-dependent

Officer and Research views may hold real density: evidence tables, citations, relevance scores. **Field Officer and community-facing views strip to one message per screen** (`AGENTS.md` §11.12). The `/field` route is single-column at every size and is never adapted upward into a desktop layout — a Field Officer on a laptop still gets the digest. Never expose internal taxonomy vocabulary ("signal", "urgency class", "relevance score") on that surface; use plain language.

### 7. WCAG 2.1 AA is a hard requirement

Keyboard navigation across the kanban board and evidence table, ARIA labels on urgency and relevance badges, 4.5:1 minimum text contrast. **Verify any new colour pairing before finalising** (`AGENTS.md` §11.13, spec §5.6). The handoff's pairings are already verified; a new one is not.

Corollaries that come up constantly: relevance renders as **number + bar, never colour-only**; a selected table row uses a surface-tint background, not a checkbox alone; the global focus ring is an accent ring with offset, never `outline: none` alone.

## Component → shadcn mapping

The full table is in the handoff. The mappings most likely to be got wrong:

| Pattern | Primitive | The thing to get right |
|---|---|---|
| Signal card | `Card` + `Badge` + dnd-kit | Urgency = 3px left border + eyebrow. Never a full fill. |
| Kanban columns | flat `Card` container + custom scroll region | Column tint crossfades on drop; **never auto re-sorts under an active reviewer** |
| Citation chip | custom Tiptap `Mark`, **not** a shadcn component | Pill on surface-tint; filled dot = verified, hollow = pending. Opens evidence in a `Sheet` — **never a route change**. See `tiptap-editor`. |
| Guard flag panel | `Alert`, **custom slate variant** | Never `destructive`. Contract in `hallucination-guard`. |
| Classification-pending banner | `Alert` (immediate-ramp variant) + queue count | **Square** glyph, distinct from the flag's circle |
| Rate-limit state | `Alert` (slate/olive) + inline countdown | Names the retry time, preserves the draft, never a generic error toast |
| Generation sequence | custom stepper from `Progress` + manual step list | Three named stages; **no indeterminate spinner anywhere** |
| Audience switcher | `Tabs` | Prose crossfades; citation chips stay position-anchored |
| Evidence table | `Table` + custom relevance-bar cell | Number + bar, never colour-only |
| Command/search | `Command` (cmdk) | Keyword and semantic results merge into one ranked list; every result shows its score |
| Impact map | custom SVG/GSAP canvas | The only GSAP surface in the product |

## Responsive

**Desktop-first for Director and Officer routes; mobile-first for Field Officer routes** (`AGENTS.md` §11.14).

Tailwind's default breakpoints don't match where these layouts actually break, so the handoff adds `tablet: 760px`, `laptop: 1000px`, `desktop: 1300px` as theme tokens and writes layouts mobile-first with `min-width` variants. Grid recipes per screen are in the handoff — use them rather than improvising a column split.

Rules that hold at every size:

- Frames never scroll horizontally. Panel borders switch `border-left` → `border-top` when a column becomes a stacked row.
- **The guard-flag panel and the classification-pending queue count are never what gets hidden at a smaller size** — they promote above the fold instead. Both are governance surfaces; hiding them is how a backlog gets forgotten.
- XL caps layout width at 1440px and centres it.
- The influence-path diagram is the one element that does not reflow: it keeps an 860px min-width and pans horizontally below `laptop`. Do not stack its nodes.

## Motion

**Motion builds trust and explains the AI's reasoning; it is never decoration** (`AGENTS.md` §11.9, spec §5.7). Every duration in the handoff's motion table is fixed and short.

- Micro-interactions **150–300ms**. Nothing beyond ~600ms **except** the impact map's line-drawing sequence (~1.6s), which is meant to be watched.
- **Motion (Framer Motion) for UI; GSAP for the impact map only.** Never GSAP elsewhere, never Motion for the impact map (`AGENTS.md` §6, §11.9).
- Shared-layout animation — kanban drag and the audience-switch crossfade — needs Motion's `LayoutGroup` / `layoutId` on the citation chips so they stay anchored. Everything else is CSS keyframes exposed as `--animate-*` theme tokens.
- **Guard-flag pulse: 900ms, once**, settling to a steady 2px underline. No blink, no loop, no colour change on pulse. The full contract is in `hallucination-guard`.
- The generation stepper's active-stage "breath" (0.85–1.0 opacity over 2s) is **the only looping animation in the product.**
- **Respect `prefers-reduced-motion` with instant state changes** (`AGENTS.md` §11.10). The global CSS rule in the handoff kills CSS animation; **Motion additionally needs `useReducedMotion()`** — the CSS rule does not disable JS-driven animation.
- **Never animate an automatic urgency reclassification.** Silent re-sorting must not surprise someone mid-review; changes queue and apply on next load (`AGENTS.md` §11.10). See `server-actions` for the state-handling side of this.
- **If in doubt, cut the animation** (`AGENTS.md` §11.11). A screen that feels calm without motion is closer to the product's purpose than one that feels busy with it.

## Copy

Never write UI copy implying the system decided, approved, verified, or endorsed anything (`AGENTS.md` §8.8). The product is a research assistant, not a decision-maker.

## The five states that need designing on every relevant screen

Not just the happy path (`AGENTS.md` §17.6, spec §5.2): **empty** (matcher below threshold, with a real next step), **rate-limited** (retry timing, draft intact), **offline / sync-pending** (visible, never a silent queue), **classification-pending** (visible queue count), **flagged** (blocking approval). Each has a treatment in the handoff. A screen shipped with only its happy path is incomplete.

## Responsive: every page, every size (`AGENTS.md` §11.15)

Migrated from the root file so it loads with the rest of the UI guidance.

**Every page is fully responsive at every screen size.** A route is not complete until it is usable and legible from 320px to 1600px+ — no horizontal page scroll at any width, no content clipped, no control pushed out of reach, no text below the minimums in `AGENTS.md` §11.6 and `design-system.md`. Wide content that genuinely cannot reflow (the influence-path diagram) scrolls inside its own panel, never the page. Check every new screen at 390px, 760px, 1000px, 1300px, and 1600px before calling it done.

**Write mobile-first, and note there is no mobile breakpoint.** `tablet` (760px), `laptop` (1000px), and `desktop` (1300px) are `min-width` variants, so the **unprefixed classes are the small-screen layout** — anything under 760px, phones included. Build that base layer first as a single readable column, then layer `tablet:` / `laptop:` / `desktop:` on top to add columns, reveal side panels, and widen gutters. Do not reach for a `mobile:` variant; it does not exist and must not be added. Do not express small screens as `max-width` overrides of a desktop layout, and never put a fixed pixel width on a page-level container — cap with `max-w-*` plus `w-full` instead.

"Responsive" means it works at every size, not that every size gets the same layout. `AGENTS.md` §11.14 still decides the *starting point* and §11.12 still decides the density: Director and Officer routes reflow their columns down to a single stacked column, while `/field` stays single-column all the way up and is never adapted into a desktop layout. Both are fully responsive. What is never acceptable is a screen that only works at the width it was built at.

## Related

- `design_handoff_evibrief/design-system.md` — **authoritative**; read it first
- `shadcn`, `frontend-design` (vendor) — the general craft this skill doesn't restate
- `hallucination-guard` — the flag's exact visual contract
- `tiptap-editor` — citation chip and flag Mark rendering
- `evidence-governance` — why the classification-pending state must stay visible
- `gsap-*` (vendor) — for the impact map, and nothing else
