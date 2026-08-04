# 27 — USSD fallback: the digest on a handset with no data

## Goal

Give a Field Officer the same weekly digest through a USSD session, on a phone
with no smartphone, no data bundle, and no app (spec §3.2's Field Officer row,
§5.2 step 6, `AGENTS.md` §1's "WhatsApp policy digest; USSD fallback").

This is the **fallback half of prompt 24**, which built the no-login read path,
the digest payload, and provider-signature verification and said explicitly that
USSD was a later prompt. It is the last unbuilt item on `AGENTS.md` §1's build
list.

Three things, and nothing else:

1. **A dial-in menu.** `*384*NNNN#` opens a short numbered menu — policy updates,
   papers from the office — driven entirely by the digits the officer presses.
2. **The same answer as every other channel.** Every screen is derived from
   `readFieldDigest()`, the same read `/field`, `/api/field/cache` and the
   WhatsApp digest already use, so a field officer never gets two different
   answers to "what happened this week" depending on how they asked.
3. **Read-only, no login, and structurally incapable of writing.** No field
   submission by USSD, no state advanced, no row created (`AGENTS.md` §10.9).

**It does not build outbound USSD or SMS.** No `AFRICASTALKING_USERNAME` /
`AFRICASTALKING_API_KEY` usage, no SMS fallback, no push. A USSD session is
request/response only: the gateway calls us, we answer with text. Those two
existing env vars stay unused by this prompt and are for a future outbound path.

## Skills read

- `server-actions` — the "unauthenticated read path" section specifically: the
  WhatsApp/USSD digest path requires no login, may not mutate state, must not
  reach a Server Action, and must still verify the inbound request via the
  provider's own mechanism. Route Handlers are for external callers and stay
  thin, with no business logic.
- `evidence-governance` — read because this is an egress path off
  Tropenbos-controlled infrastructure onto a telco network, even though it makes
  no model call. See the classification section below.

Not loaded, deliberately: `design-system`. USSD has no visual surface — no
colour, no type, no component, no breakpoint. The one design rule that does
apply is §11.12's plain-language register for the Field Officer, and that rule is
already enforced in code by `lib/field/plain-language.ts`, which this prompt
reuses rather than restates. `inngest-jobs` is not loaded either: nothing here is
scheduled, and the outbound Monday nudge already exists in prompt 24's job.

**Read before implementing, not instead of:** `node_modules/next/dist/docs/` for
the current Route Handler surface in Next 16.2, and **Africa's Talking's own
current USSD documentation**. Do not write the callback's field names, the
`CON`/`END` convention, the content type, or the per-screen character limit from
memory — verify each against their live docs. In particular, confirm whether
Africa's Talking now offers a request signature or an IP allowlist; if it does,
prefer it to the shared secret described below and say so in the implementation.

## Existing code inspected

- `app/api/whatsapp/webhook/route.ts` — the sibling this file is modelled on:
  verify first, resolve the sender, reply, log nothing about the message. Its
  in-memory per-number rate limiter and its "unknown sender is told nothing"
  policy are both copied in shape.
- `lib/whatsapp/verify.ts` — `verifyTokenMatches`, constant-time comparison of a
  shared secret. Pure, no environment, no secret of its own.
- `lib/whatsapp/config.ts` — `normaliseWhatsappNumber` (digits-only, 8–15,
  returns `null` for anything implausible) and the caps/limit constants pattern
  this prompt's config mirrors.
- `lib/whatsapp/message.ts` — `buildWhatsappDigest`, a **pure** payload → text
  function with no `fetch`, no Prisma, no environment. The USSD menu builder is
  the same shape for the same reason.
- `lib/whatsapp/client.ts` — the one place a channel's env vars are read,
  `server-only`, returning `null` for "not configured" rather than throwing.
- `lib/db/field.ts` — `readFieldDigest()`; last 30 signals and 10 briefs,
  `submitted`/`published` briefs only, **not one column of `evidence_item` or
  `evidence_chunk` selected**, everything serialisable.
- `lib/field/plain-language.ts` — `URGENCY_PLAIN_LABEL`,
  `BRIEF_STATUS_PLAIN_LABEL`, `plainDate`. The single place §11.12 is enforced
  and the only source of words this channel may say.
- `lib/db/staff.ts` — `findStaffUserByWhatsappNumber`, matching the normalised
  digits against `StaffUser.whatsappNumber` with and without a leading `+`.
- `lib/net/url.ts` — precedent for a pure, non-`server-only` helper module under
  `lib/net/`.
- `prisma/schema.prisma` — `StaffUser.whatsappNumber`, `String? @unique`.
- `.env.example` — `AFRICASTALKING_USERNAME` / `AFRICASTALKING_API_KEY` declared
  and currently unused.

## Decisions and assumptions

1. **The registered handset is one handset.** A Field Officer dialling USSD is
   dialling from the same phone that receives the WhatsApp nudge, so this reuses
   `StaffUser.whatsappNumber` and `findStaffUserByWhatsappNumber` rather than
   adding a `ussdNumber` column. No migration, no second registration for staff
   to keep in sync, no way for the two to disagree. The column name reads a
   little narrow for its second caller; renaming it is a migration and a
   rename across five files for no behavioural gain, so it stays
   (`AGENTS.md` §18 — no unrelated refactors). A comment at the schema field
   records that it is now the channel identifier for both.

2. **Unknown numbers are told nothing, exactly as on WhatsApp.** A number that
   is not a registered Field Officer gets a neutral `END` that does not disclose
   whether the number is known, does not name staff, and does not serve the
   digest. Anyone can dial a short code, including by mistyping a digit.

3. **Access control is a secret path segment, and the trade-off is stated rather
   than hidden.** Africa's Talking does not sign its callbacks the way Meta
   does, so there is no signature to verify. The callback URL registered in their
   dashboard carries a high-entropy secret as a path segment
   (`/api/ussd/<secret>`), compared in constant time; a mismatch is a `403` with
   no body and nothing parsed. A path segment rather than a query parameter
   because query strings are the part of a callback URL most likely to be
   dropped or rewritten in transit. **The honest cost:** a URL path appears in
   platform access logs, so this secret is lower-grade than a body signature and
   is expected to be rotated. It is combined with a second, independent check —
   the posted `serviceCode` must equal the configured short code — so a leaked
   URL alone is not a complete key. If the implementer finds Africa's Talking now
   supports a signature or a source-IP allowlist, use it instead and note the
   change.

4. **Two new env vars, added to `.env.example` in this change.**
   `AFRICASTALKING_USSD_SECRET` (the path segment) and `USSD_SERVICE_CODE` (the
   registered short code). Both server-only, neither `NEXT_PUBLIC_*`. The two
   existing `AFRICASTALKING_*` credentials are left alone and their comment is
   extended to say they are for a future outbound path and are not read by the
   USSD callback.

5. **The session is stateless, and that is what keeps the path read-only.**
   Africa's Talking accumulates every keypress of a session into the `text`
   field, `*`-separated. All navigation state therefore lives in the request, so
   there is no session table, no cache row, no write of any kind. This is not a
   convenience — it is the structural reason this endpoint cannot mutate
   anything, and it is worth writing down as such.

6. **A screen is short and ASCII.** USSD screens are limited to roughly 182
   characters and are transmitted in the GSM 7-bit alphabet; a curly quote, an
   en dash, or an accented character either fails to render or silently halves
   the available length. Every string leaving this module is reduced to plain
   ASCII and hard-capped at the configured screen length, cut on a word boundary
   with a trailing `...`. The exact limit is taken from Africa's Talking's
   current docs and stated once in config, not inlined.

7. **Depth two, no deeper.** Menu → list → item. A USSD session times out in
   seconds and a person is holding a phone to their ear; a third level would be
   a maze. Anything that does not fit is answered with "ask the office", the
   same escape hatch the WhatsApp cap uses.

8. **`readFieldDigest()` is not widened.** Every screen is built from what it
   already returns. If a screen seems to want evidence or brief body text, that
   is a governance decision and a different prompt — not a `select` added here.

## Files likely to change

New:

- `lib/ussd/config.ts` — the short code, screen character cap, items per list,
  rate-limit window, and the pure `parseUssdInput(text)` that splits the
  gateway's accumulated `text` into the keypress path. Not `server-only` (no
  credential here), same call `lib/whatsapp/config.ts` makes.
- `lib/ussd/client.ts` — `server-only`. The one place `AFRICASTALKING_USSD_SECRET`
  and `USSD_SERVICE_CODE` are read, each returning `null` when unset so an
  unconfigured deployment refuses cleanly instead of throwing.
- `lib/ussd/menu.ts` — **pure**. `(payload: FieldDigestPayload, path: string[]) →
  { kind: "CON" | "END"; body: string }`. No `fetch`, no Prisma, no environment,
  no `Date.now()`. The whole menu tree is reviewable and testable without
  credentials or a network, exactly as `buildWhatsappDigest` is.
- `lib/ussd/text.ts` — `toGsmSafe()` and `capScreen()`; the ASCII reduction and
  the word-boundary cut from decision 6.
- `app/api/ussd/[secret]/route.ts` — the thin handler.

Changed:

- `lib/net/secret.ts` (new) — `constantTimeEquals(a, b)`, lifted verbatim from
  the body of `verifyTokenMatches`, with `lib/whatsapp/verify.ts` delegating to
  it. One extracted helper and a one-line delegation, no behaviour change; the
  alternative is a USSD module importing from `lib/whatsapp/`, which would make
  two independent channels structurally dependent on each other.
- `.env.example` — the two new variables and the extended comment from
  decision 4.
- `prisma/schema.prisma` — comment only on `whatsappNumber` (decision 1). **No
  migration**: a comment above a field is not a schema change, and `npm run
  db:migrate:new` must produce nothing. If it produces a diff, stop.
- `AGENTS.md` §19 only if a script is added — none is expected.

## Implementation requirements

### The route handler

- `POST` only, `application/x-www-form-urlencoded` — read via `await
  request.formData()` after confirming the field names against Africa's Talking's
  current docs. Expect `sessionId`, `serviceCode`, `phoneNumber`, `text`; treat
  any of them missing as a `400`.
- Order, no exceptions: **secret → service code → rate limit → resolve number →
  build screen.** Nothing is parsed or queried before the first two pass.
- An unconfigured deployment (`ussdSecret() === null` or `ussdServiceCode() ===
  null`) returns `403` with no body — a clean named refusal, so `npm run dev`
  with no credentials is not a crash.
- Responses are `text/plain`, body prefixed `CON ` (session continues, more input
  expected) or `END ` (session terminates). Verify both the prefixes and the
  content type against the provider's docs before writing them.
- The handler imports no Server Action, calls no `prisma.*.create/update/delete`,
  and touches only `findStaffUserByWhatsappNumber` and `readFieldDigest`. State
  this as a comment, because it is the enforcement of §10.9 and a future edit
  needs to see it.
- **It logs nothing about the session.** Not the phone number, not the keypress
  path, not the composed screen. A phone number is personal data (§18); log an
  outcome name and a count if anything at all.
- Per-number in-memory rate limit, keyed on the normalised digits, copied in
  shape from the WhatsApp webhook — including its honest comment that the window
  is per server instance and is a flood blunter, not a quota meter. Over the
  limit gets a plain `END` asking the caller to try again shortly, never silence:
  a USSD caller who gets nothing is looking at a network error screen.

### The menu (`lib/ussd/menu.ts`)

- `path.length === 0` → `CON` with the root menu: the two options plus the date
  of the digest, in plain language.
- `["1"]` → `CON` listing up to `USSD_MAX_SIGNALS` signal titles, numbered,
  each truncated to fit, plus `0` to go back.
- `["1", n]` → `END` with that signal's plain-language urgency label and its
  summary, capped.
- `["2"]` → `CON` listing up to `USSD_MAX_BRIEFS` brief titles, numbered.
- `["2", n]` → `END` with that brief's title and plain status label.
- Any unrecognised input → `CON` back at the root with a short "that was not one
  of the options" line, not an `END`: a mistyped digit should not drop the call.
- An empty digest gets an honest `END` — "There is nothing new to report this
  week." — never a blank screen.
- **Not one label is written inline.** Every word describing a signal or a brief
  comes from `lib/field/plain-language.ts`. No "signal", no "urgency", no
  "relevance", no classification value, no id, no score (§11.12).
- **Nothing implies the system decided anything** (§8.8). Briefs are "Sent to the
  people it was written for", never "approved" or "verified".

### Security

- Constant-time secret comparison; shape-check before comparing so a malformed
  value cannot throw.
- `phoneNumber` is attacker-controllable: it goes through
  `normaliseWhatsappNumber` and reaches no query until it is digits.
- The keypress index from `text` is parsed as an integer and bounds-checked
  against the rendered list length before indexing — never used as a raw
  accessor.
- No credential is `NEXT_PUBLIC_*`; none is imported from a client component;
  none appears in a log line, a Sentry event, or a PostHog property.
- No Server Action is reachable from this path, and no write occurs on it.

## Evidence classification impact

**No Gemini call fires on this path, and no evidence data reaches it.**

None of `evidence-governance`'s eight gated call types is touched: no embedding,
no summarisation, no classification, no generation, no re-generation, no audience
switch, no translation, no fact-check. Nothing in this prompt's import graph
reaches `lib/ai/` or `lib/governance/`, and every screen is assembled by a pure
function from rows already stored.

The gate is nonetheless load-bearing here as a **data-egress** rule, because a
USSD screen leaves Tropenbos-controlled infrastructure and crosses a telco
network in cleartext:

- The only read is `readFieldDigest()`, which selects **no column** of
  `evidence_item` or `evidence_chunk` and no brief body. There is no field on
  `FieldDigestPayload` through which an evidence title, excerpt, body or citation
  key could arrive, so no classification value can reach a screen regardless of
  what a menu asks for.
- **`readFieldDigest()` must not be widened by this prompt.** That constraint is
  the enforcement point: it is a property of the query in `lib/db/field.ts`, not
  a check in the handler, so there is no per-screen rule anyone can forget.
- Community-sourced field submissions are not readable on this path at all —
  they are `evidence_item` rows, which this read never touches (§7.6).
- Nothing about the session is logged, so no phone number and no screen text
  reaches Sentry or PostHog.

If a future screen wants evidence, that is a governance decision and a separate
prompt, not a `select` added to the field read.

## Hallucination-guard implications

**None.** This path reads no brief body, renders no claim, stores no flag, and
resolves none. `readFieldDigest()` selects no `bodyText` for the screen — only a
title and a status — so no flag mark, flagged claim, or citation chip can reach
a handset. Nothing here changes what is fact-checked, how claims are extracted,
how flags are stored, how they render, or what a flag blocks. The rule that
`submitted`/`published` briefs only reach this surface is unchanged, and it is
what keeps an unresolved-flag draft off it.

## Acceptance criteria

1. Dialling the short code with a registered Field Officer's number returns a
   `CON` root menu naming the two options and the date of the digest.
2. `1` lists policy updates in plain language; `1*2` ends the session with that
   update's plain urgency label and summary.
3. `2` lists papers from the office; `2*1` ends with the title and plain status.
4. `0` from a list returns to the root menu; an unrecognised input returns to the
   root with a short notice, and never ends the session.
5. An unregistered number gets a neutral `END` that discloses nothing and serves
   no digest.
6. A wrong or missing path secret gets `403` with no body, and the body is not
   parsed.
7. A `serviceCode` that does not match the configured short code gets `403`.
8. An unconfigured deployment gets `403`, not a `500`.
9. Every screen is ASCII, is within the configured character cap, and is cut on a
   word boundary when capped.
10. No word on any screen comes from outside `lib/field/plain-language.ts`; no
    internal taxonomy term, id, or score appears anywhere.
11. The route writes nothing: no `create`, `update`, `delete`, `upsert`, or
    Server Action import anywhere in its graph.
12. Nothing about a session is logged.
13. `npm run db:migrate:new -- ussd_check` produces no schema diff.

## Checks to run

- `npm run lint` — expect only the 4 known pre-existing errors in
  `components/ui/carousel.tsx`, `hooks/use-mobile.ts`, and
  `design_handoff_evibrief/support.js`.
- `npm run typecheck`
- `npm run build` — a new route is added, so the build is affected.

Report the exact output of each.

## Manual test steps

With `npm run dev` running, and `AFRICASTALKING_USSD_SECRET=testsecret` and
`USSD_SERVICE_CODE=*384*1234#` in `.env.local`. Africa's Talking's simulator can
drive the same endpoint once deployed, but every case below is reachable with
`curl` alone.

Seed prerequisite: one `StaffUser` with `role = field_officer` and
`whatsappNumber = 233241234567`, and at least one non-archived `policy_signal`
and one `submitted` brief. `npm run db:studio` is the quickest way.

1. **Root menu**

   ```
   curl -s -X POST http://localhost:3000/api/ussd/testsecret \
     -d sessionId=abc -d 'serviceCode=*384*1234#' \
     -d phoneNumber=+233241234567 -d text=
   ```

   Expect `CON ` and the two options. Confirm no internal taxonomy word appears.

2. **List updates** — same call with `-d text=1`. Expect `CON `, numbered
   titles, and a `0` back option.

3. **One update** — `-d 'text=1*1'`. Expect `END `, a plain urgency label
   ("Act this month" and friends), and the summary. Confirm the whole body is
   under the configured cap and is pure ASCII.

4. **Papers** — `-d text=2`, then `-d 'text=2*1'`. Expect the title and a plain
   status ("Sent to the people it was written for"), never "approved".

5. **Back and bad input** — `-d 'text=1*0'` returns the root menu; `-d text=9`
   returns the root menu with a short notice and a `CON`, not an `END`.

6. **Unknown number** — same as step 1 with `phoneNumber=+233209999999`. Expect
   a single neutral `END` that does not say whether the number is known.

7. **Wrong secret** — post to `/api/ussd/wrongsecret`. Expect `403` and an empty
   body.

8. **Wrong service code** — step 1 with `-d 'serviceCode=*111#'`. Expect `403`.

9. **Unconfigured** — unset `AFRICASTALKING_USSD_SECRET`, restart, repeat
   step 1. Expect `403`, not a stack trace.

10. **Rate limit** — run step 1 more times than the configured window allows.
    Expect a plain `END` asking the caller to try again shortly, never an empty
    response.

11. **Read-only** — with the dev server's terminal visible, run steps 1–5 and
    confirm no Prisma write is logged. Then
    `grep -rn "prisma\.\w*\.\(create\|update\|delete\|upsert\)" lib/ussd app/api/ussd`
    returns nothing.

12. **Consistency** — compare the titles on screen 2 against `/field` in a
    browser. They are the same items in the same order, because they are the same
    read.
