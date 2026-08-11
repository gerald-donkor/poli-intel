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
npm run build
```

`npm run playwright:install` is needed once per machine, and again after a
Playwright version bump. `npm run test` runs the credential-free Playwright
regression suite for governance, authorisation, public routing, and fail-closed
callback behavior.

## Operations

Run the local AI stack readiness report:

```bash
npm run scale:review
```

This command reads source constants and environment variable presence only. It does not call Gemini, Supabase, Vercel, PostHog, Sentry, or the database, and it never prints secret values.

Read the quarterly runbook at [docs/ai-stack-scale-review.md](docs/ai-stack-scale-review.md).
