# 74 — Quarterly Operational Metrics & Institutional Performance Scorecard

## Goal

Implement the quantitative Quarterly Operational & Strategic Performance Metrics and Exportable Donor Summary specified in `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §10.1 (Operational Metrics), §10.2 (Strategic Impact Metrics), §3.5 (Quarterly Impact Report generator), and `AGENTS.md` §10.

EviBrief’s quarterly evaluation cycle allows the Programme Director, policy staff, and external donors to assess institutional velocity, evidence utility, and policy influence. Building directly on the qualitative narrative (prompt 71) and QA checklist (prompt 73), this feature adds the quantitative scorecard on `/impact`:

1. **Policy Signals Detected & Classified** — total volume for the selected quarter, with breakdown across urgency levels (Immediate, Near-term, Horizon, Watch).
2. **Median Brief Turnaround Time** — median duration from signal detection / brief creation to review/approval, measured against the institutional target of **under 4 hours** (spec §1.0, §10.1).
3. **Evidence Match Quality** — staff rating percentage of top evidence retrieval assessed as relevant in the quarter, measured against the institutional benchmark of **>80%** (spec §10.1).
4. **Brief Volume & Workflow Progression** — total briefs active in the quarter with breakdown by status (draft, reviewed, submitted, published).
5. **Audience Coverage & Diversity** — distribution of briefs across the 5 core audience profiles (Ghana Ministry, Cocoa Company, EU Regulator, Donor/Programme Officer, Community Governance/CREMA).
6. **Policy Window Capture Rate** — percentage of Immediate-urgency policy signals in the quarter that resulted in a reviewed, submitted, or published brief (spec §10.2).
7. **Donor-Ready Export / Copy Summary** — one-click generation/copying of the complete structured quarterly report (metrics, narrative, verified influence citations, and evidence backing) formatted in clean institutional Markdown suitable for donor progress reports and network communications.

## Skills read

- `.claude/skills/server-actions/SKILL.md` — Server Action conventions, role authorisation, and safe database mutations.
- `.claude/skills/supabase-schema/SKILL.md` — Prisma schema query optimization, aggregation over indexed date ranges, and 500MB budget awareness.
- `.claude/skills/design-system/SKILL.md` — Stat card tokens, progress bars, metric target indicators, and warm institutional color recipes.
- `.claude/skills/evidence-governance/SKILL.md` — Standing data classification and zero-unverified-AI rules (this metrics scorecard is strictly aggregated from stored database records; zero raw evidence is sent to an external model).
- `.agents/skills/shadcn/SKILL.md` — shadcn/ui components (Card, Badge, Progress, Button, Tooltip).
- `design_handoff_evibrief/design-system.md` — Authoritative design tokens and typography hierarchy.

## Existing code inspected

- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §1.0, §3.5, §10.1, §10.2: Defines the targets (<4h turnaround, >80% match quality, policy window capture rate, audience coverage).
- `lib/db/influence.ts`: `readQuarterlyImpactReport`, `QuarterlyImpactReport` data model and queries.
- `lib/db/evidence-matches.ts`: `getEvidenceMatcherFeedbackSummary` query over `evidence_match_review`.
- `lib/db/quarterly-narrative.ts`: `findQuarterlyNarrativeByQuarter` and qualitative reflection fields.
- `app/(app)/impact/page.tsx`: Server Component for the `/impact` route.
- `app/(app)/impact/quarterly-report.tsx`: Quarterly report client presentation and narrative integration.
- `lib/impact/config.ts`: Quarter boundary date calculations (`quarterFor`, `parseQuarterKey`, `previousQuarter`).

## Decisions and assumptions

1. **Pure database aggregation (zero AI generation).** Spec §3.5 and §10.1 require an accurate, traceable evaluation. All metrics are computed strictly from stored timestamps, statuses, and relations in PostgreSQL. Zero LLM calls are used, preventing hallucinated performance claims.
2. **Quarter-bounded date math:**
   - **Signals:** Filtered by `detectedAt >= start AND detectedAt < end`.
   - **Briefs:** Briefs created or transitioned during the quarter (`createdAt >= start AND createdAt < end` or having a status change in that period).
   - **Evidence Match Quality:** Calculated from `EvidenceMatchReview` records with `reviewedAt >= start AND reviewedAt < end`.
   - **Turnaround Duration:** For briefs with status `reviewed`, `submitted`, or `published` linked to a signal, turnaround time is calculated as `(firstApprovalOrReviewDate - signalDetectedAt)` in hours. Median is computed in application code from sorted durations.
   - **Policy Window Capture Rate:** `(count of Immediate signals in quarter with associated brief in reviewed/submitted/published status) / (total Immediate signals in quarter) * 100`.
3. **Structured Metrics Type:** Extended on `QuarterlyImpactReport` in `lib/db/influence.ts`:
   - `signalsCount`: Total signals, plus urgency counts (`immediate`, `nearTerm`, `horizon`, `watch`).
   - `briefsCount`: Total active briefs, plus status counts (`draft`, `reviewed`, `submitted`, `published`).
   - `turnaroundHoursMedian`: Median hours (or null if no completed briefs exist in quarter). Target is `< 4h`.
   - `evidenceMatchQuality`: Percentage relevant (0–100 or null if no reviews). Target is `> 80%`.
   - `policyWindowCaptureRate`: Percentage (0–100 or null if no immediate signals).
   - `audienceDistribution`: Record/Map of `BriefAudience` to count.
4. **Donor Report Export:** A client component with a "Copy Donor Report (Markdown)" button that formats the quarterly scorecard, qualitative narrative, and verified influence citations into a structured Markdown document ready to paste into annual/donor submissions.

## Files likely to change

- `lib/db/influence.ts` — update `QuarterlyImpactReport` type and enhance `readQuarterlyImpactReport` to compute quarterly operational metrics.
- `app/(app)/impact/page.tsx` — pass extended report structure to presentation components.
- `app/(app)/impact/quarterly-report.tsx` — render the new `OperationalScorecard` section with target badges and benchmarks.
- `app/(app)/impact/export-donor-report.tsx` (new component) — clipboard copy / download export for the complete quarterly narrative and scorecard.
- `tests/contracts/quarterly-metrics.spec.ts` (new test file) — contract tests verifying accurate calculation of median turnaround, match quality %, window capture rate, and audience distribution.

## Implementation requirements

1. **Data Layer (`lib/db/influence.ts`):**
   - Extend `QuarterlyImpactReport` with `metrics: QuarterlyOperationalMetrics`.
   - In `readQuarterlyImpactReport({ start, end })`:
     - Query signals detected within `[start, end)` grouped by urgency.
     - Query briefs created in `[start, end)` with their audience, status, created timestamp, and associated signal detected timestamp.
     - Query `evidenceMatchReview` within `[start, end)` to compute quarterly relevance satisfaction percentage.
     - Calculate median turnaround time for briefs with valid start/finish timestamps.
     - Compute policy window capture rate for immediate signals.
     - Return cleanly structured metrics alongside verified events and cited evidence.
2. **UI Component (`app/(app)/impact/quarterly-report.tsx`):**
   - Add `OperationalScorecard` sub-component displaying:
     - 4 high-level KPI cards:
       - **Median Turnaround Time**: Display formatted hours, target `< 4h` badge (achieved vs below target).
       - **Evidence Match Quality**: Display percentage, target `> 80%` badge.
       - **Immediate Window Capture**: Display percentage with completed/total ratio.
       - **Policy Signals Monitored**: Total signals with urgency pills.
     - 2 distribution breakdown panels:
       - **Audience Coverage**: Bar/count distribution across all 5 audience categories.
       - **Brief Pipeline Status**: Counts across Draft, Reviewed, Submitted, Published.
3. **Donor Export (`app/(app)/impact/export-donor-report.tsx`):**
   - Provide a clean, accessible button with tooltip and copy confirmation toast.
   - Format the full report into standard Markdown containing:
     - Header: Tropenbos Ghana · EviBrief Quarterly Impact Report
     - Quarter Period & Date Range
     - Operational & Strategic Scorecard Summary
     - Staff Qualitative Reflection (Wins, Missed Windows, Evidence Gaps, System Improvements)
     - Verified Influence Records with cited sources and quotes
     - Cited Evidence Knowledge Base items
4. **Accessibility & Design Tokens:**
   - Use design system tokens (`--color-surface-tint`, `--color-primary`, `--color-ink-3`, `--color-card`, `font-mono` for metrics).
   - Ensure all interactive elements have `cursor-pointer`.
   - Full keyboard accessibility and WCAG 2.1 AA contrast.

## Evidence classification impact

**none — no evidence data path.**
This task calculates mathematical aggregates (counts, durations, percentages) over metadata tables (`policy_signal`, `brief`, `evidence_match_review`, `influence_event`). No raw evidence text, document chunks, or unclassified records are read or transmitted to external models.

## Hallucination-guard implications

**none.**
This feature does not touch brief text generation, fact-check passes, or flag resolution.

## Security requirements

- Authorisation checked via `canViewImpact` on the `/impact` page render.
- Database queries use Prisma parameterised queries within the specified quarter timestamp boundaries.
- No sensitive user or unclassified data exposed.

## Acceptance criteria

1. Navigating to `/impact` loads the selected quarter's operational metrics scorecard.
2. Median turnaround time accurately calculates hours between signal detection and brief completion and displays target comparison (`< 4h`).
3. Evidence match quality accurately computes % relevant reviews in the quarter and highlights against the `> 80%` target.
4. Immediate policy window capture rate correctly reflects immediate signals converted into completed briefs.
5. Audience distribution shows representation across the 5 target audience profiles.
6. The "Copy Donor Report" action produces clean, formatted institutional Markdown containing metrics, narrative, and verified records.
7. Automated contract tests pass cleanly.

## Checks to run

- `npm run lint` — verify code cleanliness and zero linter warnings.
- `npm run test -- tests/contracts/quarterly-metrics.spec.ts` — run feature contract tests.
- `npm run build` — ensure clean Next.js Turbopack build with no TypeScript or build errors.

## Exact manual test steps expected after implementation

1. Start the dev server: `npm run dev`.
2. Sign in as Programme Director (`director@tropenbosghana.org`) or Policy Officer (`policy@tropenbosghana.org`).
3. Navigate to `/impact`.
4. Inspect the **Quarterly report** section:
   - Verify the **Operational Scorecard** displays the 4 KPI cards (Median Turnaround, Evidence Match Quality, Window Capture Rate, Signals Monitored) and 2 distribution charts (Audience Coverage, Pipeline Status).
   - Switch between quarters using the quarter selector pills and observe metrics updating to match each quarter's data.
5. Click the **Copy Donor Summary (Markdown)** button and paste into a text editor:
   - Verify the Markdown output includes complete executive scorecard metrics, staff evaluation narrative sections, verified influence records, and cited evidence references.
