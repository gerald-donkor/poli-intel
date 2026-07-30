#!/bin/bash
set -e

echo "== Adding marketplaces =="
claude plugin marketplace add inngest/inngest-claude-code-plugin
claude plugin marketplace add langchain-ai/langchain-skills
claude plugin marketplace add greensock/gsap-skills

echo "== Installing from claude-plugins-official (built-in, no marketplace add needed) =="
claude plugin install supabase@claude-plugins-official
claude plugin install vercel@claude-plugins-official
claude plugin install playwright@claude-plugins-official
claude plugin install sentry@claude-plugins-official
claude plugin install prisma@claude-plugins-official
claude plugin install resend@claude-plugins-official
claude plugin install frontend-design@claude-plugins-official

echo "== Installing vendor-published skills =="
claude plugin install inngest@inngest-claude-code-plugin
claude plugin install langchain-skills@langchain-skills
claude plugin install gsap-skills@greensock

echo "== Non-/plugin installers =="
npx skills add google-gemini/gemini-skills --skill gemini-api-dev
npx shadcn@latest init

echo "== Done. Verify inside a Claude Code session with /plugin or /reload-plugins =="
