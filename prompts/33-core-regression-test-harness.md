# 33 — Core regression test harness

## Goal

Add the first repeatable test harness for EviBrief so the highest-risk product contracts can be checked with one local command before further feature work, refactors, or deployment preparation.

This is not a new product module. The goal is a small Playwright test-runner setup that covers:

- the evidence-governance gate as a hard, typed contract;
- role-authorisation predicates for the main server-side permissions;
- unauthenticated routing to the project sign-in surface;
- the sign-in surface's deliberate Google Workspace-only shape;
- public/read-only callback routes that must fail closed when unauthenticated or unconfigured;
- artifact hygiene so traces, screenshots, auth state, and reports are never committed.

Keep the first suite credential-free. It must not require a real Google login, real Supabase data, real Gemini key, real Inngest keys, real Uploadthing keys, real Resend key, real WhatsApp/USSD credentials, Sentry, PostHog, or Pandoc.

## Skills read

- `evidence-governance` (project) — the test suite must assert that only `public_published` evidence is eligible, refusals are typed data containing ids/classifications only, and no bypass flag or trusted-source shortcut exists.
- `server-actions` (project) — confirms authorisation is server-side, role predicates are server-only, auth is Google Workspace SSO only, and a test must not add a credentials provider, magic link, or test-only mutation route.
- `playwright-skill` (vendor/community) — use Playwright's test runner with `webServer`, `baseURL`, role-based locators, web-first assertions, isolated tests, no `waitForTimeout`, traces on first retry, and committed-safe artifact paths.
- `playwright-skill/core/nextjs.md` — Next.js App Router tests should run through a managed web server and assert rendered routes rather than reaching into server component internals.
- `playwright-skill/core/configuration.md` — config should use `defineConfig`, CI retries, `forbidOnly`, stable `baseURL`, and artifact settings.
- `playwright-skill/core/test-organization.md` — organise by feature/domain with `.spec.ts` files, shallow `describe` blocks, and behavior names.
- `playwright-skill/core/authentication.md` — storage-state files contain session tokens and must be gitignored; do not introduce a fake login flow when the app's real auth is Google Workspace SSO.
- `playwright-skill/core/test-data-management.md` — tests must create or inline their own data and avoid depending on existing environment state. For this first suite, avoid database seed data entirely.

## Existing code inspected

- `AGENTS.md` — workflow, test-script gap in §19, evidence-governance gate, role matrix, auth restrictions, and current command list.
- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — skill table names testing the ingestion → classification → search flow as an expected implementation support activity; risk table requires preventing community data exposure to AI APIs.
- `prompts/32-ai-stack-scale-review.md` — confirms the latest prompt closed the AI stack scale-review operations item and explicitly left "adding a test framework" out of scope.
- `git log --oneline -12` — confirms committed implementation through AI stack scale review; worktree is clean.
- `package.json` — has `playwright` for radar scraping and `playwright:install`, but no `@playwright/test`, no `test` script, and no Playwright config.
- `.gitignore` — ignores `/coverage` only; does not yet ignore `playwright-report/`, `test-results/`, or Playwright auth state.
- `README.md` — still says "There is no test script yet."
- `auth.ts` — Auth.js v5 Google-only, Workspace-domain-restricted setup; no credentials provider and no local auth path.
- `lib/auth/session.ts` — route/session helper; role is re-read from the database when a real session exists.
- `lib/auth/authorize.ts` — central server-only authorisation predicates for briefs, flags, evidence classification, signal urgency, tracker, impact, and field submission.
- `lib/governance/gate.ts` — classification partition function, refusal shape, `ELIGIBLE_EVIDENCE_WHERE`, and pending-classification constant.
- `app/(app)/evidence/actions.ts` — classification mutation authorises before validation and queues embedding only after the classification transaction.
- `app/(app)/signals/actions.ts` — signal urgency mutation authorises before validation and writes audit through the data layer.
- `app/field/actions.ts` — field submissions default to unpublished/internal via schema/data defaults and make no AI call.
- `app/(app)/briefs/page.tsx` — generation control is presentation only; action-level authorisation remains separate.
- `lib/db/evidence.ts` — Evidence Library listing spreads `ELIGIBLE_EVIDENCE_WHERE` so only eligible evidence is searchable.

## Decisions and assumptions

1. **Next scope:** core regression test harness. The section 1 product build list is represented in committed code and prompt 32 handled the remaining Phase 4 operations review. The next unblocking work is repeatable verification, because the repo explicitly has no test script.
2. **Use Playwright's test runner, not browser automation alone.** The project already carries `playwright` for scraping, but tests should use `@playwright/test` so assertions, config, traces, and CI behavior are standard.
3. **No test-only auth bypass.** The first suite may test unauthenticated routing and sign-in shape. Authenticated role-specific page tests wait until a deliberate seeded-auth strategy exists; do not add credentials auth, a fake provider, mutable test route handlers, or a cookie-forging helper in this prompt.
4. **Contract tests are acceptable in the Playwright harness.** Some tests can import server-only pure modules such as `lib/governance/gate.ts` and `lib/auth/authorize.ts` and run under the Playwright test runner without a browser page. This gives fast coverage of the most important invariants without live services.
5. **No real database dependency.** The web-server env may provide harmless fake local values for required server-only env vars so modules initialise, but tests must not expect a database connection, seed rows, run Prisma migrations, or read production data.
6. **No network calls outside the local Next server.** Tests must not call Google, Gemini, Supabase, Resend, Inngest Cloud, PostHog, Sentry, Uploadthing, WhatsApp, USSD, Vercel, or Google Drive.
7. **Chromium first.** Add a single Chromium project for the first harness. Mobile and visual projects can be added later when there are authenticated fixtures and stable seed data; starting broad would create slow, brittle tests before the contract layer exists.
8. **Use the existing Next dev server locally.** `webServer` should run `npm run dev` with safe test env values and `reuseExistingServer: !process.env.CI`.
9. **Do not introduce a new unit-test framework yet.** Playwright can run the contract and route checks; adding Vitest/Jest at the same time would make the first testing prompt larger than needed.

## Files likely to change

**New**

- `playwright.config.ts` — Playwright test-runner config with a managed Next server, Chromium project, stable local env, traces/screenshots/reports, and no third-party credentials.
- `tests/contracts/governance.spec.ts` — classification gate and retrieval-filter contract tests.
- `tests/contracts/authorisation.spec.ts` — role predicate contract tests for the core server-side rights.
- `tests/e2e/public-routing.spec.ts` — unauthenticated route and sign-in surface checks against the local app.
- Optional: `tests/e2e/external-callbacks.spec.ts` — only if route behavior can be checked without real secrets and without mutating state.

**Modified**

- `package.json` — add `@playwright/test` as a dev dependency and a `test` script, e.g. `playwright test`.
- `package-lock.json` — updated by npm when adding the test-runner package.
- `.gitignore` — ignore Playwright artifacts and auth state: `/playwright-report/`, `/test-results/`, `/.playwright-auth/` or equivalent.
- `README.md` — replace "There is no test script yet" with `npm run test` and the one-time `npm run playwright:install` note.
- `AGENTS.md` §19 — add the new `npm run test` command, clarify first-suite scope, and remove the stale "no test script" gap.
- Optional: no app source files should change unless a route lacks a stable accessible label needed for the public-route tests. If that happens, keep the UI change minimal and consistent with existing copy.

## Implementation requirements

### Dependency and scripts

- Install `@playwright/test` as a dev dependency using the package manager already in the repo.
- Keep the existing `playwright` dependency and `playwright:install` script for Policy Radar scraping; do not repurpose it.
- Add `npm run test` for the regression suite.
- Do not add CI config in this prompt.
- Do not add a database seeding script in this prompt.

### Playwright config

- Create `playwright.config.ts` using `defineConfig`.
- Use `testDir: "./tests"` and `testMatch: "**/*.spec.ts"`.
- Use `forbidOnly: !!process.env.CI`, retries `2` in CI and `0` locally, and `trace: "on-first-retry"`.
- Use `screenshot: "only-on-failure"` and no video by default unless needed to debug.
- Use `baseURL: "http://127.0.0.1:3000"` or a local env override.
- Configure only a Chromium desktop project initially.
- Configure `webServer` to run `npm run dev`, wait for the base URL, reuse an existing server outside CI, and provide harmless local test env values:
  - `AUTH_SECRET=test-secret-do-not-use-in-production`
  - `AUTH_URL=<baseURL>`
  - `AUTH_ALLOWED_DOMAIN=tropenbosghana.org`
  - fake local `DATABASE_URL` and `DIRECT_URL` values that are syntactically valid but not production credentials
  - leave all third-party API keys unset unless a module requires an inert placeholder to boot; if a placeholder is required, it must be obviously fake and never printed.
- Do not load `.env.local` automatically from the Playwright config. Tests must not accidentally use real service credentials.

### Contract tests

- Add governance tests that assert:
  - `partitionByClassification()` returns `public_published` items as eligible and refuses `community_sourced` and `unpublished_internal`;
  - refusal objects include `id`, `classification`, and `reason: "ineligible_classification"` only;
  - refusal objects never include evidence body/prose fields even if the candidate object carried them;
  - `ELIGIBLE_EVIDENCE_WHERE` is exactly `{ classification: Classification.public_published }`;
  - `PENDING_CLASSIFICATION` is `Classification.unpublished_internal`.
- Add authorisation tests that assert at minimum:
  - only Programme Director can approve/reject and submit/publish briefs;
  - Policy & Advocacy Officer and Programme Director can generate/edit briefs, while Research Officer and Field Officer cannot;
  - Research Officer and Programme Director can change evidence classification;
  - flag dismissal is blocked for the brief author even when the role is otherwise allowed;
  - only allowed roles can reclassify signals, request evidence rematches, manage stakeholders, log/verify influence events, and submit field observations, matching `lib/auth/authorize.ts`;
  - tests import role enum values from the generated Prisma enums, not hand-written string unions.
- Keep these tests data-free and deterministic.

### Public route tests

- Add browser tests that assert:
  - unauthenticated `/` renders or redirects to the sign-in surface without crashing;
  - unauthenticated protected app routes such as `/signals`, `/evidence`, `/briefs`, `/stakeholders`, `/tracker`, `/impact`, and `/field` redirect to or render `/signin`;
  - `/signin` offers Google sign-in and does not render email/password fields, a password field, magic-link copy, or a credentials fallback;
  - route assertions use role/label/text locators and web-first assertions, not brittle CSS selectors.
- If a route imports database code at module initialisation, the fake local DB URL should be enough to boot; the tests must not depend on a reachable database. If any route actually attempts a DB query before authentication, treat that as a bug to investigate before broadening the test.

### Optional callback tests

- If feasible without secrets or database access, add checks that unconfigured/read-only callback routes fail closed with 401/403/400 instead of 500:
  - `/api/field/cache`
  - `/api/auth/google-drive`
  - `/api/auth/google-drive/callback`
- Do not test provider webhooks by inventing signatures. If the signature contract is not obvious from existing code, leave this for a later provider-specific prompt.

### Artifact hygiene and docs

- Add Playwright artifacts and auth storage directories to `.gitignore`.
- Update `README.md` checks to include:
  - `npm run playwright:install` once per machine;
  - `npm run test`.
- Update `AGENTS.md` §19:
  - list `npm run test` as the Playwright regression suite;
  - state that the first suite is credential-free and covers governance/authorisation/public routes;
  - remove the stale "There is still no test script" paragraph;
  - keep the warning that `playwright:install` is also needed for Policy Radar scraping.

## Evidence classification impact

Touches the evidence-classification rule as a **test subject only**. It does not read, store, move, transmit, or mutate evidence data.

Classifications involved:

- `public_published`
- `community_sourced`
- `unpublished_internal`

Enforcement points under test:

- `lib/governance/gate.ts::partitionByClassification()` — only `public_published` is eligible; refused items return typed refusal records.
- `lib/governance/gate.ts::ELIGIBLE_EVIDENCE_WHERE` — the retrieval/search filter for evidence listing and model-facing retrieval.
- `lib/governance/gate.ts::PENDING_CLASSIFICATION` — newly ingested items remain unpublished/internal by default.
- `lib/auth/authorize.ts::canChangeEvidenceClassification()` — only Research Officer and Programme Director may change classifications.

Blocked items in the test are synthetic objects with ids and classifications only. They are refused as typed data with `reason: "ineligible_classification"`. No body text, uploaded document text, field observation, chunk text, prompt, completion, or real evidence record is loaded or sent anywhere.

## Hallucination-guard implications

No behavioral change to the hallucination guard.

The authorisation contract tests should cover the existing flag-dismissal predicate:

- Research Officer and Programme Director are the only roles that may dismiss a flag;
- nobody may dismiss a flag on a brief they authored;
- this is a server-side predicate contract only.

The prompt does not change what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks. It also does not change the visual contract: flags remain slate review prompts with a gentle single pulse settling to a steady soft outline, never red, blinking, or error-styled.

## Security requirements

- Do not add credentials login, a test-only Auth.js provider, local password auth, magic links, or a route that mints sessions.
- Do not commit `.env.test.local`, real secrets, Playwright storage-state files, traces, screenshots, videos, or reports.
- Do not load `.env.local` in the Playwright config.
- Do not call external APIs from tests.
- Do not connect to the production database or any Supabase project.
- Do not log or assert against real evidence body text, brief prose, field observations, stakeholder data, prompts, completions, translations, or raw errors.
- Keep all test data synthetic and clearly fake.
- Keep test config and docs ASCII.
- Do not add a governance bypass, paid-tier branch, fake public classification override, `FORCE_PUBLIC`, `ALLOW_INTERNAL_AI`, or similar flag.
- Do not add broad `data-testid` attributes unless an accessible locator is impossible; prefer role and label locators.

## Acceptance criteria

1. `@playwright/test` is installed as a dev dependency.
2. `npm run test` exists and runs the Playwright regression suite.
3. `playwright.config.ts` starts or reuses the local Next server with safe test env values and does not load real `.env.local` credentials.
4. The first suite runs without real Gemini, Supabase, Google, Resend, Inngest, Uploadthing, WhatsApp, USSD, Sentry, PostHog, Pandoc, or Vercel credentials.
5. Governance contract tests verify eligible/refused partitioning, refusal shape, pending classification, and retrieval filter.
6. Authorisation contract tests verify the role matrix in `lib/auth/authorize.ts`, including object-level flag dismissal.
7. Public route tests verify protected pages land unauthenticated users on the sign-in surface.
8. Sign-in tests verify Google Workspace SSO is the only visible auth path.
9. Playwright artifacts and auth-state directories are gitignored.
10. `README.md` documents `npm run test` and the one-time browser install command.
11. `AGENTS.md` §19 documents `npm run test` and no longer says there is no test script.
12. `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` run. Report exact output, including any known pre-existing lint noise.

## Checks to run

- `npm run playwright:install` if Chromium is not already installed for this Playwright version
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

No database migration is expected. Do not run `prisma migrate dev`.

## Manual test steps

1. Run `npm run test` with no `.env.local` loaded by Playwright. Confirm the suite starts the app using fake local test env values and does not request real service credentials.
2. Confirm `/signin` shows only the Google Workspace sign-in route and no email/password or magic-link fallback.
3. Confirm unauthenticated protected routes redirect to or render the sign-in surface without a 500.
4. Confirm the governance tests use only synthetic ids/classifications and no evidence prose.
5. Confirm `playwright-report/`, `test-results/`, and any auth-state directory are ignored by Git after a test run.
6. Confirm `README.md` and `AGENTS.md` both name `npm run test`.
7. Confirm no new route, provider, env var, or helper can bypass Auth.js, role checks, or the evidence-classification gate.

## Not in scope

- CI workflow configuration.
- Authenticated E2E flows through Google OAuth.
- Test-only login routes, credentials providers, or session-forging helpers.
- Database seeding, migrations, fixtures, or test database lifecycle management.
- Browser tests that require real Supabase data.
- Mocking Gemini generation, embeddings, or third-party provider APIs.
- Visual regression screenshots.
- Accessibility audit tooling beyond basic locator/assertion discipline.
- Provider webhook signature tests.
- End-to-end ingestion upload, generation, export, WhatsApp, USSD, or email delivery tests.
