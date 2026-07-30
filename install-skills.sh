#!/bin/bash
# Install EviBrief's vendor and official Claude Code skills.
# The reasoning behind each line — why these repos, which ones are unverified —
# lives in docs/skills-install.md. Keep the two in sync.
set -euo pipefail

echo "== Confirmed official skills =="
npx skills add supabase/agent-skills
npx skills add vercel-labs/agent-skills
npx skills add greensock/gsap-skills
npx skills add langchain-ai/langchain-skills
npx skills add google-gemini/gemini-skills --skill gemini-api-dev
npx skills add getsentry/sentry-for-ai
npx skills add prisma/skills
npx skills add resend/resend-skills
npx skills add anthropics/skills --skill frontend-design

echo "== shadcn/ui (two steps) =="
# `init` rewrites components.json and base styles, so it runs only when the
# project has not been scaffolded yet. This repo is already initialised.
if [ -f components.json ]; then
  echo "-- components.json exists; skipping 'shadcn init' (would overwrite it)"
else
  npx shadcn@latest init
fi
npx skills add https://github.com/shadcn-ui/ui/tree/main/skills/shadcn

echo "== Community fallback (Playwright) =="
npx skills add testdino-hq/playwright-skill

echo "== Inngest — via confirmed plugin path =="
claude plugin marketplace add inngest/inngest-claude-code-plugin
claude plugin install inngest@inngest-claude-code-plugin

echo "== PostHog MCP =="
npx -y @posthog/wizard@latest mcp add

echo "== Done. Restart Claude Code or run /reload-plugins to pick everything up =="
