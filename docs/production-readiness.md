# EviBrief production readiness

## What CI proves

The GitHub Actions workflow runs the repository's credential-free checks on pushes and pull requests for `main`:

- `npm run lint`
- `npm run typecheck`
- `npm run scale:review`
- `npm run build`
- `npm run test`

The workflow uses fake local environment values only. It does not load `.env.local`, read production data, call Gemini, connect to Supabase, send email, upload files, trigger Inngest events, deliver WhatsApp or USSD messages, upload Sentry source maps, send PostHog events, run database migrations, seed data, or deploy to Vercel.

## What still needs account verification

Before production deployment, verify the current external account state:

- Google AI Studio model quotas, billing tier, and grounded-search availability.
- Supabase database size, activity state, backups, logs, and pgvector index health.
- Vercel plan, commercial eligibility, function duration, Fluid Compute state, runtime logs, and usage.
- Resend domain authentication, sending limits, suppression handling, and digest deliverability.
- Google OAuth consent, Tropenbos Workspace domain restriction, and Google Drive export access.
- WhatsApp Cloud API phone number, webhook verification, template approval, and rate limits.
- USSD gateway credentials, callback URLs, and fail-closed behaviour.
- Sentry DSNs, source-map upload choice, and evidence-safe redaction.
- PostHog self-hosted host/key, explicit event allowlist, and disabled autocapture/session replay.
- Uploadthing project credentials, file limits, and retention posture.
- Inngest production signing/event keys, function registration, and schedule ownership.
- Pandoc and PDF engine availability on the host before enabling PDF export.

Vercel Hobby is not the Tropenbos production plan. Use Pro, Enterprise, or an explicitly approved alternative before treating the deployment as production.

## Production deployment preflight

After loading production-shaped environment variables in the local shell or a trusted operator environment, run:

```bash
npm run production:preflight
```

The preflight is a local, credential-safe readiness report. It checks environment-variable presence and conservative shapes, optional provider capability posture, local Pandoc executability, evidence-governance reminders, and local Vercel linkage files. It does not load `.env.local` automatically, contact Gemini, Supabase, Vercel, Resend, Google, Uploadthing, Inngest, WhatsApp, Africa's Talking, Sentry, PostHog, or Slack. It does not deploy, run migrations, seed data, upload files, send messages, upload source maps, or create cloud resources.

The report separates:

- `BLOCKER` rows: production-critical missing, fake-looking, local-looking, or invalid values. The command exits nonzero while any blocker remains.
- `WARN` rows: optional capabilities, partial provider setup, manual account checks, or host constraints.
- `OK` rows: configured checks by name only.

The command never prints secret values, token prefixes, connection strings, Vercel project IDs, evidence body text, policy document text, prompts, completions, translations, search queries, stakeholder notes, or field observations.

Set `EVIBRIEF_VERCEL_PRODUCTION_PLAN_ACK=non_hobby` only after confirming the Tropenbos production deployment will not run on Vercel Hobby. This acknowledgement is not a runtime feature flag and does not bypass authentication, role checks, webhook verification, USSD access control, or the evidence-governance gate.

Provider checks are intentionally local:

- AI Studio: the command requires `GOOGLE_GENERATIVE_AI_API_KEY` shape/presence only; operators still verify quotas, billing tier, and grounded-search availability in Google.
- Supabase: the command checks database URL presence/shape only; operators still verify project size, backups, activity state, logs, pgvector indexes, and production credentials.
- Vercel: the command only reads `.vercel/project.json` or `.vercel/repo.json` if present and hides IDs; linking and deployment happen later through an explicit deployment prompt. Use a preview deployment first unless production is explicitly requested.
- Resend: the command checks API key and sender presence/shape only; operators still verify domain authentication, suppression handling, sending limits, and digest deliverability.
- Google OAuth/Drive: Google Docs export is reported configured only when OAuth variables and a plausible 32-byte base64 `DRIVE_TOKEN_ENCRYPTION_KEY` are present; operators still verify consent, redirect URIs, and Drive scope posture.
- WhatsApp: the command reports Cloud API credentials and webhook secrets as configured, partial, or absent; operators still verify phone number ownership, webhook subscription, templates, and rate limits.
- USSD: the command reports inbound callback secrets and warns when `USSD_SERVICE_CODE` appears to have lost its trailing `#`; operators still verify callback registration and gateway behaviour.
- Sentry: the command reports DSNs and opt-in source-map upload token presence; operators still verify evidence-safe redaction and project settings.
- PostHog: the command requires both key and self-hosted host for configured status; there is no PostHog Cloud fallback.
- Uploadthing and Inngest: the command checks credential presence only; operators still verify project limits, retention, function registration, and schedule ownership.
- Pandoc: PDF export is configured only when `PANDOC_BIN` is present and executable locally. Vercel does not ship Pandoc by default, so PDF export needs a host decision before production use.

## Governance

The evidence-governance gate remains hard. Only `public_published` evidence is eligible for AI calls; `community_sourced` and `unpublished_internal` evidence must not reach Gemini for embedding, summarisation, classification, generation, regeneration, audience switching, translation assist, or hallucination-guard fact-checking.

CI artifacts must not contain evidence body text, brief prose, prompts, completions, translations, search queries, stakeholder notes, field observations, or secret values.

Use the quarterly operations runbook for the full review process: [docs/ai-stack-scale-review.md](ai-stack-scale-review.md).
