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

## Governance

The evidence-governance gate remains hard. Only `public_published` evidence is eligible for AI calls; `community_sourced` and `unpublished_internal` evidence must not reach Gemini for embedding, summarisation, classification, generation, regeneration, audience switching, translation assist, or hallucination-guard fact-checking.

CI artifacts must not contain evidence body text, brief prose, prompts, completions, translations, search queries, stakeholder notes, field observations, or secret values.

Use the quarterly operations runbook for the full review process: [docs/ai-stack-scale-review.md](ai-stack-scale-review.md).
