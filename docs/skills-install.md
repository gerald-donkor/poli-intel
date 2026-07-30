# EviBrief — Vendor & Official Skills (corrected)

Supersedes the original `/plugin install X@claude-plugins-official` list in spec Section 10.2. That marketplace's cache proved unreliable during setup; the `npx skills add owner/repo` format below was verified directly against each vendor's own repo and is the current source of truth.

The runnable version of everything here is `install-skills.sh` at the repo root. Keep the two in sync — this file explains *why* each install looks the way it does; the script only does it.

## Confirmed official — install these as-is

```bash
npx skills add supabase/agent-skills
npx skills add vercel-labs/agent-skills
npx skills add greensock/gsap-skills
npx skills add langchain-ai/langchain-skills
npx skills add google-gemini/gemini-skills --skill gemini-api-dev
npx skills add getsentry/sentry-for-ai
npx skills add prisma/skills
npx skills add resend/resend-skills
npx skills add anthropics/skills --skill frontend-design
```

**One correction from the original list:** Sentry's skill repo was `getsentry/sentry-agent-skills` — that repo is now **archived**. Sentry explicitly redirects all new installs to `getsentry/sentry-for-ai`, used above.

**One clarification:** `frontend-design` is Anthropic's own first-party skill, living in `anthropics/skills` — not a Vercel-published skill, even though Vercel's `agent-eval` repo happens to contain a differently-scoped skill with a similar name. Don't conflate the two.

## shadcn/ui — two separate steps, not one

```bash
npx shadcn@latest init                                                   # scaffolds the project + components.json
npx skills add https://github.com/shadcn-ui/ui/tree/main/skills/shadcn   # teaches the agent shadcn's own patterns
```

These do different jobs: `init` sets up the actual project files (Tailwind config, `components.json`, base styles). The skill teaches Claude Code component search, styling conventions, and preset handling — it doesn't scaffold anything itself. Run both.

**`init` is a one-time step.** This repo already has a `components.json` and a populated `components/ui/`, and re-running `init` rewrites that config — so the script skips it when `components.json` is present. Run it by hand only if you are genuinely scaffolding from scratch.

Optional, not required: `mattbx/shadcn-skills` adds awareness of 1,500+ community component registries and post-hoc style auditing. Explicitly designed to complement the official skill above, not replace it — only add this if you want registry search beyond shadcn's default set.

```bash
npx skills add mattbx/shadcn-skills   # optional
```

## No confirmed official repo — community fallback or verify before use

**Playwright** — no official Microsoft-published skill found. Best-documented community option:
```bash
npx skills add testdino-hq/playwright-skill
```

**Inngest** — confirmed working via the plugin marketplace path; the `npx skills add` form below uses the same repo but hasn't been independently verified to work with this installer:
```bash
# Confirmed:
/plugin marketplace add inngest/inngest-claude-code-plugin
/plugin install inngest@inngest-claude-code-plugin

# Untested with this installer — try, don't assume:
npx skills add inngest/inngest-claude-code-plugin
```

## PostHog — confirmed command

```bash
npx -y @posthog/wizard@latest mcp add
```

Official, from `posthog.com/docs/model-context-protocol` and the `PostHog/mcp` repo directly. This installs the PostHog MCP server into Claude Code (also supports Cursor, Claude Desktop, Codex, VS Code, Zed) — a different mechanism from `npx skills add`, so it doesn't fit the pattern above, but it's the correct one-line install.

One thing worth knowing before running it against real project data: the wizard is agent-powered — it reads your project's source files as context to wire up the integration, and by default sends run telemetry (phase, task list, planned events) back to PostHog. `.env*` files and anything its scanner flags as a secret are excluded from what gets read. Reasonable for a standard setup; worth a beat of awareness given EviBrief's Section 4.3 data-handling posture, even though this is tooling data, not the community-sourced evidence that section is actually protecting.

## Custom project skills (unchanged)

These are project-specific, not vendor skills — no install command, they already exist in `.claude/skills/`:

- `gemini-integration`
- `evidence-governance`
- `supabase-schema`
- `server-actions`
- `design-system`
- `inngest-jobs`
- `hallucination-guard`
- `tiptap-editor`
