# EviBrief

EviBrief is the Policy Intelligence and Brief Generator module for Tropenbos Ghana. It monitors forest-policy signals, matches them to classified evidence, and helps staff draft traceable policy briefs for human review.

## Local setup

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Generate the Prisma client:

```bash
npm run db:generate
```

Start the development server:

```bash
npm run dev
```

Open <http://localhost:3000>.

## Checks

Run the standard local checks before committing implementation work:

```bash
npm run playwright:install
npm run test
npm run lint
npm run typecheck
npm run scale:review
npm run build
```

`npm run playwright:install` is needed once per machine, and again after a
Playwright version bump. `npm run test` runs the credential-free Playwright
regression suite for governance, authorisation, public routing, and fail-closed
callback behavior.

## CI and production readiness

GitHub Actions runs the credential-free checks on pushes and pull requests for
`main`: `npm run lint`, `npm run typecheck`, `npm run scale:review`,
`npm run build`, and `npm run test`.

CI uses fake local credentials only. It does not load `.env.local`, contact real
providers, run migrations, seed data, or deploy the app. Production deployment
still requires the account and governance checks in
[docs/production-readiness.md](docs/production-readiness.md) and the quarterly
runbook.

## Operations

Run the local AI stack readiness report:

```bash
npm run scale:review
```

This command reads source constants and environment variable presence only. It does not call Gemini, Supabase, Vercel, PostHog, Sentry, or the database, and it never prints secret values.

Run the production deployment preflight after loading production-shaped environment variables in your shell:

```bash
npm run production:preflight
```

This command checks local environment shape, optional provider capability posture, evidence-governance reminders, and local Vercel linkage files. It does not deploy, contact providers, run migrations, seed data, or print secrets.

Read the quarterly runbook at [docs/ai-stack-scale-review.md](docs/ai-stack-scale-review.md).
