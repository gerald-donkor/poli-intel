# 76 — Research Gap Logging & Ingestion Priorities Queue

## Goal

Implement the **Research Gap Logging**, **Ingestion Priorities Queue**, and **Signal Match Gap Resolution Workflow** specified in `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §3.3 (Step 5: Evidence Gaps), §4.3 (Data Governance), §5.2 (Research Officer & Policy Officer Workflows, Empty State Design), §10.3 (Evidence Gaps & Quarterly Priorities), `design_handoff_evibrief/README.md` (Match Gap Design), and `AGENTS.md` §1.0 / §15.

When the Evidence Matcher discovers that no eligible evidence clears the confidence threshold for an incoming policy signal (or when policy/research officers identify missing evidence areas during brief drafting and landscape analysis), this feature provides a structured mechanism to record, prioritize, track, and resolve evidence gaps:

1. **Research Gap Entity & Database Model** — A dedicated `ResearchGap` table in PostgreSQL / Prisma recording missing evidence topics, associated policy signal, impact area, priority, lifecycle status (`open`, `in_progress`, `resolved`, `dismissed`), logging actor, resolution notes, and linkage to newly ingested `EvidenceItem` records upon resolution.
2. **Signal Match Gap Interactive UI** — Upgrades the empty/gap state in `app/(app)/signals/[id]/matched-evidence.tsx` to match the design handoff:
   - Displays clear confidence metrics (e.g. closest similarity score vs. threshold).
   - Provides primary "Broaden search and review manually" re-match trigger.
   - Provides "Log as a research gap" dialog/action that captures gap details prefilled from the signal's impact area and title.
   - Smooth 200ms collapse to a persistent confirmation badge upon logging.
3. **Research Gaps & Ingestion Priorities Board (`/evidence/gaps`)** — A dedicated operational queue for Research Officers and Policy Officers on `/evidence/gaps`:
   - Categorized by Impact Area and Priority (`urgent`, `high`, `medium`, `low`).
   - Filterable by status and impact area with keyword search.
   - Actionable workflows: "Ingest evidence for this gap" (linking to `/evidence/new` with prefilled gap context) and "Mark as resolved" (associating the resolved `EvidenceItem`).
4. **Governance & Quarterly Evidence Integration** — Deterministic audit trail linking research gaps to quarterly evidence narratives (`QuarterlyEvidenceNarrative`), showing how field and policy intelligence directly drive Tropenbos's research and ingestion agenda.

## Skills read

- `.claude/skills/server-actions/SKILL.md` — Server Action conventions, role-based authorisation, typed error handling, and transactional database updates.
- `.claude/skills/evidence-governance/SKILL.md` — Hard standing gate; strictly zero unverified AI data transmission (all gap records store human-authored metadata; no unclassified evidence text is processed).
- `.claude/skills/evidence-matcher/SKILL.md` — Matcher rules, gap surfacing requirements, and threshold handling.
- `.claude/skills/supabase-schema/SKILL.md` — Prisma schema conventions, indexed foreign keys, and 500MB budget awareness.
- `.claude/skills/design-system/SKILL.md` — Design tokens, contour ring mark, warm→cool priority palette, and responsive component recipes.
- `.agents/skills/shadcn/SKILL.md` — shadcn/ui components (Dialog, Badge, Button, Select, Textarea, Card, Table).
- `design_handoff_evibrief/design-system.md` — Authoritative typography hierarchy and color recipes.

## Existing code inspected

- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §3.3, §4.3, §5.2, §10.3: Defines the requirement that evidence gaps are surfaced as actionable findings rather than empty dead-ends, feeding into quarterly ingestion priorities.
- `design_handoff_evibrief/README.md` & `EviBrief Screens.dc.html`: Specifies the exact UX contract for the Match Gap panel (contour ring mark, score explanation, "Broaden search" + "Log as a research gap" buttons, 200ms collapse).
- `.claude/skills/evidence-matcher/SKILL.md` Rule 4: "Evidence gaps are surfaced, not hidden. When nothing clears the confidence threshold, return an explicit gap — and in the UI, an empty state with a real next step (broaden the search, flag as a research gap), never a blank panel."
- `app/(app)/signals/[id]/matched-evidence.tsx`: Currently contains a static placeholder noting "not a button labelled 'record a research gap' with no table behind it".
- `app/(app)/evidence/page.tsx` & `app/(app)/evidence/queue/page.tsx`: Navigation and tabs for Evidence Library and Classification Queue.
- `lib/db/evidence.ts` & `lib/db/signals.ts`: Data access layer for evidence and signals.
- `lib/auth/authorize.ts`: Role-based permission predicates.

## Decisions and assumptions

1. **Prisma Model `ResearchGap` & Enums:**
   - Define `ResearchGapStatus`: `open`, `in_progress`, `resolved`, `dismissed`.
   - Define `ResearchGapPriority`: `urgent`, `high`, `medium`, `low`.
   - Define `ResearchGap` model:
     - `id`: UUID primary key.
     - `signalId`: Optional UUID foreign key to `PolicySignal` (onDelete: SetNull).
     - `impactArea`: `ImpactArea` enum.
     - `topic`: String (short title of the missing evidence).
     - `description`: String (rich context on the gap).
     - `priority`: `ResearchGapPriority` (default: `medium`).
     - `status`: `ResearchGapStatus` (default: `open`).
     - `loggedById`: UUID foreign key to `StaffUser` (onDelete: Restrict).
     - `resolvedById`: Optional UUID foreign key to `StaffUser` (onDelete: SetNull).
     - `resolvedAt`: Optional DateTime.
     - `resolutionNotes`: Optional Text.
     - `resolvedEvidenceItemId`: Optional UUID foreign key to `EvidenceItem` (onDelete: SetNull).
     - Standard `createdAt` and `updatedAt` timestamps.
     - Indices on `[status]`, `[impactArea]`, `[priority]`, and `[signalId]`.
2. **Role Permissions (`lib/auth/authorize.ts`):**
   - `canLogResearchGap`: `policy_advocacy_officer`, `research_officer`, `programme_director`.
   - `canManageResearchGaps` (status updates, resolution): `research_officer`, `programme_director`.
3. **Dedicated Route `/evidence/gaps`:**
   - Add a clean sub-route `/evidence/gaps` linked from the Evidence Library sub-navigation alongside the main library and classification queue (`/evidence`, `/evidence/queue`, `/evidence/gaps`).
   - Provides full filterability by status, impact area, priority, and search terms.
4. **Signal Detail Match Gap Interactive Flow:**
   - In `app/(app)/signals/[id]/matched-evidence.tsx`, inspect existing `researchGaps` associated with the signal.
   - If a gap is already logged, render a persistent `ResearchGapPill` / status block showing the open gap with a link to view it in the queue.
   - If not yet logged, render the interactive "Log as a research gap" dialog triggering `logResearchGapAction`.
   - Implement the 200ms animated collapse upon successful logging.
5. **Direct Gap Ingestion Link:**
   - From `/evidence/gaps`, the "Ingest evidence" button routes to `/evidence/new?gapId=<id>&impactArea=<area>`, pre-populating metadata and linking the resulting evidence item upon classification.

## Files likely to change

- `prisma/schema.prisma` — Add `ResearchGapStatus`, `ResearchGapPriority` enums and `ResearchGap` model with relations to `StaffUser`, `PolicySignal`, and `EvidenceItem`.
- `lib/generated/prisma/*` — Generated Prisma client.
- `lib/auth/authorize.ts` — Add `canLogResearchGap` and `canManageResearchGaps` role permission helpers.
- `lib/db/research-gaps.ts` (new file) — Data access layer for research gaps (CRUD, filtering, stats, signal linking, resolution).
- `lib/db/index.ts` — Re-export research gap queries.
- `app/(app)/signals/[id]/actions.ts` (or `app/(app)/evidence/gaps/actions.ts`) — Server actions for logging, updating, and resolving research gaps.
- `app/(app)/signals/[id]/matched-evidence.tsx` — Upgrade `MatchGap` to include interactive gap logging dialog, broadened search trigger, and 200ms transition.
- `app/(app)/evidence/gaps/page.tsx` (new file) — Evidence Gaps & Ingestion Priorities management dashboard.
- `app/(app)/evidence/gaps/gap-list.tsx` (new file) — Client table and filter controls for research gaps.
- `app/(app)/evidence/gaps/resolve-gap-dialog.tsx` (new file) — Dialog to mark gap as resolved with notes and optional evidence link.
- `app/(app)/evidence/page.tsx` — Add sub-nav pill / indicator for open research gaps count.
- `tests/contracts/research-gaps.spec.ts` (new file) — Integration and contract tests for gap logging, role authorization, signal association, and resolution.

## Evidence classification impact

**none — no evidence data path.**
This feature manages metadata records about missing knowledge and research priorities (`ResearchGap`). It does not transmit raw evidence text, document chunks, or unclassified data to Gemini or external AI models. All operations are deterministic database transactions and Server Actions governed by role-based authorization.

## Hallucination-guard implications

**none.**
This task does not modify hallucination-guard fact-checking, claim extraction, or flag rendering in the brief editor.

## Security requirements

- Server Actions strictly verify authentication via `requireStaffUser()` and enforce role permissions (`canLogResearchGap`, `canManageResearchGaps`).
- Actor IDs (`loggedById`, `resolvedById`) are taken directly from the verified session, never trusted from client inputs.
- All input strings (topic, description, resolutionNotes) are sanitized and validated with Zod schemas.

## Acceptance criteria

1. **Schema & Database:**
   - `ResearchGap` table and enums exist in PostgreSQL with appropriate indices and foreign keys.
2. **Signal Match Gap Logging:**
   - On `/signals/[id]`, when evidence matching produces a gap, officers can click "Log as a research gap".
   - Opens a dialog prefilled with the signal's impact area and title.
   - On submit, creates the `ResearchGap` record linked to the signal and smoothly transitions the UI without page reload.
3. **Evidence Gaps Dashboard (`/evidence/gaps`):**
   - Accessible via `/evidence` sub-navigation with an open gap count badge.
   - Displays all gaps with status, priority, impact area, logged date, and originating signal link.
   - Filterable by Impact Area, Priority, and Status.
   - Research Officers and Directors can change status, edit priority, and resolve gaps with resolution notes.
4. **Resolution & Ingestion Linking:**
   - Clicking "Ingest evidence" from a gap navigates to `/evidence/new` with prefilled context.
   - Resolving a gap allows linking the newly ingested `EvidenceItem`.
5. **Automated Test Coverage:**
   - Playwright / Vitest contract tests in `tests/contracts/research-gaps.spec.ts` verify all CRUD operations, permission checks, and signal associations.

## Checks to run

- `npm run lint` — Linting rules and TypeScript strict mode.
- `npm run db:migrate:new` / `npm run db:migrate` — Schema migration check.
- `npx prisma generate` — Prisma client generation.
- `npx playwright test tests/contracts/research-gaps.spec.ts` (or relevant test runner) — Verification of contract tests.

## Exact manual test steps expected after implementation

1. Sign in as a Policy & Advocacy Officer (`policy.officer@tropenbos.org` or dev session).
2. Navigate to a signal with a match gap (or trigger a rematch resulting in below-threshold candidates).
3. Verify the Match Gap panel displays the contour mark, score explanation, "Broaden search" button, and "Log as a research gap" button.
4. Click "Log as a research gap". Verify dialog opens with impact area preselected and title prefilled. Enter description and submit.
5. Verify the panel collapses and indicates the research gap has been recorded.
6. Navigate to `/evidence` and notice the "Research Gaps" tab with updated badge count.
7. Click into `/evidence/gaps`. Verify the newly logged gap appears in the table with its priority and impact area.
8. Filter by impact area and status; verify table updates smoothly.
9. Sign in as a Research Officer and click "Resolve gap". Provide resolution notes and confirm status updates to `resolved`.
