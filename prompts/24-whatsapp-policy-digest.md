# 24 — WhatsApp policy digest: the weekly update, and the reverse read path

## Goal

Give Field Officers the weekly policy digest on the channel they actually use
(spec §5.2 step 6, §5.4, §3.2's Field Officer row):

1. **Out** — a scheduled weekly job sends each subscribed Field Officer a short
   business-initiated notification on WhatsApp, in plain language, saying their
   update is ready.
2. **Back** — an inbound webhook serves the full digest to whoever replies, with
   **no login at all** (`AGENTS.md` §10.9, spec §5.2 step 6) and **no way to
   mutate anything** from that path.
3. **Once** — the message content is derived from `readFieldDigest()`, the same
   read `/field` and `/api/field/cache` already use, so a field officer never
   gets two different answers to "what happened this week" depending on which
   screen they looked at.

This is the last unbuilt Phase 3 item, and it is the prerequisite for the USSD
fallback (Phase 4): the no-login read path, the digest payload, and the
provider-signature verification are designed once here and reused there.

**It does not build USSD.** No Africa's Talking code, no `*384#` menu, no
`AFRICASTALKING_*` usage. Those are a later prompt.

## Skills read

- `inngest-jobs` — the weekly cadence, per-recipient failure isolation, the
  free-tier job budget, and the rule that all scheduled work is an Inngest
  function and never a bare timer
- `server-actions` — specifically the "unauthenticated read path" section: the
  WhatsApp path requires no login, may not mutate state, must not reach a Server
  Action, and must still verify the inbound request via the provider's own
  signature mechanism
- `design-system` — §11.12's plain-language rule for the Field Officer register,
  and the copy constraint that nothing implies the system decided anything
- `supabase-schema` — extending `StaffUser` rather than forking a subscription
  table; the 500MB budget
- `evidence-governance` — read because this is an egress path off
  Tropenbos-controlled infrastructure, even though it makes no model call. See
  the classification section below.

Read before implementing, not instead of: `node_modules/next/dist/docs/` for the
current Route Handler surface in Next 16.2, and the WhatsApp Cloud API's own
current message and webhook shapes. **Do not write the request body, the
signature header name, or the webhook verification handshake from memory** —
they have all changed across API versions.

## Existing code inspected

- `lib/db/field.ts` — `readFieldDigest()`, the last 30 signals and 10 briefs,
  selecting no column from `evidence_item` or `evidence_chunk`. This is the read
  the WhatsApp message is built from; it is not forked.
- `lib/field/plain-language.ts` — `URGENCY_PLAIN_LABEL`,
  `BRIEF_STATUS_PLAIN_LABEL`, `plainDate`. The one place §11.12 is enforced, and
  the only source of the words this channel may use.
- `lib/jobs/functions/morning-digest.ts` — the cron + `emailConfig() === null`
  named outcome + per-recipient `step.run` + idempotency-key pattern this job
  copies wholesale. It is the closest existing sibling.
- `lib/jobs/functions/notify-field-submission.ts` — the same pattern at
  event-trigger scale, and the `listDigestRecipients` reuse decision.
- `lib/email/client.ts` / `lib/email/send.ts` — `emailConfig(): T | null`, the
  `{ data, error }` contract handled explicitly rather than by `try`/`catch`, and
  the typed `SendResult` that is returned and never thrown. `lib/whatsapp/`
  mirrors this shape exactly.
- `lib/digest/config.ts` — `DIGEST_CRON`, the window derivation,
  `digestIdempotencyKey`, `appBaseUrl()` reading `AUTH_URL`. The WhatsApp config
  is its counterpart and introduces no second copy of `appBaseUrl`.
- `lib/db/staff.ts` — `provisionStaffUser`, and the established convention that a
  `StaffUser`'s privileged attributes are set **in the database, not through a
  UI**. The phone number follows it.
- `lib/db/digest.ts` — `listDigestRecipients(roles)`, "staff users with these
  roles", already reused once by prompt 23.
- `app/api/inngest/route.ts` and `app/api/uploadthing/route.ts` — the thin Route
  Handler shape for an external caller.
- `lib/net/url.ts` — the "everything from outside goes through here first" rule.
- `.env.example` lines 47–54 — `WHATSAPP_API_TOKEN` and
  `WHATSAPP_PHONE_NUMBER_ID` are **already declared**. `AFRICASTALKING_*` are
  also declared and are not touched by this prompt.

## Decisions and assumptions

**1. The provider is the WhatsApp Cloud API shape, and that is already decided
by `.env.example`.**
Spec §6 says "Twilio or 360dialog". The two have incompatible request shapes, and
the declared variables — `WHATSAPP_API_TOKEN` plus `WHATSAPP_PHONE_NUMBER_ID` —
are Cloud API naming (Twilio would need an account SID and a `from` number).
Taking the existing declaration as the decision means **no new environment
variable for sending and no rename**, and 360dialog exposes the same Cloud API
surface, so the choice between it and Meta direct stays open at deployment time
rather than being baked into code. Record this in `AGENTS.md` §6 as the resolved
half of "Twilio or 360dialog".

**2. Business-initiated messages need a pre-approved template, so the digest goes
out in two parts.**
This is the constraint that shapes the whole feature and it is not optional: a
WhatsApp business-initiated message sent outside the 24-hour customer service
window must use a template approved by the provider. Free-form text is only
permitted **in reply** to an inbound message.

Therefore:

- **Outbound (Monday):** a short approved-template notification — "Your weekly
  update from Tropenbos is ready. Reply UPDATE to read it." The template name and
  its variables live in config; the template itself is registered with the
  provider by a human and is **not** something this code creates.
- **Inbound (any time):** the officer replies, which opens the 24-hour window, and
  the webhook answers with the full plain-language digest as free-form text.

This is also why spec §5.2 step 6 calls the reverse path the one that "requires
no login at all" — it is the officer who initiates the read. The two-part shape
is a platform rule being respected, not an interaction being invented.

**3. The phone number is a nullable column on `StaffUser`, and NULL means not
subscribed.**
Extend the existing actor; never fork a parallel subscription table for the same
concept (§12.1). Four staff at one organisation who all asked for this is not a
subscription-management problem — the same call `lib/digest/config.ts` already
made and said so. **No opt-in UI in this prompt:** the number is set in the
database exactly as `role` is today (`lib/db/staff.ts`). If Tropenbos later wants
officers to manage it themselves, that is a settings screen in a later prompt and
this column is unchanged by it.

**4. Recipients are Field Officers only, and that is a narrowing of
`DIGEST_RECIPIENT_ROLES`, not a reuse of it.**
`lib/digest/config.ts` deliberately excludes Field Officers from the email digest
because a kanban-shaped email full of "urgency" and "relevance" is exactly the
§11.12 failure. This channel is the mirror image: Field Officers only, plain
language only. A Programme Director wanting the same thing on WhatsApp is a
different request and is not assumed.

**5. Signature verification needs one new environment variable, and this is the
one thing to confirm on approval.**
Prompt 23's security rule was "if a new env var turns out to be needed, stop and
ask rather than inventing a name". One is needed: the Cloud API signs webhook
bodies with an app secret, which is a **different value** from the send token
already declared, and a webhook that cannot verify its caller is an open endpoint
that will serve Tropenbos's weekly digest to anyone who finds the URL.

Proposed, for approval alongside this prompt:

- `WHATSAPP_WEBHOOK_SECRET` — the app secret the HMAC signature is checked
  against. Server-only, added to `.env.example` with an empty value.
- `WHATSAPP_VERIFY_TOKEN` — the string echoed back during the provider's one-time
  `GET` subscription handshake. Server-only, same treatment.

If either name should be different, say so on approval and it will be used
instead. **Nothing is implemented with an invented name.**

**6. An unconfigured deployment is a named outcome, never a crash.**
`whatsappConfig(): WhatsAppConfig | null` mirrors `emailConfig()` exactly. A local
`npm run dev` with no credentials must not produce a red failed run every Monday,
and the webhook must answer a caller cleanly rather than throwing. This is also
what makes the feature reviewable before Tropenbos has provisioned an account —
see the manual test steps, which end at the not-configured path.

**7. The digest is text only. No links into the app, no media, no buttons.**
A Field Officer's app surface is `/field`, which requires SSO — a link into
`/signals` from a WhatsApp message would be an invitation to a sign-in wall for a
role that has no access anyway (§10.5). A link to `/field` is possible but is
deliberately omitted: the whole point of this channel is the officer who cannot
open the app right now.

## Files likely to change

**Schema / migration**

- `prisma/schema.prisma` — add to `StaffUser`:
  `whatsappNumber String? @unique @map("whatsapp_number")`. Unique because one
  number is one person, and a duplicate would silently send one officer another's
  digest. No new model.
- `prisma/migrations/<ts>_staff_whatsapp_number/migration.sql` — authored via
  `npm run db:migrate:new -- staff_whatsapp_number`. **Never `prisma migrate
  dev`** (§19); confirm the generated SQL contains no `DROP INDEX` on either
  `*_embedding_cosine_idx`.

**Transport**

- `lib/whatsapp/client.ts` — `whatsappConfig(): WhatsAppConfig | null`, reading
  `WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Server-only. Knows how to
  reach the API; knows nothing about what a digest is. Mirrors
  `lib/email/client.ts`.
- `lib/whatsapp/send.ts` — one send, typed result, **returned and never thrown**:
  `{ ok: true; messageId } | { ok: false; reason: "not_configured" | "rejected" |
  "rate_limited" | "outside_window" | "request_failed"; statusCode }`. Mirrors
  `lib/email/send.ts`, including the explicit check of the provider's error body
  rather than relying on a throw.
- `lib/whatsapp/verify.ts` — HMAC signature verification over the **raw** request
  body, in constant time. Pure, testable, no I/O.
- `lib/whatsapp/config.ts` — the weekly cron, the template name and its variable
  order, the recipient role, message caps, and the idempotency-key helper.

**Message content**

- `lib/whatsapp/message.ts` — `readFieldDigest()`'s payload → the plain-text
  digest string. Pure, so the whole message can be read in one place without
  credentials — the same call `lib/digest/build.ts` makes. It imports
  `lib/field/plain-language.ts` and **declares no label of its own**.

**Job**

- `lib/jobs/functions/whatsapp-digest.ts` — weekly cron, one `step.run` per
  recipient, registered in `lib/jobs/index.ts`.

**Webhook**

- `app/api/whatsapp/webhook/route.ts` — `GET` for the provider's subscription
  handshake, `POST` for inbound messages. Thin: verify → resolve → reply → 200.

**Data**

- `lib/db/staff.ts` — `listWhatsappRecipients()` (Field Officers with a number)
  and `findStaffUserByWhatsappNumber(number)`. Exported through `lib/db/index.ts`.

**Docs / env**

- `.env.example` — the two new variables from decision 5, empty.
- `AGENTS.md` §6 — record the Cloud API resolution of "Twilio or 360dialog"
  (decision 1). This is the one rule change this prompt makes, and it is a
  narrowing of an existing either/or, not a new stack item.

## Implementation requirements

### The reverse path is read-only, and that is enforced structurally

- The webhook **never** imports a Server Action, and **never** writes to any table
  except its own delivery/receipt log if one is added. It resolves a staff user
  from a phone number, reads the digest, and replies.
- It never advances a signal, never touches a brief's status, never sets a
  classification, and never creates evidence. A field observation submitted by
  WhatsApp is **not** in scope — that is a write from an unauthenticated channel
  and it is exactly what §10.9 forbids. If the officer's reply is not a
  recognised keyword, answer with the digest anyway; do not attempt to interpret
  it as a submission.
- An inbound message from a number that matches no `StaffUser` gets a neutral,
  non-committal reply and nothing else. It must not disclose whether the number is
  known, and it must not send the digest.

### Verification

- Every `POST` verifies the provider's HMAC signature over the **raw body bytes**
  before parsing. A body that fails verification is a `401` and is not parsed, not
  logged, and not acted on.
- Reading the raw body correctly in a Next 16.2 Route Handler is the detail most
  likely to be got wrong — a re-serialised `await request.json()` will not match
  the signature. Read the docs.
- The `GET` handshake compares the challenge token against `WHATSAPP_VERIFY_TOKEN`
  and echoes the challenge only on a match.

### The job

- Weekly, not daily (spec §3.2: "weekly policy digest"). The cadence literal lives
  in `lib/whatsapp/config.ts` and appears nowhere else (§14.2).
- `whatsappConfig() === null` → log a named outcome and return. No crash, no
  failed run.
- A week with nothing to report **sends nothing** and records why, exactly as the
  morning digest does. A weekly "nothing happened" trains people to ignore the
  channel.
- One `step.run` per recipient, sequential, with a per-recipient idempotency key
  of the shape `whatsapp-digest/<staffUserId>/<YYYY-MM-DD>`. One bad number is one
  `ok: false`; the rest still get theirs (`inngest-jobs` rule 5).
- A `429` is handled with backoff, as a named state, never a crash (§13.3's rule
  applied to a non-Gemini provider).

### The message

- Plain language only. Every label comes from `lib/field/plain-language.ts` — no
  "signal", no "urgency", no "relevance", no classification value, no brief id.
- Capped in length, with the cap in config. WhatsApp truncates long bodies, and a
  digest cut off mid-sentence by the platform reads as a bug. Cap it deliberately
  and say how many items were left out.
- Never implies the system decided, approved, verified, or endorsed anything
  (§8.8).
- No evidence title, no excerpt, no citation key, no brief body.

## Evidence classification impact

**None in the sense of the gate — no evidence data path, and no model call.**
This task makes no Gemini request of any kind: not generation, not classification,
not embedding, not translation. Nothing here is reachable from `lib/ai/`, and no
new file may import it.

**But the §7.6 egress rule applies with full force, and is the reason
`evidence-governance` is on the skills list anyway.** A WhatsApp message leaves
Tropenbos-controlled infrastructure and passes through a third party's
infrastructure, where it is retained. The enforcement is structural, exactly as it
is for the morning digest:

- The message is built from `readFieldDigest()`, which selects **no column** from
  `evidence_item` or `evidence_chunk`. There is no field on `FieldDigestPayload`
  through which an evidence title, excerpt, body, or citation key could arrive, so
  there is nothing to filter out in `lib/whatsapp/message.ts`.
- **Do not widen that read to serve this feature.** If a future message wants
  evidence, that is a governance decision and a different prompt.
- No message body, no phone number, and no recipient name appears in any log line,
  Sentry event, or PostHog property. Log the staff user id, the outcome, and the
  status code — the same rule `lib/email/send.ts` already states.
- The inbound webhook must not log the officer's reply text.

**No classification is created, read as a gate, or changed by this task.** The
classification-pending queue is untouched.

## Hallucination-guard implications

**None.** This task generates no brief, extracts no claims, stores no flags,
renders no flags, and changes nothing about what a flag blocks. The digest
carries brief titles and statuses of already-submitted or published briefs; it
does not carry brief bodies and therefore renders no flag marks. No fact-check
pass runs anywhere on this path.

## Security requirements

- Two new server-only environment variables, both from decision 5, both added to
  `.env.example` empty. No secret is ever committed. **If either name needs
  changing, that is settled on approval and not invented during implementation.**
- `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_SECRET`,
  and `WHATSAPP_VERIFY_TOKEN` are read in `lib/whatsapp/` only, never in a client
  component, and never as `NEXT_PUBLIC_*` (§18).
- The webhook is an unauthenticated endpoint by design, so signature verification
  **is** its access control. Constant-time comparison; a verification failure is a
  `401` with no body and no detail.
- The webhook is read-only. It reaches no Server Action and mutates no table.
- A phone number is personal data: unique, never logged, never in a URL, never in
  a query parameter, and never rendered outside an authenticated screen.
- Rate-limit the inbound path so a flood of replies from one number cannot spend
  the outbound message budget. Per-number, in the job/handler layer.
- No user-supplied string from an inbound message is ever interpolated into a
  database query, a URL, or an outbound message body unescaped.

## Acceptance criteria

1. A Monday run sends one template notification per Field Officer with a
   `whatsappNumber`, and none to any other role or to a Field Officer without one.
2. A week with no signals and no briefs sends nothing and records why.
3. An inbound reply from a known number is answered with the full plain-language
   digest, with no login involved at any point.
4. An inbound reply from an unknown number gets a neutral reply, is not sent the
   digest, and is not told whether the number is known.
5. A `POST` with a missing or wrong signature is refused with `401`, and its body
   is never parsed or logged.
6. Nothing on the inbound path writes to the database — verifiable by the absence
   of any Prisma write in the route and its imports.
7. No message contains the words "signal", "urgency", "relevance", or any
   classification value, and no message contains an evidence title or excerpt.
8. A deployment with no WhatsApp credentials produces a clean named outcome on
   both paths — no failed job run, no `500` from the webhook.
9. No Gemini call fires anywhere on this path — verifiable by the absence of any
   import from `lib/ai/` in the new files.
10. Re-running the weekly job for the same week sends nothing a second time.

## Checks to run

- `npm run lint` — expect only the 4 known pre-existing errors (`carousel.tsx`,
  `use-mobile.ts`, two in `design_handoff_evibrief/support.js`). Any error in a
  new file is a failure.
- `npm run typecheck`
- `npm run build` — a new Route Handler affects it.
- `npm run db:migrate:new -- staff_whatsapp_number`, then read the generated SQL
  before `npm run db:migrate`. Confirm no `DROP INDEX` on `*_embedding_cosine_idx`.
- Report exact output. Never claim a check passed without running it.

## Manual test steps

Without provider credentials — everything below this line is testable today:

1. `npm run dev`, plus `npm run inngest:dev` in a second terminal.
2. Open <http://localhost:8288> and trigger the weekly digest job. Confirm it
   returns the `not_configured` outcome, logs it, and does **not** appear as a
   failed run.
3. `POST` to `/api/whatsapp/webhook` with no signature header. Confirm `401`, an
   empty body, and nothing about the request in the terminal.
4. `GET /api/whatsapp/webhook` with a wrong verify token. Confirm it does not echo
   the challenge.
5. Set `WHATSAPP_WEBHOOK_SECRET` locally, `POST` a correctly signed sample inbound
   payload for a number that matches no `StaffUser`, and confirm the neutral reply
   path is taken and no digest is composed.
6. Set a `whatsappNumber` on a Field Officer via `npm run db:studio`, repeat step 5
   with that number, and read the composed message in the terminal (or a
   test-double sink). Confirm it contains no internal taxonomy vocabulary, no
   evidence title, and no brief body.
7. `npm run db:studio` after every step above: confirm no row was created or
   modified by anything on the inbound path.

With credentials, once Tropenbos has provisioned an account and registered the
template:

8. Trigger the weekly job and confirm one template notification arrives per
   subscribed officer.
9. Reply `UPDATE` from the handset and confirm the full digest arrives, with no
   sign-in prompt anywhere.
10. Re-trigger the job for the same week and confirm nothing is re-sent.
