# 36 — CI and production-readiness guardrails

## Goal

Add repository-level guardrails for EviBrief's now-complete product surface: a GitHub Actions CI workflow that runs the existing credential-free checks on pushes and pull requests, plus a narrow production-readiness note that explains what the workflow does and deliberately does not prove.

This is next because the section 1 product build list and prompt 35's weekly radar gap analysis are represented in committed code, but the repo has no `.github/workflows/` checks. Prompt 33 created the regression harness; this prompt wires that harness into the repository so governance, authorisation, public routing, fail-closed callbacks, type safety, linting, and build regressions are caught before `main`.

This task must not deploy the app, connect Vercel, add a database service, create seed data, add test auth bypasses, add a second test framework, or introduce any new user-facing surface.

## Skills Read

- `playwright-skill` — CI should keep retries CI-only, upload useful artifacts, avoid hidden state, keep tests credential-free, and prefer standard reporters.
- `playwright-skill` CI GitHub Actions and reporting guides — use `npm ci`, Playwright browser caching/install, GitHub annotations, HTML reports, traces/screenshots on failure, and concurrency cancellation.
- `evidence-governance` — this workflow must not load real data or real service credentials; logs and artifacts must never contain evidence body text, brief prose, prompts, completions, field observations, stakeholder notes, or search text.

No deployment skill is used because this prompt does not deploy to Vercel or mutate any cloud resource.

## Existing Code Inspected

- `AGENTS.md` — prompt workflow, evidence governance, environment-variable rules, checks in section 19, Vercel/Supabase production posture, and unconfigured-state notes for Pandoc, Sentry, and PostHog.
- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — hosting is Vercel + Supabase, monitoring/analytics are required production concerns, and Vercel Hobby is not appropriate for Tropenbos production use.
- `git log --oneline -8` — confirms prompt 35 was implemented and committed as `Add weekly radar gap analysis`.
- `git status --short` — shows an unrelated `tsconfig.json` formatting/generated change; do not touch or revert it.
- `prompts/33-core-regression-test-harness.md` — first suite is intentionally credential-free, database-free, and local-only.
- `prompts/35-weekly-radar-gap-analysis.md` — latest executed prompt; confirms no further product module was left open there.
- `package.json` — available scripts are `test`, `lint`, `typecheck`, `build`, `scale:review`, `playwright:install`, `db:generate`, and related local commands.
- `playwright.config.ts` — CI retries are already `2`, local retries `0`, traces are `on-first-retry`, Chromium is the only project, and fake local env values are already supplied through `webServer.env`.
- `.gitignore` — Playwright reports, test results, auth storage, `.next`, generated Prisma client, env files, Vercel files, and TypeScript build info are ignored.
- `.env.example` — canonical env list and intentionally inert states for optional providers.
- `README.md` and `docs/ai-stack-scale-review.md` — current local setup/checks and quarterly operations runbook.
- `find .github .openai` / `find ... vercel` — no existing CI or deployment workflow files are present.

## Decisions and Assumptions

1. **CI first, no deployment yet.** The safe next step is to enforce checks, not to push to production or add Vercel credentials. Deployment requires cloud account state and should be a separate explicit prompt.
2. **GitHub Actions is the target.** The repo has GitHub remote history, and the missing `.github/workflows/` directory is the smallest standard place for repository checks.
3. **Single workflow, two jobs.** Use one workflow with a static/check job (`npm run lint`, `npm run typecheck`, `npm run scale:review`, `npm run build`) and a Playwright job (`npm run test`). Keeping Playwright separate makes artifacts and timeouts clearer.
4. **No sharding yet.** The suite is small. Sharding adds merge complexity without current payoff.
5. **No real secrets in CI.** The workflow must use explicit fake values where a build or server boot needs env shape. It must not reference repository secrets in this prompt.
6. **No database service container.** Existing Playwright tests are designed not to require a reachable database. Adding Postgres would widen the test contract and invite seed-data coupling.
7. **Use `npm ci`.** CI must install from the lockfile, not update dependencies.
8. **Do not commit generated artifacts.** Reports, traces, screenshots, `.next`, generated Prisma client, and Playwright browser caches remain out of git.
9. **Production readiness remains a checklist, not a claim.** Passing CI means the source checks pass under fake local credentials; it does not prove Supabase capacity, Vercel plan suitability, AI Studio quotas, Resend deliverability, WhatsApp setup, Sentry/PostHog provisioning, Pandoc availability, or Google OAuth consent.
10. **Leave `tsconfig.json` alone.** The existing dirty diff is unrelated and must not be normalized or reverted by this prompt.

## Files Likely To Change

New:

- `.github/workflows/ci.yml` — GitHub Actions workflow for install, generated Prisma client, lint, typecheck, scale review, build, and Playwright regression tests.
- Optional: `docs/production-readiness.md` — compact checklist tying CI to the quarterly runbook and explaining required external account checks before production deployment.

Modified:

- `README.md` — add a short CI / production-readiness section linking the workflow and operations note.
- Optional: `playwright.config.ts` — only if needed to add a JUnit or dot reporter for CI; preserve existing retry/trace behavior.
- Optional: `package.json` — only if a convenience script such as `ci:static` materially reduces workflow duplication. Do not add a script that hides real commands behind a vague name.

Do not modify `tsconfig.json`.

## Implementation Requirements

### GitHub Actions Workflow

- Create `.github/workflows/ci.yml`.
- Trigger on:
  - `push` to `main`;
  - `pull_request` targeting `main`.
- Add workflow-level concurrency:
  - group by workflow and ref;
  - cancel in-progress runs for the same branch or PR.
- Set `CI: true`.
- Use Node 20, matching the repo's current TypeScript/Next.js expectations.
- Use `npm ci`, not `npm install`.
- Run `npm run db:generate` after install if `postinstall` does not already produce the Prisma client reliably in CI. Avoid duplicate generation if `npm ci` already runs `postinstall` successfully.
- Static/check job:
  - `npm run lint`;
  - `npm run typecheck`;
  - `npm run scale:review`;
  - `npm run build`.
- Playwright job:
  - install dependencies with `npm ci`;
  - cache Playwright browsers under `~/.cache/ms-playwright` keyed by OS plus `package-lock.json`;
  - install Chromium and OS dependencies when the browser cache is cold;
  - install OS dependencies when the browser cache is warm;
  - run `npm run test`.
- Upload artifacts when useful:
  - `playwright-report/` on non-cancelled runs, short retention such as 7-14 days;
  - `test-results/` on failure, short retention such as 7 days.
- Do not add a scheduled workflow until there is a concrete owner for interpreting failures.
- Do not add deployment, Vercel token use, Supabase migration deploy, database seeding, Sentry release upload, source-map upload, PostHog setup, Slack notification, or email notification.

### CI Environment

- Use inert fake values only where required for `next build` or Playwright web-server boot:
  - `AUTH_SECRET`
  - `AUTH_URL`
  - `AUTH_GOOGLE_ID`
  - `AUTH_GOOGLE_SECRET`
  - `AUTH_ALLOWED_DOMAIN`
  - `DATABASE_URL`
  - `DIRECT_URL`
- Keep optional providers unset unless a build-time import demonstrably needs a placeholder.
- If placeholders are required for optional providers, values must be obviously fake and never printed.
- Do not set:
  - `GOOGLE_GENERATIVE_AI_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `UPLOADTHING_TOKEN`
  - `INNGEST_EVENT_KEY`
  - `INNGEST_SIGNING_KEY`
  - `WHATSAPP_API_TOKEN`
  - `AFRICASTALKING_API_KEY`
  - `SENTRY_AUTH_TOKEN`
  - real Sentry/PostHog DSNs or keys.
- Do not load `.env.local` in CI.
- Keep `NEXT_PUBLIC_POSTHOG_HOST` unset so analytics stays inert and never falls back to Cloud.

### Playwright Config

- Preserve:
  - `fullyParallel: true`;
  - `forbidOnly: !!process.env.CI`;
  - `retries: process.env.CI ? 2 : 0`;
  - `trace: "on-first-retry"`;
  - `screenshot: "only-on-failure"`;
  - Chromium-only project;
  - fake local `webServer.env`.
- If adding reporters, keep GitHub annotations in CI and HTML output for artifact upload.
- Do not add authenticated storage state, global login, or bypass sessions.

### Documentation

- Update `README.md` with a short section explaining:
  - CI runs on pushes/PRs to `main`;
  - CI uses fake local credentials and does not contact real providers;
  - local equivalents are `npm run lint`, `npm run typecheck`, `npm run scale:review`, `npm run build`, and `npm run test`;
  - production deployment still requires the quarterly/account checks in the runbook.
- If adding `docs/production-readiness.md`, keep it focused:
  - what CI proves;
  - what must be manually verified in AI Studio, Supabase, Vercel, Resend, Google OAuth/Drive, WhatsApp/USSD, Sentry, PostHog, Uploadthing, Inngest, and Pandoc;
  - reminder that Vercel Hobby is not the Tropenbos production plan;
  - reminder that the evidence-governance gate remains hard.
- Do not duplicate the full contents of `docs/ai-stack-scale-review.md`; link to it.

## Evidence Classification Impact

None — no evidence data path.

This task creates repository checks and documentation only. It must not read, write, move, transmit, seed, import, or query `EvidenceItem`, `EvidenceChunk`, field submissions, brief versions, stakeholder notes, policy documents, prompts, completions, translations, or hallucination-guard claim text.

Classifications involved:

- `public_published`
- `community_sourced`
- `unpublished_internal`

Enforcement point:

- No new runtime enforcement point is added because no evidence data path or AI-layer entry point is created.
- Existing enforcement remains in `lib/governance/gate.ts` and the current AI/data callers.
- The CI workflow must run existing tests with fake env only and must not connect to real data stores where evidence could exist.

Blocked items:

- `community_sourced` and `unpublished_internal` evidence remain blocked by existing code.
- CI must not contain fixtures, logs, artifacts, or documentation examples with real evidence text from any classification.

## Hallucination-Guard Implications

None.

This task does not change brief generation, claim extraction, fact-checking, flag persistence, flag rendering, flag dismissal, or approval blocking. Existing unresolved flags continue to block Programme Director approval server-side. CI may run existing guard-related tests but must not create or render new claim text.

## Security Requirements

- Never commit real secrets.
- Do not reference GitHub repository secrets unless a later deployment prompt explicitly needs them.
- Do not print environment variables.
- Do not upload `.env*`, `.next`, generated Prisma client, Playwright auth state, or build caches as artifacts.
- Keep Playwright artifacts limited to `playwright-report/` and `test-results/`, which should contain only credential-free local test output.
- No deployment keys, cloud mutations, database migrations, or external provider calls.
- Do not set `SENTRY_AUTH_TOKEN` or upload source maps in CI.
- Do not enable PostHog autocapture, replay, feature flags, or any analytics transport.
- Workflow comments and docs must not include secret-like sample values beyond obvious fake placeholders.

## Acceptance Criteria

1. `.github/workflows/ci.yml` exists and runs on pushes and pull requests for `main`.
2. CI installs dependencies with `npm ci`.
3. CI runs `npm run lint`, `npm run typecheck`, `npm run scale:review`, `npm run build`, and `npm run test`.
4. Playwright browser installation/caching is present and scoped to Chromium.
5. Playwright artifacts are uploaded with short retention; test traces/results are uploaded only on failure.
6. The workflow uses only fake local env values and no real provider secrets.
7. The workflow does not deploy, run migrations, seed data, call third-party APIs, or require a database service container.
8. README documents the CI behavior and local equivalents.
9. Any production-readiness doc clearly states CI is not a substitute for AI Studio, Supabase, Vercel, provider, and governance checks.
10. `tsconfig.json` remains untouched.
11. Local checks run after implementation: `npm run lint`, `npm run typecheck`, `npm run scale:review`, `npm run build`, and `npm run test`.

## Checks To Run

- `npm run lint`
- `npm run typecheck`
- `npm run scale:review`
- `npm run build`
- `npm run test`

Do not run `npm run db:migrate`; this task has no migration.

## Manual Test Steps

After implementation:

1. Inspect `.github/workflows/ci.yml` and confirm it has no deployment, migration, seeding, real secrets, Slack/email notifications, Sentry upload, or cloud-provider commands.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm run scale:review`.
5. Run `npm run build`.
6. Run `npm run test`.
7. Confirm `README.md` links to the production-readiness/runbook guidance and states that CI uses fake local credentials.
8. Confirm `git diff -- tsconfig.json` is unchanged from the pre-existing unrelated diff.
