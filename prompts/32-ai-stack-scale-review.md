# 32 — AI stack scale review and free-tier readiness

## Goal

Implement the Phase 4 **AI stack scale review** named in the product spec: an auditable, repeatable operations check that tells Tropenbos whether the current free-tier posture still fits the application's actual pipeline shape.

This is not a new product module and not a usage dashboard. The goal is a small, maintainable readiness artifact that:

- summarises the current Gemini, Supabase, and Vercel constraints that matter to EviBrief;
- derives EviBrief's worst-case Gemini request envelope from the constants already in `lib/ai/config.ts`;
- documents the decision rule for staying on Gemini free tier versus moving to paid Gemini / Vertex AI;
- preserves the hard evidence-governance rule: moving tiers is a deliberate governance decision, never an env flag and never a code bypass;
- gives an operator exact manual checks to run in Google AI Studio, Supabase, Vercel, and the local repository before deployment or quarterly review.

## Skills read

- `evidence-governance` (project) — confirms the scale review must not add a bypass, paid-tier branch, development override, or anticipatory gate-lifting flag. Only `public_published` evidence remains AI-eligible until `AGENTS.md` and this skill are deliberately changed.
- `gemini-integration` (project) — central Gemini model IDs, request budgets, batch sizes, RPM allocations, rate-limit handling, and the requirement that every AI limit remains centralised in `lib/ai/config.ts`.

No vendor skill was needed to write this prompt. During implementation, verify current vendor limits against official docs rather than memorised values:

- Gemini API rate limits and pricing: `https://ai.google.dev/gemini-api/docs/rate-limits` and `https://ai.google.dev/gemini-api/docs/pricing`
- Supabase database size / pricing: `https://supabase.com/docs/guides/platform/database-size` and `https://supabase.com/pricing`
- Vercel plans / Hobby restrictions: `https://vercel.com/docs/plans/hobby`, `https://vercel.com/docs/limits/fair-use-guidelines`, and `https://vercel.com/pricing`

## Existing code inspected

- `AGENTS.md` — workflow, governance gate, free-tier graduation trigger, environment requirements, and checks.
- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — Phase 4 roadmap item: "AI stack scale review"; free-tier risk and graduation notes in spec §§6.1, 7, and 9.
- `prompts/01-31` — confirms all main product build-list items now have prompt coverage and recent commits, so the remaining spec item is operational rather than another user-facing module.
- `git log --oneline --decorate -20` — confirms committed work through Sentry and PostHog observability, plus the product modules that precede this review.
- `package.json` — available scripts and dependencies; no scale-review script exists.
- `.env.example` — canonical environment list; no real secrets; PostHog, Sentry, Pandoc, Gemini, Supabase, Inngest, Resend, WhatsApp, USSD, Uploadthing, Auth.js, and Google Drive variables are documented.
- `README.md` — still default create-next-app text; no project-specific operations or deployment guidance.
- `docs/skills-install.md` — vendor skill installation notes; useful context but not an operations runbook.
- `lib/ai/config.ts` — central source for Gemini model IDs, budgets, batch sizes, source caps, per-module RPM allocations, radar/matcher/impact request-envelope constants, and the explicit free-tier design assumptions.
- `lib/briefs/generation-limits.ts` — client-visible generation context and pasted-policy limits.
- `lib/observability/sentry-options.ts`, `lib/observability/posthog-config.ts`, `lib/observability/scrub.ts` — optional observability posture and evidence-safe redaction precedent.
- `lib/db/client.ts` — database connection env handling and server-only expectations.
- `.env.example`, `app/api/inngest/route.ts`, `lib/jobs/client.ts` — deployment-sensitive keys and Inngest production/dev split.

## Decisions and assumptions

1. **The next scope is an operations/readiness artifact.** The core product list is represented in committed code. The spec's remaining unbuilt item is the Phase 4 scale review, which should be concrete enough to run, but should not create a new app area or admin dashboard.
2. **No live account calls in the local script.** The script should not call Gemini, Supabase Management API, Vercel API, PostHog, or Sentry. It reads local code/config only and prints manual checks for account-specific numbers.
3. **No secrets printed.** The script may report whether an env var is present, never its value. URL hostnames may be shown only when safe and useful; query strings and credentials are never printed.
4. **Current vendor limits must be rechecked during implementation.** The prompt may name official URLs, but the implementation should not hard-code volatile price or rate-limit values as permanent truth without noting "verified on <date>".
5. **The review is a decision aid, not automatic enforcement.** It must not auto-disable jobs, change model IDs, lift the classification gate, alter throttles, or mutate environment variables.
6. **Vercel Hobby is not suitable for Tropenbos production.** Official Vercel docs restrict Hobby to personal/non-commercial use. The review should call this out plainly and point production toward Pro or an explicitly approved alternative.
7. **Supabase Free remains a capacity risk.** The review should track the 500 MB database-size threshold and 1-week inactivity pause from official Supabase docs, but it should not connect to the database unless a later prompt adds a safe aggregate-only check.
8. **Gemini free-tier governance does not change because volume changes.** If usage outgrows free tier, the operational recommendation may be "move to paid Gemini / Vertex AI and update governance documents deliberately"; code must still block ineligible evidence until that separate governance change is approved.

## Files likely to change

**New**

- `docs/ai-stack-scale-review.md` — the human-readable runbook and current review record: what to check, thresholds, decision rules, and what must be updated if the AI tier changes.
- `scripts/ai-stack-scale-review.mjs` — local, no-network command that reads safe constants from source files and prints a readiness report.

**Modified**

- `package.json` — add `scale:review` script, e.g. `node scripts/ai-stack-scale-review.mjs`.
- `README.md` — replace the default create-next-app deployment section with a short EviBrief operations section linking to the scale review, environment setup, and required checks.
- `AGENTS.md` §19 — add the new `npm run scale:review` command and clarify it is a local readiness estimate, not a substitute for account dashboards.
- Optional: `.env.example` comments only if a missing operational note becomes obvious. Do not add new env vars unless a real implementation need appears.

## Implementation requirements

### Documentation

- Create `docs/ai-stack-scale-review.md` with:
  - purpose and scope;
  - "verified on <implementation date>" vendor-limit notes for Gemini, Supabase, and Vercel, with official links;
  - current EviBrief AI consumers: evidence embedding, radar classification + signal embedding, grounded radar search, matcher rerank, brief generation, hallucination guard, audience switcher, translation assist, and impact detection;
  - what each consumer costs in request terms using the existing constants in `lib/ai/config.ts`;
  - expected free-tier bottlenecks: RPM, daily Gemini requests, Supabase database size, Supabase inactivity pause, Vercel Hobby commercial restriction, Vercel function duration, and missing Pandoc on Vercel;
  - decision table: stay on current posture / reduce throughput / upgrade hosting/database / move AI tier and update governance;
  - governance rule: no gate-lifting flag, no paid-tier branch, no community-sourced or unpublished internal evidence sent to Gemini until `AGENTS.md` and `evidence-governance` are explicitly amended;
  - exact quarterly review checklist.

### Local script

- Add `scripts/ai-stack-scale-review.mjs`.
- The script must run with plain Node and no new dependency.
- It must not import TypeScript modules directly unless that works under the existing runtime. Prefer reading source files and extracting named numeric/string constants from `lib/ai/config.ts` with narrow, named patterns. Fail with a clear message if a required constant is missing rather than silently assuming a value.
- It should print:
  - model IDs and embedding dimensions from `lib/ai/config.ts`;
  - Gemini request budgets from `lib/ai/config.ts`;
  - per-module RPM allocations and derived run-start limits;
  - radar worst-case requests per source run;
  - matcher request envelope per run;
  - impact weekly request envelope;
  - embedding sweep/batch sizing assumptions;
  - which required env vars are present/missing by category, with values masked;
  - an explicit "manual checks still required" section for Google AI Studio quotas, Supabase database size, Supabase inactivity status, Vercel plan, and actual production traffic.
- It must not:
  - call external services;
  - call Gemini;
  - connect to the database;
  - print secret values;
  - print evidence text, brief text, prompts, completions, document titles, stakeholder data, field observations, or search queries;
  - mutate files, env vars, or database rows.

### README and AGENTS updates

- Replace the generic Next.js README sections with concise EviBrief-specific setup:
  - `npm install`;
  - copy `.env.example` to `.env.local`;
  - `npm run db:generate`;
  - `npm run dev`;
  - checks: `npm run lint`, `npm run typecheck`, `npm run build`;
  - operations: `npm run scale:review`;
  - link to `docs/ai-stack-scale-review.md`.
- Add the scale-review script to `AGENTS.md` §19 alongside existing commands, with the same direct operational style.
- Do not rewrite unrelated AGENTS content.

## Evidence classification impact

None — no evidence data path.

This task reads local source constants, package metadata, documentation, and environment variable presence only. It does not read evidence rows, evidence chunks, uploaded documents, field submissions, policy brief bodies, prompts, completions, translations, stakeholder records, or search queries. It does not add a Gemini call, embedding path, retrieval path, export path, telemetry path, or database mutation.

If implementation expands the script to inspect production data, stop and re-scope: any database query must be aggregate-only, must not read body text/title/prose fields, and must be recorded in this prompt before execution.

## Hallucination-guard implications

None. This task does not change what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks.

The runbook should restate that moving AI tiers does not automatically change the hallucination-guard contract: every generated brief still requires the post-generation fact-check pass before persistence, and unresolved flags still block Programme Director approval server-side.

## Security requirements

- Never print or commit real secrets.
- Mask env var values as `set` / `missing`; do not show raw values.
- Do not call external APIs from the scale-review script.
- Do not connect to the database from the scale-review script.
- Do not add any browser code.
- Do not add a paid-tier switch, governance bypass, `FORCE_PUBLIC`, `ALLOW_INTERNAL_AI`, or similar env flag.
- Do not send repository content to an external setup wizard.
- Keep all new docs ASCII unless a quoted official product name requires otherwise.
- Keep the script deterministic and side-effect free.

## Acceptance criteria

1. `npm run scale:review` exists and runs with plain Node.
2. The command prints a readable local readiness report using values derived from `lib/ai/config.ts`, not copied by hand.
3. The command exits non-zero with a clear message if a required source constant cannot be found.
4. The command does not call the network, call Gemini, connect to the database, or mutate files.
5. The command masks all environment variable values.
6. `docs/ai-stack-scale-review.md` exists and includes vendor-limit notes, official links, EviBrief request-envelope analysis, governance decision rules, and quarterly manual check steps.
7. The documentation explicitly states that Vercel Hobby is personal/non-commercial only and is not the production plan for Tropenbos deployment.
8. The documentation explicitly states that Supabase Free's 500 MB database-size threshold and inactivity pause must be reviewed before production use.
9. The documentation explicitly states that Gemini free-tier content-use terms are the reason the classification gate remains hard, and that moving to paid Gemini / Vertex AI requires an explicit governance-doc update before any data eligibility changes.
10. `README.md` is EviBrief-specific and links to the scale-review runbook.
11. `AGENTS.md` §19 documents the new command.
12. `npm run lint`, `npm run typecheck`, and `npm run build` run. Report exact output, including known pre-existing lint noise if it remains.

## Checks to run

- `npm run scale:review`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

No database migration is expected. Do not run `prisma migrate dev`.

## Manual test steps

1. Run `npm run scale:review` with no `.env.local`. Confirm it reports missing variables without throwing and without printing values.
2. Set a harmless local variable such as `GOOGLE_GENERATIVE_AI_API_KEY=fake` and rerun the command. Confirm it says the variable is set but does not print `fake`.
3. Temporarily rename one required constant in a scratch copy or by editing then reverting immediately before commit. Confirm the script fails clearly when a required constant is absent. Do not leave the rename in the final change.
4. Open `docs/ai-stack-scale-review.md` and confirm the quarterly checklist can be followed without repository context.
5. Confirm the README no longer instructs Tropenbos operators to edit `app/page.tsx` or deploy as a generic create-next-app project.
6. Confirm no new code path sends data to Gemini, PostHog, Sentry, Supabase, Vercel, or any other third party.

## Not in scope

- Deploying to Vercel.
- Querying live Supabase usage through the Management API.
- Querying Google AI Studio quotas programmatically.
- Querying Vercel usage programmatically.
- Changing Gemini model IDs, rate limits, throttles, or job cadences.
- Moving to paid Gemini, Vertex AI, paid Supabase, or Vercel Pro.
- Changing the evidence classification gate.
- Building an in-app operations dashboard or admin panel.
- Adding telemetry events.
- Adding a test framework.
