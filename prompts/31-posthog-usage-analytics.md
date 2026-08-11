# 31 — PostHog usage analytics without evidence leakage

## Goal

Wire the second half of the observability stack named in `AGENTS.md` §6 and the product spec: **PostHog usage analytics, self-hosted**, with the same hard telemetry posture as prompt 30's Sentry work.

This is not a dashboard-building prompt and not a product-growth instrumentation sweep. The goal is the minimum useful analytics layer for Tropenbos staff workflows:

- understand which core workflows are being used;
- measure completion/failure rates for high-value actions;
- distinguish roles and surfaces without identifying staff by name or email;
- never send evidence body text, brief prose, search text, stakeholder names, field observations, prompts, completions, document titles, URLs with query strings, or raw error messages to PostHog.

The existing `lib/observability/scrub.ts` was deliberately written to serve this prompt without importing Sentry. Reuse it. Do not create a second redaction system.

## Skills read

- `evidence-governance` (project) — the logging and telemetry prohibition: no evidence body text in a PostHog property, log line, or error report; retain ids, classifications, counts, statuses, and timings only.

No PostHog skill is installed in the approved skill list. `docs/skills-install.md` and the spec mention the official PostHog MCP wizard, but running an agent-powered wizard against this repository is a separate tooling decision and is not required for this implementation. Use the installed package docs after adding the package, or PostHog's official current docs if local docs are insufficient.

## Existing code inspected

- `prompts/30-sentry-and-error-boundaries.md` — explicitly leaves PostHog out of scope and names it as prompt 31; requires the scrubber to be reusable for PostHog.
- `lib/observability/scrub.ts` — pure structural redaction layer, no SDK import, no `server-only`, no bypass. Keeps scalar metadata and replaces prose or deep/nested content with typed redaction markers.
- `lib/observability/sentry-options.ts` — centralised optional observability configuration pattern: env resolution in one module, unconfigured state is silent, transport hooks always scrub.
- `lib/observability/capture.ts` — server-only Sentry helper shape: event name plus scalar context, staff id/role only, no names or email.
- `instrumentation-client.ts` and `instrumentation.ts` — Sentry browser/server init files; useful as a precedent for optional client/server observability.
- `lib/auth/session.ts` — the one place resolved staff identity currently attaches `id` and `role` to Sentry scope. Use the same identity boundary for analytics, but do not make observability import auth or Prisma.
- `app/layout.tsx` — root layout can host a small client analytics provider below `<body>`.
- `.env.example` — already declares `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`; comments say self-hosted and client + server. No real key is present.
- `package.json` — no `posthog-js` or `posthog-node` dependency yet.
- `rg -n "posthog|PostHog|NEXT_PUBLIC_POSTHOG|capture\\(" .` — only docs, env comments, prompts, and governance references exist; no implementation exists.

## Decisions and assumptions

1. **Use PostHog's normal JavaScript packages, not the MCP wizard.** The wizard is for agent/tool setup and sends its own run telemetry by default. This change is small enough to implement directly, and a direct implementation avoids exposing repository context to an external setup agent.
2. **PostHog is optional at runtime.** With no `NEXT_PUBLIC_POSTHOG_KEY` or host, the app boots, builds, and runs silently with no analytics capture. This mirrors Sentry and Pandoc: unconfigured is a first-class state.
3. **Self-hosted host is required when enabled.** The spec says PostHog is self-hosted. Do not silently default to PostHog Cloud. If a key exists without `NEXT_PUBLIC_POSTHOG_HOST`, analytics stays disabled and logs no noisy warning.
4. **No session replay.** Replay records the DOM. The DOM can contain evidence excerpts, brief prose, stakeholder records, Twi key messages, and field observations. Enabling replay would violate `AGENTS.md` §7.6 unless a later prompt designs a much stricter capture policy.
5. **No autocapture.** PostHog's autocapture can collect button text, form labels, URLs, and DOM details. Use explicit events only.
6. **No user names or emails.** Identify with staff id where a signed-in staff user exists, and attach role. Do not send staff email, display name, stakeholder names, organisation names, phone numbers, or document titles.
7. **Event names are product events, not prose.** Use short dotted event names, matching the existing `console.warn("namespace.event", { ... })` convention.
8. **Analytics observes human actions, not AI content.** It may record that a brief generation was requested, succeeded, rate-limited, failed validation, or was blocked by unresolved flags. It must never record prompt text, generated text, evidence excerpts, claim text, policy document text, translation text, search query text, or guard-flag prose.

## Files likely to change

**New**

- `lib/observability/posthog-config.ts` — shared config: key/host resolution, enabled state, environment/release, explicit capture defaults, and comments explaining why Cloud fallback, autocapture, and replay are disabled.
- `lib/observability/posthog-client.tsx` — `"use client"` provider and hook/component for browser pageview/action capture. Uses `posthog-js`, initialises only when enabled, disables autocapture/session replay, strips query strings from route data, and sends only scrubbed properties.
- `lib/observability/posthog-server.ts` — `server-only` helper for server-side captures using `posthog-node`, with scalar-only property typing and `scrubValue()` applied before capture.
- `lib/observability/events.ts` — central event-name constants and property type helpers so event names do not drift across routes/actions.
- Optional: `lib/observability/scrub.test-helper.ts` or a scratch-only script during verification if useful. Do not keep a test file unless a real test command is added.

**Modified**

- `app/layout.tsx` — add the client provider inside `<body>` so route changes can be captured after hydration.
- `lib/auth/session.ts` or a small adjacent module — attach staff id and role to PostHog in the same direction as Sentry: auth may call observability; observability must not import auth, Prisma, Gemini, evidence, or route code.
- Selected Server Actions where the event is high-value and safe:
  - brief generation requested / completed / failed by typed reason;
  - brief approval refused because unresolved flags exist;
  - evidence classification changed;
  - signal moved/classified/re-matched;
  - field submission queued/submitted/synced counts;
  - export requested by format and outcome.
- `.env.example` — sharpen comments if needed; no new variables unless the package requires a server-only key, and do not add one speculatively.
- `package.json` / lockfile — add `posthog-js` and, only if needed for server-side capture, `posthog-node`.
- `AGENTS.md` §19 — add the same operational note style as Sentry: PostHog is inert unless configured, self-hosted host required, no autocapture, no replay, all properties scrubbed.

## Implementation requirements

### Read current docs before implementing

Before writing PostHog code, inspect the installed package docs/types after installation. If the package docs are insufficient, use PostHog's official current docs. Do not use memorised SDK options for `posthog-js`, `posthog-node`, pageview capture, or shutdown/flush behavior.

### Configuration

- Keep all PostHog configuration in `lib/observability/posthog-config.ts`.
- Read only `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` from client-reachable modules.
- Do not introduce `POSTHOG_API_KEY`, `POSTHOG_PERSONAL_API_KEY`, or any server-only administrative key unless an actual required server SDK feature proves it necessary. Capturing events should not require an admin key.
- If key or host is blank, analytics is disabled silently.
- If key exists but host is blank, analytics is disabled silently because the project requires self-hosting and must not default to Cloud.
- Derive environment from `VERCEL_ENV ?? NODE_ENV ?? "development"` and release from `VERCEL_GIT_COMMIT_SHA`, matching Sentry's pattern.

### Client capture

- Initialise `posthog-js` in a small client component mounted from `app/layout.tsx`.
- Disable autocapture.
- Disable session recording/replay.
- Disable any feature that records DOM text, form values, rage clicks with element text, or URL query strings.
- Capture a pageview on route changes using pathname only. Do not send `searchParams`; query text can be evidence text.
- If PostHog exposes a built-in pageview option that includes full URL/query, disable it and capture explicitly.
- Identify or set person properties with staff id and role only if available on the client without exposing more personal data. If getting staff identity to the client would require broadening session payloads, skip client identify and use anonymous pageviews plus server-side identified action events.
- The provider must render `children` unchanged and must not block hydration if PostHog fails to load.

### Server capture

- Add a server-only helper, for example `captureUsage(event, properties, staff?)`.
- Properties are scalar-only at the type level: ids, roles, enums, booleans, numbers, timestamps, durations, counts, statuses.
- Always run properties through `scrubValue()` before sending.
- Never pass raw request bodies, form values, search queries, file names, document titles, stakeholder names, phone numbers, email addresses, policy-document text, evidence text, brief text, prompt text, completion text, translation text, or error messages.
- If the server SDK has a flush/shutdown requirement for serverless runtimes, follow the official package guidance and keep it isolated in the helper.
- Fail closed and silent for analytics transport failures. A PostHog outage must never fail a Server Action or route render. Use existing safe `console.warn("observability.posthog.capture_failed", { event })` style if a warning is useful; never include payload content.

### Event set

Start with a constrained allowlist in `lib/observability/events.ts`. Good initial events:

- `route.viewed` — client only, `{ pathname, environment, release }`
- `brief.generation_requested`
- `brief.generation_completed`
- `brief.generation_failed`
- `brief.approval_refused`
- `brief.export_requested`
- `brief.export_completed`
- `evidence.classification_changed`
- `signal.rematch_requested`
- `signal.status_changed`
- `field.submission_created`
- `field.submission_sync_attempted`
- `digest.whatsapp_sent`
- `digest.ussd_viewed`

For each event, define allowed properties close to the event name. If a property would require prose to be useful, do not track it.

### Placement

- Add capture calls only where the action has a stable typed outcome already. Do not thread analytics through unrelated UI components.
- Do not add analytics to every button. Prioritise module-level workflow outcomes.
- Do not add database tables for analytics. PostHog owns analytics storage.
- Do not send PostHog events from Inngest if it would substantially increase free-tier event volume. For scheduled jobs, capture only coarse success/failure counts if the existing job code already has those safe counts.
- `lib/observability/` remains a leaf: no Prisma, Gemini, evidence, matcher, briefs, jobs, auth imports into config/client/server helpers. Callers pass ids and roles in.

## Evidence classification impact

This task does **not** add or change any Gemini call and does not alter the AI-layer classification gate. It does, however, creates a new third-party telemetry path, so `AGENTS.md` §7.6 and `evidence-governance`'s telemetry prohibition apply directly.

- **Which of the eight AI call types:** none. This does not embed, summarise, classify with Gemini, generate, re-generate, reframe, translate, or fact-check.
- **Classifications involved:** all three values — `public_published`, `community_sourced`, and `unpublished_internal` — because analytics can be emitted from screens/actions that read or move all three kinds of records.
- **Enforcement point in code:** `scrubValue()` / `scrubEvent()` in `lib/observability/scrub.ts`, called from the new PostHog client and server capture helpers before any event is sent. The helpers are the only exported PostHog capture path.
- **What happens to blocked content:** long strings, multi-word prose, arrays/objects beyond the safe scalar shape, request/search strings, and any accidental prose are replaced with typed redaction markers before capture. Event capture continues with ids, classifications, counts, statuses, roles, formats, and timings intact.
- **Blocked items:** ineligible evidence remains blocked from AI by the existing governance gate. Analytics must not expose the blocked item's body text, title, search query, field observation, or classification rationale. It may record safe metadata such as `evidenceItemId`, old/new classification, actor role, and queue counts.

## Hallucination-guard implications

None. This change does not alter what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks.

If analytics records guard-related workflow events, it may record safe metadata only: brief id, flag count, unresolved count, actor role, and outcome such as `approval_refused_unresolved_flags`. It must not record claim text, evidence excerpt text, rationale text, dismissal reason prose, or the rendered flag contents. The visual contract remains unchanged: guard flags render in slate with a gentle single pulse settling to a steady soft outline, never red, never blinking, never an error toast.

## Security requirements

- Never commit real PostHog keys.
- Never default to PostHog Cloud; the spec says self-hosted.
- No session replay, no autocapture, no DOM text capture, no form value capture.
- No evidence body text, brief prose, search text, stakeholder personal data, field observation text, prompts, completions, translation text, request bodies, raw URLs with query strings, cookies, auth headers, or secrets in any PostHog event or property.
- Staff identity is staff id and role only. No email, no display name, no IP enrichment configured by application code.
- Server helper is `server-only`.
- Client helper imports no server-only module.
- Observability helpers remain dependency leaves and do not import Prisma, auth, evidence, Gemini, LangChain, jobs, or route modules.
- Analytics transport failure must never change product behavior.

## Acceptance criteria

1. `posthog-js` is wired for client route views only when both `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` are set.
2. No key or no host means no PostHog init, no capture attempt, no noisy console output, and no runtime error.
3. Autocapture and session replay are disabled explicitly.
4. Client pageview events send pathname only, never query string or hash.
5. Server-side capture helper is `server-only`, scalar typed, scrubbed, and optional at runtime.
6. A synthetic event with a 2,000-character evidence-style prose string in properties reaches the helper scrubbed, with no substring of the prose remaining and safe ids/counts/classifications retained.
7. At least five high-value workflow events are instrumented at stable typed outcomes, with no prose properties.
8. Staff identity, where sent, is id and role only.
9. `.env.example` remains the canonical env list and documents the self-hosted requirement.
10. `AGENTS.md` §19 documents the optional PostHog state and the no-autocapture/no-replay posture.
11. `npm run lint`, `npm run typecheck`, and `npm run build` run. Report exact output, including any known pre-existing lint noise.

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npm run build`

Run `npm install` only if the PostHog packages are not already installed. If network access is blocked by the sandbox, request escalation for the package install rather than hand-writing package metadata.

## Manual test steps

1. With `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` unset, run `npm run build && npm run start`. Confirm the app boots with no PostHog terminal/browser console output.
2. Add temporary local PostHog values using a self-hosted-looking URL such as `http://127.0.0.1:9999`, load `/signals?query=this-should-not-leak`, and confirm any attempted pageview payload contains `/signals` but not `query=this-should-not-leak`.
3. Trigger one instrumented Server Action in development and confirm it does not fail if the PostHog endpoint is unreachable.
4. Run a temporary scratch script with a 2,000-character prose block passed through the PostHog capture helper/scrubber path. Confirm the prose is absent and ids/counts/classifications remain. Delete the scratch script afterwards.
5. Check browser devtools for PostHog config: autocapture disabled, session recording/replay not active, no DOM text payloads.
6. Sign in as at least one non-Field Officer role and one Field Officer route if local auth fixtures permit it. Confirm role/id handling does not expose email or display name in analytics properties.

## Not in scope

- Building analytics dashboards inside EviBrief.
- Creating or administering a PostHog instance.
- Running the PostHog MCP wizard.
- Session replay.
- Feature flags or experiments.
- Full funnel taxonomy beyond the constrained initial event allowlist.
- Product-copy or UI changes beyond mounting the provider.
