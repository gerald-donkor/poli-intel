# 17 — The morning digest: the board comes to you

## Goal

Finish Phase 2. Spec §7's Phase 2 bullet is *"Signal dashboard: kanban UI with
morning digest email"* — the kanban shipped in prompt 15, the digest never did —
and Phase 2's stated goal is not the board, it is the behaviour change the board
enables: *"Staff shift from hunting for signals to reviewing a curated digest."*
Without the digest, every signal the radar classifies at 05:00 waits for somebody
to remember to open `/signals`. `inngest-jobs` rule 7 and `AGENTS.md` §14.7 both
carry it; `RESEND_API_KEY`, `DIGEST_FROM_EMAIL` and `SLACK_WEBHOOK_URL` have been
sitting in `.env.example` since the first commit with nothing reading them.

Three things, one body of work:

- **The scheduled job** — one daily Inngest cron that reads what the night
  produced, decides whether there is anything worth a person's attention, and
  sends per recipient with per-recipient failure isolation.
- **The email** — a React Email template carrying the morning's classified
  signals in urgency order, the drafts waiting on a decision, and the
  classification backlog, on the product's own palette and readable on a phone
  over a slow connection.
- **The delivery layer** — a server-only Resend module with an idempotency key
  per recipient per day, so an Inngest retry re-sends nothing.

**Explicitly out of scope, and named so the boundary is deliberate:**

- **The Slack webhook.** `AGENTS.md` §14.7 says email **and/or** Slack, and
  `SLACK_WEBHOOK_URL` stays unread. One delivery channel done properly beats two
  half-done, and a second channel is a second place the same governance question
  gets answered. Its own prompt, if it is ever wanted.
- **The WhatsApp / USSD digest.** A different audience (Field Officers), a
  different register (§11.12 — plain language, no internal taxonomy), a
  different transport, and a Phase 3 bullet. Not this.
- **New influence events in the digest.** Spec §5.2 lists them for the Programme
  Director, and `InfluenceEvent` exists in the schema — but **nothing writes a
  row to it**, and it is the Impact Tracker's job to (Phase 4). A section that is
  permanently empty is theatre; the digest gains it in the same change that
  gives it something to report.
- **The weekly gap analysis.** Its own cadence, its own audience question, and it
  reads `RadarRun`, not signals. `AGENTS.md` §14.7 pairs the two sentences but
  they are two jobs.
- **Per-user notification preferences.** `StaffUser` has no preference column and
  this prompt does not add one. Four staff at one organisation who all asked for
  this is not a subscription-management problem, and inventing an opt-out table
  before anybody has asked to opt out is exactly the overbuilding §1 forbids.
- **Delivery-event webhooks.** Bounce and complaint handling is a real concern at
  list scale; at a single Workspace domain with a handful of verified colleagues
  it is not. `resend`'s suppression list already covers the failure mode.

## Skills read

- `inngest-jobs` — rule 7 (the digest itself), rule 5 (one dead source does not
  abort the batch — applied here per *recipient*), rule 6 (the free-tier job
  budget), and the standing rule that everything scheduled is an Inngest
  function, never a cron route doing real work.
- `resend` — the `{ data, error }` return contract (the Node SDK does not throw),
  idempotency-key format and its 24-hour expiry, the single-vs-batch decision and
  batch's atomicity, the `resend.dev` sandbox's delivery restriction, and the
  test addresses.
- `react-email` — component structure, the `Tailwind` component with
  `pixelBasedPreset`, and the `email dev` preview server.
- `email-best-practices` — transactional-vs-marketing (this is transactional, so
  no unsubscribe machinery), and the accessibility checklist: `lang`, semantic
  headings, presentational tables, `<title>`, contrast.
- `evidence-governance` — the logging and telemetry prohibition (§7.6), which is
  the binding rule here even though no Gemini call is made: an email is an
  egress path off Tropenbos-controlled infrastructure.
- `design-system` — the urgency ramp as left rule and eyebrow only, never a
  filled row and never red/amber/green; relevance on its own scale; the sans for
  generated prose; no leaf, tree or forest imagery.
- `server-actions` — read only to confirm what does *not* apply: the digest is
  not a mutation path and adds no Server Action.

## Existing code inspected

- `lib/jobs/functions/radar-schedule.ts` — the cron shape to follow: one daily
  `cron("0 5 * * *")`, a `step.run` that resolves what is due, then fan-out. Its
  comment that "the 05:00 is when the radar wakes, not how often any source is
  checked" is the same distinction decision 1 has to make for 06:30.
- `lib/jobs/client.ts` — the event contract, and its standing rule that **event
  payloads carry ids, never text**. The digest adds no event.
- `lib/jobs/index.ts` — the registry. A function absent from this array does not
  exist as far as Inngest is concerned.
- `lib/db/signal-board.ts` — `listSignalBoard` is the board's read, capped at
  `SIGNAL_BOARD_MAX_ITEMS` and unfiltered by date. The digest needs a *window*,
  so it gets its own read rather than a date parameter bolted onto the board's.
- `lib/db/briefs.ts` — `listBriefs` already computes `openFlagCount` per brief
  from the current version, which is exactly what the digest needs to say which
  drafts are blocked from approval.
- `lib/db/evidence.ts` — `countPendingClassification`, already rendered as the
  in-app queue count by `ClassificationPendingAlert`.
- `app/(app)/signals/labels.ts` — `URGENCY_ORDER`, `URGENCY_LABELS`,
  `RELEVANCE_LABELS`. The email reads the same tables, so a rename cannot leave
  the digest saying something the board no longer says.
- `prisma/schema.prisma` — `StaffUser` carries `email`, `name`, `role` and no
  preference or active flag. `InfluenceEvent` exists; nothing writes it.
- `.env.example` — `RESEND_API_KEY`, `DIGEST_FROM_EMAIL` and `SLACK_WEBHOOK_URL`
  are already declared. **No change to this file is needed**, which is worth
  stating so nobody adds a duplicate key.

## Decisions and assumptions

1. **One daily cron at 06:30 UTC, and the time is a delivery decision, not a
   cadence.** Ghana is UTC+0, so 06:30 UTC is 06:30 in Kumasi — a morning digest
   that is actually delivered in the morning. It sits behind the radar's 05:00
   fan-out and the evidence sweep's 05:30 so the night's signals are fetched,
   deduplicated and classified before the digest reads them. No per-source
   cadence literal appears in this job; those live in `lib/radar/sources.ts` and
   are not this job's business.

2. **The window is "since the previous digest", expressed as the last 24 hours,
   and it is stated in the email.** Not "today", which would silently drop a
   signal detected at 06:29. The window is a named constant beside the cron so
   the two cannot drift into overlapping or leaving a gap.

3. **A quiet morning sends nothing, and that is recorded rather than inferred.**
   Nothing new, nothing awaiting a decision, and an empty classification queue
   means no email. A daily "nothing happened" trains people to stop opening it,
   which costs more than it saves. The run still writes a log line naming the
   window and the three counts, and a digest job that *broke* shows as a failed
   Inngest run rather than as a quiet day — the two are told apart by the run
   history, not by the reader's inbox.
   - **On the mornings it does send, it names how many radar sources were
     checked**, read from `RadarRun`. That is what lets a reader tell "quiet" from
     "broken" without leaving the email, and it uses a table that already exists
     (`AGENTS.md` §14.7 — silence is reported, not assumed).

4. **One template, role-aware sections — not three templates.** Spec §5.2 gives
   the Programme Director extra content (briefs awaiting approval), and the
   classification backlog is a Research Officer's queue. Three templates would be
   three places to fix one wording change. Sections are included per recipient
   role and the email is honest about being addressed to that person.

5. **Field Officers do not receive it.** §10.5 gives them mobile submission and
   digests in *their own* register — plain language, one message per screen,
   no internal taxonomy (§11.12). Sending them a kanban-shaped email full of
   "urgency class" and "relevance" would be the exact failure that rule exists to
   prevent. Their digest is the WhatsApp path, and it is a different prompt.

6. **One send per recipient, each in its own `step.run`, with its own
   idempotency key — not a batch.** `resend`'s batch endpoint is atomic: one
   malformed address fails the whole morning for everyone. Per-recipient runs are
   the same failure isolation `inngest-jobs` rule 5 applies to sources, at a
   staff-list size where the job-budget argument for batching does not bite. Key
   format `digest/<staffUserId>/<YYYY-MM-DD>`, inside the 24-hour expiry and the
   256-character cap, so an Inngest retry of a step that already sent re-sends
   nothing.

7. **A missing `RESEND_API_KEY` is a handled, named outcome, not a crash.** The
   same shape the Gemini paths already use for `missing_api_key`: the job records
   that the digest is not configured on this deployment and returns. A local
   `npm run dev` with no key must not produce a red failed run every morning.

8. **The email carries no evidence, ever.** Signal titles and summaries, brief
   type / audience / status / flag counts, and integer counts. It never reads
   `evidence_item.full_text`, `evidence_chunk.chunk_text`, a matched excerpt, or
   an evidence item's title. This is the whole governance answer and decision 8
   of this list is the one to break the prompt over.

9. **No images, no web fonts, no tracking pixels.** Low-bandwidth is a stated
   requirement (`inngest-jobs`, spec §3.2). System font stack, inline styles via
   React Email's `Tailwind`, and the urgency ramp as a 3px left rule plus a
   small-caps eyebrow exactly as on the board — never a filled row, never
   red/amber/green (§11.4, §11.5).

10. **The digest links, and never acts.** Every item is a link into the app,
    where the reader signs in and the Server Actions authorise them. Nothing in
    an email advances a signal, approves a brief, or clears a flag — no action
    links, no one-click approve, not behind a token (§8.2, §8.3, §10.1).

## Files likely to change

**New**

- `lib/email/client.ts` — `server-only`; the Resend client and the configured
  check. No template knowledge.
- `lib/email/send.ts` — one send, the `{ data, error }` contract handled, a typed
  result. Never logs a subject line's contents or a recipient's name into an
  error path beyond what is needed to identify the send.
- `emails/morning-digest.tsx` — the React Email template and its props type.
- `lib/digest/config.ts` — the send hour, the window length, the item caps, and
  the roles that receive it. One table, per `AGENTS.md` §13.1's spirit.
- `lib/digest/build.ts` — turn the three reads plus a recipient's role into the
  template's props. Pure, so the shape is testable by reading it.
- `lib/db/digest.ts` — the windowed reads: signals classified in the window,
  drafts awaiting a decision with their open-flag counts, the radar-run count for
  the window, and the digest's recipients.
- `lib/jobs/functions/morning-digest.ts` — the cron function.

**Edited**

- `lib/db/index.ts` — the new read surface.
- `lib/jobs/index.ts` — register the function.
- `package.json` — `resend` and `react-email` dependencies, and an `email` script
  for the preview server.
- `AGENTS.md` §19 — document the new `npm run email` script in the same change
  that adds it, per that section's own standing instruction.

## Implementation requirements

1. **The job.** One `inngest.createFunction` with a single daily cron trigger,
   registered in `lib/jobs/index.ts`. It resolves the window, runs the reads,
   returns early with a log line when there is nothing to report, resolves
   recipients, then fans out one `step.run` per recipient. Bounded retries. No
   business logic in a Route Handler and no work outside a step.

2. **The reads are windowed and capped.** Signals classified within the window,
   newest first, capped; drafts awaiting a decision, capped; the pending
   classification count; the count of radar runs in the window. Every read is a
   Prisma query in `lib/db/`, and none of them selects an evidence column.

3. **The template.** Urgency sections in `URGENCY_ORDER` — the enum's order
   carries the taxonomy and nothing re-sorts it (§11.4). Each signal renders its
   title, its source, its relevance, and its summary in the sans (it is generated
   prose, not quoted material — §11.6). Each links to `/signals/<id>`. The drafts
   section names each brief's type, audience, and whether open flags are blocking
   approval, linking to `/briefs/<id>`. The classification backlog renders as a
   count with a link to `/evidence/queue` and the **square** governance glyph,
   distinct from the guard flag's circle (§11.7).

4. **Accessibility and bandwidth.** `<Html lang="en">`, a `<title>`, a `Preview`
   line that says what the morning holds rather than repeating the subject,
   semantic headings in order, presentational tables only for layout, 4.5:1
   contrast on every pairing, no images, no remote fonts. Legible at 320px.

5. **Idempotent, isolated sending.** One send per recipient inside its own
   `step.run`, each with `digest/<staffUserId>/<YYYY-MM-DD>`. A failed send for
   one recipient is logged and does not abort the others. The SDK's `error` is
   checked explicitly — never a `try`/`catch` standing in for it.

6. **Copy never implies the system decided anything** (§8.8). The digest reports
   what was picked up and what is waiting; it does not recommend, prioritise for
   the reader, or say a brief is ready. "Three signals were classified overnight"
   is right; "three signals need your attention today" is not.

7. **Preview without sending.** `npm run email` runs the React Email dev server
   against `emails/`, so the template can be read at every breakpoint without an
   API key and without delivering anything.

## Evidence classification impact

**No Gemini call — and the gate's *egress* half binds here harder than on any
screen built so far.**

- **Not one of the eight call types.** The digest embeds nothing, summarises
  nothing, classifies nothing, generates nothing, translates nothing, and
  fact-checks nothing. It renders stored facts. `gateEvidenceForGeneration` is
  not called and is not needed, because no candidate evidence exists on this
  path.
- **But an email leaves Tropenbos-controlled infrastructure.** It transits Resend
  and lands in a mailbox, so §7.6 applies with full force: **no evidence body
  text, no chunk text, no matched excerpt, and no evidence item title enters the
  digest, its props, its logs, or a send-failure record.** The enforcement is
  structural — `lib/db/digest.ts` selects no column from `evidence_item` or
  `evidence_chunk` at all, so there is no field for one to arrive through.
- **What does travel, and why each is safe.** Signal titles and `summaryText`:
  the signal originates from a public source the radar fetched, and `summaryText`
  was written by a Gemini classification call about that public document — it is
  not evidence and carries no classification. Brief type, audience, status and
  open-flag *counts*: metadata, not document content. The pending-classification
  figure: an integer.
- **The backlog is surfaced, never hidden.** The classification queue count is a
  governance surface, and putting it in the digest is the point — a backlog
  nobody sees is how untagged evidence sits forever (§7.5).
- **Logging stays ids, counts and outcomes** — recipient ids and role, item
  counts, the window, the send result. Never a signal summary, never a subject
  line's contents, never a recipient's name in an error payload (§13.9).

No bypass, no `force`, no env var, and no anticipatory paid-tier branch is added.

## Hallucination-guard implications

**None to the pass; one to a flag's *visibility*, and it only makes flags harder
to miss.**

- Claim extraction, verification, the flag record, anchoring, the pulse, and what
  a flag blocks are all untouched. No generation happens on this path, so no new
  flag is ever created here.
- The digest **reports** open-flag counts on drafts awaiting a decision, so a
  Director opening the email learns before clicking that a brief cannot be
  approved yet. It does not resolve, dismiss, or reopen anything — flag
  resolution is a Server Action with its own authority check (§10.6), and no link
  in an email reaches it.
- **Unresolved flags still block Programme Director approval server-side** (§9.5).
  Nothing about the digest changes that, and the email says a draft is *waiting
  on checks*, never that it is *ready*.
- Flag copy in the email follows the guard's register: a flag means a claim needs
  a person's eyes, never that it is false (`hallucination-guard`). Rendered in
  the watch ramp — never red, never an alarm.

## Security requirements

- `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` are **server-only** and read only
  inside `lib/email/`, which is `server-only`. Never `NEXT_PUBLIC_*`, never
  imported from a client component, never logged.
- The digest is **read-only**. No Server Action, no Route Handler, no webhook
  endpoint, and no token-authenticated link that mutates state (§8.2, §10.9).
- Recipients come from `StaffUser` rows resolved server-side by role. No address
  is ever taken from input, a query parameter, or an event payload.
- Links are relative paths joined to `AUTH_URL`; no URL in the email is built
  from stored external content. A signal's `sourceUrl` is external — if it
  appears at all it is a plain link with no prefetch, never fetched and never
  embedded.
- No evidence body text in a Sentry event or any error path on this route (§7.6).
- The Resend API is called from the job only. It does not support CORS and must
  never be reached from browser code (§18).

## Acceptance criteria

1. `npm run inngest:dev` discovers a `morning-digest` function with one daily
   cron trigger, and triggering it from the dev UI runs it end to end.
2. With signals classified in the window, each recipient in a receiving role gets
   one email; a Field Officer gets none.
3. The email groups signals by urgency in ramp order, renders urgency as a left
   rule and eyebrow only, and uses no red, amber, or green anywhere.
4. A Programme Director's copy carries the drafts-awaiting-a-decision section and
   names which are blocked by open flags; a Policy & Advocacy Officer's does not.
5. A Research Officer's copy carries the classification backlog count linking to
   `/evidence/queue`.
6. A morning with no new signals, no waiting drafts, and an empty queue sends
   nothing and logs the three counts and the window.
7. Running the job twice for the same day sends each recipient exactly one email
   — the idempotency key holds.
8. With `RESEND_API_KEY` unset the run completes, records that the digest is not
   configured, and does not throw.
9. One invalid recipient address fails that recipient's step only; the others
   still receive theirs.
10. The email carries no evidence title, excerpt, or body text — verified by
    reading the rendered HTML, not by inspecting the template's intent.
11. `npm run email` previews the template at 320px and desktop with no API key.
12. `npm run lint` and `npm run typecheck` are clean apart from the four
    pre-existing errors §19 names.

## Checks to run

- `npm install` (the two new dependencies)
- `npm run lint`
- `npm run typecheck`
- `npm run build`

No migration: this prompt adds no column, no table, and no enum.

Report the exact output of each.

## Manual test steps

1. `npm run dev` and `npm run inngest:dev`. Have at least two signals detected
   within the last 24 hours across different urgencies, one `draft` brief with an
   open flag, one `draft` brief with none, and a non-empty classification queue —
   trigger a radar run, or set them up in `npm run db:studio`.
2. `npm run email` and read the template at 320px, 390px and desktop. Confirm the
   urgency ramp, that no section is red/amber/green, and that nothing is clipped.
3. Set `RESEND_API_KEY` and `DIGEST_FROM_EMAIL`. Note the sandbox rule: an
   unverified `onboarding@resend.dev` sender delivers **only** to your own Resend
   account address, so either verify a domain or set every test recipient in
   Studio to that address.
4. In the Inngest dev UI at <http://localhost:8288>, trigger the digest function.
   Watch the step trace: the reads, then one send step per recipient.
5. Confirm the delivered email — signals grouped by urgency, each linking to
   `/signals/<id>`; the drafts section naming the flagged one as waiting on
   checks; the backlog count linking to `/evidence/queue`.
6. Trigger the function a second time for the same day. Confirm no second email
   arrives and the Resend dashboard shows no new send.
7. Change one staff row's role to Field Officer in Studio and re-trigger.
   Confirm that person receives nothing.
8. Set one staff row's email to `bounced@resend.dev` and re-trigger. Confirm the
   other recipients still receive theirs and only that step records a failure.
9. Archive or delete the recent signals, clear the classification queue, and
   re-trigger. Confirm no email is sent and the run log names the window and the
   three counts.
10. Unset `RESEND_API_KEY` and re-trigger. Confirm the run completes green with a
    "not configured" record rather than a failure.
11. Read the delivered message's HTML source and search it for any evidence
    title, citation key, or excerpt. There must be none.
