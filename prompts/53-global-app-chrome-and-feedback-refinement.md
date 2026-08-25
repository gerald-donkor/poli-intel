# Prompt 53 — Global UI/UX Refinement: App Chrome, Feedback System, and Institutional Layout Polish

## Goal

Refine the global UI and UX foundation across EviBrief to establish a seamless, credible research-institutional feel for Tropenbos Ghana. This includes:
1. Enhancing the global application shell (`AppNav`, breadcrumbs, role badges, user menu, and command palette trigger).
2. Implementing an institutional feedback and status notification system (toast notifications styled with warm neutrals and non-destructive urgency tokens, accessible inline status banners).
3. Standardizing page headers, action button hierarchy, and responsive gutters from 320px to 1600px+.
4. Refining micro-interactions (150–300ms transitions, focus-visible accent rings, active navigation pill styling).

---

## Skills read

- `design-system` (`.claude/skills/design-system/SKILL.md`)
- `frontend-design` (`.agents/skills/frontend-design/SKILL.md`)
- `shadcn` (`.agents/skills/shadcn/SKILL.md`)
- `web-design-guidelines` (`.agents/skills/web-design-guidelines/SKILL.md`)
- `evidence-governance` (`.claude/skills/evidence-governance/SKILL.md`)

---

## Existing code inspected

- `app/globals.css` — `@theme` tokens, color variables, typography variables, custom breakpoints, motion keyframes.
- `components/app-nav.tsx` — Desktop header, navigation links, mobile sheet drawer, command palette button, user menu.
- `components/page-header.tsx` — Page header title, subtitle, action container.
- `components/user-menu.tsx` — Staff user avatar, role display, sign-out trigger.
- `components/command-palette.tsx` — Cmd+K dialog, search input, categorized groups, keyboard navigation.
- `components/classification-pending-alert.tsx` — Governance alert banner.
- `app/(app)/layout.tsx` — Protected layout shell, skip-to-content accessibility link.
- `design_handoff_evibrief/design-system.md` — Authoritative token, typography, and component specifications.

---

## Decisions and assumptions

1. **Brand & Neutrals Fidelity**: Retain the strict Tropenbos palette (primary `#0F6E56`, accent `#1D9E75`, surface-tint `#E1F5EE`, paper `#F7F5F0`, card `#FDFCF9`, stone `#EFECE4`, line `#E4E1D8`, ink `#2C2C2A`). Never use pure white or shadcn default zinc/slate themes.
2. **Typography Rule**: Inter is the product voice; Source Serif 4 is exclusively direct quotes and policy source text; IBM Plex Mono is numerical data/scores/timestamps.
3. **Institutional Feedback**: Toast notifications and alert banners must use warm-to-cool neutrals (watch slate, immediate bronze, horizon teal) and must never use red or alarmist iconography.
4. **Role Clarity**: Display the current user's role clearly in the header/user menu with an institutional badge so staff immediately know their active permissions (Programme Director, Policy Officer, Research Officer, Field Officer).
5. **Cursor Pointer & Focus Rings**: Every clickable surface has `cursor-pointer`; keyboard focus states use the accent ring (`focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`).
6. **Responsive Gutter Standards**: Standardize main content container padding (`px-4 py-4 tablet:px-6 tablet:py-6 desktop:px-8`) with `max-w-[1440px] mx-auto` to eliminate horizontal scroll and visual jumpiness during route transitions.

---

## Files likely to change

- `components/app-nav.tsx`
- `components/page-header.tsx`
- `components/user-menu.tsx`
- `components/ui/sonner.tsx` or global toast wrapper (ensuring warm palette tokens)
- `app/(app)/layout.tsx`
- `app/globals.css` (if micro-interaction utility refinement is needed)

---

## Implementation requirements

1. **AppNav Header Polish**:
   - Refine active link indicator with subtle surface-tint background (`bg-surface-tint text-primary font-medium`) and 150ms crossfade.
   - Add hover states to inactive navigation links with soft background lift.
   - Enhance the mobile navigation drawer (`Sheet`) with clean section dividers, user profile preview, and direct links to all active surfaces.
   - Ensure the abstract structural logo mark (2px bordered square in primary green) has proper alignment and tooltip/accessibility label.

2. **PageHeader & Breadcrumbs Refinement**:
   - Support optional breadcrumb trails for nested routes (e.g. `Briefs > Juabeso-Bia Agroforestry Brief > Edit`).
   - Add support for role indicator badges or status chips directly in the header action area.
   - Ensure subtitle text uses `text-ink-2 text-[13.5px] leading-relaxed max-w-[80ch]` for effortless readability.

3. **User Menu & Role Indicator**:
   - Display full user name, email, and a styled role badge (`Programme Director`, `Policy & Advocacy Officer`, `Research Officer`, `Field Officer`) in the trigger and dropdown.
   - Ensure dropdown items carry `cursor-pointer` and proper keyboard focus states.

4. **Global Toast & Institutional Feedback Component**:
   - Provide a shared, accessible toast feedback system (using Sonner / shadcn toast) styled according to EviBrief tokens (`bg-card border border-line text-ink shadow-overlay`).
   - Support semantic variants:
     - Success / Verified: Accent green border accent (`border-l-4 border-l-accent`).
     - Information / Slate: Watch slate border accent (`border-l-4 border-l-watch`).
     - Governance Hold / Pending: Immediate bronze border accent (`border-l-4 border-l-immediate`).
   - No red toasts, no alarm sounds, no rapid flashing.

5. **Accessibility & Responsive Consistency**:
   - Verify skip-to-content focus ring.
   - Test responsive layout from 320px to 1600px without horizontal overflow.

---

## Evidence classification impact

**none — no evidence data path.**
This task refines the global application chrome, navigation, page headers, user menu, and feedback system. It does not touch, store, move, read, or transmit evidence data.

---

## Hallucination-guard implications

**none.**
This task does not modify hallucination-guard claim extraction, verification passes, flag schemas, or approval gates.

---

## Security requirements

- Server-side role authorization checks remain untouched in Server Actions and DAL queries.
- UI role badges are purely informative presentation.
- No secrets or credentials exposed to browser code.

---

## Acceptance criteria

- [ ] Top navigation renders smoothly with active surface tint indicators and responsive drawer under 760px.
- [ ] User menu clearly shows user details and formatted role badge with cursor-pointer on all items.
- [ ] PageHeader supports breadcrumbs and clean action button alignment across desktop and mobile.
- [ ] Institutional toast feedback renders with warm neutral backgrounds and warm-to-cool urgency left borders (no red).
- [ ] No layout shift or horizontal scroll at 320px, 390px, 760px, 1000px, 1300px, 1600px.
- [ ] Passes `npm run typecheck`, `npm run lint`, and `npm run test`.

---

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run test`

---

## Exact manual test steps expected after implementation

1. Navigate to `/signals`, `/briefs`, `/tracker`, `/stakeholders`, `/evidence`, `/impact`.
2. Verify active nav link styles update cleanly with surface tint and primary ink.
3. Open user menu in the top right, verify role badge, name, email, and sign-out option.
4. Resize viewport to 375px (mobile) and verify hamburger menu opens drawer with all navigation links and active states.
5. Trigger an institutional toast notification and verify card background, font hierarchy, and border styling.
6. Verify keyboard tab navigation across header, search trigger, user menu, and page header actions.
