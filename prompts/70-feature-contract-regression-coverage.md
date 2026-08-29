# 70 — Feature contract regression coverage

## Goal

Add a credential-free regression layer for the completed EviBrief product contracts that are not currently covered by the small initial Playwright harness. The new coverage must verify the server-side boundaries that protect Tropenbos Ghana's evidence, human-review workflow, field submissions, exports, and external callback endpoints without inventing a test login, connecting to a database, or calling any provider.

This is verification work after the completed product build list, not a new product module. It exists to make the high-risk finished flows safe to refactor and deploy.

## Skills read

- `.claude/skills/evidence-governance/SKILL.md` — the classification gate and refusal-data contract under test.
- `.claude/skills/server-actions/SKILL.md` — authorise-first Server Action boundaries, validation conventions, and mutation restrictions under test.
- `.agents/skills/playwright-skill/SKILL.md` — isolated, role-based, web-first Playwright tests with no external calls.

Before implementation, read the installed Next.js 16.2 documentation relevant to Server Actions and Route Handlers, plus the Playwright skill references `core/test-architecture.md`, `core/fixtures-and-hooks.md`, `core/test-data-management.md`, `core/network-mocking.md`, `core/service-workers-and-pwa.md`, and `core/nextjs.md`. Read only the app modules named below and their direct dependencies.

## Existing code inspected

- `playwright.config.ts`, `package.json`, `README.md`, and `AGENTS.md` §19: the existing credential-free Chromium harness starts a local Next server with fake, non-production environment values.
- `tests/contracts/governance.spec.ts` and `tests/contracts/authorisation.spec.ts`: the current pure-contract coverage for the classification gate and role predicates.
- `tests/e2e/public-routing.spec.ts` and `tests/e2e/external-callbacks.spec.ts`: the existing unauthenticated browser and request-level checks.
- `app/field/actions.ts`, `app/field/schema.ts`, `lib/field/queue.ts`, `lib/field/config.ts`, `app/api/field/cache/route.ts`: field data must remain default-classified, locally queued only when offline, and unavailable from the cache endpoint to signed-out callers.
- `lib/governance/gate.ts`, `lib/ai/evidence-context.ts`, `lib/ai/generate-brief.ts`, `lib/ai/translate.ts`, `lib/ai/reframe-brief.ts`, and `lib/ai/fact-check.ts`: AI-layer entry points and their shared gated evidence-context boundary.
- `app/(app)/briefs/new/actions.ts`, `app/(app)/briefs/[id]/actions.ts`, `app/(app)/briefs/[id]/reframe/actions.ts`, and `app/(app)/briefs/[id]/edit/actions.ts`: generation, approval, reframe, and edit flows remain Server Action-only and must keep human approval server-side.
- `app/api/whatsapp/webhook/route.ts`, `app/api/ussd/route.ts`, `app/api/auth/google-drive/route.ts`, and `app/api/auth/google-drive/callback/route.ts`: provider-facing routes must fail closed without valid configuration or verification.
- `lib/observability/scrub.ts`, `lib/observability/capture.ts`, `lib/whatsapp/message.ts`, and `lib/ussd/menu.ts`: external telemetry and digest surfaces deliberately exclude evidence bodies and restricted metadata.

## Decisions and assumptions

1. The completed build list is represented in committed code through prompt 69. The next highest-value work is to test its non-negotiable contracts, rather than add a feature outside the specified scope.
2. Keep the suite credential-free and data-free. Do not add a credentials provider, test-only route, cookie/session forgery, database seed, migration, or live database dependency merely to obtain authenticated UI coverage.
3. Test pure modules directly where that exercises an invariant more reliably than a browser. Browser/request tests are reserved for actual public routing, failure behaviour, and the service-worker/cache shell where no real staff data is needed.
4. Mock only external provider boundaries within a test, never EviBrief's own actions, data layer, or governance modules. Any mock must be local to a test and contain only synthetic, non-sensitive values.
5. Prefer assertions on exported typed contracts and on rendered accessible semantics. Do not read source files as strings to test implementation details, and do not add broad `data-testid` attributes when role, label, or text locators can identify the UI.
6. This prompt must not claim that a credential-free suite proves a real Google OAuth, Supabase, Gemini, Uploadthing, Meta/360dialog, Africa's Talking, Resend, or Google Drive integration. Those integrations remain covered by explicit manual production-readiness procedures.

## Files likely to change

- `tests/contracts/` — new narrowly focused contract specs and small extensions to existing specs.
- `tests/e2e/` — new public failure-mode or offline-shell checks only where stable without authentication.
- `playwright.config.ts` only if a test project/fixture setting is demonstrably required; retain the safe local server and Chromium default.
- `README.md` and/or `AGENTS.md` §19 only if the test command or documented coverage changes materially.
- At most, a small production-code export or accessible label where an existing stable contract cannot otherwise be tested. Do not change feature behaviour to accommodate tests.

## Implementation requirements

### Classification, AI, and draft lifecycle contracts

- Extend governance tests to prove all model-facing operations use the existing gated evidence-context type/constructor. Cover generation, fact-checking, reframe/audience switching, translation assist, and embedding entry points as applicable to their public module contracts. Do not execute Gemini calls or assert prompts/completions.
- Assert the all-refused path remains an explicit typed outcome and contains ids, classifications, and allowed reason/state fields only—never evidence body text, excerpts, field observations, or prompt text.
- Extend authorisation coverage for the full brief lifecycle: only Programme Directors approve, reject, submit, or publish; Policy & Advocacy Officers can create/refine drafts but cannot approve; Research Officers can resolve/dismiss eligible flags but never flags on a brief they authored; Field Officers cannot access generator or approval permissions.
- Assert the approval action's guard is present through its public pure validation/data-boundary contract: unresolved hallucination flags produce a handled refusal and do not transition a brief. Do not add a test-only database write to simulate it.
- Preserve the distinction between signal classification (automated suggestion), staff signal reclassification, evidence-match review, and Programme Director brief approval. Tests must never imply an automated state transition or autonomous submission.

### Field and offline contracts

- Test `app/field/schema.ts` and its direct input contract to prove a browser/offline payload cannot supply an evidence classification, role, staff-user id, AI eligibility flag, or publication status.
- Test the offline queue's serialisable item contract using synthetic observation text. Verify queue payloads contain only the minimum form fields and client-generated id/timestamps needed for replay, and never a Gemini prompt, classification value, or auth/session material.
- Verify the field cache configuration is fixed to the documented maximum of 30 signal summaries and 10 brief summaries, and that cached representations are their existing intentionally reduced, plain-language shapes—not evidence library rows or full restricted brief/evidence data.
- Keep existing signed-out `/api/field/cache` failure-closed coverage. If the public service-worker registration shell can be tested without authentication, add a browser check that it renders a clear offline limitation rather than asserting an actual offline sync against a live database. Do not use `page.waitForTimeout()`.

### Public callback and observability contracts

- Expand request-level tests only for provider routes whose invalid/unconfigured paths are deterministic from existing code. Assert they return a handled 4xx/explicit unavailable response, not 500, and do not make outbound requests.
- Add pure tests for observability scrub/capture boundaries using synthetic restricted strings. Assert no evidence body, field observation, brief prose, source URL, prompt, completion, translation, reviewer note, or raw provider token can enter a third-party payload. IDs, classifications, counts, statuses, and durations remain permissible where the existing contract allows them.
- Test WhatsApp and USSD digest-shaping helpers with synthetic data to ensure they omit classification values, evidence excerpts/full text, signal relevance scores, raw brief contents, and internal IDs. Do not contact Meta, 360dialog, Africa's Talking, or any phone number.

### Suite quality

- Each test owns its synthetic input and has no execution-order dependency. Do not mutate global environment state across parallel tests.
- Use generated Prisma enums and exported project constants rather than hand-written copies of role/classification/status strings.
- Use `getByRole`, `getByLabel`, and web-first assertions for browser tests. Use `request` fixtures for HTTP contracts. Never use CSS/XPath for a stable accessible element, `waitForTimeout`, a real provider, or a production/staging URL.
- Keep browser tests to Chromium unless a concrete cross-browser regression is discovered. Preserve CI retries, first-retry traces, failure screenshots, artifact ignores, and the current fake local test environment.
- Organise new specs by contract boundary, with shallow `describe` blocks and behaviour-oriented test names. Do not create page objects for one-off public pages.
- Do not add a new test framework, a database test lifecycle, visual-regression baselines, an accessibility scanner, or CI workflow changes in this prompt.

## Evidence classification impact

This task treats the classification gate and limited synthetic field payloads as **test subjects only**. It does not ingest, store, move, transmit, search, embed, summarise, generate from, translate, or fact-check real evidence.

The classifications involved are exactly `public_published`, `community_sourced`, and `unpublished_internal`. Enforcement points under test are `lib/governance/gate.ts` and the gated evidence-context constructors used by AI modules. The default-ingestion enforcement point remains the Prisma `EvidenceItem.classification` default and the field/evidence Server Actions; this prompt must not alter either.

Synthetic blocked items must receive typed handled refusals and remain out of every model-facing test path. Tests must assert that refusal/payload shapes omit evidence bodies and excerpts. No community-sourced or unpublished internal content—real or synthetic—may be emitted to Sentry, PostHog, a provider mock log, a Playwright report assertion, or an external request.

## Hallucination-guard implications

No change to fact-check execution, claim extraction, flag persistence, flag rendering, or approval behaviour is permitted. This prompt adds regression coverage only.

The tests must preserve the existing contract: a generated brief is fact-checked before it becomes reviewable; structured flags are anchored records; unresolved flags refuse Programme Director approval server-side; authorised review roles record resolution/dismissal reasons. The UI visual contract remains a slate review prompt with one gentle pulse settling to a soft steady outline—never red, blinking, or an error alarm.

## Security requirements

- Do not introduce an Auth.js test provider, credentials login, magic link, test-only mutation endpoint, session-forging utility, or authentication bypass.
- Do not connect to or migrate any database, and do not load `.env.local`, real secrets, browser storage state, or production data.
- Do not invoke Gemini, embeddings, Google, Supabase, Inngest, Uploadthing, Resend, Meta/360dialog, Africa's Talking, Google Drive, Sentry, PostHog, Vercel, or Pandoc.
- Keep all fixtures clearly synthetic. Never print evidence/brief/field text, provider responses, secret-like values, or raw errors in test names, snapshots, or logs.
- Do not weaken the classification gate, authorisation predicates, approval refusal, validation schema, provider-signature checks, or public route guards to make a test pass.
- Preserve third-party-boundary scrubbing and never assert against a telemetry payload that contains evidence text.

## Acceptance criteria

1. `npm run test` remains credential-free, deterministic, parallel-safe, and free of real provider/database access.
2. The suite covers all model-facing pathways' use of the existing governance boundary without making a model request.
3. The suite verifies the full role matrix for brief generation/editing, flag resolution, approval/rejection, and submit/publish, including the unresolved-flag server-side block.
4. Field input and offline queue/cache contracts cannot carry a caller-selected classification, AI-eligibility override, role/session material, or restricted evidence/brief content.
5. Signed-out cache and applicable public callback routes fail closed with handled responses and no outbound request.
6. Observability, WhatsApp, and USSD shaping tests prove restricted evidence/prose and secret-like provider values are excluded from external payloads.
7. New browser tests use accessible, web-first locators; no arbitrary waits, source-string inspection, or brittle selectors are added.
8. No product behaviour, schema, migration, external integration, CI workflow, or test-only authentication mechanism is introduced.
9. Existing tests remain green, and new coverage uses synthetic data only.

## Checks to run

1. `npm run test`
2. `npm run lint` (report the documented baseline issues separately; fix any new owned-file issue)
3. `npm run typecheck`
4. `npm run build`

Do not run a migration or seed script for this task.

## Manual test steps

1. Ensure no development server is running with real environment variables, then run `npm run test`. Confirm the Playwright server starts with the configured fake local values and no provider login or database prompt occurs.
2. Review the test output and trace/report artifacts after a forced local failure if needed. Confirm artifact directories remain ignored by Git and that output contains no synthetic restricted prose beyond a failing test's minimal assertion context.
3. Open `/signin` and an unauthenticated protected route. Confirm the existing Google Workspace-only sign-in surface still appears and no test auth path exists.
4. Run `git diff --check` and inspect the changed tests. Confirm all data is synthetic, external boundaries are mocked only when necessary, and neither an evidence-classification bypass nor an automatic brief transition was introduced.
