# Handoff: EviBrief — Policy Intelligence & Brief Generator

## Overview

EviBrief is Tropenbos Ghana's policy intelligence product. It monitors forest-policy developments across Ghana and internationally, matches emerging policy windows to Tropenbos's own research evidence, and produces audience-tailored briefs and submissions in hours instead of weeks.

The product's entire value proposition is **traceability**: every claim in a generated brief traces back to verified, classified evidence before a human approves it. The UI exists to make that traceability legible in seconds. Design for that trust relationship, not for "an AI writing tool."

Two very different users share the product:

- **Programme Director / Policy & Advocacy Officer** — desktop-first. Needs to trust a brief within seconds before sending it to a government ministry or a company's sustainability lead. Institutional credibility is on the line.
- **Field Officer** — mobile-first, patchy connection, sometimes a basic phone. Needs a stripped-down, zero-friction experience.

## About the Design Files

The `.dc.html` files in this bundle are **design references** — browser-openable prototypes showing intended look and behaviour. They are **not production code to copy**. `support.js` is only the runtime that makes them render; it has no place in your application.

Your task is to **recreate these designs in the target Next.js codebase** using its established patterns: Next.js 16.2 App Router, Tailwind CSS 4.3, and the installed shadcn/ui component set. `design-system.md` in this folder is the authoritative implementation reference — it contains the ready-to-paste Tailwind `@theme` block, the shadcn `:root` token aliasing, `next/font` setup, per-component utility recipes, breakpoint definitions, and keyframes. **Start there, not from the HTML.**

Where the HTML and `design-system.md` disagree, `design-system.md` wins.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, and interaction states. Recreate pixel-faithfully using shadcn/ui primitives and the Tailwind theme, per the component mapping table in `design-system.md`.

## Anti-patterns — hard constraints

These were explicit product requirements. Violating them defeats the design:

- **No red/amber/green urgency signalling.** Urgency uses a controlled warm→cool ramp (bronze → olive → teal → slate). `--destructive` is deliberately unmapped in the shadcn token layer.
- **No leaf, tree, or forest iconography.** No stock forest photography. Where an icon is needed, use abstract structural marks — thin-stroke circles, squares, concentric contour rings echoing topographic maps.
- **No clinical white.** Backgrounds are warm off-white (`#F7F5F0` app, `#FDFCF9` cards).
- **No generic admin-dashboard look, no playful/startup tone.** Calm, credible, quietly confident.
- **A hallucination-guard flag is a review prompt, not an error.** Slate, gentle single pulse settling to a steady outline. Never red, never a blink, never an alarm.
- **The serif is reserved for quoted material only** — source excerpts, citations, verbatim policy language. Generated prose is always the sans. This distinction is load-bearing.

## Routes / Screens

Five screens. Files: `EviBrief Screens.dc.html` (frames `1a`–`1e` are screens, `1f`–`1j` are states); `EviBrief Design System.dc.html` (palette, type, component specimens).

### 1. Signal Dashboard — `/signals` (frame `1a`)

**Purpose.** The daily-use screen. A Policy & Advocacy Officer scans overnight policy signals and decides what to act on. Sets the tone for the entire product.

**Layout.** Full-height column: 56px global nav bar → page header block (title, counts, filter row) → kanban board filling remaining height.

- Global nav: `bg-card`, `border-b border-line`, 56px, `px-6`. Left: wordmark (18px square outline mark + "EVIBRIEF", 13px/600, `tracking-[0.12em]`, uppercase, `text-primary`). Centre: nav links 13px, active link `bg-surface-tint text-primary rounded` `px-2.5 py-1.5`. Right: 230px search field (`bg-paper border border-line rounded-card`, ⌘K hint) + 30px circular avatar.
- Header block: `bg-card border-b border-line px-6 pt-[22px] pb-4`. H1 24px/600 `-0.015em`. Subtitle 13px `text-ink-3` with the new-signal count in `text-primary font-semibold`. Right side: classification-pending pill, "Log a signal" (outline), "Generate brief" (primary).
- Filter row: segmented Board/Table/Calendar control (`bg-stone` track, active pill `bg-card shadow-raised`), then filter chips (`rounded-full border border-line bg-card px-2.5 py-1.5`, active chip uses surface-tint), and a right-aligned mono "live · polled 40s ago".
- Board: 4 columns, `gap-4`, `px-6 py-5`. Column header is a label + count + window text over a **2px bottom border in the stage colour**. Cards stack `gap-3`.

**Signal card.** `bg-card`, `border border-{stage}-border`, **`border-l-[3px] border-l-{stage}`**, `rounded-card`, `p-3.5`, `gap-2.5`, `shadow-raised`. Contents: eyebrow row (10.5px/600 uppercase `tracking-[0.06em]` stage-coloured deadline + relevance badge, right-aligned) → title 14px/600 `leading-[1.4]` → **serif** 12.5px summary in `text-ink-2` → footer above a `border-t border-stone`: source, match count in mono `text-primary`, status right-aligned. Hover raises to `shadow-overlay`.

Urgency is carried by the left rule and the eyebrow **only** — never a filled card background. The board must stay readable at density.

Also present: a dashed drop-zone placeholder in the Near-term column ("reclassifying a signal logs who changed it and when"), and a muted overflow note in the Watch column.

### 2. Brief Editor — `/briefs/[id]/edit` (frame `1b`)

**Purpose.** The core value moment: AI-drafted, human-reviewed, citation-tracked. The screen must make it obvious what is drafted, what is quoted, what is verified, and what still needs a human.

**Layout.** Nav bar (with breadcrumb, autosave timestamp, status badge, Export, "Send for approval") → three-column body `grid-cols-[236px_1fr_372px]`.

- **Left rail** (`bg-card border-r border-line p-5`): brief metadata list (Type, Length, Signal urgency, Deadline, Drafted-by/timestamp), section nav (active item: `bg-surface-tint`, 2px left border in primary, `text-primary`), version history card pinned to the bottom.
- **Centre**: sticky audience bar above a scrollable document canvas.
  - **Audience switcher** — shadcn `Tabs` styled as a segmented control on a `bg-stone` track; 5 tabs (Ghana ministry / Cocoa company / EU / DG ENV / Donor / CREMA). Right-aligned reassurance: accent dot + "Same 8 evidence items · framing regenerated". Below: a tone summary row (register, format, framing, translation link).
  - **Document canvas** — `max-w-[700px]`, `bg-card border border-line rounded-card`, `px-11 py-9`, `gap-5`, centred, scrolls independently. Document header: 10.5px uppercase meta row (type | recipient | classification | date) then H1 25px/600 `-0.02em`. Sections are a 10.5px uppercase `text-primary` label + body at 14.5px/`leading-[1.7]`.
  - **Citation chips** are inline in the prose: `rounded-full bg-surface-tint border border-surface-tint-border px-2 py-0.5 text-[11px]/600 text-primary-ink`, preceded by a 5px dot — **filled accent = verified, hollow slate = unverified**. Clicking opens the evidence in the right panel, never a new route.
  - **Pull-quote** — `bg-paper`, 2px left border in accent, serif 15px, attribution 11.5px with the publication title in serif italic.
  - The flagged claim is inline: `bg-watch-surface` with a `border-b-2 border-watch`, followed by an "unverified" chip.
- **Right panel** (`bg-card border-l border-line`): header row ("Evidence & verification", item count) → **guard-flag alert** → verification summary line → scrollable list of cited evidence cards (mono ID + relevance score, title, provenance + usage count; the currently-cited one uses the surface-tint treatment) → "Show all 8 matched items" → an evidence-gap note in the immediate-surface colour pinned to the bottom.

### 3. Evidence Library — `/evidence` (frame `1c`)

**Purpose.** Search and browse the evidence corpus. Must read as authoritative — an institutional archive, not a file list.

**Layout.** Nav → header block (title, corpus counts, last-ingest time, large search field, "Ingest document" + "Review queue · 6") → `grid-cols-[216px_1fr_340px]`.

- **Filters rail**: checkbox groups (Source type, Country) with mono counts right-aligned, impact-area chips, a year range slider, and a classification-pending callout pinned to the bottom.
- **Results table**: `grid-cols-[1fr_108px_96px_84px]`, `bg-stone` header row (10.5px uppercase). Rows `px-6 py-4`, `border-b border-stone`. Selected row: `bg-surface-tint`, `border-l-2 border-l-primary`. **Relevance renders as a mono number above a 3px bar** — never colour-only judgement. A classification-pending row uses a warm tint, carries the pending pill, and shows "—" for relevance (it is held out of the pipeline entirely).
- **Detail panel**: mono ID, title, authorship line, tag chips, the matched excerpt as a **serif** pull-quote with page reference, "Used in" list with status, an influence note linking to the impact map, and two footer actions.

### 4. Field Officer view — `/field` (frame `1d`)

**Purpose.** WhatsApp-digest-style weekly update. Offline-aware, feature-phone-conscious.

**Layout.** 390×844 single column, `rounded-[20px]`.

- Teal header (`bg-primary`): wordmark in `surface-tint`, officer name, "This week" 20px/600, landscape + date.
- **Offline banner**: `bg-stone border-b border-line`, grey dot, "Offline — showing saved updates", queued count in `text-primary`.
- Cards: the priority card uses the Immediate left-rule treatment with an "Act this month" eyebrow; a Background card; a submissions card with dot-status rows (grey = waiting, accent = sent).
- Footer: full-width 16px/600 primary button at `p-4` (well above the 44px minimum), with "Works offline — sends when you have signal" beneath.

**Constraints this view must respect:** one message per card, 14px minimum body text, 48px tap targets, no icon-only controls, no imagery to download, and **plain language only** — the officer never sees "signal", "urgency class", or "relevance score". A USSD fallback (`*384#`) mirrors the same content as four numbered options; the digest hierarchy is authored once and degrades. Never adapt this route upward into a desktop layout.

### 5. Impact map — `/impact` (frame `1e`)

**Purpose.** The donor-facing "proof it worked" screen.

**Layout.** Nav → header with H1 and four inline stats (14 influence events / 6 policy documents citing TBG / 4.2-day median signal-to-submission) plus "Generate Q2 donor report" → `grid-cols-[1fr_356px]`.

- **Main**: view tabs (Influence paths / Geography / Timeline), a legend, then the diagram — a three-column lattice **Evidence → Briefs & submissions → Policy outcomes** drawn as an SVG of bezier paths over a contour-ring background motif. Evidence nodes are 10px primary dots, briefs are surface-tint cards, outcomes are ringed slate dots. Verified links are solid; **unverified links are dashed sage and always drawn last**.
- **Rail**: influence-event cards, newest first. The lead event uses the surface-tint treatment, quotes the adopted wording in **serif**, and carries a "Verified by <name>" line. Below: an "Awaiting verification" note (unverified events stay out of donor reports until a named staff member confirms the source), and a most-cited-evidence-type meter.

## Key UX states

These are not edge cases. They are core to how trustworthy the product feels.

### Empty — no evidence above threshold (frame `1f`, `/signals/[id]/generate`)

Centred contour-ring mark (56px, concentric box-shadow rings) → "No evidence cleared the confidence threshold" 17px/600 → explanation naming the actual scores: closest match 0.41 against a 0.55 threshold, and **why we stopped rather than filling the gap**. Two actions: "Broaden to 0.40 and review manually" (primary) and "Log as a research gap" (outline). A footer row shows the nearest below-threshold item with its score.

Never a blank panel; never an apology; always the numbers and a next step.

### Rate-limited (frame `1g`, `/briefs/[id]/edit`)

"Waiting on the model — retrying in 47 seconds", with quota context (14 of 15 requests this hour), reassurance that the draft/evidence/audience selection are saved and the queue position survives navigation, a determinate progress rule, mono retry metadata (`retry 2 of 4 · backoff 60s`, `quota resets 15:00 GMT`), and two actions ("Retry now", "Keep editing the Ministry version"). A surface-tint footer notes the previously approved draft is untouched and still submittable.

Never a generic error. Never a spinner. The countdown ticks in text.

### Generating (frame `1h`)

A three-stage vertical stepper: **Reading evidence** (complete — filled dot, solid connector, "8 items · 47 chunks · 12s") → **Drafting** (active — ringed dot, sub-status "Section 4 of 6", a determinate bar) → **Verifying citations** (pending — empty ring, muted, with the reassurance that every cited figure is checked against source text before the draft opens). Header shows elapsed time; footer offers "You can leave this page" and Cancel.

The wait reads as sequenced, visible work. No indeterminate spinner anywhere in the product.

### Flagged claim (frame `1i`)

The claim inline with a `bg-watch-surface` highlight and 2px slate underline. Beneath, a slate review panel: "Not traceable to a cited source" + guard-pass timestamp → explanation → **the closest supported statement quoted in serif with its page reference** → three actions ("Replace with 31%", "Cite another source", "Delete sentence"). Below the panel, the "Approve & submit" button is **disabled but visible**, with the reason adjacent: blocked until cleared by the Research Officer or Director.

### Classification pending (frame `1j`, `/evidence`)

Warm banner: "6 evidence items awaiting classification" + "oldest: 9 days". Body explains untagged items **default to the most restrictive classification and are held out of the AI pipeline entirely**. A row list with inline classification pills (Public / Community-sourced / Internal) on the actionable row. A surface-tint footer explains that community-sourced and internal items stay on Tropenbos-controlled storage, and that marking an item Community-sourced keeps it staff-searchable but permanently excluded from model prompts.

## Interactions & Behaviour

Full motion table with durations and easings is in `design-system.md`. Headlines:

- **Animation communicates the AI's reasoning; it is never decoration.** Micro-interactions 150–300ms. Nothing exceeds 600ms except the impact-map draw.
- **Generation sequence** — staged and visible, up to 60s. Active stage label breathes 0.85–1.0 over 2s; this is the only looping animation in the product and it stops the moment the stage lands.
- **Audience switch** — 260ms crossfade of the prose while shared citation chips animate position and stay anchored. Needs `LayoutGroup`/`layoutId` (Framer Motion), not CSS. The motion must argue "same evidence, reframed", not "new document loaded".
- **Kanban drag** — spring (~380 stiffness / 30 damping); cards settle rather than snap. Destination column tint crossfades 240ms and its count ticks.
- **Guard-flag pulse** — background 0.32 → 0 over 900ms, once, settling to the steady 2px underline. Resolving fades the highlight over 200ms and transitions the disabled approve button to primary.
- **Match reveal** — results fade + rise 8px in relevance order, 70ms stagger, so retrieval reads as individual acts.
- **Impact map** — GSAP draws each path left-to-right over ~1.6s in citation-date order (`pathLength="1"` + `stroke-dashoffset`); outcome nodes fade up as their line lands; dashed unverified paths draw last. Hovering a node dims unrelated paths to 25% over 150ms.
- **Automatic urgency re-classification never animates or re-sorts under a reviewer.** Changes queue silently and apply on next load.
- `prefers-reduced-motion` disables everything. The CSS media query does not cover Framer Motion — pair it with `useReducedMotion()`.

## State Management

Per screen, the state the UI actually depends on:

- **Signal Dashboard** — signals by urgency stage; active filters (relevance, impact area, geography, assignment); view mode (board/table/calendar); drag-in-flight card + hovered column; new-since-last-visit set; classification-queue count (global); last poll timestamp.
- **Brief Editor** — brief document per audience (drafts are per-audience, sharing one evidence set); active audience tab; active section; editor content (Tiptap doc with citation marks); guard flags (claim range, reason, suggested replacement, resolution status); evidence panel selection; generation status (`idle | queued | reading | drafting | verifying | complete | rate_limited`) with stage progress and retry countdown; autosave timestamp; version history; **approval gate derived from `openFlags.length === 0`**.
- **Evidence Library** — query string; filter selections; result set with keyword and semantic scores merged; selected item; detail panel data; review-queue count.
- **Field** — cached digest (last 30 signals / 10 briefs per the spec); online/offline status; outbound submission queue with per-item sync state; language preference.
- **Impact** — influence events with verification status; graph nodes/edges; hovered node; active view tab; date range.

Data-fetching notes: the dashboard polls for new signals but must **not** re-sort a column while it is being read — buffer and apply on refresh. Generation is long-running (up to 60s) and must survive navigation; drive it from server state with the queue position preserved. Classification-pending items must be filtered out of every evidence-matching query at the data layer, not just hidden in the UI.

## Design Tokens

See `design-system.md` — it has the complete Tailwind `@theme` block, the shadcn `:root` aliasing, the type scale, spacing (8px base: 4/8/12/16/24/32/48/64), radii (3 inputs / 6 cards / 10 modals / 999 pills), the three-step elevation scale, keyframes, and breakpoints. All colour pairings are verified WCAG 2.1 AA (≥4.5:1 body, ≥3:1 large text and UI) — **re-check any new pairing you introduce**.

## Responsive Behaviour

Desktop-first for `/signals`, `/briefs`, `/evidence`, `/impact`; mobile-first for `/field`. Custom breakpoints (`tablet` 760, `laptop` 1000, `desktop` 1300) and per-screen grid class strings are in `design-system.md`.

Rules that hold at every size: frames never scroll horizontally; panel borders switch from `border-l` to `border-t` when a column becomes a stacked row; **the guard-flag panel and the classification-pending count are never what gets hidden at a smaller size** — they promote above the fold. XL caps at 1440px centred. The influence-path diagram is the one element that does not reflow: below 1000px it keeps an 860px min-width and pans horizontally.

## Assets

None. No images, icon fonts, or SVG illustrations are required. All marks in the designs are CSS primitives (bordered squares/circles, concentric `box-shadow` rings for the contour motif) and one inline SVG of bezier paths for the impact map. Fonts are Google Fonts loaded via `next/font/google`: **Inter**, **Source Serif 4**, **IBM Plex Mono**.

All copy in the designs is realistic placeholder scenario content (EUDR smallholder annex, Cocobod shade-tree review, Ahafo Ano field data). Replace with real content; keep the register.

## Files

| File | What it is |
|---|---|
| `design-system.md` | **Primary implementation reference.** Tailwind theme, shadcn token aliasing, component mapping, breakpoints, motion specs. |
| `EviBrief Screens.dc.html` | All five screens (`1a`–`1e`) and five states (`1f`–`1j`). Open in a browser; pan/zoom the canvas. |
| `EviBrief Design System.dc.html` | Visual specimen sheet — palette, urgency ramp, type scale, component states, motion inventory. |
| `support.js` | Runtime required only to render the two `.dc.html` files locally. Not application code. |
