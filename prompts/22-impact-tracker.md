# 22 — Impact Tracker: influence logging, weekly detection, and the quarterly report

## Goal

Build the pipeline's **fourth and last module** (`AGENTS.md` §5.1): the Impact Tracker. It closes the feedback loop by recording where Tropenbos evidence and recommendations have been acknowledged, cited, or adopted — and it turns that record into the donor-facing quarterly report.

Three parts, one body of work:

1. **Influence-event logging** — a person records that a brief reached something: a policy document citing it, legislation aligned with it, a company commitment, a dialogue outcome, national strategy text (spec §3.5).
2. **Weekly detection** — a scheduled Inngest job searches for downstream citations of briefs Tropenbos has actually put into the world, and files what it finds as **unverified leads**.
3. **Quarterly report** — a structured summary of **verified** influence events, suitable for donor reporting (spec §3.5, §10.1).

Scope explicitly **excludes** the **impact map** — the GSAP evidence→brief→outcome line-drawing (spec §5.7, `AGENTS.md` §11.9). It is prompt 23's, for two reasons: a map can only draw paths that exist, and it is the product's single GSAP surface, which deserves its own prompt rather than a corner of this one. `/impact` therefore ships here with its real data surfaces and **keeps a placeholder where the map will go**.

Also excluded: evidence-quality feedback (spec §3.5's third output) beyond what the report's "which evidence is most cited" section gives for free; the field-officer routes; WhatsApp/USSD.

## Skills read

- **`inngest-jobs`** — rule 9 (the Impact Tracker runs weekly), rule 5 (one dead source does not abort the batch), rule 7 (silence is reported, not assumed), rule 6 (the free-tier job budget), and the "job shapes" split that keeps this module from reaching into the radar's internals.
- **`gemini-integration`** — the central config, no inlined model ID or limit, 429 with backoff as a handled visible state, Zod validation of structured output, and the rule against logging prompts or completions.
- **`evidence-governance`** — read to settle decision 4 below, which is the one genuinely load-bearing question in this prompt: what text may be sent to a search-grounded model when the subject is Tropenbos's own brief.
- **`supabase-schema`** — the enum rule (§12.7), the 500MB budget, and migration authoring. This prompt **does** change the schema.
- **`design-system`** — the `/impact` surfaces, the verified/unverified distinction, and the serif rule, which this screen is the strongest case for in the whole product (decision 8).
- **`server-actions`** — the action order (authorise → validate → work, in that order), the typed error-result outcomes, the object-level-versus-role-level distinction that decision 11 turns on, and the `useOptimistic` restriction in decision 12.
- **`gemini-api-dev`** (vendor) — the grounding surface, already verified in prompt 21 and reused rather than re-derived.
- **`resend`, `react-email`** (vendor) — read for the digest's new influence section, and they mostly confirmed there is nothing new to decide: the section extends the existing `emails/morning-digest.tsx` and its existing send. Two rules that do bite if the section grows a layout — no flexbox or grid (use `Row`/`Column`), and no `dark:`/`sm:` variants, which email clients do not support.

## Existing code inspected

- `prisma/schema.prisma` — `InfluenceEvent` at line 787 exists from prompt 04 and **has never been written to**. It carries `briefId`, `eventType` (a bare `String`), `sourceDocument`, `detectedAt`, `description`, `verified`. `Brief` and `BriefStatus` (`draft → reviewed → submitted → published`) are next door, as is `BriefStatusChange`, which is the record of when a brief actually went out.
- `app/(app)/impact/page.tsx` — a `ScreenPlaceholder` reading "The impact map goes here … plus the influence-event rail and the quarterly report generator". This prompt replaces everything in that sentence **except the map**.
- `lib/radar/grounded.ts` (prompt 21, committed 63611e9) — the verified grounded-search call: the `tools: [{ googleSearch: {…} }]` shape, `timeRangeFilter`'s second-granularity constraint, redirect-URI resolution, and the 429 mapping. **This is the module decision 3 reuses**, and prompt 21 said so when it was written.
- `lib/ai/config.ts` — `GENERATION_MODEL`, `GENERATION_TEMPERATURE`, `RADAR_GROUNDED_CALLS_PER_RUN`, `RADAR_GROUNDED_RECENCY_DAYS`, `RADAR_RPM_ALLOCATION` / `MATCHER_RPM_ALLOCATION` / `EMBEDDING_RPM_ALLOCATION` and the derived per-minute throttles. The allocation pattern is established; a fourth consumer joins it.
- `lib/ai/structured.ts`, `lib/ai/gemini.ts` — `callStructured`, `toGeminiRequestFailure`. Unchanged by this prompt.
- `lib/auth/authorize.ts` — twelve `can*` capability functions, each a pure role predicate. The Impact Tracker adds to this list; it does not invent a second authorisation mechanism.
- `lib/db/` — one module per surface (`signals.ts`, `briefs.ts`, `digest.ts`, `stakeholders.ts`…), all re-exported through `index.ts`. Nothing else talks to the database.
- `lib/digest/config.ts`, `lib/digest/build.ts`, `lib/db/digest.ts`, `emails/morning-digest.tsx` — the digest reads a 24-hour window and builds role-aware sections. **It has no influence-event section**, which spec §5.2 step 1 requires for the Programme Director.
- `lib/jobs/functions/` — seven functions, and `lib/jobs/client.ts`'s rule that job infrastructure carries ids and counts, never text.

## Decisions and assumptions

1. **The schema changes, and it is a real migration.** `InfluenceEvent` as it stands cannot support any of the three parts:
   - `eventType` is a bare `String`. Spec §3.5 names five kinds, so it becomes an **enum** defined once in the schema and imported everywhere (§12.7). Never a string union in UI code.
   - There is no way to tell a **person's log** from a **job's detection**. Those are different claims with different weight, and the report may only use one of them, so the row must say which.
   - `verified` is a bare boolean with no actor and no timestamp. Every other status transition in this schema records who and when (§8.3); a claim that goes into a donor report is not the place to start making exceptions.
   - There is nothing to deduplicate on, and a weekly job that re-finds the same citation every Monday for a year is the defect §14.4 describes, one layer up.

   Authored with `npm run db:migrate:new -- <name>`, **never `prisma migrate dev`** (§19). No vector column is added, so no HNSW index is at stake — the rule still holds.

2. **Detection files leads, never facts.** A detected event enters `verified: false` and stays there until a person verifies it. This is §8 applied to a new surface: the model does not decide that Tropenbos influenced anything. The quarterly report reads **verified events only** (decision 7), so an unverified lead cannot reach a donor by accident.

3. **The grounded-search call is extracted and shared, not copied.** Prompt 21 wrote the verified call — the tool shape, the second-granularity timestamps that a plain `toISOString()` breaks, the redirect resolution, the 429 mapping. A second copy would drift from the first, and the first is the one that was verified against the live API.

   Extract the model-facing half of `lib/radar/grounded.ts` into a shared server-only module (suggested: `lib/ai/grounded-search.ts`) that takes a query and a recency window and returns **prose plus resolved publisher sources**. `lib/radar/grounded.ts` keeps its own `DetectedItem` mapping and its own extraction schema; the Impact Tracker gets its own. **The radar's behaviour must not change** — this is a refactor with a new second caller, and prompt 21's acceptance criteria still have to hold afterwards.

4. **What may be sent to the model — the governance decision of this prompt.**

   Detection means asking a search-grounded model whether the outside world has cited a Tropenbos brief. The naive implementation sends the brief's body text. **It must not**, and the reason is not §7's letter but its purpose: a `draft` or `reviewed` brief is unpublished internal Tropenbos material, and the free tier trains on what it receives.

   The rule to implement:
   - **Detection runs only on briefs whose status is `submitted` or `published`** — documents Tropenbos has already put into the world, where there is nothing left to leak.
   - **Even then, the body text is not sent.** The query is built from the brief's **title, its recorded audience, and its brief type** — enough to search for, and all of it metadata Tropenbos published when it published the brief.
   - **No evidence item, chunk, or `full_text` is read on this path at all.** The Impact Tracker never touches the evidence library.

   Enforce this **structurally**, the way `classifySignal` does: the detection entry point accepts a narrow, purpose-built input type that *cannot carry* body text or an evidence reference. A status filter in a Prisma `where` is a good start and is not the gate — make the ineligible thing unrepresentable.

5. **Deduplicate before the insert, on a normalised key.** The same citation found on two consecutive Mondays is one influence event. Match on `briefId` + normalised source-document URL first, then fall back to the description-similarity approach `lib/radar/dedup.ts` already implements — **reuse that module's normalisation rather than writing a second one**. A re-detection touches the existing row; it never creates a second.

6. **Weekly, and inside the budget.** One Inngest cron (`AGENTS.md` §14.9), fanning out per eligible brief so one failed detection does not abort the batch (§14.5). Cost per brief is the grounded pair from prompt 21 — a search call plus a structured extraction. That is **not free**: with a growing corpus of submitted briefs this is the job most likely to eat the daily budget, so it needs its own `IMPACT_*` allocation in `lib/ai/config.ts`, a **bounded number of briefs per run**, and a rule for which briefs are checked. Suggested rule, to be recorded in config: check a brief for a bounded window after it was submitted, and stop — a brief submitted three years ago does not need a search every Monday. Derive the throttle; do not guess it.

7. **The quarterly report is assembled, not generated.** No Gemini call.

   Spec §3.5 says "auto-drafted donor reporting section", and auto-**assembly** satisfies it. A model-written donor report is unsourced prose about the organisation's own impact — the exact thing §9.8 forbids inside a brief, and worse here, because there is no hallucination guard on this surface and no citation chip to check. Every line of the report must trace to a verified, logged row.

   The report covers a named quarter and contains: verified events by type, the briefs behind them, the evidence items those briefs cited (which is spec §3.5's evidence-quality feedback, for free), and an explicit count of what was **detected but not verified** so the reader knows the difference. Export reuses the existing `docx` path in `lib/export/` if it fits; if it does not, the screen is enough for this prompt and export is stated as not done rather than half-done.

8. **The serif finally has its proper subject.** An influence event's quoted line **from the citing document** — the sentence in the Forestry Commission notice that cites Tropenbos — is verbatim material the product did not author. **That is the serif** (§11.6). The event's own description, written by a person or drafted by the detection pass, is the sans. This screen is the clearest illustration of the rule in the product; get it right here.

9. **Verified and unverified are distinguished by shape and words, not colour alone** (§11.7 corollary, §11.13). No red, no green, no tick-versus-cross. And **no urgency ramp** — an influence event has no urgency, and reusing that ramp would attach a taxonomy it does not have.

10. **Roles.** `/impact` is the Programme Director's screen (spec §5.2 table), but the Policy & Advocacy Officer is who tracks outcomes day to day.
    - **View `/impact` and log an event**: Programme Director, Policy & Advocacy Officer.
    - **Verify an event**: **Programme Director only.** Verification is the claim that goes to donors.
    - **Generate the quarterly report**: Programme Director.
    - Research Officer and Field Officer: no access.

    New `can*` predicates in `lib/auth/authorize.ts`, authorised **inside** each Server Action, server-side (§10.1). UI hiding is presentation.

11. **Verification is role-level, and the object-level question is open — raise it, don't silently decide it.**

    `server-actions` draws the distinction sharply, and this project already has a precedent for the stricter answer: a Policy & Advocacy Officer may not clear a guard flag on a brief **they drafted** (§10.6). The parallel question here is whether a Programme Director may verify an influence event on a brief they authored — because verification is what puts a claim about Tropenbos's own impact into a donor report, and self-attestation is exactly what the flag rule exists to prevent.

    **Implement role-level for now** (Programme Director verifies), because Tropenbos Ghana is a small organisation and a blanket object-level block could leave events unverifiable when the Director wrote the brief. But **surface the authored-by on the verification control** so the reviewer can see it, and **flag the question in the implementation summary** rather than treating it as settled. If Tropenbos wants the stricter rule, it is a one-predicate change.

12. **Optimistic updates: only where refusal is impossible.**

    `server-actions` is explicit that `useOptimistic` must never be applied to something the server may refuse on authorisation grounds. Verification is Programme-Director-only, so on the Director's own screen it is a known-permitted operation and may be optimistic. **Logging an event must not be** — it is offered to two roles and the action still authorises. When in doubt here, don't; nothing on this screen is latency-sensitive enough to earn the risk of showing a donor-facing claim as verified before the server agreed.

13. **The digest gains its influence section.** Spec §5.2 step 1 requires the morning digest to surface new influence events for the Programme Director, and it currently does not. A small, role-scoped section — counts and titles, no quoted document text — added to the existing template rather than a second email.

## Files likely to change

**Schema**

- `prisma/schema.prisma` — the `InfluenceEventType` enum, a detection-method distinction, verification actor and timestamp, and whatever dedup key decision 5 settles on.
- `prisma/migrations/<timestamp>_<name>/migration.sql` — authored via `npm run db:migrate:new`.

**AI**

- `lib/ai/grounded-search.ts` (new) — the shared grounded call extracted from `lib/radar/grounded.ts` (decision 3).
- `lib/radar/grounded.ts` — reduced to its radar-specific half. **No behaviour change.**
- `lib/ai/detect-influence.ts` (new) — the detection door: narrow input type, query construction, structured extraction, Zod validation.
- `lib/ai/config.ts` — the `IMPACT_*` allocation, per-run brief cap, detection window, and derived throttle.

**Jobs**

- `lib/jobs/functions/impact-detect.ts` (new) — the weekly cron and its fan-out.
- `lib/jobs/client.ts` — the new event(s), following the existing naming.
- `app/api/inngest/route.ts` — registration.

**Data**

- `lib/db/influence.ts` (new) — reads and writes for influence events and the report's aggregate query.
- `lib/db/index.ts` — re-exports.
- `lib/db/digest.ts` — the digest's new influence read.

**UI**

- `app/(app)/impact/page.tsx` — replaces the placeholder with the real surfaces, **keeping a placeholder for the map**.
- `app/(app)/impact/actions.ts`, `schema.ts`, and the client components for logging, verifying, and the report — colocated with the route (§5.3).
- `lib/auth/authorize.ts` — the new predicates.

**Digest**

- `lib/digest/build.ts`, `emails/morning-digest.tsx` — the influence section.

## Implementation requirements

### Detection

- One entry point taking the narrow input type of decision 4. Body text and evidence references must be **unrepresentable** in it, not filtered out of it.
- Bounded like every other model path: a request timeout, a per-run brief cap, a per-brief item cap, and a character cap on anything extracted.
- Every source URL validated as absolute http(s) and resolved past a grounding redirect before it is stored — reuse prompt 21's resolution, do not write a second one.
- A candidate with no resolvable source is **dropped and counted**, never stored with an invented URL.
- Structured output validated with Zod; invalid output retried once via `callStructured`'s existing rule, then a typed failure.
- A 429 in either call is the recorded, reschedulable outcome with retry timing intact, mapped through `toGeminiRequestFailure`.
- **Logging: brief ids, counts, model, latency, outcome. Never the query, never the returned prose, never a description.**

### The job

- Weekly cron, per-brief fan-out, per-brief failure isolation.
- A run that searched and found nothing is recorded as such, distinguishably from a run that failed (`inngest-jobs` rule 7). Follow `radar_run`'s precedent — whether that means a new run table or a reuse is an implementation call to make and record.
- Throttled through Inngest flow control, never a sleep inside a step.

### The Server Actions

- **Authorise, then validate, then work — in that order.** An unauthorised caller must learn nothing from validation messages about a resource they cannot touch (`server-actions`).
- **Typed results, never a thrown error across the action boundary** for an expected outcome. The outcomes this surface needs are `unauthorised`, `invalid` (field-mapped for the form), and — on the report, if it ever grows a model call, which decision 7 says it must not — nothing else. Each renders as a designed state, never a generic error toast.
- Zod schemas shared with React Hook Form so the rules exist once, and **no authorisation logic in a client-visible shared schema** (§10.10). Shape in the shared schema; who may act in server-only modules.
- **Actions stay short.** Validate, authorise, orchestrate, return. The detection call belongs to the AI layer and the job that drives it — never inline in an action (§5.2, §18).

### The screen

- Fully responsive 320px→1600px+, checked at 390 / 760 / 1000 / 1300 / 1600 (§11.15). No horizontal page scroll.
- The five required UX states where they apply (§17.6) — in particular **empty**, which is the honest steady state for a young organisation's tracker and must read as "nothing logged yet" with a real next step, never as an error.
- WCAG 2.1 AA: keyboard-navigable lists and dialogs, ARIA labels on the verified/unverified indicator, 4.5:1 contrast on any new pairing.
- Copy never implies the system decided, verified, or confirmed anything (§8.8). A detected event was **found**, and a person **verified** it.

## Evidence classification impact

**None — no evidence data path.** Stated with the reason, because this prompt makes Gemini calls and the default answer for a Gemini call is "the gate applies".

- **No evidence reaches the model.** The Impact Tracker reads `brief`, `influence_event`, and — for the report's evidence-quality section — the **ids and titles** of evidence a brief cited via `BriefEvidence`. It never reads `evidence_item.full_text`, never retrieves a chunk, and never constructs a `GatedEvidenceContext`, because there is no evidence to gate.
- **The report's evidence section is a database aggregate, not a model call.** Counting which evidence items appear across verified events transmits nothing to anyone.
- **What is transmitted:** a brief's title, audience and type — metadata of a document Tropenbos has already published — plus, in the extraction step, the model's own prose from the search step. Decision 4 is the enforcement point, and it is structural: the detection entry point's input type cannot carry body text or an evidence reference.
- **Unpublished briefs never reach this path at all.** `draft` and `reviewed` briefs are excluded by status before anything is built, and the input type is what makes the exclusion unforgeable.
- **This is not a licence to widen the input later.** Seeding detection from a brief's body, an evidence item, or a signal's summary is a different data path and must be re-assessed against `evidence-governance` first. Say so in the module comment, where the query is built.
- **No bypass, no flag, no env var.**
- **Logging:** ids, counts, timings, outcomes. Never the query, never the model's prose (§7.6, §13.9).

## Hallucination-guard implications

**None.**

Nothing here changes what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks. This path generates no brief and produces no evidence context, so there is nothing for the guard to verify against.

One explicit non-change, for the same reason prompt 21 stated one: **a detected influence event is a model assertion about the world and is not fact-checked.** It is a lead a person confirms, which is exactly what decision 2's `verified: false` default encodes and what decision 7 keeps out of the donor report. Do not add guard flags to influence events — that would invent a second flag surface with a different contract from `hallucination-guard`'s, and the verification workflow already does this job better.

## Security requirements

- Server-only and jobs-only for detection. It never runs in browser code and never inside a request handler (§18, §14.1).
- Every Server Action authorises its caller inside the action, per decision 10. Verification refuses any role but Programme Director, server-side.
- `GOOGLE_GENERATIVE_AI_API_KEY` stays server-only. No new env var, no new secret, no new external service.
- Every URL from the model is untrusted: validated as absolute http(s) before storage, never followed by the scraper, never rendered as a link without that validation.
- No returned text is evaluated, interpolated into a query, or written anywhere but the event's own capped fields.
- No model ID, temperature, token cap, or rate-limit number inlined at a call site (§13.1).
- The quarterly report is a Tropenbos-internal document: no evidence body text in it, and nothing from it goes to Sentry or PostHog.

## Acceptance criteria

1. An authorised person can log an influence event against a brief, and it appears on `/impact` immediately.
2. Only a Programme Director can verify an event; the action refuses another role **server-side**, not by hiding a button. Every action authorises before it validates.
3. Verification records actor and timestamp, and both are visible.
4. The weekly job runs on its cron, fans out per eligible brief, and one failed detection does not affect the others.
5. Detection runs on `submitted` and `published` briefs only. A `draft` or `reviewed` brief is never sent to the model, and the input type makes that structural rather than conditional.
6. A detected event is stored `verified: false` and is visibly distinguished from a logged one.
7. Running detection twice against the same brief creates no duplicate event; the second run matches and touches the existing row.
8. A run that searched and found nothing is recorded distinguishably from one that failed.
9. A 429 records the outcome with retry timing and does not fail the other briefs' runs.
10. The quarterly report covers a named quarter, contains **only verified** events, states the unverified count separately, and every line traces to a stored row. No Gemini call is made to produce it.
11. Quoted text from a citing document is set in the serif; every other string on the screen is not.
12. Verified and unverified are distinguishable without relying on colour, and no urgency ramp appears on this screen.
13. The morning digest carries a new-influence-events section for the Programme Director.
14. `/impact` is usable with no horizontal scroll at 390 / 760 / 1000 / 1300 / 1600px, and its empty state reads as "nothing logged yet" with a next step.
15. The impact map placeholder is still present and still says the map is built by a later prompt.
16. The radar's grounded search behaves exactly as it did before the extraction — prompt 21's acceptance criteria still hold.
17. No new Gemini model ID, no new env var.
18. `npm run lint` and `npm run typecheck` are clean apart from the four known pre-existing errors.

## Checks to run

```
npm run lint
npm run typecheck
npm run build
npm run db:migrate
```

This prompt adds a migration — author it with `npm run db:migrate:new -- <snake_case_name>` and apply it with `npm run db:migrate`. **Never `prisma migrate dev`** (§19). Restart `npm run dev` after `db:generate` so the DMMF is not stale. Report the exact output of each.

## Manual test steps

1. `npm run db:migrate`, then `npm run dev` and `npm run inngest:dev` together.
2. As a Programme Director, open `/impact`. Confirm the empty state reads as "nothing logged yet" with a real next step — not an error, not a blank panel.
3. Log an influence event against an existing brief. Confirm it appears, marked as logged by a person, with your name and the time.
4. Sign in as a Policy & Advocacy Officer. Confirm you can log an event and **cannot** verify one. Confirm the verify action refuses server-side — call it directly, don't just check that the button is hidden.
5. Sign in as a Research Officer. Confirm `/impact` is not accessible.
6. At <http://localhost:8288>, trigger the weekly detection job. Read the step trace: eligible briefs resolved, then the grounded pair per brief.
7. Confirm every detected event is `verified: false` and visibly distinct from step 3's logged event.
8. **Click a detected event's source link and confirm it opens a readable document**, not an API redirect or a 404 — the same failure mode prompt 21 flagged, on a new surface.
9. Confirm no `draft` or `reviewed` brief was checked. Verify by looking at which brief ids the run reported.
10. Trigger the job again. Confirm no duplicate events are created.
11. Verify one detected event as Programme Director. Confirm the actor and timestamp are recorded and shown.
12. Generate the quarterly report. Confirm it contains the verified event and **not** the unverified ones, and that it states the unverified count separately.
13. Confirm any quoted line from a citing document is in the serif and everything else is not.
14. Trigger the morning digest and confirm the Programme Director's copy carries the new influence section.
15. Trigger a radar grounded run (`news-ghana-forestry`) and confirm the extraction refactor changed nothing.
16. Check `/impact` at 390px, 760px, 1000px, 1300px, 1600px — no horizontal page scroll, no clipped control.
