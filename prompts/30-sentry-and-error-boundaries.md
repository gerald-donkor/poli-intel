# 30 — Sentry error tracking and the app's error boundaries

## Goal

Wire the last unbuilt piece of the observability stack's error half: **Sentry** (`AGENTS.md` §6), and the **error boundaries that currently do not exist anywhere in `app/`**.

Two things, one prompt, because they are structurally the same work: a React render error in a Server or Client Component is only reportable from a `global-error.tsx` / `error.tsx` boundary. Wiring Sentry without boundaries reports server exceptions and silently loses every client render crash; adding boundaries without Sentry gives the user a nice page and gives the team nothing.

The hard constraint that shapes the whole design: **no evidence body text may ever leave the box in a Sentry event** (`AGENTS.md` §7.6, §13.9, `evidence-governance` → "Logging and telemetry prohibition"). This project already logs correctly by hand — 40 call sites in `lib/` and `app/` use a structured `console.warn("namespace.event", { ids, counts, statuses })` convention with no body text. Sentry must not become the one path that undoes that. Redaction is therefore built as a **scrubbing layer in `beforeSend`, not as a convention** — the same reasoning as the classification gate: there must be no unscrubbed door.

PostHog is **out of scope** and becomes prompt 31. It is a different concern (usage analytics, client-side, self-hosted) and shares only the §7.6 prohibition, which this prompt's scrubber will be written to be reusable for.

## Skills read

- `evidence-governance` (project) — the telemetry prohibition, and the "typed outcome, no bypass" shape that the scrubber copies
- `sentry-instrument` (vendor) — the Next.js SDK wiring; note the deviation recorded under Decisions
- `design-system` (project) + `design_handoff_evibrief/design-system.md` (authoritative) — the boundary pages are UI, so tokens, the no-red rule, and the responsive floor all apply
- `server-actions` (project) — the existing error-result shape that boundaries must *not* replace

`AGENTS.md` §3 lists the Sentry skills as `sentry-nextjs-sdk`, `sentry-instrument`, `sentry-debug-issue`. Only `sentry-instrument` and `sentry-debug-issue` are actually installed; `sentry-nextjs-sdk` does not exist. Correct §3 in this change rather than citing a skill that is not there.

## Existing code inspected

- `app/layout.tsx` — three `next/font` families, `<html>` carries the variables and `h-full`, `<body>` is `flex min-h-full flex-col`. A `global-error.tsx` replaces the whole document, so it must restate the font variables itself or render unstyled.
- `app/(app)/layout.tsx`, `app/field/layout.tsx` — the two shells a segment-level `error.tsx` renders inside.
- No `error.tsx`, `global-error.tsx`, `not-found.tsx`, or `loading.tsx` exists anywhere under `app/`. Confirmed by `find app -name "error.tsx" -o -name "global-error.tsx" -o -name "not-found.tsx"` returning nothing.
- `next.config.ts` — bare `NextConfig`, no wrapper applied yet.
- `.env.example` lines 98–103 — `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN` are already declared with their server/client comments. No new variables are needed.
- `package.json` — no `@sentry/*` dependency; no `instrumentation.ts` at the root.
- The 40 existing `console.warn`/`console.error` call sites, e.g. `lib/ai/translate.ts:87`, `lib/export/pandoc.ts:201`, `app/(app)/briefs/new/actions.ts:494`, `app/api/auth/google-drive/callback/route.ts:85`. All follow `("dotted.event.name", { scalars })`. This is the convention Sentry breadcrumbs will inherit, and it is already safe — do not rewrite these call sites.
- `lib/net/secret.ts` — the house style for a small pure module with its reasoning in the header comment. The scrubber should read like this.

## Decisions and assumptions

1. **No Sentry project is provisioned, and none will be provisioned in this change.** `sentry-instrument`'s spine assumes an authenticated Sentry MCP and ends at "a real event confirmed in Sentry". That is not available here, and provisioning a Tropenbos-owned Sentry org is the client's call, not an implementation detail. This prompt therefore does the **code half only** and deviates from the skill's Step 2/Step 4 verification loop deliberately. Say so in the commit message.
2. **Consequently, Sentry must be fully optional at runtime.** With `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` unset, the app boots, builds, and runs with Sentry inert and *no console noise* — exactly the pattern §19 already established for `PANDOC_BIN` and PDF export. Unset is the state production currently gets, so unset must be a first-class state, not a degraded one.
3. **Source map upload is off unless `SENTRY_AUTH_TOKEN` is present.** The build must never fail because a token is missing.
4. **`tracesSampleRate` is 0 for now.** `sentry-instrument` treats errors+tracing as the default `init`, but tracing on a free-tier Sentry with Inngest jobs, Gemini calls, and pgvector queries burns the quota on data nobody is reading yet, and every span name is one more surface to audit for evidence text. Errors first; tracing is a later, deliberate prompt. Record this in the config comment so it reads as a decision, not an omission.
5. **`sendDefaultPii: false`.** Staff are named individuals at a small organisation and the app is Workspace-SSO-only. Attach the staff **id and role** to the Sentry scope, never email or name.
6. **Boundaries do not replace the `Result` union convention.** Handled failures (rate limits, refusals, validation) already return typed results and render their own states — the boundary is for the unhandled crash only. Do not route any existing typed failure through it.

## Files likely to change

**New**

- `lib/observability/scrub.ts` — pure, no `server-only`, no SDK import. The redaction rules and the allowlist. Testable without an environment.
- `lib/observability/sentry-options.ts` — the shared `init` options (dsn resolution, `enabled`, `beforeSend`/`beforeSendTransaction`/`beforeBreadcrumb` wired to the scrubber, `sendDefaultPii: false`, `tracesSampleRate: 0`, release/environment).
- `lib/observability/capture.ts` — `server-only`. The single exported way for app code to report a handled-but-notable failure, taking a dotted event name plus a scalar context object, mirroring the existing `console.warn` shape. It scrubs, then forwards to Sentry if enabled and to `console.warn` always.
- `instrumentation.ts` (root) — `register()` initialising the Node runtime, plus `onRequestError` exported for Next 16's server-error hook.
- `instrumentation-client.ts` (root) — browser init. Confirm the filename and the `onRouterTransitionStart` export against `node_modules/next/dist/docs/` and the installed `@sentry/nextjs`; Next moved this file more than once and the memorised answer is likely stale.
- `app/global-error.tsx` — `"use client"`. Renders `<html>`/`<body>` itself with the three font variables restated, captures to Sentry, offers reload.
- `app/(app)/error.tsx` — segment boundary for Director/Officer/Research routes.
- `app/field/error.tsx` — segment boundary for the Field Officer route. **Single column, plain language, no internal taxonomy** (`design-system` rule 6). A Field Officer seeing "a segment threw" is a failure of this file.
- `app/not-found.tsx` — the 404. Currently a raw Next default.
- `components/failure-panel.tsx` — the shared body the three boundaries compose, so the visual treatment exists once.

**Modified**

- `next.config.ts` — wrap with `withSentryConfig`, guarded so a missing `SENTRY_AUTH_TOKEN` disables upload rather than failing.
- `package.json` — `@sentry/nextjs`.
- `AGENTS.md` — §3 skill-name correction (see above); §19 gains a note that Sentry is inert without a DSN, in the same voice as the Pandoc note.
- `.env.example` — only if a comment needs sharpening. No new variables.

## Implementation requirements

### The scrubber is the point

`lib/observability/scrub.ts` is the load-bearing module. Write it first and write it defensively.

- **Allowlist, never denylist.** A denylist of key names ("text", "body", "content") fails the moment someone adds `excerpt` or `chunk`. The scrubber walks an event's context objects and keeps only values that are **scalars matching the shapes this project actually logs**: ids (cuid/uuid), enum-like short tokens, numbers, booleans, ISO timestamps, and short dotted event names. Anything else — long strings, arrays of objects, nested prose — is replaced with a redaction marker that records its **type and length**, never its content.
- Apply a hard length ceiling on any retained string. A cuid is ~25 chars; a policy excerpt is not. Pick the ceiling in the module and comment why.
- **Scrub the error's own message and the exception value too**, not just `extra`/`contexts`/`tags`. A `throw new Error(\`no match for "\${chunk.text}"\`)` is the realistic leak, and it is the one a key-based filter never catches.
- **Scrub breadcrumbs.** Console breadcrumbs are on by default in the browser SDK and would otherwise vacuum up anything a component logged.
- **Drop request bodies and search strings.** A Server Action's serialised arguments and an evidence-search `?q=` are both evidence text by another name.
- No `force`, no env var, no dev bypass that turns scrubbing off. Same rule as the classification gate: a dev bypass is a production bypass with a different name.
- Export the scrubber as a plain function over a generic payload so prompt 31 can reuse it for PostHog without importing `@sentry/nextjs`.

### Sentry wiring

- `enabled` is derived from DSN presence. No DSN → the SDK is initialised in a disabled state (or not at all) and **nothing is printed**.
- Model IDs, limits, and now DSN/environment/release resolution stay centralised — `lib/observability/sentry-options.ts` is the one place, mirroring `lib/ai/config.ts`. Never inline a DSN or a sample rate in a route or a boundary.
- Attach staff `id` and `role` to the scope from the Auth.js session where a session exists; never email, never name.
- `onRequestError` in `instrumentation.ts` must pass through the scrubber like every other path.
- Nothing in `lib/observability/` may import Prisma, Gemini, or any evidence module. It is a leaf.

### The boundary UI

Read `design_handoff_evibrief/design-system.md` before writing any of it.

- **Nothing is red.** `--destructive` is deliberately unmapped (`design-system` rule 2). A crashed screen is a **slate/stone** treatment — the same register as the guard flag, calm and non-alarmist. No `destructive` variant, no alert-red border, no warning triangle.
- No leaf/tree iconography. If a mark is used at all, it is the abstract thin-stroke vocabulary — a concentric contour ring or a plain rule. Prefer no icon.
- **Copy is measured and never blames the user or claims the system decided anything** (`AGENTS.md` §8.8). "This screen could not be loaded." then a concrete next step. Do not say "verified", "approved", or "we detected".
- Do **not** render the raw `error.message` to the user. It is exactly the string the scrubber exists to distrust. Show `error.digest` in the mono family as a reference the team can match to a Sentry event — the digest is a hash, and the `/field` boundary shows nothing at all.
- Typography: Inter for all of it. **The serif is quoted material only** and a stack trace is not quoted material.
- `/field` boundary: single column at every width, plain language ("Something went wrong. Your saved submissions are still on this phone."), one action. It must not leak "segment", "boundary", "signal", or "digest". Check that queued offline submissions are described as safe if they are — verify against `lib/field/queue.ts` before writing that sentence, and drop it if it is not true.
- Every boundary is legible at **320px** and up with no horizontal scroll; check 390 / 760 / 1000 / 1300 / 1600.
- Reset action uses the boundary's `reset()`, is a real focusable button, and respects `prefers-reduced-motion`. If in doubt, no motion at all here — a crashed screen is the wrong place for a flourish.

### `not-found.tsx`

Same visual family, one link back to the app shell. It is a Server Component; do not make it a client boundary.

## Evidence classification impact

**Touches no Gemini call, but sits directly on the §7.6 telemetry prohibition — the strictest reading of the governance rule applies.**

- **Which of the eight call types:** none. Nothing here embeds, summarises, classifies, generates, re-generates, reframes, translates, or fact-checks. The classification gate at the AI layer's entry is untouched and must not be modified by this change.
- **The data path that does exist:** error reports from code that *does* handle evidence — `lib/ai/*`, `lib/ingestion/*`, `lib/matcher/*`, `lib/db/evidence*.ts`. An unhandled throw inside any of them can carry evidence body text in its message, its stack frame variables, or a Server Action's serialised arguments. Sentry is third-party storage (`AGENTS.md` §7.6), so that transmission is exactly what §7 forbids.
- **Enforcement point in code:** `scrubEvent()` in `lib/observability/scrub.ts`, invoked from `beforeSend`, `beforeSendTransaction`, and `beforeBreadcrumb` in `lib/observability/sentry-options.ts`. Every Sentry transport path in the app goes through those three hooks; there is no exported init that omits them.
- **What happens to blocked content:** it is replaced in place with a marker naming its type and length, and the event is still sent. A redacted event is more useful than no event and cannot be mistaken for a silent drop. Ids, classifications, counts, and timings survive, which `evidence-governance` states is enough to debug the pipeline.
- **Community-sourced data specifically:** `community_sourced` and `unpublished_internal` items never reach Gemini, but they *do* flow through ingestion and the Evidence Library, so their text is in scope for a crash report. The scrubber does not read classification and must not — it redacts by shape, so it protects all three values identically and cannot be defeated by a mis-tagged item.

## Hallucination-guard implications

**None.** This change does not alter what is fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks. No file under `lib/briefs/extensions/`, `lib/ai/fact-check.ts`, or the approval action is touched.

One adjacency worth stating so it is not violated by accident: the guard flag's slate treatment and the boundary's slate treatment share a ramp, but the flag's **circle glyph and its 900ms single pulse are its own contract** (`hallucination-guard`). The boundary must not borrow the circle glyph or the pulse — a crashed screen is not a review prompt, and the two must stay visually distinguishable.

## Security requirements

- `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` are server-only. Only `NEXT_PUBLIC_SENTRY_DSN` reaches the browser (`AGENTS.md` §18). Never read the server DSN from a client module.
- `SENTRY_AUTH_TOKEN` is build-time only and must never be bundled or logged.
- `sendDefaultPii: false`. No email, no name, no IP beyond what Sentry infers; staff id and role only.
- No secret, session token, cookie header, or `Authorization` header in any event — the scrubber's allowlist already excludes them, but assert it explicitly for headers.
- `lib/observability/capture.ts` is `server-only`.
- Boundaries never render `error.message` or a stack to the browser.
- The USSD/WhatsApp read-only paths must stay unauthenticated and non-mutating — instrumentation adds no state change there.

## Acceptance criteria

1. With no Sentry variables set: `npm run dev`, `npm run build`, and `npm run start` all work, no Sentry console output, no network attempt to ingest.
2. With `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set to a syntactically valid DSN: init succeeds on server and client; with no `SENTRY_AUTH_TOKEN`, `npm run build` still succeeds and skips source-map upload.
3. A thrown error inside an `(app)` route renders `app/(app)/error.tsx` inside the app shell, not a Next default.
4. A thrown error inside `/field` renders `app/field/error.tsx`, single-column, plain language, no internal vocabulary.
5. A thrown error in the root layout renders `app/global-error.tsx` with fonts intact.
6. An unknown URL renders `app/not-found.tsx`.
7. `scrubEvent()` given an event whose `message`, `extra`, `breadcrumbs`, and request body all contain a 2,000-character prose block returns an event with **no substring of that block anywhere**, while retaining ids, counts, and classification enum values. Demonstrate this in the manual test steps.
8. No boundary renders `error.message`. No boundary uses a red or `destructive` token.
9. Every boundary and the 404 are legible with no horizontal scroll at 320, 390, 760, 1000, 1300, 1600.
10. `AGENTS.md` §3 no longer names `sentry-nextjs-sdk`; §19 records the DSN-optional behaviour.
11. No existing `console.warn` call site is rewritten.
12. `npm run lint` and `npm run typecheck` clean apart from the four known pre-existing errors recorded in §19.

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npm run build` — required, since `next.config.ts` and the root instrumentation files both affect it

Report exact output.

## Manual test steps

1. `npm run build && npm run start` with **no** Sentry variables in `.env.local`. Confirm a clean boot and no Sentry line in the terminal.
2. Add a temporary `throw new Error("boundary check")` to `app/(app)/tracker/page.tsx`, reload `/tracker`, confirm `app/(app)/error.tsx` renders inside the shell with no raw message. Remove it.
3. Repeat in `app/field/page.tsx`; confirm the plain-language boundary, single column at 390px. Remove it.
4. Visit `/does-not-exist`; confirm `app/not-found.tsx`.
5. Temporarily throw from `app/layout.tsx`; confirm `global-error.tsx` renders with Inter applied, not a serif fallback. Remove it.
6. **Scrubber proof.** Add a temporary script under the scratchpad that imports `scrubEvent` and passes a synthetic event carrying a long prose block in `message`, `extra.chunk`, a breadcrumb, and `request.data`. Run it with `npx tsx`, and paste the before/after showing the prose gone and the ids kept. Delete the script afterwards.
7. Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` to a valid-shaped DSN pointing nowhere, rebuild, trigger step 2 again, and confirm the app degrades silently — a failed ingest POST must never surface to the user or break the boundary render.
8. Resize each boundary through 320 / 390 / 760 / 1000 / 1300 / 1600 and confirm no horizontal scroll.

## Not in scope

- Provisioning a Sentry organisation or project, and confirming a live event (needs the client's Sentry account — see Decision 1).
- Tracing, profiling, session replay, cron check-ins, and AI/LLM monitoring (Decision 4).
- PostHog — prompt 31.
- `loading.tsx` skeletons. Also missing app-wide, also worth doing, but they are a perceived-performance concern with no governance dimension and belong in their own prompt.
