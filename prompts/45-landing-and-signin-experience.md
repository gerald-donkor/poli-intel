# 45 — Rich institutional landing & sign-in experience

## Goal

Replace the generic, single-card sign-in screen (`app/signin/page.tsx`, as captured in `Screenshot_20260821_095216.png`) with an institutional, high-trust, animated landing and sign-in experience built specifically for **Tropenbos Ghana**. 

The page will ground visitors in Tropenbos Ghana's research-first mission (*"making knowledge work for forests and people"*), clearly communicate EviBrief's core value proposition (traceability from landscape evidence to policy briefs), and provide a streamlined, domain-restricted Google Workspace SSO authentication portal with smooth animations powered by `motion/react` with full `prefers-reduced-motion` compliance.

---

## Skills read

- `design-system` (project) — tokens, palette (`primary #0F6E56`, `accent #1D9E75`, `surface-tint #E1F5EE`, `paper #F7F5F0`, `card #FDFCF9`, `line #E4E1D8`, `sage #C3D2C8`, `ink #2C2C2A`), urgency ramp (immediate, nearterm, horizon, watch), typography rules (Inter for UI, Source Serif 4 for quoted material only, IBM Plex Mono for data), abstract structural marks only (no leaf/tree clichés, contour rings), WCAG 2.1 AA contrast requirements, motion limits (150–300ms micro-interactions, `motion/react` for UI, respect `useReducedMotion`).
- `frontend-design` (vendor) — layout hierarchy, distinctive institutional voice, intentional typography scale, avoiding templated SaaS aesthetics, active voice, grounding in the real subject matter (Ghana's forest landscapes: Juabeso-Bia and Sefwi-Wiawso).
- `shadcn` (vendor) — composition patterns, `Alert` for guard/notice states, `Badge` for status/metadata, `Button` with default variants, no `space-y-*` (use `flex flex-col gap-*`), `size-*` for equal dimensions, `truncate` shorthand, `cn()` for conditionals.
- `web-design-guidelines` (vendor) — accessibility (semantic landmarks, aria labels, focus indicators), mobile-first responsive layout from 320px to 1600px+, readable typography, no horizontal overflow.
- `evidence-governance` (project) — confirming zero-retention and classification boundaries; ensuring demo/mock data displayed on the landing page uses only verified public published examples.

---

## Existing code inspected

- `app/signin/page.tsx` — current minimal Server Component with centred sign-in card and error query-param handling.
- `app/signin/sign-in-button.tsx` — client button with `useFormStatus` and no indeterminate spinner.
- `app/signin/actions.ts` — server action `signInWithGoogle()` calling `signIn("google", { redirectTo: "/" })`.
- `app/page.tsx` — root redirect logic checking `getCurrentStaffUser()` and dispatching to role landing path or `/signin`.
- `app/globals.css` — Tailwind 4 `@theme` block with all EviBrief tokens, keyframes (`riseIn`, `flagPulse`, `breathe`, etc.), and breakpoints (`tablet: 760px`, `laptop: 1000px`, `desktop: 1300px`).
- `app/layout.tsx` — root layout defining `--font-inter`, `--font-source-serif`, and `--font-plex-mono`.
- `components/ui/alert.tsx`, `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx` — installed UI components.
- `lib/auth/session.ts` — `getCurrentStaffUser()`, `landingPathForRole()`.

---

## Decisions and assumptions

1. **Route positioning**: The rich landing experience lives directly on `/signin` (and is rendered whenever an unauthenticated visitor visits `/` or `/signin`). Authenticated users visiting `/` or `/signin` are immediately redirected to their role's workspace (`/signals` for officers/directors or `/field` for field officers), preserving frictionless re-entry for staff.
2. **Institutional identity, not generic SaaS**: The visual language reflects a respected forest-and-livelihoods research organisation based in Kumasi, Ghana. Register is measured, credible, and evidence-first. No marketing hyperbole, no leaf/tree stock vectors, no dark-mode neon gradients.
3. **Typography discipline**: 
   - UI chrome, headers, body copy, and labels use **Inter** (`font-sans`).
   - Real landscape evidence quotes and policy excerpts in the interactive walkthrough use **Source Serif 4** (`font-serif`) to strictly uphold the distinction that serif is exclusively quoted/verbatim material (`AGENTS.md` §11.6).
   - Telemetry metrics, dates, scores, and reference codes use **IBM Plex Mono** (`font-mono`).
4. **Motion architecture with `motion/react`**:
   - Staggered entry reveals (hero thesis, telemetry bar, sign-in portal) using gentle 200–300ms transitions with `--ease-standard` curves (`cubic-bezier(0.2, 0.7, 0.3, 1)`).
   - The topographic contour mark features a subtle ambient CSS breathing effect.
   - Interactive 3-stage Traceability Pipeline walkthrough allows users to toggle between Signal Detection, Evidence Retrieval, and Brief Generation with smooth layout transitions.
   - **`useReducedMotion()` from `motion/react` is strictly wired** on all client animation components to immediately skip animations if the user prefers reduced motion.
5. **Interactive Traceability Pipeline Showcase**:
   - Demonstrates the core value proposition of EviBrief:
     - **Stage 1 (Policy Radar)**: Monitored policy window (*EUDR Ghana Cocoa Traceability Directive* · Urgency: *Near-term (1–3 mo)*).
     - **Stage 2 (Evidence Matcher)**: Semantic match from Juabeso-Bia agroforestry field research (*12 CREMA community surveys, 87% compliance feasibility*).
     - **Stage 3 (Draft Brief & Guard)**: Tailored policy brief excerpt with active citation chips (`[TB-GH-2024-03]`) and verified hallucination-guard clearance.
6. **Core Capabilities Grid**:
   - 4 structured cards highlighting:
     1. *Policy Radar & Urgency Ramp* (continuous scanning across Ghana Forestry Commission, EU, and international bodies).
     2. *Classified Evidence Library* (strict three-way governance gate protecting community-sourced data).
     3. *Five Audience Reframing Engine* (tailored framing for Ministry, Parliamentary Committees, CREMAs, Agribusiness, and Donors).
     4. *Field Officer Bridge* (lightweight single-column mobile digest & offline field observation intake).
7. **Landscape Grounding**:
   - Dedicated section highlighting Tropenbos Ghana's operational landscapes: **Juabeso-Bia** and **Sefwi-Wiawso** (Western North Region).
8. **Authentication Form Preservation**:
   - The sign-in card preserves all existing functionality: Google Workspace SSO action (`signInWithGoogle`), domain guard error handling (`Alert variant="guard"`), and `SignInButton` without spinner.

---

## Files likely to change

### New components
- `app/signin/landing-header.tsx` — Top institutional navigation bar with Tropenbos Ghana identity, EviBrief wordmark, and system status indicator.
- `app/signin/landing-hero.tsx` — Client component with animated thesis, telemetry metrics, and the elevated sign-in card.
- `app/signin/pipeline-preview.tsx` — Client component with interactive 3-stage animated traceability demo.
- `app/signin/capabilities-grid.tsx` — 4-card capabilities showcase with subtle hover states.
- `app/signin/landscape-section.tsx` — Landscape grounding panel featuring Juabeso-Bia and Sefwi-Wiawso research quotes set in Source Serif 4.
- `app/signin/landing-footer.tsx` — Institutional footer with Tropenbos International affiliation, governance badge, and WCAG notice.

### Modified files
- `app/signin/page.tsx` — Server component orchestrating the complete landing page, checking auth state, handling error alerts, and rendering the sections.

---

## Evidence classification impact

**None — no evidence data path.**
This page is the public landing and sign-in surface. It touches no database evidence items or AI generation pipelines. The sample data shown in the pipeline preview is static illustrative copy based on publicly published Tropenbos Ghana research (Juabeso-Bia agroforestry studies) to demonstrate system functionality without accessing unpublished or community-governed database rows.

---

## Hallucination-guard implications

**None.**
The landing page does not perform brief generation or claim verification. The UI illustrates the guard's role (rendering the standard watch-ramp badge/slate review indicator in the interactive preview) adhering strictly to the §9.7 visual contract (slate border/surface, circle glyph, 16px).

---

## Security requirements

- All OAuth credentials (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_DOMAIN`) remain strictly server-side.
- Sign-in action remains a server-side `POST` mutation through Auth.js v5.
- Domain restriction enforcement in `auth.ts` remains intact and untouched.
- No sensitive user or staff data is exposed in client components.

---

## Acceptance criteria

1. **Visual fidelity & brand alignment**:
   - Warm `paper` (`#F7F5F0`) background throughout; cards on `card` (`#FDFCF9`) with `line` borders (`#E4E1D8`) and `shadow-raised`.
   - Tropenbos primary green (`#0F6E56`) and accent (`#1D9E75`) used for brand elements and primary actions.
   - Strictly NO red/amber/green stoplight colours and NO pure clinical white backgrounds.
   - Abstract topographic contour motif used as structural mark; NO stock leaf/forest photography.
2. **Typography rules strictly enforced**:
   - Inter for UI and product voice.
   - Source Serif 4 exclusively for the quoted landscape research excerpt in the landscape section and sample brief text.
   - IBM Plex Mono for all telemetry metrics, urgency tags, and reference codes.
3. **Motion & Animations**:
   - Smooth entrance animations on hero and sections using `motion/react`.
   - Interactive 3-stage pipeline preview with animated tab transitions.
   - All animations automatically disabled when `prefers-reduced-motion` is active via `useReducedMotion()`.
4. **Sign-in integration**:
   - Complete Google Workspace SSO authentication portal seamlessly integrated into the hero.
   - Error states (`?error=AccessDenied` or generic) rendered via `<Alert variant="guard">` with clear, institutional copy.
   - Authenticated staff visiting `/signin` or `/` are redirected to their designated landing path.
5. **Responsive design**:
   - Flawless reflow across 320px (mobile), 760px (tablet), 1000px (laptop), 1300px (desktop), and 1600px+ without horizontal page scroll or clipped text.
6. **Quality checks**:
   - `npm run typecheck`, `npm run lint`, and `npm run build` pass with zero errors.

---

## Checks to run

```bash
npm run typecheck
npm run lint
npm run build
```

---

## Exact manual test steps expected after implementation

1. Open browser in an unauthenticated / incognito session and navigate to `http://localhost:3000/`.
2. Verify redirect to `/signin` and observe the rich, institutional landing page:
   - Institutional header with Tropenbos Ghana & EviBrief branding, plus live "System Active · Restricted SSO" pill.
   - Hero section with clear value proposition, telemetry metrics, and the integrated Sign-in card with topographic CSS motif.
   - Interactive 3-stage Traceability Pipeline walkthrough: click between "1. Signal Detection", "2. Evidence Matching", and "3. Brief Drafting" to observe smooth transitions and sample citations.
   - Four capabilities cards (Policy Radar, Evidence Library, Audience Engine, Field Officer Bridge).
   - Landscape grounding section highlighting Juabeso-Bia and Sefwi-Wiawso with research quote in Source Serif 4.
   - Institutional footer.
3. Test responsive views:
   - Resize viewport to 390px (mobile) -> verify stacked single-column layout, legible text (nothing under 13px), and no horizontal scroll.
   - Resize to 760px (tablet) and 1300px (desktop) -> verify grid transitions and balanced spacing.
4. Test animation accessibility:
   - Enable `prefers-reduced-motion` in OS/browser devtools -> verify that page renders immediately with instant state transitions.
5. Test sign-in interaction:
   - Click "Continue with Google" -> verify redirection to Google OAuth flow.
   - If signed in with a valid account, verify redirection to the appropriate workspace (`/signals` or `/field`).
