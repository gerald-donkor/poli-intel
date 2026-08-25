# Prompt 54 — Policy Radar & Kanban Board UX Refinement

## Goal

Refine the Policy Radar urgency board (`/signals`) and the Signal Detail surface (`/signals/[id]`) to deliver an institutional, accessible, and responsive policy intelligence experience for Tropenbos Ghana. This includes:
1. Kanban board column headers with explicit time-window badges and active count indicators.
2. Drag-and-drop interaction feedback: drop-target tint crossfades (240ms), accessible keyboard reordering, clear refusal notices if an unauthorized move is attempted.
3. Signal card layout: 3px urgency left border, small-caps eyebrow, relevance badge, landscape and impact area tags, and source metadata.
4. Signal Detail surface: landscape-specific tagging, policy source excerpts strictly styled in Source Serif 4 with accent borders, matched evidence items with `number + bar` relevance rendering, and clear reclassification audit history.

---

## Skills read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `web-design-guidelines` (`.agents/skills/web-design-guidelines/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)

---

## Existing code inspected

- `app/(app)/signals/page.tsx` — Board layout, header, empty state.
- `app/(app)/signals/signal-board.tsx` — Kanban columns, dnd-kit context, optimistic state updates.
- `app/(app)/signals/signal-card.tsx` — Card rendering, urgency 3px left rule, relevance badge, drag handle.
- `app/(app)/signals/labels.ts` — Urgency ramp mappings, labels, window descriptions.
- `app/(app)/signals/[id]/page.tsx` — Signal detail view, matched evidence summary, reclassification history.
- `app/(app)/signals/[id]/matched-evidence.tsx` — Evidence match list, relevance bars, gap callout.
- `design_handoff_evibrief/design-system.md` — Urgency ramp specifications (Immediate bronze `#8A6032` -> Near-term olive `#67743C` -> Horizon teal `#0F6E56` -> Watch slate `#496375`).

---

## Decisions and assumptions

1. **Urgency Ramp Fidelity**: Urgency is conveyed strictly by the card's 3px left border and small-caps eyebrow in the warm-to-cool ramp. Cards always remain on `card #FDFCF9` background so board readability remains high.
2. **Relevance Independence**: Relevance (Core, Adjacent, Background) is independent of urgency and retains its distinct pill styling (`primary` filled for Core, `surface-tint` for Adjacent, `stone` for Background).
3. **Quoted Excerpts in Serif**: Direct verbatim policy text and source excerpts are set in `Source Serif 4` (`font-serif text-quote border-l-2 border-accent pl-4 text-ink`). Summaries authored by AI classification remain in `Inter` (`font-sans`).
4. **WCAG & Micro-Interactions**: All transitions remain within 150–240ms with `useReducedMotion` support. Drag handles carry `cursor-grab` and active cards have `cursor-grabbing`.

---

## Files likely to change

- `app/(app)/signals/page.tsx`
- `app/(app)/signals/signal-board.tsx`
- `app/(app)/signals/signal-card.tsx`
- `app/(app)/signals/[id]/page.tsx`
- `app/(app)/signals/[id]/matched-evidence.tsx`
- `app/(app)/signals/labels.ts`

---

## Implementation requirements

1. **Kanban Column Header Polish**:
   - Display urgency stage name (Immediate, Near-term, Horizon, Watch), closing time window (e.g. `< 4 weeks`, `1–3 months`), and a count badge.
   - Column drop targets transition smoothly with a subtle 240ms background tint when a card hovers over.
   - Keep empty column states informative with a subtle dashed border and calm copy.

2. **Signal Card Component Polish**:
   - Card title carries `text-[14px] font-semibold text-ink leading-snug group-hover:text-primary transition-colors`.
   - Small-caps urgency eyebrow and relevance badge in the header row.
   - Metadata footer row with source name, landscape/geography badge (Juabeso-Bia, Sefwi-Wiawso, Ghana National, EU), and mono-spaced detection date.
   - Accessible drag handle with `cursor-grab`, clear focus ring, and aria announcements.

3. **Signal Detail (`/signals/[id]`) Polish**:
   - Display breadcrumbs: `Signals > [Signal Title]`.
   - Structural layout separating Signal Overview, Source Excerpt (Source Serif 4 quote block), Matched Evidence Section, and Reclassification Audit Trail.
   - Prominent action banner for "Draft a brief from this signal" with context explanation and role clarity.

4. **Matched Evidence Component Polish**:
   - Render relevance as `number + bar` cell (e.g., `87%` in Plex Mono next to a proportional progress bar).
   - Display gap warning banner with clean immediate-ramp/slate styling when no high-relevance evidence matches.

5. **Responsiveness**:
   - Kanban board collapses to a single stacked scrollable list on mobile viewports (< 760px) while preserving all card information and actions.
   - On desktop, 4 columns share equal width with responsive gap spacing (`gap-3 tablet:gap-4`).

---

## Evidence classification impact

**none — no evidence data path.**
This task refines the UI and UX of the Policy Radar and signal detail screens. It does not ingest, reclassify, or transmit unclassified evidence to model endpoints.

---

## Hallucination-guard implications

**none.**
This task does not alter fact-check pass execution, flag persistence, or verification rules.

---

## Security requirements

- Role authorization for reclassification and brief drafting remains enforced server-side inside Server Actions.
- No confidential evidence text exposed to client-side logs.

---

## Acceptance criteria

- [ ] Kanban board columns display clear urgency indicators, time windows, and card counts.
- [ ] Drag-and-drop feedback is smooth with drop-target tinting and full keyboard accessibility.
- [ ] Signal cards display 3px urgency left border, small-caps eyebrow, and landscape badges.
- [ ] Signal Detail page renders source quotes in Source Serif 4 and evidence matches with relevance bars.
- [ ] Fully responsive on 320px, 390px, 760px, 1000px, 1300px, 1600px viewports.
- [ ] Passes `npm run typecheck`, `npm run lint`, and `npm run test`.

---

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run test`

---

## Exact manual test steps expected after implementation

1. Navigate to `/signals`.
2. Inspect the 4 columns (Immediate, Near-term, Horizon, Watch), their window badges, and card counts.
3. Drag a signal card between columns and verify optimistic update, smooth 240ms crossfade, and server sync.
4. Click into a signal card to view `/signals/[id]`.
5. Verify breadcrumbs `Signals > [Signal Title]` at the top.
6. Verify policy excerpt is rendered in Source Serif 4 with accent left border.
7. Verify matched evidence items show `number + bar` relevance scores.
8. Test on mobile screen size (< 760px) and verify clean single-column layout.
