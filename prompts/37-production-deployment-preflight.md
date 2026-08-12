# 37 — Production deployment preflight

## Goal

Add a credential-safe production deployment preflight for EviBrief: a local script and documentation that verify the environment shape, deployment capability posture, and governance-sensitive provider configuration before anyone deploys to Tropenbos-owned Vercel/Supabase/provider accounts.

This is next because prompts 1-36 have committed the product surface and CI guardrails, but the repository still has no operator-facing preflight that distinguishes "the app builds with fake CI env" from "this deployment has the production account state required to operate safely." The next unblocking step is not to deploy yet; it is to make deployment readiness explicit and auditable without weakening evidence governance or leaking secrets.

This task must not deploy the app, link or mutate a Vercel project, push to git, create cloud resources, run database migrations, seed data, contact Gemini/Supabase/Resend/Uploadthing/Inngest/WhatsApp/USSD/Sentry/PostHog, or add runtime bypasses for unconfigured providers.

## Skills Read

- `deploy-to-vercel` — Vercel deployments should default to preview unless production is explicitly requested; project/team state should be gathered before choosing a deployment method; linked Vercel project state is represented by `.vercel/project.json` or `.vercel/repo.json`; do not use commands that silently link a project while merely detecting state.
- `evidence-governance` — production readiness must not change the hard Gemini free-tier classification gate; only `public_published` evidence may reach Gemini, and no evidence body text, prompt, completion, field observation, or stakeholder note may be logged or included in diagnostics.

No `deploy-to-vercel` execution steps are part of this prompt. The skill is read to shape safe deployment preparation, not to perform a deployment.

## Existing Code Inspected

- `AGENTS.md` — prompt workflow, production stack, evidence governance, no-bypass rule, Vercel/Supabase posture, and the requirement to stop at the approval question for `i`.
- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — Vercel/Supabase hosting, section 6.1 free-tier graduation triggers, Vercel Hobby non-production status, Supabase free-tier limits, and the Phase 4 AI stack scale review item.
- `git log --oneline -12` — confirms prompt 36 was implemented and committed as `Add CI production readiness guardrails`.
- `git status --short` — clean worktree.
- `prompts/36-ci-and-production-readiness-guardrails.md` — CI intentionally uses fake credentials and does not deploy or contact providers.
- `.github/workflows/ci.yml` — current CI checks, fake env values, no deployment job, no secrets.
- `README.md` — local setup, checks, CI summary, and links to production readiness / AI stack scale review docs.
- `docs/production-readiness.md` — current manual account verification checklist.
- `docs/ai-stack-scale-review.md` — existing quarterly review command scope and external-account risks.
- `.env.example` — canonical environment variable list, server/client exposure notes, provider capability comments, Pandoc caveat, and WhatsApp/USSD access-control variables.
- `package.json` — current scripts include `scale:review`, checks, Prisma commands, but no production preflight script.
- `next.config.ts` — Sentry source map upload is opt-in on `SENTRY_AUTH_TOKEN`; build must not fail when Sentry is unconfigured.
- `instrumentation.ts` — Sentry initialises only with a server DSN and stays silent when unconfigured.
- `scripts/ai-stack-scale-review.mjs` — existing script pattern for credential-safe operational diagnostics that read source constants / env presence only.
- `lib/governance/gate.ts` — existing classification gate and no-bypass posture.
- `lib/export/pandoc.ts`, `lib/google/drive-client.ts`, `lib/email/client.ts`, `lib/whatsapp/client.ts`, `lib/ussd/client.ts`, and related config modules as needed during implementation — provider clients use fail-closed or disabled-capability shapes when credentials are absent.

## Decisions and Assumptions

1. **Preflight before deployment.** The safe next prompt is a readiness command and documentation, not a Vercel deploy. Deployment should be a later explicit `deploy` request after the preflight is meaningful.
2. **No cloud mutation.** The script must not call provider APIs, run migrations, send test messages, upload files, create a Vercel project, or alter account state.
3. **Presence and shape, never values.** Diagnostics may report whether a variable is present, blank, fake-looking, URL-shaped, domain-shaped, or internally inconsistent. They must never print secret values.
4. **Separate required from capability-specific checks.** Core production blockers should fail the command. Optional or host-dependent capabilities should report as `configured`, `not configured`, or `needs operator decision` without pretending the feature works.
5. **Vercel Hobby is a blocker for Tropenbos production.** The script cannot know account plan without calling Vercel, so it should require an explicit operator acknowledgement variable or produce a manual-check blocker documented in the report.
6. **Pandoc on Vercel remains a known constraint.** PDF export should be reported as unavailable unless `PANDOC_BIN` is present and executable locally. Do not require PDF to pass production preflight on Vercel unless the operator has explicitly decided to host Pandoc somewhere that supports it.
7. **No generated secrets.** The command may say a secret is missing or too short, but it must not generate, write, or suggest committing a value.
8. **CI remains fake-env only.** Do not wire production preflight into the existing GitHub Actions workflow unless it runs in a fake-profile mode that cannot require real provider credentials.
9. **No build-time hard fail.** Do not make `next build` fail because optional production providers are absent. The existing fail-closed runtime posture must remain intact.
10. **Documentation should tell operators exactly how to run it.** Include local, Vercel, and CI-safe usage notes without asking them to paste secrets into chat.

## Files Likely To Change

New:

- `scripts/production-preflight.mjs` — credential-safe readiness report for production deployment.
- Optional: `docs/deployment-preflight.md` — operator runbook with env groups, provider checks, and next deployment steps.

Modified:

- `package.json` — add a script such as `production:preflight`.
- `README.md` — add the command to Operations / production readiness.
- `docs/production-readiness.md` — link the preflight command and clarify what remains manual.
- Optional: `.env.example` — add only non-secret acknowledgement variables if the implementation needs explicit manual-check attestations. Do not add feature flags or gate bypasses.
- Optional: `scripts/ai-stack-scale-review.mjs` — only if extracting shared formatting/helpers is genuinely cleaner than duplicating small report utilities.

Do not modify `.github/workflows/ci.yml` unless the implementation adds a deliberately fake, non-production profile that proves the script itself runs without real credentials.

## Implementation Requirements

### Preflight Script

- Add `scripts/production-preflight.mjs`.
- Add `npm run production:preflight`.
- Keep it Node-only, dependency-light, and runnable without network access.
- Use only `process.env`, source constants, local file existence, and local executable checks.
- Never read `.env.local` directly; let the operator load env in the normal shell or Vercel environment.
- Never print raw environment values. Show:
  - variable name;
  - status such as `present`, `missing`, `blank`, `invalid shape`, `fake-looking`, `manual check required`;
  - short remediation text.
- Exit with nonzero status when production-critical checks fail.
- Exit zero when all blockers are clear, even if non-critical capability notes remain.
- Produce a compact report grouped by:
  - core app / Auth.js;
  - Supabase / Prisma;
  - Gemini / AI governance;
  - ingestion / Uploadthing;
  - Inngest jobs;
  - email / Resend;
  - exports / Google Drive / Pandoc;
  - WhatsApp Cloud API;
  - USSD;
  - Sentry;
  - PostHog;
  - Vercel deployment account manual checks.
- Include a final summary with counts for blockers, warnings, and configured capability checks.

### Required Production Blockers

At minimum, fail for:

- missing or fake-looking `AUTH_SECRET`;
- missing or non-HTTPS `AUTH_URL` when `NODE_ENV=production`;
- missing `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`;
- missing or non-Tropenbos `AUTH_ALLOWED_DOMAIN`;
- missing `DATABASE_URL` / `DIRECT_URL`;
- `DATABASE_URL` / `DIRECT_URL` that look like CI fake credentials;
- missing `GOOGLE_GENERATIVE_AI_API_KEY`;
- missing `UPLOADTHING_TOKEN`;
- missing `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`;
- missing `RESEND_API_KEY` / `DIGEST_FROM_EMAIL`;
- missing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` if browser-side Supabase upload or storage paths require them;
- missing explicit operator acknowledgement that the deployment is not on Vercel Hobby for Tropenbos production, if using an acknowledgement variable is the chosen approach.

Use conservative shape checks only. Do not encode brittle provider-specific secret prefixes unless already documented in `.env.example` or local config.

### Capability Checks

Report but do not necessarily fail for:

- Google Docs export:
  - configured only when Google OAuth vars are present and `DRIVE_TOKEN_ENCRYPTION_KEY` is present with a plausible 32-byte base64 shape;
  - warn if OAuth vars are present but Drive encryption is missing.
- PDF export:
  - configured only when `PANDOC_BIN` is present and executable locally;
  - warn that Vercel does not ship Pandoc by default.
- WhatsApp:
  - configured only when token, phone number id, webhook secret, and verify token are present;
  - warn if only some are present.
- USSD:
  - configured only when `AFRICASTALKING_USSD_SECRET` and `USSD_SERVICE_CODE` are present;
  - warn if `USSD_SERVICE_CODE` appears to have lost its trailing `#` due to unquoted dotenv syntax.
- Africa's Talking outbound credentials:
  - report as future outbound capability, not required for inbound USSD callback.
- Sentry:
  - server/browser DSN presence, source-map upload token presence, and the existing opt-in upload behaviour;
  - warn but do not fail if Sentry is absent unless production policy decides it is mandatory.
- PostHog:
  - configured only when both `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` are present;
  - warn if key is present without self-hosted host, because there is no PostHog Cloud fallback.
- Slack webhook:
  - optional signal digest destination; warn only if half-configured.

### Governance and Privacy

- State in the report that the preflight does not inspect evidence rows, brief prose, prompts, completions, translations, search queries, stakeholder notes, or field observations.
- Do not log evidence text, policy document text, prompts, completions, field observations, stakeholder notes, secret values, or token fragments.
- Do not add a flag or env var that disables `lib/governance/gate.ts`.
- Do not add any branch that changes AI eligibility based on paid Gemini, Vertex AI, `NODE_ENV`, operator acknowledgement, or production deployment status.
- Do not contact Gemini to validate the API key.

### Vercel Readiness

- Detect local Vercel linkage only by reading `.vercel/project.json` or `.vercel/repo.json` if present.
- Do not run `vercel link`, `vercel project inspect`, `vercel ls`, `vercel deploy`, or any CLI command that could prompt, mutate, or require network.
- If `.vercel/` is absent, report that the project is not locally linked and link/deploy should happen later through an explicit deployment prompt.
- If `.vercel/` is present, report only linked/unlinked state and file type, not raw org/project IDs.
- Document that the later deployment should use preview first unless the user explicitly asks for production.

### Documentation

- Update `README.md` with:
  - `npm run production:preflight`;
  - what it checks;
  - that it does not contact providers or print secrets;
  - that it is not a deployment.
- Update `docs/production-readiness.md` or add `docs/deployment-preflight.md` with:
  - how to run the command locally with production env loaded;
  - how to interpret blockers and warnings;
  - what remains manual in AI Studio, Supabase, Vercel, Resend, Google OAuth/Drive, WhatsApp, USSD, Sentry, PostHog, Uploadthing, Inngest, and Pandoc;
  - explicit reminder that Vercel Hobby is not Tropenbos production;
  - explicit reminder that only `public_published` evidence may reach Gemini.

## Evidence Classification Impact

None — no evidence data path.

This task creates a production readiness script and documentation. It must not read, write, move, transmit, seed, import, query, or export `EvidenceItem`, `EvidenceChunk`, field submissions, brief versions, stakeholder notes, policy documents, prompts, completions, translations, hallucination-guard claim text, or search queries.

Classifications involved:

- `public_published`
- `community_sourced`
- `unpublished_internal`

Enforcement point:

- No new AI-layer entry point is added.
- Existing enforcement remains in `lib/governance/gate.ts`, specifically `partitionByClassification` for AI-layer candidate partitioning and `ELIGIBLE_EVIDENCE_WHERE` for retrieval filtering.
- The preflight may report that the gate exists and must remain hard, but it must not change eligibility or add a bypass.

Blocked items:

- `community_sourced` and `unpublished_internal` evidence remain blocked by existing code.
- The preflight must not inspect or print any blocked item text. If it ever reports governance status, it may mention only the classification names and the code-level enforcement module.

## Hallucination-Guard Implications

None.

This task does not change brief generation, claim extraction, fact-checking, flag persistence, flag rendering, flag dismissal, or Programme Director approval blocking. Existing unresolved flags continue to block approval server-side. The preflight must not read or render hallucination-guard claim text.

## Security Requirements

- Never print secret values or token prefixes.
- Never write `.env*`, generated credentials, Vercel project ids, provider keys, or account metadata to git.
- Do not load `.env.local` automatically.
- Do not contact third-party providers.
- Do not add a deployment command, migration command, seed command, or cloud mutation command.
- Do not upload Sentry source maps or initialise Sentry/PostHog from the script.
- Do not add telemetry, analytics events, or crash reporting for the preflight output.
- Keep all diagnostics evidence-safe: names, statuses, counts, and remediation only.
- Preserve all existing fail-closed runtime behaviour when optional providers are absent.
- Do not introduce any feature flag, env var, or development branch that bypasses evidence governance, authentication, role checks, webhook verification, or USSD callback access control.

## Acceptance Criteria

1. `npm run production:preflight` exists and runs locally without network access.
2. The preflight exits nonzero for missing production-critical env shape and zero when blockers are satisfied.
3. The preflight never prints raw secret values, token prefixes, connection strings, Vercel project IDs, evidence text, prompts, completions, or field observations.
4. The report clearly separates blockers from warnings / capability notes.
5. Vercel linkage detection reads only `.vercel/project.json` or `.vercel/repo.json` and performs no CLI/network action.
6. The report includes the Vercel Hobby production warning.
7. The report includes the evidence-governance reminder without changing the gate.
8. Optional providers such as PDF/Pandoc, Google Docs export, Sentry, PostHog, WhatsApp, USSD, and Slack are reported accurately as configured, not configured, or partially configured.
9. Existing CI remains credential-free and does not require production secrets.
10. Documentation explains how to run and interpret the preflight and states it is not a deployment.
11. Local checks pass after implementation: `npm run lint`, `npm run typecheck`, `npm run scale:review`, `npm run production:preflight` in a safe missing-env mode, and `npm run build`.

## Checks To Run

- `npm run lint`
- `npm run typecheck`
- `npm run scale:review`
- `npm run production:preflight`
- `npm run build`

Do not run `npm run db:migrate`; this task has no migration.

## Manual Test Steps

After implementation:

1. Run `npm run production:preflight` with no production env loaded and confirm it reports blockers without printing secret-looking values.
2. Run `AUTH_SECRET=test-secret-do-not-use-in-production AUTH_URL=http://127.0.0.1:3000 DATABASE_URL=postgresql://evibrief_test:evibrief_test@127.0.0.1:5432/evibrief_test DIRECT_URL=postgresql://evibrief_test:evibrief_test@127.0.0.1:5432/evibrief_test npm run production:preflight` and confirm fake/local values are flagged.
3. Run with plausible placeholder production-shaped values in the shell, using only fake non-secret strings, and confirm blocker counts drop while no raw values are printed.
4. Temporarily create no `.vercel/` files and confirm the report says the project is not locally linked.
5. If `.vercel/project.json` or `.vercel/repo.json` exists locally, confirm the report says linked without printing project or org IDs.
6. Review `README.md` and production readiness docs to confirm they say the command does not deploy, contact providers, run migrations, seed data, or weaken the evidence-governance gate.
