---
name: inngest-jobs
description: Load when writing or changing EviBrief background work — Policy Radar scraping and RSS polling, per-source cadences, signal deduplication and classification, Evidence Matcher triggers, embedding fan-out, the weekly Impact Tracker, the morning digest, and the weekly gap analysis. Covers cadence config, free-tier job budget, and per-source failure isolation.
---

# Inngest jobs

Scope: **this project's cadences, triggers, and job-shape budget.** Inngest mechanics are not restated here.

Layers on the vendor skills:

- **`inngest-setup`** — SDK install, client config, env vars, the serve endpoint in Next.js, the local dev server
- **`inngest-durable-functions`** — function config, triggers (event/cron/invoke), step memoization, idempotency, cancellation, retries, observability
- **`inngest-steps`** — `step.run`, `step.sleep`, `step.waitForEvent`, `step.sendEvent`, `step.invoke`, parallel work
- **`inngest-flow-control`** — concurrency, throttle, rate limit, debounce, batching, priority
- **`inngest-events`** — event schema, naming, fan-out, idempotency keys
- **`playwright-skill`** (vendor, community) — scraping mechanics
- **`inngest-cli`** — local dev server and run debugging

Rules: `AGENTS.md` §14, §5.1, §8.4. Spec: §3.2, §3.3, §3.5, §7 Phase 2/4.

**Not installed yet.** As of writing there is no Inngest dependency, no serve endpoint, no Playwright. The first jobs task adds them and the corresponding `package.json` scripts in that same change (`AGENTS.md` §19). `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are server-only (§18).

## Everything scheduled or event-triggered is an Inngest function

**Never a bare `setInterval`, never real work inline in a cron route, never a fire-and-forget promise in a request handler** (`AGENTS.md` §14.1). A promise dropped in a serverless request handler is work that may simply not happen, with no record that it didn't.

Route Handlers stay thin: the Inngest serve endpoint is a Route Handler, and it contains no business logic (`AGENTS.md` §5.2).

Scraping, embedding, generation, fact-checking, and radar processing **never run in browser code** (§18).

## Every Gemini call in a job still passes the gate

Signal classification, embedding, and grounded search are all Gemini calls made from jobs. Load **`evidence-governance`** and **`gemini-integration`** before writing them. A job is not a governance exemption, and "it runs on the server anyway" is not the point — the point is what data reaches the model.

## Cadences live in config

**Per-source cadences live in one config module, not scattered across job definitions** (`AGENTS.md` §14.2). One table to read when someone asks "how often do we check the Gazette?", and one place to change it.

From spec §3.2:

| Source | Cadence | Signal type |
|---|---|---|
| Ghana Gazette / Forestry Commission | Daily | Draft regulations, policy notices |
| EUDR implementing acts | Weekly | Consultation periods, guidance updates |
| UNFCCC secretariat | **Daily during COP** | Draft decisions, negotiating texts |
| Cocobod announcements | Weekly | Standard revisions, trade requirements |
| ITTO newsletters | Monthly | Trade policy, legality discussions |
| CBD secretariat | Monthly | Implementation guidance, reporting |
| Reuters / AllAfrica | Daily | Political signals, minister statements |

"Daily during COP" is a real conditional, not a rounding of "daily" — the config needs to express a period-dependent cadence rather than hard-coding the busier rate all year and burning the budget on it.

Retrieval method per source (spec §3.2):

- **Structured sources** — Playwright scraping (`playwright-skill`)
- **UNFCCC, CBD, ITTO** — RSS polling
- **News, minister statements** — Gemini with Google Search grounding (`gemini-integration`)

## Job shapes

Four kinds of work, at four cadences (`AGENTS.md` §5.1):

1. **Policy Radar** — scheduled per source. Fetch → extract → deduplicate → create signal → classify.
2. **Evidence Matcher** — event-triggered by signal detection, or on demand.
3. **Embedding / ingestion** — event-triggered by a document becoming eligible; batched and fanned out.
4. **Impact Tracker** — **weekly** (`AGENTS.md` §14.9). Plus the **weekly gap analysis** and the **morning digest**.

A module never reaches into another module's internals — they communicate through the database and through Inngest events (`AGENTS.md` §5.1). So the radar does not call the matcher's functions; it emits an event the matcher subscribes to.

### Detection triggers the Matcher and stops there

**Signal detection triggers the Evidence Matcher. It never triggers the Brief Generator** (`AGENTS.md` §8.4, §14.8, spec §3.1). Generation is on demand only — staff choose when to generate. There is no scheduled generation, no auto-draft on a high-urgency signal, and no flag that enables one (§8.2).

Likewise: signals are classified automatically, but **never auto-advanced past `reviewed`** (§8.5). Acting on a signal is always a human decision.

## Deduplicate before creating a record

**Deduplicate signals with fuzzy text matching before creating a record. A repeat alert on the same event is a defect** (`AGENTS.md` §14.4, spec §3.2).

Two distinct layers, both needed:

- **Event-level idempotency** — Inngest's own idempotency keys stop the same run being processed twice (`inngest-events`).
- **Domain-level deduplication** — fuzzy text matching stops *different* fetches of the *same real-world event* becoming two signals. Inngest cannot do this for you; a Gazette notice reachable at two URLs is one policy window.

Dedupe before the insert, not by cleaning up after. A duplicate that reached the digest has already cost a staff member's attention.

## One dead source does not abort the batch

**Radar jobs tolerate slow or unreachable sources without failing the whole run** (`AGENTS.md` §14.5, spec §9's connectivity risk row).

- Isolate per source: each source's fetch is its own step or its own function invocation, so a timeout on ITTO does not lose that day's Gazette results.
- Retries per source with backoff, bounded (`inngest-durable-functions`).
- **A failure is recorded, not swallowed.** A source that failed is a source that returned no signals, and that must be visible — see the gap analysis below.

## Silence is reported, not assumed

**A source returning no new signals is reported in the weekly gap analysis — silence may mean a monitoring failure, not a quiet week** (`AGENTS.md` §14.7, spec §9). This is the check that catches a scraper broken by a site redesign. Distinguish, in the record: fetched successfully and found nothing, versus failed to fetch.

## The morning digest

Staff receive a **morning digest of classified signals** via email (Resend) and/or Slack webhook (`AGENTS.md` §14.7, spec §3.2, §5.2 step 1). It also surfaces briefs awaiting approval and new influence events for the Programme Director (spec §5.2). Designed to function on low bandwidth.

Email specifics: `resend`, `react-email`, `email-best-practices` (vendor). `RESEND_API_KEY`, `DIGEST_FROM_EMAIL`, `SLACK_WEBHOOK_URL` are server-only (`AGENTS.md` §18).

**No evidence body text in a digest that leaves Tropenbos-controlled infrastructure without the classification check having been applied** — the digest is about signals and briefs, and it must not become a side channel for ineligible evidence (`evidence-governance`).

## The free-tier budget

**Structure jobs to stay within Inngest free-tier limits — batch and fan out deliberately rather than one invocation per item** (`AGENTS.md` §14.6).

- **Batch first, then fan out.** A document with 200 chunks is not 200 function runs. Group chunks into embedding batches (`gemini-integration`), then fan out over batches.
- Two budgets bind at once: Inngest's run count and Gemini's ~1,500 req/day and 15 RPM. Use `inngest-flow-control`'s **throttle** to sit inside the Gemini RPM ceiling rather than hand-rolling sleeps inside steps — a hand-rolled wait inside a step that Inngest will retry anyway double-counts the delay.
- Concurrency limits keep a large ingest from starving the radar.
- Prefer a small number of long, stepped functions over many tiny ones where the work is genuinely sequential.
- Supabase Free **pauses after 7 days of inactivity** (spec §6.1). Scheduled jobs incidentally keep it warm — but don't rely on that, and don't add a job whose only purpose is keeping it awake.

## The §14 contract, in full

Migrated verbatim from `AGENTS.md` §14 so the root file no longer carries it. These nine rules bind on every job.

1. All scheduled and event-triggered work runs as Inngest functions. Never a bare `setInterval`, never real work inline in a cron route, never a fire-and-forget promise in a request handler.
2. Respect per-source cadences — Ghana Gazette / Forestry Commission daily, EUDR weekly, UNFCCC daily during COP, Cocobod weekly, ITTO monthly, CBD monthly, news daily. Cadences live in config, not scattered across job definitions.
3. Structured sources are scraped with Playwright; RSS feeds are polled; unstructured monitoring uses Gemini with Google Search grounding.
4. Deduplicate signals with fuzzy text matching before creating a record. A repeat alert on the same event is a defect.
5. Radar jobs run server-side with retry logic and tolerate slow or unreachable sources without failing the whole run. One dead source does not abort the batch.
6. Structure jobs to stay within Inngest free-tier limits — batch and fan out deliberately rather than one invocation per item.
7. Staff receive a morning digest of classified signals via email (Resend) and/or Slack webhook. A source returning no new signals is reported in the weekly gap analysis — silence may mean a monitoring failure, not a quiet week.
8. The Evidence Matcher is triggered by signal detection. The Brief Generator is not (`AGENTS.md` §8).
9. The Impact Tracker runs weekly.

## Related

- `evidence-governance` — the gate, before any model call from a job
- `evidence-matcher` — what signal detection triggers
- `gemini-integration` — classification and embedding call paths, backoff, batching
- `supabase-schema` — the signal/evidence/influence tables these jobs write
- `inngest-*`, `playwright-skill`, `resend`, `react-email` (vendor) — the mechanics
- `sentry-nextjs-sdk` (vendor) — job error reporting, with **no evidence body text in the event**
