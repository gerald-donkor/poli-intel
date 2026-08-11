# 35 — Weekly radar gap analysis

## Goal

Add the weekly Policy Radar gap analysis that `RadarRun` was created to support: a scheduled report showing which monitored sources were checked, which were quiet, which failed, and which produced signals during the last week.

This is next because the section 1 product build list is represented in committed code through prompt 34, and the remaining explicit unbuilt contract is operational rather than a new product surface: `inngest-jobs` rule 7 and the `RadarRun` schema comments say a source returning no signals must be reported in a weekly gap analysis so silence is not mistaken for a working source. Prompt 17 deliberately excluded this job, leaving the table and comments ready but no weekly report.

The deliverable is a read-only weekly Inngest job plus a compact React Email report sent to the same staff roles that receive the internal morning digest. It must not add a new module, admin screen, schema table, Slack path, or evidence data path.

## Skills read

- `inngest-jobs` — weekly gap analysis is named beside the morning digest; all scheduled work must be an Inngest function; per-source failure isolation and recorded failed/empty outcomes are the reason this report exists.
- `evidence-governance` — no Gemini call is made, but the report leaves Tropenbos-controlled infrastructure through email, so it must structurally avoid evidence body text, excerpts, chunk text, brief prose, prompts, completions, field observations, and stakeholder notes.
- `design-system` — email uses the EviBrief palette, warm neutrals, urgency ramp only as rule/eyebrow, no red/amber/green, no leaf/tree imagery, and measured research-institutional copy.
- `resend` — reuse single sends with explicit `{ data, error }` handling and idempotency keys; batch sending remains the wrong shape because one bad recipient should not fail everyone.
- `react-email` — template structure, `Preview`, `Html lang`, `Tailwind` with `pixelBasedPreset`, semantic headings, no flex/grid assumptions in email clients, PreviewProps for local preview.
- `email-best-practices` — transactional email, idempotent retries, accessibility basics, contrast, useful link text, no marketing subscription machinery for this operational report.

## Existing Code Inspected

- `AGENTS.md` — resume workflow, build-list sequencing, evidence governance, roles, scheduled-job boundaries, design rules, and available checks.
- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — Policy Radar, monitoring risk, Phase 2/4 roadmap context, email/digest expectations, and infrastructure constraints.
- `git log --oneline -30` — confirms executed prompt sequence through `Add authenticated command palette`.
- `git status --short` — shows an existing unrelated modification in `tsconfig.json`; do not touch or revert it.
- `prompts/17-morning-digest-email.md` — explicitly excluded the weekly gap analysis as its own cadence and audience question.
- `prompts/34-command-palette.md` and `git show --stat -1 HEAD` — confirms the command palette prompt was implemented and committed.
- `prisma/schema.prisma` — `RadarRun` has `sourceId`, `sourceName`, `outcome`, counts, short `failureReason`, `startedAt`, `finishedAt`, and an index for recent runs by source; comments name this report as the consumer.
- `lib/radar/sources.ts` — source registry, cadences, intensified COP window, retrieval methods, source ids/names, and the single source-of-truth rule for monitored sources.
- `lib/jobs/functions/radar-schedule.ts` and `lib/jobs/functions/radar-fetch.ts` — current scheduled fan-out and per-source run recording, including `found`, `empty`, `failed`, and `not_implemented` outcomes.
- `lib/radar/extract.ts` and `lib/radar/grounded.ts` — RSS, Playwright scrape, and grounded fetch paths are implemented; this prompt must not rework retrieval.
- `lib/jobs/functions/morning-digest.ts` — existing email job pattern: configured check, read step, per-recipient send steps, idempotency, no mutating actions.
- `lib/jobs/functions/whatsapp-digest.ts` — weekly notification pattern and Inngest step-id idempotency precedent.
- `lib/digest/config.ts`, `lib/digest/build.ts`, `lib/db/digest.ts`, `emails/morning-digest.tsx` — existing internal digest config, role sections, email preview, and structural no-evidence read surface.
- `lib/email/client.ts` and `lib/email/send.ts` — server-only Resend client and typed single-send wrapper.
- `lib/jobs/index.ts` — function registry that must include any new Inngest function.
- `tests/contracts/*.spec.ts` and `tests/e2e/*.spec.ts` — current regression structure and contract-test style.
- `package.json` — available scripts: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run email`, `npm run inngest:dev`.
- `design_handoff_evibrief/design-system.md` — colours, email-relevant typography/register, governance glyph distinction, and no red/amber/green rule.

## Decisions and Assumptions

1. **Weekly email, not an app screen.** The gap analysis exists to catch broken monitoring without requiring someone to remember to inspect run tables. A report delivered to staff matches the morning digest pattern and does not invent an admin panel.
2. **One cron after the monitored week closes.** Use a weekly Inngest cron, for example Monday 07:00 UTC, with a seven-day UTC window ending at the scheduled instant. Keep the cron and window constants together so they cannot drift.
3. **Read `RadarRun`, not `PolicySignal`.** Signals may be created without showing why a source was quiet or failed. The report is about source health, and `RadarRun` is the contract table for that.
4. **Include every registry source, even if it had no run.** A missing run is the highest-signal gap: it means the scheduler did not check a source or the job never recorded an attempt.
5. **Latest run plus weekly totals.** For each source, show status from the latest run in the window and counts for runs, found/empty/failed/not_implemented, items seen, created signals, and duplicates suppressed.
6. **`not_implemented` remains visible.** It is not expected today, because RSS, scrape, and grounded paths are implemented, but the outcome exists to distinguish declared-but-unbuilt retrieval from a quiet or failed source.
7. **No schema change.** The report can be derived from `RadarRun` and `RADAR_SOURCES`; a stored report table would be overbuild until staff need historical report archives inside the app.
8. **No evidence or brief content.** This is a radar-source health report. It must not read evidence, chunks, brief versions, hallucination claims, field submissions, stakeholder notes, prompts, completions, or translations.
9. **Recipients mirror internal digest recipients.** Programme Director, Policy & Advocacy Officer, and Research Officer receive it. Field Officers do not; they get the plain-language WhatsApp/USSD digest path.
10. **Reuse the existing email transport.** `sendTransactionalEmail()` already implements the Resend SDK contract, not-configured handling, idempotency, and no-content logging.
11. **Quiet weeks still send.** Unlike the morning digest, a week with no signals is meaningful if sources were checked. Send the report unless email is unconfigured or there are no recipients.
12. **No Slack webhook.** Prompt 17 excluded Slack for the morning digest; adding it here would create a second delivery channel and a second governance surface without user request.

## Files Likely To Change

New:

- `lib/radar/gap-analysis.ts` — server-only read/build module that converts `RADAR_SOURCES` plus recent `RadarRun` rows into a serialisable weekly report.
- `emails/radar-gap-analysis.tsx` — React Email template with PreviewProps and no evidence content.
- `lib/jobs/functions/radar-gap-analysis.ts` — weekly Inngest job that reads the report and sends per recipient.
- Optional: `tests/contracts/radar-gap-analysis.spec.ts` — contract tests for source coverage, no evidence reads, and deterministic status mapping.

Modified:

- `lib/digest/config.ts` or a new `lib/radar/gap-config.ts` — weekly cron/window constants and idempotency key helper. Prefer a radar-specific config if digest config would become semantically crowded.
- `lib/db/digest.ts` or a narrow new `lib/db/staff.ts` export — reuse `listDigestRecipients(DIGEST_RECIPIENT_ROLES)` if it fits; otherwise add a generic staff-recipient reader without creating preference tables.
- `lib/jobs/index.ts` — register the new function.
- `README.md` — only if manual running instructions for the new job are not already clear from `npm run inngest:dev` / `npm run email`.

Do not modify `tsconfig.json`; it has an unrelated working-tree change.

## Implementation Requirements

### Report Builder

- Create a server-only module that accepts a window `{ start, end }` and returns a serialisable report object.
- Read all `RadarRun` rows with `startedAt >= start` and `< end`, selecting only:
  - `sourceId`
  - `sourceName`
  - `outcome`
  - `itemsSeen`
  - `signalsCreated`
  - `duplicatesSuppressed`
  - `failureReason`
  - `startedAt`
  - `finishedAt`
- Join those rows against `RADAR_SOURCES` by `source.id`, not by stored source name.
- Return one row per source in registry order, with:
  - source id/name
  - cadence label from `effectiveCadence(source, end)`
  - retrieval method
  - signal types
  - status: `not_checked`, `failed`, `not_implemented`, `quiet`, or `signals_found`
  - latest run timestamp/outcome/reason
  - weekly totals for runs, items seen, signals created, duplicates suppressed, failures, empty runs, and not-implemented runs.
- Treat a source with no run in the window as `not_checked`, not `quiet`.
- Treat a source with any created signals as `signals_found` unless the latest run is `failed`; the latest failed run should be visible because the freshest check did not complete.
- Keep `failureReason` as the stored short machine reason. Never include fetched response bodies, error messages, URLs' response text, signal summaries, or signal titles.
- Add pure helper functions for status mapping and week-window calculation so contract tests can cover them without a database.

### Inngest Job

- Add one `inngest.createFunction` with a weekly cron trigger and `concurrency: 1`, registered in `lib/jobs/index.ts`.
- Use `step.run` for:
  - building the report;
  - resolving recipients;
  - sending each recipient's email.
- If email is not configured, return `{ outcome: "not_configured", weekKey }` and log only the week key and report counts.
- If no recipients are found, return `{ outcome: "no_recipients", weekKey }` without throwing.
- Send per recipient with an idempotency key shaped like `radar-gap/<staffUserId>/<YYYY-MM-DD>`, inside Resend's 256-character limit and 24-hour expiry.
- A failed send for one recipient must log only `staffUserId`, `role`, machine reason, and status code, then continue to the others.
- The job is read-only: no signal status changes, no brief generation, no match reruns, no notification preference writes.

### Email Template

- Create a React Email template under `emails/` using `Html lang="en"`, `Head`, `Preview`, `Body`, `Container`, semantic `Heading`s, `Text`, `Section`, `Link`, `Hr`, `Tailwind`, and `pixelBasedPreset`.
- Use no images, remote fonts, tracking pixels, SVGs, or web fonts.
- Keep it compact and readable at 320px: a source-health summary, then one row/card per source.
- Use EviBrief colours directly in the email Tailwind config:
  - paper `#F7F5F0`
  - card `#FDFCF9`
  - line `#E4E1D8`
  - primary `#0F6E56`
  - ink `#2C2C2A`
  - ink-3 `#6B6B66`
  - watch surface/border/ink for missing or failed checks
  - surface tint for healthy checked sources
- Do not use red/amber/green. Use status words plus glyphs/shapes:
  - `signals_found`: solid structural mark and primary text
  - `quiet`: hollow square or neutral mark
  - `failed`: watch-ramp outline and text
  - `not_checked`: square governance-hold shape and watch/stone treatment
  - `not_implemented`: neutral/stone treatment with explicit text.
- Do not render urgency colours; source-health is not signal urgency.
- Use sans/system type for all prose; no serif because there are no quoted source excerpts.
- Link to `/signals` for reviewing the board and, optionally, `/design-system` only in PreviewProps is not allowed; production links should be product surfaces only.
- Copy must report what happened, not what the system decided. Good: "This source was checked and produced no new signal rows." Avoid: "This source is healthy" or "No action needed."
- Add PreviewProps with fictional source names/counts and no evidence, signal summary, brief prose, field observation, or stakeholder text.

### Tests

- Add contract tests for pure report status mapping:
  - no runs -> `not_checked`;
  - latest failed -> `failed`;
  - latest found / created > 0 -> `signals_found`;
  - only empty runs -> `quiet`;
  - latest not_implemented -> `not_implemented`.
- Add a source-coverage contract test that every `RADAR_SOURCES` id appears exactly once in a report built from empty runs.
- Add a no-evidence-read contract test by checking the report builder source does not import `lib/db/evidence`, `lib/db/briefs`, `lib/db/field`, `lib/db/stakeholders`, or `lib/ai`, and does not contain `fullText`, `chunkText`, `bodyText`, `claimText`, `prompt`, or `completion`.
- Keep tests credential-free and database-free where possible. Do not add a test auth bypass or real email send.

## Evidence Classification Impact

No Gemini call, but this is an email egress path and therefore the no-leak half of the classification gate applies.

Classifications involved:

- `public_published`
- `community_sourced`
- `unpublished_internal`

Enforcement point:

- The new report builder in `lib/radar/gap-analysis.ts` must read only `RadarRun` rows and the static `RADAR_SOURCES` registry. It must not import evidence, chunks, brief body/version content, field submissions, stakeholder notes, or AI modules.
- The new email template receives only source names, method/cadence labels, outcomes, counts, short machine reasons, and timestamps.

Blocked items:

- `community_sourced` and `unpublished_internal` evidence never enters this path because no `evidence_item` or `evidence_chunk` query exists.
- Evidence pending classification is not named, counted, or excerpted by this report. The existing classification queue surfaces continue to handle that backlog.

Logging:

- Logs may include `weekKey`, source ids, counts, outcomes, recipient staff ids/roles, send result, and status codes.
- Logs must never include evidence text, signal summaries, signal titles, fetched page bodies, raw caught error messages, email body HTML, recipient names, or email addresses.

## Hallucination-Guard Implications

None.

This task does not change what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks. It does not generate or edit a brief and must not render flag claim text. Existing unresolved guard flags still block Programme Director approval server-side.

## Security Requirements

- `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` remain server-only and are read through `lib/email/client.ts`.
- No browser code, Route Handler, Server Action, or user-triggered mutation is added.
- No third-party API is called except Resend from the scheduled job.
- No Gemini call, no embeddings, no grounded search, no Playwright scrape, and no evidence retrieval run in this job.
- Do not log source response bodies, raw exception messages, email body contents, recipient emails, or recipient names.
- Use idempotency keys for every send.
- Keep all URLs in the email based on `appBaseUrl()` plus fixed internal paths, never on external source URLs from stored data.
- Do not add notification preference tables, unsubscribe links, webhooks, or marketing-contact machinery.

## Acceptance Criteria

1. `npm run inngest:dev` discovers a weekly radar gap analysis function.
2. The function builds a report from `RadarRun` and `RADAR_SOURCES`, with one row per registered source.
3. Sources with no run in the window are labelled `not_checked`, not `quiet`.
4. Failed, empty, found, and not-implemented outcomes render as distinct text states without red/amber/green.
5. The email sends to Programme Director, Policy & Advocacy Officer, and Research Officer recipients; Field Officers do not receive it.
6. Missing Resend configuration is a handled `not_configured` outcome, not a thrown job failure.
7. One failed recipient send does not abort sends to the rest.
8. The report and template contain no evidence title, excerpt, body, chunk text, field observation, stakeholder note, brief prose, prompt, completion, or flag claim text.
9. The job mutates no application state and emits no downstream events.
10. PreviewProps render in `npm run email` with fictional source-health data.
11. Contract tests cover status mapping, registry source coverage, and no evidence/AI imports in the report builder.
12. `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` run after implementation.

## Checks To Run

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

No migration is expected. Do not run `prisma migrate dev`.

## Manual Test Steps

1. Start the app with `npm run dev` and the Inngest dev server with `npm run inngest:dev`.
2. Open <http://localhost:8288> and confirm the weekly radar gap analysis function is listed.
3. In a configured local database, create or trigger radar runs covering at least one `found`, one `empty`, one `failed`, and one source with no run in the last week.
4. With `RESEND_API_KEY` unset, trigger the function and confirm it completes as `not_configured`.
5. Set `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` for a safe Resend test sender. Use Resend test addresses such as `delivered@resend.dev` and `bounced@resend.dev`; do not use fake Gmail/Outlook addresses.
6. Trigger the function again and confirm one send step per eligible recipient.
7. Confirm a bounced recipient records only that recipient as failed while the delivered recipients still receive the message.
8. Open `npm run email` and inspect the radar gap analysis template at 320px and desktop widths.
9. Confirm every source row wraps cleanly, no text clips, and no row uses red/amber/green.
10. Read the delivered HTML source and search for evidence titles, citation keys, excerpts, brief body text, field observation text, prompt text, completion text, and flag claim text. None should appear.
11. Trigger the same week again and confirm Resend idempotency prevents duplicate delivery.

## Not In Scope

- Slack webhook delivery.
- In-app report archive.
- Notification preferences or unsubscribe management.
- New radar sources or cadence changes.
- Retrying failed radar sources from the email.
- Evidence Matcher gap analysis.
- Brief generation, approval, submission, or hallucination-flag changes.
- Database migrations.
