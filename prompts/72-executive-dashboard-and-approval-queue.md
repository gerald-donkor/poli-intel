# 72 — Executive Dashboard & Programme Director Approval Queue

## Goal

Build the dedicated Executive Dashboard at `/dashboard` per spec §5.1, §5.2, and §5.5. 

The Programme Director is the primary decision-maker in EviBrief — commissioning briefs, approving submissions, monitoring closing policy windows, and tracking influence outcomes. Today, each of these capabilities lives in a separate tab (`/signals`, `/briefs`, `/tracker`, `/evidence/queue`, `/impact`), but the Director lacks a unified executive cockpit.

This route assembles existing stored data into a calm, authoritative executive overview:
1. **Executive Key Metrics Strip** — active high-urgency signals, briefs pending review/approval, windows closing within 14 days, and unclassified evidence backlog.
2. **Brief Review & Approval Queue** — prioritised queue of briefs in `draft` or `reviewed` status, displaying author, brief type, target audience, citation count, open hallucination flag count, and one-click access to review on `/briefs/[id]`.
3. **High-Urgency Signal Digest** — Immediate and Near-term policy windows detected by the Policy Radar in the active window with their matched evidence count and generation status.
4. **Closing Policy Windows (Horizon Clocks)** — upcoming policy windows closing within 30 days from the Submission Tracker, indicating whether a brief exists.
5. **Recent Policy Influence Highlights** — latest verified influence events and downstream citations from the Impact Tracker.
6. **Role Landing Path** — `landingPathForRole` directs `programme_director` to `/dashboard` upon sign-in, while preserving `/field` for Field Officers and `/signals` for other staff.
7. **App Navigation** — `AppNav` includes `Dashboard` alongside existing navigation links.

## Skills read

- `.claude/skills/server-actions/SKILL.md` — Authorise-first Server Action conventions, role predicates, and error handling.
- `.claude/skills/supabase-schema/SKILL.md` — Prisma schema conventions, read-only data assembly, and Supabase free-tier data design.
- `.claude/skills/design-system/SKILL.md` — Warm institutional palette, card hierarchy, typography (Inter for UI, serif for quotes only), and responsive rules at every width.
- `.claude/skills/evidence-governance/SKILL.md` — Standing data classification and zero-unverified-AI rules.
- `.claude/skills/hallucination-guard/SKILL.md` — Fact-check visual contract (slate badge with subtle pulse, never red/alarmist) and approval block rules.
- `.agents/skills/shadcn/SKILL.md` — shadcn/ui components (Card, Badge, Button, Table).
- `design_handoff_evibrief/design-system.md` — Visual system and token recipes.

## Existing code inspected

- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §5.1, §5.2, §5.5: Defines the Programme Director persona, approval & impact review workflow, and the `/dashboard` route.
- `lib/auth/session.ts`: `landingPathForRole`, `getCurrentStaffUser`, `requireStaffUser`, and role gates.
- `lib/auth/authorize.ts`: `canApproveOrRejectBrief`, `canLogInfluenceEvent`, `canClassifyEvidence`.
- `components/app-nav.tsx`: Desktop navigation and mobile drawer navigation items.
- `lib/db/briefs.ts`: `listBriefs`, `findBriefDetail`.
- `lib/db/signals.ts` & `lib/db/signal-board.ts`: `listSignalBoard`, `findRecentSignals`.
- `lib/db/tracker.ts`: `getTrackerWindows`.
- `lib/db/evidence.ts`: `countPendingClassification`.
- `lib/db/influence.ts`: `listInfluenceEvents`.
- `app/(app)/briefs/labels.ts`: `BRIEF_STATUS_LABELS`, `formatGeneratedAt`.
- `app/(app)/signals/labels.ts`: `URGENCY_LABELS`, `URGENCY_ORDER`.

## Decisions and assumptions

1. **Read-only assembly over stored rows.** The dashboard performs zero AI calls, zero background jobs, and zero client-side fetching. Initial data is fetched in the Server Component via a single, dedicated data-layer function `readExecutiveDashboardData()`.
2. **Access for all staff, tailored for Directors.** While designed as the primary home for Programme Directors, Policy & Advocacy Officers and Research Officers can also access `/dashboard` for executive visibility. Field Officers remain on `/field` (§10.5).
3. **Hallucination guard visibility.** Brief cards in the approval queue clearly distinguish between briefs with open hallucination flags (which block Director approval) and briefs where flags are cleanly cleared or resolved, using the official slate badge.
4. **App navigation placement.** `Dashboard` is added to `NAV_LINKS` in `components/app-nav.tsx` as the first item, giving fast access across the desktop navbar and mobile drawer.
5. **No generic admin dashboard widgets.** Follows AGENTS.md §11.8: no stock charts, no circular progress rings, no startup-cheerful cards, and no stoplight colours. Urgency uses the warm→cool ramp (bronze, olive, teal, slate).

## Files likely to change

- `lib/db/dashboard.ts` (new file) — data layer read query `readExecutiveDashboardData` aggregating metrics, pending briefs, high-urgency signals, closing windows, and verified influence highlights.
- `lib/db/index.ts` — export `readExecutiveDashboardData` and its associated TypeScript types.
- `lib/auth/session.ts` — update `landingPathForRole` to return `/dashboard` for `programme_director`.
- `components/app-nav.tsx` — add `/dashboard` to `NAV_LINKS`.
- `components/command-palette.tsx` — include `/dashboard` in destination index.
- `app/(app)/dashboard/page.tsx` (new file) — Server Component for `/dashboard`.
- `app/(app)/dashboard/executive-metrics.tsx` (new file) — KPI strip showing key counts with contextual links.
- `app/(app)/dashboard/approval-queue.tsx` (new file) — briefs awaiting review/approval with guard flag badges.
- `app/(app)/dashboard/urgent-signals.tsx` (new file) — Immediate and Near-term policy windows.
- `app/(app)/dashboard/closing-windows.tsx` (new file) — horizon countdown of deadlines ≤30 days.
- `app/(app)/dashboard/influence-highlights.tsx` (new file) — recent verified policy citations and wins.
- `tests/contracts/executive-dashboard.spec.ts` (new file) — contract and routing tests for `/dashboard`.

## Implementation requirements

### Data layer (`lib/db/dashboard.ts` & `lib/db/index.ts`)

- Implement `readExecutiveDashboardData()` returning:
  ```ts
  export interface ExecutiveDashboardData {
    metrics: {
      pendingApprovalCount: number;
      blockedByFlagsCount: number;
      immediateSignalsCount: number;
      nearTermSignalsCount: number;
      closingSoonWindowsCount: number; // <= 14 days
      unclassifiedEvidenceCount: number;
      verifiedInfluenceCount: number;
    };
    approvalQueue: Array<{
      id: string;
      title: string;
      briefType: BriefType;
      targetAudience: AudienceTarget;
      status: BriefStatus;
      createdAt: Date;
      authorName: string | null;
      authorEmail: string;
      citationsCount: number;
      openFlagsCount: number;
      canBeApproved: boolean;
    }>;
    urgentSignals: Array<{
      id: string;
      title: string;
      sourceName: string;
      urgency: Urgency;
      detectedAt: Date;
      windowClosesAt: Date | null;
      matchedEvidenceCount: number;
      briefCount: number;
    }>;
    closingWindows: Array<{
      signalId: string;
      signalTitle: string;
      windowClosesAt: Date;
      daysRemaining: number;
      briefStatus: BriefStatus | null;
      briefId: string | null;
    }>;
    recentInfluence: Array<{
      id: string;
      eventType: InfluenceEventType;
      policyDocument: string;
      description: string;
      detectedAt: Date;
      briefTitle: string;
      briefId: string;
    }>;
  }
  ```
- Use Prisma transactions or parallel queries for clean performance.

### Auth & Navigation (`lib/auth/session.ts`, `components/app-nav.tsx`, `components/command-palette.tsx`)

- Update `landingPathForRole`:
  ```ts
  export function landingPathForRole(role: StaffRole): string {
    if (role === "field_officer") return "/field";
    if (role === "programme_director") return "/dashboard";
    return "/signals";
  }
  ```
- In `components/app-nav.tsx`, update `NAV_LINKS` to include `{ href: "/dashboard", label: "Dashboard" }` as the leading link.
- In `components/command-palette.tsx`, add `/dashboard` destination item.

### UI components (`app/(app)/dashboard/`)

- `app/(app)/dashboard/page.tsx`:
  - Require signed-in staff user via `requireStaffUser()`.
  - Fetch dashboard data via `readExecutiveDashboardData()`.
  - Render `PageHeader` with title "Dashboard" and subtitle "Executive overview of policy windows, approval queue, and verified influence."
  - Render the layout with responsive grid:
    - Top: `ExecutiveMetrics` (4-column grid on desktop, 2-column on tablet, 1-column on mobile).
    - Main split (2-column layout on laptop/desktop):
      - Left column: `ApprovalQueue` section (prominent, with direct links to review) and `ClosingWindows` horizon list.
      - Right column: `UrgentSignals` section and `InfluenceHighlights` section.
- `ExecutiveMetrics`:
  - Render calm institutional metric cards for:
    1. Briefs for Approval (with subtext on flag status, links to `/dashboard#approval-queue` or `/briefs`)
    2. Active Urgent Signals (Immediate + Near-term, links to `/signals`)
    3. Closing Windows (within 14 days, links to `/tracker`)
    4. Unclassified Evidence (with queue badge, links to `/evidence/queue`)
- `ApprovalQueue`:
  - List briefs with `status: draft` or `reviewed`.
  - Display title, author, target audience badge, brief type, and generated date.
  - Render hallucination-guard chip:
    - If `openFlagsCount > 0`: slate badge with flag icon and count ("X flags open — blocks approval").
    - If `openFlagsCount === 0`: clean badge ("Citations verified").
  - Action button: "Review brief" linking directly to `/briefs/[id]`.
  - Empty state when no briefs are pending approval.
- `UrgentSignals`:
  - List signals with `urgency === "immediate"` or `"near_term"`.
  - Left border with urgency warm-to-cool palette (bronze for immediate, olive for near-term).
  - Show signal source, title, matched evidence count, and action ("View signal" / "Generate brief").
- `ClosingWindows`:
  - Display deadline countdown chip (e.g., "5 days left", "Closing today").
  - Indicate whether a brief is drafted, submitted, or missing.
- `InfluenceHighlights`:
  - List recent verified influence events with event type badge, policy document title, and connected brief link.

## Evidence classification impact

**None — no evidence data path.**
This task reads already-classified aggregate counts (`countPendingClassification`) and existing brief/signal records. It performs no Gemini calls, transfers no evidence body text to external APIs, and does not alter the standing data classification gate.

## Hallucination-guard implications

**Visual presentation and approval state surfacing only.**
This task does not alter fact-check extraction or verification logic. It accurately reflects the hallucination guard's status on pending briefs in the approval queue: displaying open flags count in slate without alarmist colours, indicating to the Programme Director whether the brief is ready for approval or blocked by open flags per AGENTS.md §9.5 and §11.4.

## Security requirements

- Server-side authentication check via `requireStaffUser()`.
- No sensitive keys or unescaped HTML rendered.
- No direct database access or mutation from client components.
- Role-based permissions preserved across all linked destination routes.

## Acceptance criteria

1. Navigating to `/dashboard` renders the executive overview with metrics, approval queue, urgent signals, closing windows, and influence highlights.
2. Programme Director sign-in directs to `/dashboard` via `landingPathForRole`.
3. `AppNav` includes `Dashboard` in the navigation bar and drawer with active state highlight.
4. Briefs with open hallucination flags clearly show the blocking flag status on the approval queue card.
5. All interactive elements have `cursor-pointer`.
6. Responsive at all screen widths from 320px to 1600px+ with zero horizontal overflow.
7. Contract tests verify data layer queries, route protection, and role navigation.

## Checks to run

- `npm run check` (typecheck, lint, formatting)
- `npm test` (unit and contract tests)
- `npx playwright test tests/contracts/executive-dashboard.spec.ts`

## Exact manual test steps expected after implementation

1. Sign in as Programme Director and verify landing on `/dashboard`.
2. Verify all metric cards display accurate counts.
3. Review a brief card in the Approval Queue and click "Review brief" to navigate to `/briefs/[id]`.
4. Check that briefs with open flags display the slate flag badge.
5. Verify Closing Policy Windows list signals closing in ≤30 days with remaining days badge.
6. Verify AppNav highlights "Dashboard" when on `/dashboard`.
7. Verify responsive layout at 375px (mobile), 768px (tablet), and 1280px (desktop).
