# EviBrief AI stack scale review

Verified on 2026-08-11.

## Purpose and scope

This runbook is the quarterly operations check for EviBrief's AI, database, and hosting posture. It answers one question: does the current free-tier posture still fit the way the product actually runs?

It is not an in-app dashboard, not an account integration, and not an enforcement mechanism. The local command reads source constants and environment variable presence only:

```bash
npm run scale:review
```

The command does not call Gemini, Supabase, Vercel, PostHog, Sentry, or the database. It does not read evidence rows, brief prose, prompts, completions, translations, search queries, stakeholder data, or field observations.

## Vendor limits to verify

Vendor limits change. Treat this section as a pointer to the current checks, not as a permanent contract.

| Vendor | Current note verified on 2026-08-11 | Official source |
| --- | --- | --- |
| Gemini API | Rate limits are evaluated by RPM, TPM, and RPD, are per project rather than per API key, vary by model and tier, and specified limits are not guaranteed. Active limits must be checked in AI Studio. | https://ai.google.dev/gemini-api/docs/rate-limits |
| Gemini API pricing | Gemini Free has free input/output tokens but content is used to improve Google products. Paid is for production volume and states that content is not used to improve Google products. Gemini 3.6 Flash Google Search grounding is not available on Free in the pricing table. | https://ai.google.dev/gemini-api/docs/pricing |
| Supabase | Free includes 500 MB database size and Free projects pause after 1 week of inactivity. Pro includes larger disk and backups. | https://supabase.com/pricing |
| Supabase database size | Supabase documents database and disk-size behaviour separately from plan pricing; review dashboard size before any ingest-heavy deployment. | https://supabase.com/docs/guides/platform/database-size |
| Vercel Hobby | Hobby is personal and non-commercial only. It is not the production plan for Tropenbos deployment. | https://vercel.com/docs/plans/hobby |
| Vercel Functions | Function duration and memory limits differ by plan and Fluid Compute state. Confirm the deployed project's current duration setting before long exports or AI callbacks. | https://vercel.com/docs/functions/limitations |
| Vercel pricing | Pro is the baseline commercial self-serve plan; Enterprise is for custom security, collaboration, and support requirements. | https://vercel.com/pricing |

## Current AI consumers

All Gemini model IDs, dimensions, budgets, and per-module allocations live in `lib/ai/config.ts`. Run `npm run scale:review` after any AI config change.

| Consumer | Request shape |
| --- | --- |
| Evidence embedding | Batches eligible evidence chunks into embedding requests. Uses `EMBEDDING_BATCH_SIZE`, `EMBEDDING_MAX_INPUT_TOKENS_PER_REQUEST`, and `EMBEDDING_SWEEP_ITEM_LIMIT`. |
| Radar classification and signal embedding | For each new item in a source run, one classification request and one signal embedding request. |
| Grounded radar search | Fixed grounded-search cost before candidates exist, then structured extraction/classification for created items. |
| Evidence Matcher | SQL retrieval, then one rerank request over bounded candidate excerpts. |
| Brief generation | One generation request over bounded policy text and top evidence context, then the hallucination-guard fact-check request before persistence. |
| Hallucination guard | One fact-check request against the exact evidence context supplied to generation. |
| Audience switcher | One reframe request, still subject to the evidence-governance gate. |
| Translation assist | One constrained request for the configured number of key messages in Twi, still subject to the evidence-governance gate. |
| Impact detection | Weekly grounded search and structured extraction for a bounded number of submitted briefs. |

## Request-envelope interpretation

Use the script output as the current source-derived numbers. The important derived checks are:

- Gemini design budget: `GEMINI_RPM_BUDGET` and `GEMINI_DAILY_REQUEST_BUDGET`.
- Embedding: sweep item limit times chunk count divided by batch size. Large imports can drain the daily budget even when RPM is paced.
- Radar: `RADAR_GROUNDED_CALLS_PER_RUN + RADAR_MAX_ITEMS_PER_RUN * RADAR_GEMINI_CALLS_PER_ITEM` is the worst-case request count for one grounded source run.
- Matcher: one Gemini request per matcher run; retrieval is SQL and depends on pgvector index health.
- Brief generation: at least two Gemini requests per reviewable draft, because generation without the guard pass is incomplete.
- Impact Tracker: `IMPACT_MAX_BRIEFS_PER_RUN * IMPACT_GROUNDED_CALLS_PER_BRIEF` is the weekly worst-case request count.

## Expected bottlenecks

- Gemini RPM: interactive brief generation must keep priority over background embedding, radar, matcher, and impact jobs.
- Gemini daily requests: daily radar plus a large embedding backlog can spend the free-tier day quickly.
- Gemini grounded search: current Gemini 3.6 Flash pricing documentation marks Google Search grounding unavailable on Free, so the radar and impact grounded paths require a live AI Studio check before production.
- Supabase database size: vector storage and extracted text make the 500 MB Free threshold the first database risk.
- Supabase inactivity pause: Free projects pause after 1 week idle, which is unacceptable for production monitoring.
- Vercel Hobby: personal/non-commercial only, so Tropenbos production must use Pro, Enterprise, or an explicitly approved alternative.
- Vercel function duration: confirm the project's Fluid Compute state and maximum duration before relying on long export, ingestion, or callback paths.
- Pandoc on Vercel: Vercel does not ship Pandoc. PDF export remains unavailable unless the host declares a working `PANDOC_BIN`.

## Decision table

| Finding | Decision |
| --- | --- |
| Actual AI Studio limits exceed observed workload with margin, Supabase size is below 350 MB, and Vercel is Pro or better | Stay on current posture and review next quarter. |
| Gemini RPM is the only pressure and account terms are still acceptable | Reduce throughput first: lower source fan-out, embedding sweep size, or impact backlog limits in `lib/ai/config.ts` through a reviewed prompt. |
| Supabase is near 500 MB, project pause is possible, or backups/log retention are required | Upgrade Supabase before increasing ingest volume. |
| Vercel is Hobby or function duration/logging is too constrained | Move to Vercel Pro/Enterprise or an explicitly approved host before production use. |
| Free-tier Gemini terms or grounded-search availability conflict with production needs | Move to paid Gemini or Vertex AI, then update `AGENTS.md` and `.claude/skills/evidence-governance/SKILL.md` deliberately before changing any data eligibility rule. |

## Governance rule

The evidence-governance gate remains hard until the governance documents are explicitly amended. There is no gate-lifting flag, no paid-tier branch, no development bypass, and no environment variable that allows `community_sourced` or `unpublished_internal` evidence to reach Gemini.

Only `public_published` evidence is AI-eligible. This applies to embedding, summarisation, signal classification, brief generation, regeneration, audience switching, translation assist, and the hallucination-guard fact-check pass. Moving tiers does not automatically change the hallucination-guard contract: every generated brief still requires the post-generation fact-check pass before persistence, and unresolved flags still block Programme Director approval server-side.

## Quarterly checklist

1. Run `npm run scale:review` locally and save the output in the operations record.
2. In Google AI Studio, record the active model-specific RPM, TPM, RPD, billing tier, and grounded-search availability for the configured project.
3. Compare the script's radar, matcher, embedding, brief-generation, translation, and impact envelopes against the AI Studio quotas.
4. In Supabase, record database size, disk/read-only state, project activity status, backups, and log retention.
5. In Vercel, record the plan, commercial eligibility, Fluid Compute state, function duration, runtime logs retention, and current usage.
6. Check whether `PANDOC_BIN` exists on the target host; if not, confirm PDF export is intentionally unavailable.
7. Review the production ingest backlog: unembedded public evidence, pending classifications, radar source count, and impact detection backlog.
8. Confirm Sentry and PostHog are either intentionally inert or configured with the existing evidence-safe redaction path.
9. Confirm no new code path logs or transmits evidence body text, brief prose, prompts, completions, translations, search queries, stakeholder notes, or field observations to third-party services.
10. Choose one decision-table outcome and record the decision, actor, date, and follow-up prompt number if changes are needed.
