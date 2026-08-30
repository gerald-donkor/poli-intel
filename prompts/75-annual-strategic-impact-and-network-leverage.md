# 75 — Annual Strategic Impact Evaluation & International Network Leverage Tracker

## Goal

Implement the **Annual Strategic Impact Evaluation**, **2030 Target Contribution Estimator**, and **Tropenbos International Network Leverage Tracker** specified in `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §10.2 (Strategic Impact Metrics — Annual), §1.0 / §2.2 (Alignment with TBI Strategy 2023–2027), §3.5 (Component 4 — Impact Tracker), and `AGENTS.md` §1.0.

Building on the Quarterly Operational Scorecard (prompt 74) and Influence Event Logging (prompt 67), this feature equips Programme Directors and Policy Officers to track long-term, multi-year policy influence and international knowledge diffusion across the Tropenbos network:

1. **Annual Strategic Metrics Rollup** — Multi-quarter aggregation (Q1–Q4 of a selected calendar year) covering cumulative policy windows captured, full-year brief volume across all 5 audience profiles, verified influence events by category, and full-year evidence match quality.
2. **2030 Target Contribution Estimator** — Tracking progress towards Tropenbos International’s 2023–2027 strategic commitment to influence **20 million hectares** of sustainably managed forest landscapes and improve climate-resilient livelihoods for **5 million people**. Allows recording estimated landscape hectares and beneficiaries associated with verified policy wins (e.g. tree tenure reform across the High Forest Zone, deforestation-free cocoa standards in Juabeso-Bia and Sefwi-Wiawso).
3. **TBI Network Leverage & Cross-Country Policy Adaptation** — Structured tracking of knowledge diffusion to the other 9 Tropenbos International network countries (Bolivia, Colombia, DR Congo, Ethiopia, Indonesia, Philippines, Suriname, Uganda, Vietnam). Records which briefs, policy models, or technical submissions developed by Tropenbos Ghana were adopted, adapted, or referenced in partner national advocacy.
4. **Annual Strategic Impact Dashboard & Donor Brief Export** — A dedicated Annual Evaluation view on `/impact` with institutional KPI cards, 2030 progress bars, an interactive TBI Network Leverage grid, and a one-click Markdown export formatted for TBI Network assemblies and bilateral donor reporting.

## Skills read

- `.claude/skills/server-actions/SKILL.md` — Server Action conventions, role-based authorisation, typed error handling, and transactional database updates.
- `.claude/skills/supabase-schema/SKILL.md` — Prisma schema query optimisation, aggregation over indexed date ranges, and 500MB budget awareness.
- `.claude/skills/design-system/SKILL.md` — Authoritative tokens, metric card recipes, warm→cool urgency ramp, network badge styling, and responsive layout.
- `.claude/skills/evidence-governance/SKILL.md` — Hard standing gate; strictly zero unverified AI data transmission (all calculations are mathematical rollups of verified records).
- `.agents/skills/shadcn/SKILL.md` — shadcn/ui components (Tabs, Card, Badge, Progress, Button, Tooltip, Dialog).
- `design_handoff_evibrief/design-system.md` — Authoritative typography hierarchy and color recipes.

## Existing code inspected

- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §1.0, §2.2, §3.5, §10.2: Defines annual strategic metrics, 2030 goals (20M ha / 5M people), and network leverage across partner countries.
- `AGENTS.md` §1.0: Authoritative list of 10 Tropenbos International network countries (Bolivia, Colombia, DR Congo, Ethiopia, Ghana, Indonesia, Philippines, Suriname, Uganda, Vietnam) and core landscape operational areas (Juabeso-Bia, Sefwi-Wiawso).
- `lib/db/influence.ts`: Data access layer for influence events, quarterly impact reports, and verification queries.
- `lib/impact/quarterly-metrics.ts`: Operational metric computation logic (median turnaround, match quality, capture rates).
- `app/(app)/impact/page.tsx`: Server Component for `/impact`, handling quarter/period selection and role gating.
- `app/(app)/impact/quarterly-report.tsx`: Quarterly report client presentation and operational scorecard.
- `app/(app)/impact/export-donor-report.tsx`: Clipboard export utility for quarterly reports.
- `lib/impact/config.ts`: Date math for quarters and periods.

## Decisions and assumptions

1. **Annual Aggregation vs. Quarterly Drill-Down:** On `/impact`, provide a clean toggle or sub-view between "Quarterly Report" (operational quarterly cycle) and "Annual Strategic Evaluation" (annual rollup of all 4 quarters with 2030 target impact and network leverage).
2. **Network Partner Country Taxonomy:** Centralise the 10 Tropenbos International countries in `lib/impact/network-partners.ts` as typed constants with country codes, ISO flags/labels, and regional clusters (West Africa, Central/East Africa, Southeast Asia, South America):
   - Ghana (Host / Originating Programme)
   - Bolivia, Colombia, Suriname (South America)
   - DR Congo, Ethiopia, Uganda (Central/East Africa)
   - Indonesia, Philippines, Vietnam (Southeast Asia)
3. **Strategic Impact Fields:**
   - Extend `InfluenceEvent` or compute on-the-fly from verified influence records with optional structured metadata:
     - `hectaresImpacted`: Estimated landscape hectares influenced by this policy outcome (nullable float/int).
     - `peopleImpacted`: Estimated beneficiaries / smallholders with improved tenure or livelihood security (nullable int).
     - `adaptedCountries`: Array of partner country codes where this brief or policy model was adapted (string array).
4. **Pure Database Aggregation (Zero Model Calls):** All annual metrics, 2030 target contributions, and network leverage tallies are computed deterministically from PostgreSQL records without calling Gemini, complying with data governance and eliminating hallucinated impact figures.
5. **Donor & Network Assembly Export:** Provide a formatted Markdown export generator for the Annual Strategic Impact Brief, combining executive KPI summaries, 2030 goal contributions, verified multi-level policy influence citations, and international partner country adaptations.

## Files likely to change

- `lib/impact/network-partners.ts` (new file) — Centralised definitions and metadata for the 10 Tropenbos International network partner organisations and countries.
- `lib/impact/annual-metrics.ts` (new file) — Pure mathematical aggregation module computing annual strategic KPIs, 2030 target sums, and network country diffusion.
- `lib/db/annual-impact.ts` (new file) — Data queries for full-year signal capture, brief production, verified influence events with strategic impact data, and partner country adoptions.
- `lib/db/index.ts` — Re-export new annual impact queries.
- `app/(app)/impact/page.tsx` — Support `?view=annual&year=YYYY` query parameters alongside quarterly view.
- `app/(app)/impact/annual-report.tsx` (new component) — Annual strategic evaluation view with 2030 target progress bars, network leverage grid, and annual scorecard.
- `app/(app)/impact/export-annual-report.tsx` (new component) — Clipboard copy and Markdown export for Annual Strategic Impact Brief.
- `tests/contracts/annual-impact.spec.ts` (new test file) — Contract and integration tests validating accurate annual calculations, 2030 target summation, and partner country leverage metrics.

## Implementation requirements

1. **Network Partners & Strategic Metrics Definition (`lib/impact/network-partners.ts`):**
   - Export `TBI_NETWORK_PARTNERS` array with `{ code, name, region, country }`.
   - Export helper functions `getPartnerByCode`, `isValidPartnerCode`.
2. **Annual Metrics Calculator (`lib/impact/annual-metrics.ts`):**
   - Define `AnnualStrategicMetrics` interface:
     - `year`: number.
     - `totalSignalsDetected`: number.
     - `immediateSignalsCount`: number.
     - `immediateSignalsCaptured`: number.
     - `annualCaptureRate`: number | null.
     - `totalBriefs`: number.
     - `audienceDistribution`: Record of `BriefAudience` to count.
     - `verifiedEventsCount`: number.
     - `eventsByType`: Record of `InfluenceEventType` to count.
     - `totalHectaresInfluenced`: number.
     - `totalPeopleBenefited`: number.
     - `networkPartnerAdoptionsCount`: number.
     - `partnerCountryCoverage`: Array<{ code: string; name: string; count: number }>.
     - `averageTurnaroundHours`: number | null.
     - `overallMatchQualityPercentage`: number | null.
   - Implement `calculateAnnualStrategicMetrics(input)`.
3. **Data Layer (`lib/db/annual-impact.ts`):**
   - Implement `readAnnualStrategicReport({ year })`:
     - Query signals detected in `[year-01-01, (year+1)-01-01)`.
     - Query briefs and verified influence events in that calendar year.
     - Query evidence match reviews within the year for overall retrieval quality.
     - Return structured annual report containing metrics, verified influence events, cited evidence base, and network leverage highlights.
4. **UI Presentation (`app/(app)/impact/annual-report.tsx`):**
   - Top-level Tab/Toggle on `/impact`: "Quarterly Review" vs. "Annual Strategic Evaluation".
   - Year selector (e.g. 2026, 2025).
   - **4 Hero KPI Cards:**
     - **Annual Policy Window Capture**: Percentage of Immediate signals converted into briefs.
     - **2030 Landscape Target Contribution**: Formatted hectares (e.g. "125,000 ha") against the 20M ha network benchmark.
     - **2030 Livelihood Target Contribution**: Formatted people (e.g. "45,000 smallholders") against the 5M people network benchmark.
     - **TBI Network Leverage**: Number of international partner countries that adapted Ghana briefs (e.g. "4 of 9 partner countries").
   - **Network Diffusion Grid:**
     - Interactive visual cards for all 9 partner countries with status badges ("Adopted", "Active Pilot", "No Exchanges Yet").
   - **Influence Portfolio & 2030 Evidence Alignment:**
     - Table/list of verified policy citations and commitments with associated landscape hectares and smallholder livelihood benefits.
5. **Annual Report Export (`app/(app)/impact/export-annual-report.tsx`):**
   - Accessible button to copy or download complete Annual Strategic Impact Brief formatted in standard Markdown.
   - Includes TBI Ghana header, annual metrics, 2030 contribution details, partner country diffusion summary, and verified citations.

## Evidence classification impact

**none — no evidence data path.**
All strategic metric rollups, 2030 contribution sums, and network leverage counts are calculated strictly from database metadata (`policy_signal`, `brief`, `influence_event`, `evidence_match_review`). Zero evidence body text or unclassified content is transmitted to external AI models.

## Hallucination-guard implications

**none.**
This feature does not alter brief generation, claim extraction, or hallucination flag verification.

## Security requirements

- Role-based server-side access control: viewing annual impact is restricted via `canViewImpact` (Programme Director, Policy & Advocacy Officer).
- Input validation: sanitize and validate `year` parameter using Zod to prevent SQL or memory injection.
- Zero client leakage: no secret tokens, API keys, or raw personal data exposed in client components.

## Acceptance criteria

1. Navigating to `/impact?view=annual` displays the Annual Strategic Evaluation view.
2. The Annual view accurately aggregates full-year signal capture rate, brief audience distribution, and verified influence events for the selected year.
3. 2030 target contributions (hectares influenced and livelihoods improved) calculate and display correctly with progress toward network goals.
4. The TBI Network Leverage panel clearly identifies partner country adoptions across the 9 non-host Tropenbos International countries.
5. Clicking "Copy Annual Strategic Brief" formats the complete report into structured institutional Markdown and copies it to clipboard with visual confirmation.
6. All interactive elements have `cursor-pointer`, meet WCAG 2.1 AA contrast requirements, and are responsive across all screen sizes (320px to 1600px+).
7. Comprehensive test suite in `tests/contracts/annual-impact.spec.ts` passes without regressions.

## Checks to run

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Exact manual test steps expected after implementation

1. Sign in as Programme Director (`director@tropenbos.org.gh`) or Policy & Advocacy Officer (`policy@tropenbos.org.gh`).
2. Navigate to `/impact`.
3. Verify the view switcher allows toggling between "Quarterly Review" and "Annual Strategic Evaluation".
4. Select "Annual Strategic Evaluation" (2026).
5. Inspect the 4 hero KPI cards: verify Annual Policy Window Capture %, 2030 Hectares, 2030 Livelihood Beneficiaries, and TBI Network Leverage count.
6. Inspect the TBI Network Leverage grid: verify cards for Bolivia, Colombia, DR Congo, Ethiopia, Indonesia, Philippines, Suriname, Uganda, and Vietnam.
7. Click "Copy Annual Strategic Brief (Markdown)": verify success toast appears and pasted clipboard content contains the formatted annual strategic summary.
8. Switch viewport from 1440px desktop down to 375px mobile: verify no horizontal overflow and all metric cards wrap cleanly.
