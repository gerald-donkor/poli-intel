# 38 — Vercel preview deployment

## Goal

Create the first Vercel preview deployment for EviBrief, using the production-readiness guardrails already committed in prompt 37 and the Vercel deployment workflow from the `deploy-to-vercel` skill.

This is next because prompts 1-37 have committed the product surface, governance gate, exports, observability, CI checks, and production preflight. The remaining unblocking step is to prove the app can be linked and built by Vercel as a preview deployment without treating that preview as Tropenbos production.

This task must not create a production deployment unless the user explicitly changes the request to production. It must not weaken evidence governance, bypass authentication, run database migrations without explicit approval, seed data, contact Gemini with real evidence, send email, send WhatsApp/USSD messages, upload files, upload Sentry source maps unless the deployment environment already opts in, or push to git without explicit approval.

## Skills Read

- `deploy-to-vercel` — always deploy as preview unless production is explicitly requested; gather git remote, local Vercel link state, CLI authentication, and teams before choosing a method; `.vercel/project.json` or `.vercel/repo.json` means linked; do not use `vercel project inspect`, `vercel ls`, or `vercel link` merely to detect state in an unlinked directory; ask before git push; use `--scope` when a team is selected.

No project AI skills are required for deployment execution because this prompt adds no AI-layer entry point and no evidence data path. The standing evidence-governance rules in `AGENTS.md` still apply.

## Existing Code Inspected

- `AGENTS.md` — prompt workflow, commit requirement after executed prompts, production checks, Vercel/Supabase stack, evidence governance, Auth.js domain restriction, and command/check expectations.
- `git log --oneline -30` — confirms prompts 1-37 were implemented and committed on `main`, ending with `Add production deployment preflight`.
- `git status --short` — clean worktree at prompt-writing time.
- `prompts/37-production-deployment-preflight.md` — states deployment should be a later explicit deployment prompt after preflight exists.
- `docs/production-readiness.md` — documents what CI proves, what remains account-specific, and how `npm run production:preflight` separates blockers and warnings.
- `scripts/production-preflight.mjs` — local, credential-safe production env shape check with no provider calls and no secret printing.
- `README.md` — local setup, CI, operations commands, and production readiness references.
- `package.json` — deployment-relevant scripts: `lint`, `typecheck`, `scale:review`, `production:preflight`, `build`, `test`, and `db:migrate`.
- `.env.example` — canonical provider/env list including the non-Hobby production acknowledgement; no secrets are committed.
- `next.config.ts` — Sentry source-map upload is opt-in on `SENTRY_AUTH_TOKEN` and build stays silent when unconfigured.
- `.vercel/` — absent at prompt-writing time, so the project is not locally linked yet.

## Decisions and Assumptions

1. **Preview first.** The implementation should create a preview deployment only. A production deployment needs a separate explicit user request.
2. **No deployment by git push from `main` unless explicitly approved.** Because this repo is on `main`, pushing may trigger production in Vercel if the project is linked to the production branch. Prefer CLI preview deployment for this first run unless the verified Vercel setup proves git push will create only a preview.
3. **Gather state before mutating.** Run the four deployment state checks from the skill before linking or deploying:
   - `git remote get-url origin`
   - local `.vercel/project.json` or `.vercel/repo.json` read
   - `vercel whoami`
   - `vercel teams list --format json`
4. **Team selection is allowed only when needed.** If multiple teams are available and the project is unlinked, present the team slugs and ask which one to use. If linked, use the linked org. If only one team or personal account is available, proceed with that scope.
5. **Linking is a real cloud/local mutation.** If unlinked and authenticated, link with the selected scope. Use `vercel link --repo --scope <team-slug>` when the git remote exists; otherwise use `vercel link --scope <team-slug>`.
6. **No-auth fallback is acceptable only if normal CLI deployment is blocked.** If `vercel` is missing or unauthenticated, use the Codex fallback from the installed skill only after the normal CLI path is impossible. Report both preview and claim URLs if fallback succeeds.
7. **Checks precede deploy.** Run local checks before deployment so Vercel is not asked to build a known-broken tree.
8. **Production preflight is advisory for preview.** Run `npm run production:preflight` and report blockers, but do not require all production blockers to be cleared for a preview deployment. A preview may intentionally use missing production providers, as long as fail-closed runtime behaviour is preserved.
9. **No secret handling in chat.** Do not ask the user to paste secrets. Use environment variables already present in the shell, Vercel dashboard/project settings, or user-managed Vercel linking flows.
10. **Commit only repository changes.** If execution creates or updates intentional repository files, commit them. Do not commit `.vercel/`, `.env*`, build output, generated Prisma client, deployment URLs as secrets, or provider metadata.

## Files Likely To Change

Likely none beyond this prompt file.

Possible, only if needed to make deployment safe or understandable:

- `README.md` — add a short preview deployment note if the actual deployment workflow reveals an operator step worth preserving.
- `docs/production-readiness.md` — clarify preview vs production deployment behaviour if Vercel account state exposes a project-specific caveat.

Do not modify application code merely to satisfy provider configuration that belongs in Vercel environment variables.

## Implementation Requirements

### Pre-Deployment Checks

- Re-read this prompt before executing.
- Confirm the current branch and worktree state:
  - `git branch --show-current`
  - `git status --short`
- If the worktree contains unrelated user changes, do not overwrite or revert them. If they affect deployment, pause and explain the conflict.
- Run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run scale:review`
  - `npm run production:preflight`
  - `npm run build`
  - `npm run test`
- Report exact command output in the final answer, including known lint noise if it appears.
- Do not run `npm run db:migrate` unless the user explicitly asks to apply database migrations to a target environment.

### Vercel State Gathering

- Run the state checks required by `deploy-to-vercel`:
  - `git remote get-url origin`
  - `cat .vercel/project.json` or `cat .vercel/repo.json` only if present
  - `vercel whoami`
  - `vercel teams list --format json`
- Do not use `vercel project inspect`, `vercel ls`, or `vercel link` to detect state in an unlinked directory.
- Never print raw Vercel project IDs, org IDs, tokens, or environment values in the final answer.

### Deployment Method

- If the project is linked and CLI-authenticated, run a CLI preview deployment:
  - `vercel deploy . -y --no-wait`
  - include `--scope <team-slug>` when the linked or selected team requires it.
- If the project is unlinked and CLI-authenticated:
  - choose the team according to the skill's team-selection rules;
  - link using `vercel link --repo --scope <team-slug>` when a git remote exists;
  - otherwise link using `vercel link --scope <team-slug>`;
  - then run `vercel deploy . -y --no-wait --scope <team-slug>`.
- If the CLI is unavailable or unauthenticated and cannot be made available in the sandbox, use the Codex no-auth fallback from the installed skill path and return both preview and claim URLs.
- Do not run `vercel deploy --prod`.
- Do not push to git unless the user explicitly approves a push after being told it may trigger Vercel's configured branch deployment behaviour.

### Deployment Verification

- Capture the preview URL returned by Vercel.
- Inspect deployment status with `vercel inspect <deployment-url>` when the CLI path was used and authentication allows it.
- If inspect is unavailable, report the preview URL and say status should be checked in the Vercel dashboard or claim URL flow.
- Do not test authenticated product workflows against production data unless the user provides a safe preview account setup.
- If practical, use unauthenticated public route checks against the preview URL only:
  - `/signin` should render the Google Workspace-only sign-in surface.
  - protected app routes should redirect to sign-in or fail closed.
  - webhook/callback routes should fail closed without valid secrets.

## Evidence Classification Impact

None — no evidence data path.

This task deploys the existing application build as a preview and may run credential-free local checks. It must not read, write, move, transmit, seed, import, query, export, or print `EvidenceItem`, `EvidenceChunk`, field submissions, brief versions, stakeholder notes, policy document text, prompts, completions, translations, hallucination-guard claim text, or search queries.

Classifications involved:

- `public_published`
- `community_sourced`
- `unpublished_internal`

Enforcement point:

- Existing enforcement remains in `lib/governance/gate.ts`, specifically `partitionByClassification` for AI-layer candidate partitioning and `ELIGIBLE_EVIDENCE_WHERE` for retrieval filtering.
- Deployment must not add an environment variable, feature flag, branch, or production mode that bypasses this gate.

Blocked items:

- `community_sourced` and `unpublished_internal` evidence remain blocked from Gemini by existing code.
- Deployment logs, Vercel build logs, Sentry events, PostHog events, and final output must not include evidence body text or blocked item details.

## Hallucination-Guard Implications

None.

This task does not change brief generation, claim extraction, fact-checking, flag persistence, flag rendering, flag dismissal, export gating, or Programme Director approval blocking. Existing unresolved flags continue to block approval server-side, and deployment must not introduce a bypass.

## Security Requirements

- Do not print secret values, token prefixes, connection strings, Vercel project IDs, Vercel org IDs, OAuth client secrets, Supabase keys, or environment variable values.
- Do not commit `.env*`, `.vercel/`, generated Prisma client output, `.next/`, provider metadata, or deployment credentials.
- Do not run production migrations, seed data, or mutate provider resources other than Vercel project linking/deployment required by the approved preview workflow.
- Do not contact Gemini, Resend, WhatsApp, USSD, Uploadthing, Sentry, PostHog, or Supabase with real production operations as part of preview smoke testing.
- Preserve fail-closed behaviour for missing optional providers.
- Use preview deployment by default; production deployment requires a new explicit request.
- Ask before any git push.
- Use sandbox escalation only for commands whose network access is required and blocked by the sandbox.

## Acceptance Criteria

1. Local checks are run and their exact results are reported.
2. Vercel project state is gathered using the safe commands from `deploy-to-vercel`.
3. If the project is unlinked and authenticated, it is linked to the correct team/project through the approved Vercel CLI flow.
4. A preview deployment is created, or a clear blocker is reported with the next required operator action.
5. No production deployment is created unless the user explicitly changes the request.
6. No git push happens without explicit approval.
7. No secrets, evidence text, prompts, completions, translations, field observations, stakeholder notes, Vercel IDs, or connection strings are printed or committed.
8. The preview deployment URL is reported when deployment succeeds.
9. Deployment status is inspected when possible and reported.
10. Any repository changes made during execution are committed to `main`; `.vercel/` and secret-bearing files remain uncommitted.

## Checks To Run

- `npm run lint`
- `npm run typecheck`
- `npm run scale:review`
- `npm run production:preflight`
- `npm run build`
- `npm run test`

Do not run `npm run db:migrate` unless the user explicitly asks for environment migrations.

## Manual Test Steps

After implementation:

1. Open the preview URL returned by Vercel.
2. Visit `/signin` and confirm the Google Workspace sign-in surface appears.
3. Visit `/evidence`, `/signals`, and `/briefs` while signed out and confirm protected routes fail closed by redirecting to sign-in.
4. If a safe Tropenbos preview account and preview database are configured, sign in and verify the main navigation loads without provider-secret errors.
5. Run `npm run production:preflight` locally with the intended production environment loaded before any later production deployment request.
6. Treat the preview as non-production until the account checks in `docs/production-readiness.md` are complete and `EVIBRIEF_VERCEL_PRODUCTION_PLAN_ACK=non_hobby` has been set only after a real non-Hobby production plan decision.
