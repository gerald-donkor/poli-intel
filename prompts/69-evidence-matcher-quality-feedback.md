# Evidence Matcher quality feedback

## Goal

Complete the remaining Impact Tracker feedback-loop requirement from spec §3.5 and the Research Officer workflow in spec §5.2: allow Research Officers to assess the quality of a current Evidence Matcher result, preserve that assessment as a staff record, and surface a compact, evidence-type-level summary that can inform research priorities. This is human feedback about retrieval quality; it must never alter a match automatically, re-rank a result, invoke Gemini, or create a brief.

## Skills read

- `.claude/skills/evidence-matcher/SKILL.md`
- `.claude/skills/evidence-governance/SKILL.md`
- `.claude/skills/server-actions/SKILL.md`
- `.claude/skills/supabase-schema/SKILL.md`
- `.claude/skills/design-system/SKILL.md`
- `.agents/skills/shadcn/SKILL.md`
- `design_handoff_evibrief/design-system.md`

Before implementation, also read the installed Next.js 16.2 Server Action documentation and the installed Prisma APIs/migration guidance relevant to the changed code. Run `npx shadcn@latest docs toggle-group alert badge` and use the returned component documentation before composing or changing those primitives.

## Existing code inspected

- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` §§3.5, 5.2, and Phase 4: the specification calls for evidence-quality feedback, and says a Research Officer periodically reviews automated matches for quality.
- `prisma/schema.prisma`: `SignalEvidenceMatch` is a replaceable current match set and cannot itself preserve a durable review history.
- `lib/db/evidence-matches.ts`: retrieval and current-set replacement are isolated in the data layer.
- `lib/db/signal-board.ts`: signal detail already returns eligible current matches and intentionally withholds reclassified items.
- `app/(app)/signals/[id]/page.tsx`, `matched-evidence.tsx`, `actions.ts`, and `schema.ts`: the current detail surface, rematch action, and shared-schema conventions.
- `lib/auth/authorize.ts`: Research Officer validation authority and authorise-first predicates.
- `app/(app)/evidence/page.tsx` and `evidence-table.tsx`: the Evidence Library layout, queue alert, and responsive treatment.
- `app/(app)/impact/quarterly-report.tsx` and `lib/db/influence.ts`: quarterly reporting already counts evidence behind confirmed impact events; this work complements it with staff-assessed matcher usefulness rather than duplicating that report.

## Decisions and assumptions

1. A review is an append-only, staff-authored assessment of one `(signal, evidence item)` match. A later assessment supersedes the displayed current assessment but preserves the earlier one for audit and longitudinal feedback. It does not mutate `SignalEvidenceMatch`, because a re-match may legitimately replace that ephemeral set.
2. The only assessment values are `relevant`, `not_relevant`, and `uncertain`, defined once as a Prisma enum and imported into the shared Zod schema. Do not invent a string union in UI code.
3. Only Research Officers and Programme Directors may submit a review. This follows the explicit Research Officer responsibility to validate matches; Policy & Advocacy Officers may request a re-match but may not certify retrieval quality. The Server Action is the enforcement point.
4. A review can be recorded only while the item is still a current match for the named signal and still `public_published`. The data-layer write re-reads both conditions transactionally. If either has changed, return a typed handled refusal, do not store a review, and direct the user to reload or the classification queue as appropriate.
5. The optional reviewer note is deliberately brief (maximum 500 characters), stored only in Tropenbos-controlled Postgres, and never sent to analytics, error reporting, a job payload, or a model. It is for concise reasoning such as “method does not address tree tenure,” never pasted evidence text.
6. The Evidence Library will show a compact feedback panel to Research Officers and Programme Directors only. It groups the latest review for each signal/evidence pair by evidence source type, showing reviewed-match count and relevant-match percentage. It explicitly labels this as staff assessment, not proof of evidence quality or policy impact; groups with no reviews are not ranked or implied to be weak.
7. The existing quarterly Impact report remains the source for “most cited.” This prompt adds the missing “most useful” (staff-reviewed relevance) half and links the two concepts in plain language without fabricating a combined score.

## Files likely to change

- `prisma/schema.prisma`
- a new Prisma migration under `prisma/migrations/`
- `lib/db/evidence-matches.ts` or a narrowly named companion data module, plus `lib/db/index.ts`
- `lib/db/signal-board.ts`
- `lib/auth/authorize.ts`
- `app/(app)/signals/[id]/schema.ts`
- `app/(app)/signals/[id]/actions.ts`
- `app/(app)/signals/[id]/matched-evidence.tsx`
- `app/(app)/signals/[id]/page.tsx`
- `app/(app)/evidence/page.tsx`
- a small colocated Evidence Library feedback component
- targeted Playwright contract coverage under `tests/contracts/`

## Implementation requirements

### Data and data layer

- Add an append-only `EvidenceMatchReview` model mapped to `evidence_match_review`, extending the existing signal/evidence domain rather than creating a parallel evidence concept.
- Record the signal id, evidence item id, reviewer id, enum assessment, nullable bounded note, and timestamp. Add only the indexes the read paths use: latest review by `(signal_id, evidence_item_id, reviewed_at)` and aggregate lookup by evidence item/review time. Do not add vectors, text-search copies, or speculative indexes.
- Add the corresponding relations on `PolicySignal`, `EvidenceItem`, and `StaffUser` with restrictive foreign-key behaviour appropriate for audit records.
- Generate the migration with `npm run db:migrate:new -- evidence_match_review_feedback`; preserve existing pgvector indexes exactly as required by `AGENTS.md` §19. Do not run `prisma migrate dev` and do not hand-edit a live database.
- Add a data-layer command that begins a transaction, confirms the requested `(signalId, evidenceItemId)` exists in the current `SignalEvidenceMatch` set, confirms the parent item remains `public_published`, then appends the review. Return typed `unknown_match` or `ineligible_classification` outcomes; never throw those ordinary races and never expose an evidence body or excerpt in an outcome.
- Extend signal-detail DTOs with the latest review only for currently eligible matches. Fetch no unpublished/community evidence text through the feedback path.
- Add a data-layer aggregate for the Evidence Library: latest assessment per signal/evidence pair, grouped by `EvidenceSourceType`, with reviewed count, relevant count, and a percentage calculated only where reviewed count is non-zero. Keep this a stored-data aggregate; it must not call AI or infer a causal impact score.

### Authorisation, validation, and mutation

- Add a server-only `canReviewEvidenceMatch` predicate for Research Officers and Programme Directors. Keep it separate from `canRequestEvidenceRematch` because re-running a model-assisted retrieval and recording a human validation are different permissions.
- Add a shape-only shared Zod schema in `app/(app)/signals/[id]/schema.ts`: UUID signal and evidence ids, Prisma-backed assessment enum, and trimmed optional note limited to 500 characters. Do not put roles or authorisation in this client-visible schema.
- Implement a colocated Server Action in `app/(app)/signals/[id]/actions.ts`. Its order is mandatory: resolve staff user, authorise, validate, call the data layer, revalidate `/signals/[id]` and `/evidence`, then return a typed result.
- Return ordinary refusals as typed results. For a stale/replaced match, say it changed and ask the reviewer to reload. For a reclassified item, say it is held from review and link or point to `/evidence/queue`; do not reveal its body text or create an assessment.
- Do not add a Route Handler, client-side database access, SWR, an Inngest event, Gemini call, telemetry event carrying note text, or an automatic state transition.

### UI and interaction

- In each eligible matched-evidence card on the signal-detail screen, render a clearly labelled “Research review” control only when the current staff member may review. Use the installed shadcn `ToggleGroup` for the three mutually exclusive assessment choices, with an optional concise note field and explicit save action.
- Do not call an assessment a verification, approval, or decision. Copy should make clear it records a reviewer’s view of whether the match is useful for this signal.
- On a card already assessed, render the latest assessment, reviewer name, and date in mono metadata. A subsequent save records a new review and updates that displayed latest assessment after revalidation.
- Render pending/saving, saved, invalid, unauthorised, stale-match, and reclassified-item outcomes inline with an `aria-live` region; do not use a disappearing generic toast for the durable action result.
- Preserve existing match scores, quoted source excerpt, gap/failure states, rematch control, and generation boundary. The review control is absent for a gap, a failed run, and matches held by classification.
- Add an “Evidence Matcher feedback” panel high on `/evidence`, after the classification-pending governance alert and before search results. Show only to Research Officers and Programme Directors. It should explain that these are staff assessments of retrieval usefulness, then list source types with reviewed count and relevant percentage (number + a neutral bar, never colour alone). If no reviews exist, render an honest empty state saying feedback will appear after Research Officers assess matches; do not show zero-value rankings.
- Follow the existing Tropenbos system: `paper` page, `card` panels, `line` borders, Inter for product copy, mono for counts/dates, and no literal forest imagery. Use semantic palette tokens only — no raw colours and no red/amber/green status scheme. Assessment state must be labelled in text, not colour alone.
- The signal-review card should stack as one readable column below `tablet`; the Evidence Library feedback panel must remain usable at 320px through 1600px with no page-level horizontal scroll. Maintain 44px or larger practical touch targets and visible keyboard focus.
- Use 150–300ms CSS transitions only where they communicate an interaction. Respect `prefers-reduced-motion`; do not introduce GSAP, a looping animation, or an automatic re-sort.
- Meet WCAG 2.1 AA: keyboard-operable toggle group and save control, visible focus ring, associated label for the optional note, semantic status text, and number-plus-bar summary values.

## Evidence classification impact

This task reads classification-governed evidence metadata and existing matched excerpts on the staff-only signal detail screen, but makes **no Gemini, embedding, retrieval, generation, translation, or fact-check call**. Classifications involved are `public_published`, `community_sourced`, and `unpublished_internal`.

The exact enforcement point for the new write is the new data-layer review command: inside its transaction it must confirm that the item remains in the signal’s current `SignalEvidenceMatch` set and that `EvidenceItem.classification === public_published` before appending `EvidenceMatchReview`. The existing matcher’s retrieval gate remains unchanged in `lib/db/evidence-matches.ts` (`findEvidenceMatchCandidates`) and `lib/governance/gate.ts` remains the AI-layer chokepoint.

`community_sourced` and `unpublished_internal` items are blocked: no review record is written, no evidence body or excerpt is returned by the refusal, and the UI explains that the item is held and points a permitted reviewer to the classification queue. The aggregate uses only stored review outcomes plus evidence metadata; it never transmits evidence text outside Tropenbos-controlled infrastructure.

## Hallucination-guard implications

None. This feature neither generates nor changes a brief, a fact-check pass, claim extraction, flag storage, flag rendering, nor approval blocking. Matcher-quality reviews are not hallucination flags and must not be rendered as slate circular guard indicators.

## Security requirements

- Every review mutation authorises the caller server-side before validation and data access.
- Enforce current-match membership and `public_published` classification in the transaction, not merely in UI props.
- Do not expose Prisma, raw SQL, model calls, or evidence body text to browser code.
- Do not emit reviewer notes, evidence titles, excerpts, source URLs, or assessment text to Sentry/PostHog. If an existing approved scalar-only analytics event is used, it may contain ids, enum assessment, and counts only; adding analytics is not required.
- Treat the optional note as plain text on render; do not render HTML and do not add rich text parsing.
- Do not alter classifications, `SignalEvidenceMatch` ranking, brief evidence selections, or any human approval/submission state.

## Acceptance criteria

1. A Research Officer or Programme Director can record `relevant`, `not_relevant`, or `uncertain` against a current public match; a Policy & Advocacy Officer and Field Officer are refused server-side.
2. Reviews are durable and append-only; the signal detail renders the latest review for that signal/evidence pair after reload without changing retrieval rank or match contents.
3. A review request races safely with a re-match or reclassification: if the pair is no longer current or eligible, no review is written and an explicit handled state is shown.
4. Only `public_published` current matches can be reviewed. `community_sourced` and `unpublished_internal` evidence stays blocked and never reaches AI, telemetry, or a review record through this feature.
5. The Evidence Library presents a Research Officer/Director-only evidence-type summary using latest staff assessments, with reviewed counts and relevant percentages; it has a clear no-feedback state and does not make causal or automated quality claims.
6. The UI remains keyboard-operable, responsive from 320px to 1600px+, uses no prohibited urgency colours, and preserves the existing signal detail’s match/gap/rematch behaviour.
7. No new Gemini request, Inngest job, route handler, or client-side primary data-fetch path is introduced.

## Checks to run

1. `npm run db:generate`
2. `npm run test`
3. `npm run lint` (report the two documented vendored baseline errors separately; fix any new errors in owned files)
4. `npm run typecheck`
5. `npm run build`

## Manual test steps

1. Start the app with the local development/test environment and sign in as a Research Officer.
2. Open a signal with at least one current public matched evidence item. Mark one as Relevant, optionally add a short note, and save. Reload and verify the latest assessment, reviewer, and date display while match rank and scores remain unchanged.
3. Save a second assessment for the same signal/evidence pair. Reload and verify the newer assessment is displayed while the database retains both rows.
4. Sign in as a Policy & Advocacy Officer and as a Field Officer. Confirm the review control is not offered, then invoke the action through a crafted request/test and confirm a server-side unauthorised refusal.
5. Reclassify a matched item away from `public_published` in a separate session, then submit a stale review. Confirm no review row is created, the UI explains the hold, and the classification queue remains the next step.
6. Open `/evidence` as a Research Officer and verify the feedback panel aggregates reviewed matches by source type with counts and relevant percentages. Confirm the same panel is absent for a Policy & Advocacy Officer and a Field Officer.
7. Check the signal detail and Evidence page at 390px, 760px, 1000px, 1300px, and 1600px. Verify no page-level horizontal scroll, keyboard toggle selection works, focus is visible, note labels are associated, and no status relies on colour alone.
