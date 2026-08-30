# 73 — Brief QA Review Checklist & Factual Accuracy Verification Workflow

## Goal

Implement the structured 30-minute Brief QA Review Checklist and Factual Accuracy Verification workflow specified in `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §9 (Risks & Mitigations), §5.1, §5.2 (Step 20), and `AGENTS.md` §10.4.

EviBrief generates policy briefs from verified evidence via AI, but all briefs require rigorous human review before submission or approval. To mitigate cognitive load and ensure high-standard institutional QA, Research Officers and Programme Directors complete a structured 5-dimension verification checklist:
1. **Factual Grounding & Source Alignment** — all claims and statistics trace to cited evidence in the evidence context.
2. **Landscape & Local Specificity** — claims and examples reference specific Ghanaian landscapes (e.g. Juabeso-Bia, Sefwi-Wiawso, Western North Region) rather than generic generalities.
3. **Audience Framing & Register** — tone and structure match the target audience profile (formal/deferential for ministries, risk/opportunity for companies, plain language for CREMAs).
4. **Concrete Actionable Asks** — 2–4 concrete recommendations with identified decision-maker targets and realistic implementation pathways.
5. **Cross-Cutting Policy Themes** — gender & youth equity dimensions and local financial capacity/livelihood impacts are explicitly checked (spec §2.2).

The checklist is stored in Postgres, associated with the brief and its version, records the reviewer and timestamp, and provides a clear review summary for the Programme Director prior to final approval.

## Skills read

- `.claude/skills/server-actions/SKILL.md` — Authorise-first Server Action conventions, object-level author checks, shared Zod schemas, and error handling.
- `.claude/skills/supabase-schema/SKILL.md` — Prisma schema conventions, migrations within the 500MB budget, and relational integrity.
- `.claude/skills/design-system/SKILL.md` — Warm institutional palette, card hierarchy, typography, and responsive rules.
- `.claude/skills/evidence-governance/SKILL.md` — Standing data classification and zero-unverified-AI rules (this QA workflow is 100% human-operated and executes zero Gemini calls).
- `.claude/skills/hallucination-guard/SKILL.md` — Fact-check visual contract, flag status integration, and approval blocking rules.
- `.agents/skills/shadcn/SKILL.md` — shadcn/ui components (Checkbox, Card, Badge, Textarea, Button, Dialog/Collapsible).
- `design_handoff_evibrief/design-system.md` — Visual system and token recipes.

## Existing code inspected

- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §9, §5.1, §5.2 (Step 20), §10.4: Mandates structured 30-minute review checklist reducing cognitive load, Research Officer factual claims verification against cited evidence, and Programme Director approval review.
- `prisma/schema.prisma`: Core entities (`Brief`, `StaffUser`, `HallucinationFlag`, `BriefStatusHistory`).
- `lib/auth/authorize.ts`: Role predicates (`canApproveOrRejectBrief`, `canDismissFlag`, `canEditBrief`, `canReviewEvidenceMatch`).
- `lib/db/briefs.ts`: `findBriefDetail`, `listBriefs`.
- `app/(app)/briefs/[id]/page.tsx`: Brief detail Server Component rendering governance and review panels.
- `app/(app)/briefs/[id]/review-panel.tsx`: Programme Director decision surface.
- `app/(app)/briefs/[id]/flag-panel.tsx`: Hallucination-guard flag display and resolution panel.
- `app/(app)/briefs/[id]/actions.ts` & `schema.ts`: Server Actions for status transitions and flag resolution.

## Decisions and assumptions

1. **Persistent relational model.** The review checklist is persisted in a `BriefQaReview` model mapped to `brief_qa_review` in PostgreSQL. Each checklist entry records:
   - `briefId`: Relational foreign key to `Brief`.
   - `briefVersion`: Integer tracking which version was reviewed.
   - `reviewerId`: Relational foreign key to `StaffUser`.
   - `factualGroundingChecked`: Boolean (all claims verified against cited sources).
   - `landscapeSpecificityChecked`: Boolean (grounded in Juabeso-Bia, Sefwi-Wiawso, etc.).
   - `audienceFramingChecked`: Boolean (register matches target audience).
   - `actionableAsksChecked`: Boolean (concrete, actionable recommendations).
   - `crossCuttingThemesChecked`: Boolean (gender, youth, and local livelihood equity checked).
   - `notes`: Optional string (reviewer observations or notes for the author/Director, max 2000 chars).
   - `completedAt`: Timestamp when all 5 dimensions were marked complete.
   - `createdAt` & `updatedAt`: Standard audit timestamps.
2. **Authorisation & Object-Level Checks:**
   - **Reviewer Roles:** Research Officer and Programme Director can author and save the QA checklist (`canReviewBriefQa`).
   - **Self-Review Separation:** A reviewer cannot complete the QA checklist on a brief they personally drafted (`reviewerId !== brief.createdById`), ensuring strict quality independence.
   - **Read Access:** All staff with access to the brief can view the completed QA checklist state and notes.
3. **Zero AI Generation:** The review checklist is strictly human-driven. It contains no LLM calls and incurs zero token or rate-limit cost.
4. **Integration with Review & Approval Surfaces:**
   - On `/briefs/[id]`, the `BriefQaPanel` appears in the side rail alongside the Flag Panel and Review Panel.
   - In `ReviewPanel`, the Programme Director sees a clear indicator showing whether the QA Checklist has been completed by a Research Officer or reviewer.
   - In `/dashboard` (Executive Dashboard approval queue), briefs with completed QA reviews display a QA verified badge alongside citation and flag metrics.
5. **Progressive disclosure & Responsive UX:** The checklist presents clear criteria descriptions for each dimension with interactive checkboxes and an optional notes field. Interactive elements strictly carry `cursor-pointer`.

## Files likely to change

- `prisma/schema.prisma` — add `BriefQaReview` model and relation on `Brief` and `StaffUser`.
- `prisma/migrations/` — new migration generated via `npm run db:migrate:new -- brief_qa_review`.
- `lib/db/brief-qa.ts` (new file) — data-layer functions: `findQaReviewForBrief`, `saveBriefQaReview`.
- `lib/db/index.ts` — export brief QA data-layer queries and types.
- `lib/auth/authorize.ts` — role predicate `canReviewBriefQa(role, brief, actorId)`.
- `app/(app)/briefs/[id]/qa-panel.tsx` (new component) — interactive QA Review checklist panel.
- `app/(app)/briefs/[id]/actions.ts` — colocated Server Action `saveBriefQaReviewAction`.
- `app/(app)/briefs/[id]/schema.ts` — Zod schema for QA checklist inputs.
- `app/(app)/briefs/[id]/page.tsx` — load and pass QA review data to `BriefQaPanel` and `ReviewPanel`.
- `app/(app)/briefs/[id]/review-panel.tsx` — render QA review summary badge/status for Programme Director.
- `app/(app)/dashboard/approval-queue.tsx` — display QA verification status on pending briefs.
- `tests/contracts/brief-qa.spec.ts` (new test file) — feature contract and authorization tests for the QA checklist.

## Implementation requirements

1. **Schema & Migration:**
   - Define `BriefQaReview` model in `prisma/schema.prisma` with proper indexes on `brief_id` and `reviewer_id`.
   - Run `npm run db:migrate:new -- brief_qa_review` to generate the migration SQL.
2. **Data Layer (`lib/db/brief-qa.ts`):**
   - Implement `findQaReviewForBrief(briefId: string)` returning the latest QA review with reviewer profile (`name`, `role`).
   - Implement `saveBriefQaReview(input: SaveBriefQaReviewInput)` performing transactional upsert and recording timestamps.
3. **Authorisation (`lib/auth/authorize.ts`):**
   - Add `canReviewBriefQa(role: StaffRole, brief: { createdById: string }, actorId: string): boolean`:
     - Allowed for `research_officer` and `programme_director`.
     - Refused if `brief.createdById === actorId` (no self-QA on own authored briefs).
     - Refused for `field_officer` and `policy_advocacy_officer` (who draft briefs).
4. **Server Action (`app/(app)/briefs/[id]/actions.ts`):**
   - Add `saveBriefQaReviewAction(input: SaveBriefQaReviewInput)`.
   - Strictly authorise the caller, validate inputs with Zod, verify brief exists and is in reviewable status, execute database upsert, and revalidate path `/briefs/${briefId}` and `/dashboard`.
5. **UI Components (`app/(app)/briefs/[id]/qa-panel.tsx`):**
   - Render 5 verification dimensions with descriptions:
     1. Factual Grounding & Source Alignment
     2. Landscape & Local Specificity (Juabeso-Bia / Sefwi-Wiawso)
     3. Audience Framing & Tone
     4. Concrete Actionable Recommendations
     5. Cross-Cutting Themes (Gender, Youth, Financial Capacity)
   - Show reviewer name, completion timestamp, and notes.
   - For authorized reviewers (non-authors), allow checking/unchecking and saving notes.
   - For authors or unauthorized users, show read-only status and informative note explaining QA separation.
6. **Integration with Review Panel & Executive Dashboard:**
   - In `ReviewPanel` (`app/(app)/briefs/[id]/review-panel.tsx`), show a subtle badge indicating whether the brief QA checklist is complete or pending.
   - In `/dashboard` approval queue, surface QA completion status alongside open hallucination flags.

## Evidence classification impact

**None — no evidence data path.** This task provides human QA workflow tracking for policy briefs and does not touch, move, reclassify, or transmit raw evidence items or community data.

## Hallucination-guard implications

**Complements and integrates with the Hallucination Guard.**
- The Hallucination Guard runs automated post-generation fact-checking and creates structured `HallucinationFlag` records.
- The QA Review Checklist provides the structured human review layer where Research Officers verify factual grounding against cited evidence and confirm that open flags have been reviewed and resolved.
- The approval block rules in §9.5 remain strictly enforced server-side: Programme Director approval refuses if open flags remain, and the QA review status gives the Director full visibility into human verification.

## Security requirements

- Server Actions authenticate and authorise every caller server-side.
- Object-level check prevents authors from approving their own QA checklist.
- Validation bounds notes length to prevent database bloat.
- XSS protection via React DOM escaping for notes and reviewer names.

## Acceptance criteria

1. Research Officers and Programme Directors can access, check, and save the 5-dimension QA review on `/briefs/[id]`.
2. Policy & Advocacy Officers and authors of the brief see the QA review status in read-only mode and cannot submit QA checks on their own drafts.
3. Completed QA review records the reviewer identity and timestamp, displaying cleanly on the brief page.
4. Programme Director sees QA checklist status in both `ReviewPanel` and `/dashboard` approval queue.
5. All automated contract tests pass with zero regressions.

## Checks to run

```bash
npm run typecheck
npm run lint
npm test
```

## Exact manual test steps expected after implementation

1. Sign in as Research Officer (`researcher@tropenbos.org`).
2. Navigate to a draft brief authored by a Policy Officer (`/briefs/<id>`).
3. Observe the Brief QA Review panel in the side rail.
4. Check the 5 verification items (Factual Grounding, Landscape Specificity, Audience Framing, Actionable Asks, Cross-Cutting Themes).
5. Add a reviewer note and click **Save QA Review**.
6. Verify the panel updates immediately showing "QA Verified by [Researcher Name] · [Timestamp]".
7. Sign in as Programme Director (`director@tropenbos.org`).
8. Navigate to `/dashboard` and verify the brief card in the Approval Queue displays the QA Verified indicator.
9. Open the brief and confirm `ReviewPanel` reflects that QA verification is complete.
