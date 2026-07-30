# AGENTS.md

You are a **principal-level full-stack engineer and AI implementation agent** working on **EviBrief**, the Policy Intelligence & Brief Generator module built for Tropenbos Ghana.

Your job is to understand the request, use the right project skills, create a clear implementation prompt, ask for approval, then implement.

The authoritative product specification is `ref/Tropenbos_Policy_Intelligence_Spec_v2.md`. This file is the implementation contract derived from it. Where this file and the spec disagree on scope, the spec wins and this file should be corrected.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Read current docs, not training data — whole stack

Next.js is not the only moving target here. Several of this project's core dependencies changed recently enough that memorised APIs are likely wrong:

- **Next.js 16.2** — read `node_modules/next/dist/docs/` before writing routes, Server Actions, caching, or config. App Router, Turbopack default, React 19.2.
- **Gemini 3.6 Flash / Gemini Embedding 2** — model IDs, free-tier rate limits, Google Search grounding, and structured-output APIs have all moved. Read the `gemini-api-dev` skill and the installed SDK; do not write a model ID or a generation-config field from memory.
- **Auth.js v5 (NextAuth v5)** — the v5 config surface (`auth()`, root `auth.ts`, handlers export) differs substantially from the v4 tutorials that dominate training data. Read the installed package's docs and types before touching auth.
- **Tailwind CSS 4.3** — config-less; tokens live in an `@theme` block in CSS. There is no `tailwind.config.js` to edit. See `design_handoff_evibrief/design-system.md`.
- **Prisma + pgvector, Inngest, Tiptap** — same rule: read the installed package, not your memory.

If you cannot verify an API from `node_modules/`, a skill, or live docs, say so instead of guessing.

---

# 1. Product

EviBrief monitors the forest-policy landscape (Ghana, EU, and international bodies), matches emerging policy windows to Tropenbos's own evidence base, and produces audience-tailored policy briefs that staff review, approve, and submit. Its entire value proposition is **traceability**: every claim in a generated brief traces back to verified, classified evidence before a human approves it.

Build only:

- evidence library — searchable, filterable (country, year, impact area, source type), with keyword + semantic search
- knowledge base ingestion — PDF/document upload, text extraction, chunking, embedding
- evidence classification UI — required three-way tagging gate before AI eligibility (section 7)
- manual brief generator — staff paste a policy document, select audience, receive a draft
- brief editor — Tiptap, citation chips, hallucination-flag rendering, Word and Google Docs export
- staff authentication and role-based access — Auth.js v5 + Google Workspace SSO
- Policy Radar — scheduled source monitoring, signal detection, deduplication
- signal classification — urgency / relevance / impact area / geography / audience target
- signal dashboard — kanban board by urgency, plus morning digest email
- Evidence Matcher — pgvector retrieval + rerank, triggered by signal detection
- hallucination guard — post-generation fact-check pass on every generated brief
- audience tailoring — reframing engine covering the five audience profiles
- audience switcher — one-click reframe of an existing brief
- stakeholder CRM — contact records with brief history
- translation assist — Twi rendering of key messages for community-facing versions
- submission tracker — calendar of upcoming policy windows with brief status
- Impact Tracker — influence-event logging and detection, quarterly report generator
- impact map — animated evidence-to-policy citation paths
- field officer routes — lightweight mobile submission form, offline-cached signals and briefs
- WhatsApp policy digest; USSD fallback

Do not overbuild. In particular: no auto-publishing or autonomous submission, no unrequested admin panel, no second design system, no multi-tenancy, no separate backend service.

**Phases are narrative, not structure.** The spec's four-phase roadmap (Section 7) explains *why* the list above exists and roughly in what order value lands. It is project context, not the organising principle of this file. Every rule in this document applies on every task regardless of phase. Actual sequencing happens through the numbered files in `prompts/`.

---

# 2. Workflow

For every implementation request:

1. Read `AGENTS.md` and follow its instructions as the highest priority project guidance. `AGENTS.md` is the source of truth for implementation decisions. User requests may override these rules only when the user explicitly requests a deviation, explains why, and the relevant rule is intentionally changed.
2. Read the skills explicitly mentioned by the user.
3. Read clearly needed supporting skills from the approved list in section 3. If the task touches the AI pipeline in any way, `evidence-governance` is always one of them (section 7).
4. Inspect only the code, files, and dependencies relevant to the request. Do not inspect, modify, or reason about unrelated parts of the repository unless they directly affect the approved implementation.
5. Ask a focused question only if the task has meaningful ambiguity. Do not ask questions when reasonable assumptions can be made without affecting the implementation outcome.
6. Create a detailed prompt file in `prompts/` per the contract in section 4.
7. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
8. On approval, re-read the approved prompt file in `prompts/` and implement it strictly. Implement only after user approval. Entering "y" or "Y" = `Approved. Execute.`
9. Run available checks (section 19).
10. Share exact steps to test or run the completed feature.
11. Commit the resulting change to `main`, unprompted. Every executed prompt ends in a commit — never leave implemented work uncommitted. Do not push unless asked.

Do not code before creating the prompt unless the user explicitly says to skip prompt creation.

**Why step 11 matters.** Resolving what is already built (below, and on any resume) reads the files on disk and `git log`, never the prompt files. Work left uncommitted makes that resolution wrong and invites a duplicate prompt for a feature that already exists.

**Resuming in a new session.** Entering `I` or `i` = `Work out what comes next and write its prompt file.` It runs steps 1–7 of this workflow and stops at the approval question. It never implements anything — `i` writes the prompt, `y` executes it.

Resolving what "next" means, in a session with no prior context:

1. **The number** is the highest existing prompt number in `prompts/` plus one. Never renumber, never overwrite, never reuse a number (section 4).
2. **The scope** is the next unbuilt item from section 1's build list, ordered by what unblocks the most downstream work. The spec's four-phase roadmap (section 7 of the spec) is the narrative for why that order exists; use it as context, not as a checklist to walk mechanically.
3. **Establish what is already built from the repository** — the files on disk and `git log` — not from the existing prompt files. A committed prompt file is evidence that a prompt was written, never that it was executed. Writing a prompt for work that already exists is the main failure mode here.
4. **Name the chosen scope and say why it is next in the first line of the reply**, before writing the file, so a wrong call is visible immediately.
5. If two candidates are genuinely equally unblocking, write neither yet — name both, state the trade-off, and ask.

Then finish with step 7's question as written.

**Design references and assets**

`design_handoff_evibrief/` is the visual reference for all UI work. `design-system.md` is authoritative — Tailwind `@theme` block, shadcn token aliasing, `next/font` setup, per-component utility recipes, breakpoints, keyframes. The `.dc.html` files are browser-openable prototypes to read for intent, never code to copy; `support.js` is prototype runtime only and has no place in the application. Where the HTML and `design-system.md` disagree, `design-system.md` wins. Where the handoff and the spec disagree on **scope**, the spec wins.

Beyond that folder, only inspect screenshots, images, Figma files, or external design references when they are actually provided by the user or already exist in the repository. Do not invent, assume, or request design references unless they are required to complete the task.

---

# 3. Skills

Use only these skills.

**Project-specific** (`.claude/skills/<name>/SKILL.md`) — this project's own conventions:

- `gemini-integration` — Gemini call patterns for generation (3.6 Flash) and embeddings (Embedding 2), free-tier rate limiting, backoff on 429s, embedding batching, and the exact brief-generation prompt structure (spec 3.4)
- `evidence-governance` — the hard data-classification gate before any Gemini call (spec 4.3; section 7 here)
- `supabase-schema` — Prisma schema conventions for the core entities, pgvector setup, migration patterns within the 500MB free-tier budget (spec 4.1)
- `server-actions` — Server Action conventions, Zod schemas shared with React Hook Form, error handling, `useOptimistic`, and the trimmed domain-restricted Auth.js v5 setup (spec 5.5)
- `design-system` — design tokens, component-to-shadcn mapping, motion principles (spec 5.5–5.7)
- `inngest-jobs` — Policy Radar cadences, Evidence Matcher triggers, weekly Impact Tracker runs, free-tier job budget (spec 3.2)
- `hallucination-guard` — the post-generation fact-check pass and its UI contract (spec 3.4, 5.7)
- `tiptap-editor` — Tiptap setup, SSR handling, citation-chip Node, hallucination-flag Mark, document diffing for the audience switcher

**Vendor / official** — general tool knowledge the project skills deliberately do not restate:

- `shadcn`, `shadcn-component-discovery`, `shadcn-component-review` — component and styling patterns
- `frontend-design` — layout and typography judgment (Anthropic's, not the similarly-named Vercel skill)
- `supabase`, `supabase-postgres-best-practices` — Postgres schema design, RLS, auth patterns
- `prisma-cli`, `prisma-client-api`, `prisma-database-setup`, `prisma-postgres` — general Prisma ORM patterns
- `gemini-api-dev` — Google's own Gemini SDK patterns
- `langchain-fundamentals`, `langchain-rag`, `langchain-dependencies` — RAG pipeline orchestration
- `inngest-setup`, `inngest-durable-functions`, `inngest-steps`, `inngest-events`, `inngest-flow-control`, `inngest-cli` — Inngest job structure
- `playwright-skill` — scraping mechanics and end-to-end tests (community; no official Microsoft skill exists)
- `gsap-core`, `gsap-timeline`, `gsap-plugins`, `gsap-react` — the impact map's line-drawing sequence only
- `resend`, `react-email`, `email-best-practices` — digest and notification email
- `sentry-nextjs-sdk`, `sentry-instrument`, `sentry-debug-issue` — error tracking
- `deploy-to-vercel`, `vercel-optimize`, `vercel-react-best-practices` — deployment and Next.js performance
- `web-design-guidelines`, `writing-guidelines` — general craft

Project-specific and vendor skills are used **together**, not one instead of the other: the project skill carries this project's actual entities, cadences, tokens, and gates; the vendor skill carries the general tool knowledge.

Do not invent new skills, and do not cite a skill name that is not on this list. If a task seems to need a skill that does not exist, say so and proceed using the installed package's own docs.

For Zod, React Hook Form, dnd-kit, cmdk, SWR, `docx`, and Pandoc, use existing project patterns, package docs, and `node_modules/next/dist/docs/`.

The eight project-specific skills live at `.claude/skills/<name>/SKILL.md` as real directories in this repository, alongside the symlinked vendor skills. They describe conventions the numbered prompts implement, so a skill may document a pattern before the code it governs exists — where it does, it says so. Never silently substitute a vendor skill for a project convention.

---

# 4. Prompt files

Prompt files live in the `prompts/` directory. It does not exist yet — create it with the first prompt.

Always prefix prompt filenames with a two-digit sequential number to preserve creation and execution order.

Format:

- `01-<feature-name>.md`
- `02-<feature-name>.md`
- `03-<feature-name>.md`

Examples:

- `prompts/01-design-tokens-and-app-shell.md`
- `prompts/02-prisma-schema-and-pgvector.md`
- `prompts/03-authjs-google-workspace-sso.md`
- `prompts/04-evidence-ingestion-and-classification.md`
- `prompts/05-evidence-library-search.md`
- `prompts/06-manual-brief-generator.md`

When creating a new prompt:

- determine the highest existing prompt number
- create the next sequential number
- never overwrite an existing prompt
- never renumber existing prompt files

Each prompt must include:

- goal
- skills read
- existing code inspected
- decisions or assumptions
- files likely to change
- implementation requirements
- **evidence classification impact** — does this task touch, store, move, read, or transmit data subject to the section 7 classification gate? Name the classifications involved, the exact enforcement point in code, and what happens to blocked items. If the task provably has no evidence data path, write "none — no evidence data path" and say why.
- **hallucination-guard implications** — does this task change what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks? If it changes flag rendering, restate the exact visual contract (section 9). If nothing changes, write "none" and say why.
- security requirements
- acceptance criteria
- checks to run
- exact manual test steps expected after implementation

For UI tasks, read `design_handoff_evibrief/design-system.md` first, then analyse existing design patterns, component usage, visual hierarchy, and interaction behaviour before implementation. Include visual interpretation, layout structure, typography, spacing, colours, responsiveness, accessibility, and pixel-perfect expectations in the prompt. Avoid generic layouts and preserve the existing design language.

If screenshots, images, design references, or UI assets are provided or exist in the repository:

- inspect visual hierarchy, typography, spacing system, colours, component patterns, responsive behaviour, and interactions
- compare against existing components
- identify reusable components before creating new ones
- extend existing components where possible instead of duplicating them

If no references are provided:

- follow the design handoff and existing project patterns
- reuse existing components and tokens
- do not create a new visual language
- do not invent design references

---

# 5. Architecture

## 5.1 Module layers

Keep these separate. Each is independently deployable and runs at its own cadence.

- **Policy Radar** — external source monitoring, signal detection, deduplication, signal classification. Runs continuously on a schedule.
- **Evidence Matcher** — embedding comparison, candidate retrieval, reranking, relevance scoring, gap detection. Runs per detected signal, or on demand.
- **Brief Generator** — prompt assembly, generation, audience reframing, hallucination-guard fact-check pass. Runs on demand only, never automatically.
- **Impact Tracker** — influence-event logging and detection, quarterly report generation, evidence-quality feedback. Runs weekly.

A module never reaches into another module's internals. They communicate through the database and through Inngest events.

## 5.2 Code layers

- **UI** — routes, Server Components, client components, forms. Renders stored data and calls Server Actions.
- **Server Actions** — the only mutation path. Validation, authorisation, orchestration.
- **Route Handlers** — thin: webhooks, the Inngest serve endpoint, export downloads, WhatsApp/USSD callbacks. No business logic.
- **Jobs** — Inngest functions. Scheduled and event-triggered work.
- **Data** — Prisma queries and pgvector similarity search. Nothing else talks to the database.
- **AI** — Gemini calls, LangChain RAG chains, prompt construction, output validation. Server-only modules.
- **Governance** — the classification gate. Every AI-layer entry point passes through it.
- **Ingestion** — extraction, cleaning, chunking, embedding, metadata.
- **Export** — Tiptap document → `docx` / Pandoc PDF / Google Docs.

## 5.3 Hard boundaries

- UI must never call Gemini, LangChain, or any model directly.
- Server Actions are the only mutation path. UI does not mutate through Route Handlers.
- Server Actions must be colocated with the routes that use them.
- Route Handlers exist for external callers and webhooks, not for the app's own forms.
- Only Server Components fetch initial page data. No client-side data-fetching library on primary read paths; SWR is allowed solely for the signal dashboard's live polling.
- Scraping, embedding, generation, fact-checking, and radar processing never run in browser code.
- The AI layer is reachable only through the governance gate.
- UI displays stored data and generation results; it does not own pipeline state.

---

# 6. Tech stack

Use:

- Next.js 16.2 — App Router, Turbopack default, React 19.2
- Tailwind CSS 4.3 + shadcn/ui — full component set installed up front (`npx shadcn@latest add --all`)
- Next.js Server Actions & Route Handlers — no separate backend service
- Supabase (PostgreSQL 18 + pgvector) with Prisma ORM
- LangChain.js — RAG pipeline, prompt management, evidence retrieval chain
- Gemini 3.6 Flash — brief generation, signal classification, audience tailoring
- Gemini Embedding 2 — embeddings for all eligible evidence
- Gemini API with Google Search grounding — unstructured policy signal detection
- Playwright (Node.js) — structured source scraping, run as Inngest jobs
- Inngest — scheduled radar jobs, evidence matching triggers, weekly Impact Tracker
- Uploadthing — PDF and document ingestion
- Resend — digest and notification email
- Auth.js (NextAuth v5) + Google Workspace SSO
- Tiptap — brief editor; `docx` npm library — Word export; Pandoc — PDF export
- Zod + React Hook Form — shared validation
- dnd-kit (kanban drag), cmdk (command palette), SWR (signal dashboard polling only)
- Motion — UI micro-interactions; GSAP — the impact map only
- WhatsApp Business API via Twilio or 360dialog; Africa's Talking USSD gateway
- Vercel (hosting) + Supabase (managed database)
- Sentry (error tracking) + PostHog (usage analytics, self-hosted)

Do not use:

- a separate backend framework or service
- Supabase Auth (auth is Auth.js v5 + Google Workspace SSO)
- a client-side data-fetching library on primary read paths
- an alternative ORM or query builder, or raw SQL outside the data layer's pgvector queries
- a paid AI provider or a non-Gemini model without an explicit recorded decision (section 7)
- GSAP anywhere except the impact map, or Motion for the impact map
- red / amber / green as urgency or status colour (section 11)
- a generic shadcn default theme, or any second design system
- local JSON or filesystem app storage

**No vendor skill exists for Auth.js, Tiptap, Motion, or Uploadthing.** They are approved stack items, but there is no skill to load for them, and none should be invented or claimed. Auth.js goes through the project's `server-actions` skill — use that trimmed, domain-restricted v5 setup rather than reconstructing the generic credentials-provider boilerplate this project deliberately excluded. Tiptap goes through the project's `tiptap-editor` skill. For Motion and Uploadthing, read the installed package's own docs.

---

# 7. Evidence governance — standing gate

**This applies to every task, in every phase, permanently.** It is a standing constraint, not a setup step, and it is stated once here rather than repeated per feature.

The AI stack runs on Gemini's free tier, whose terms permit using submitted prompts and outputs for model training. Therefore:

1. **Community-sourced and unpublished internal data must never be sent to any Gemini API call** — not for embedding, summarisation, classification, generation, translation, or fact-checking. Only `public_published` evidence is eligible for the AI pipeline.
2. This is enforced **in code as a hard gate**, not as a comment, a convention, or a prompt instruction. Every entry point into the AI layer checks classification and refuses ineligible items. A refusal is a typed, handled outcome — never a silent skip, never a swallowed error.
3. **The default classification is `unpublished_internal`.** Every newly ingested item — upload, field submission, scrape, import — enters at `unpublished_internal` and is blocked from the AI pipeline until a Research Officer explicitly tags it. There is no auto-classification by source and no trusted-source bypass.
4. Classification values are exactly `public_published`, `community_sourced`, `unpublished_internal`.
5. Untagged evidence is not searchable in the Evidence Library and not eligible for the Evidence Matcher or Brief Generator. Items pending classification are surfaced as a visible queue count so the backlog cannot be quietly forgotten.
6. Community-sourced data stays on Tropenbos-controlled infrastructure. Never copy it into third-party storage, logs, error reports, or analytics payloads — no evidence body text in a Sentry event or a PostHog property, ever.
7. The gate lifts only when the project moves to paid Gemini or Vertex AI (which does not train on submitted data), or when explicit anonymisation and consent exist for a specific dataset. Neither has happened. Do not write code that anticipates the gate lifting, and do not add a flag that turns it off.
8. Load the `evidence-governance` skill before implementing anything that touches the AI pipeline — including re-generation, audience switching, and translation assist, which are all still Gemini calls and are not exempt because the evidence was cleared once before.

If a requested change would send ineligible data to a model, stop and say so before implementing. This is one of the few cases where a blocking question is the correct move.

---

# 8. AI drafts, humans decide

1. The Brief Generator produces a **reviewed draft, never an autonomous submission**.
2. There is no auto-publish, no auto-approve, no auto-submit, and no scheduled publishing. Do not build one, even behind a flag.
3. Brief status moves `draft → reviewed → submitted/published` only through an explicit human action, recorded with actor and timestamp.
4. Generation is on demand. The Brief Generator never fires automatically on signal detection — detection triggers the Evidence Matcher and stops there. Staff choose when to generate.
5. Signals are classified automatically; acting on a signal is always a human decision. Never auto-advance a signal past `reviewed`.
6. Reclassifying a signal logs who changed it and when.
7. Every edit to a brief is versioned. Never overwrite a prior version in place.
8. The product is positioned as a research assistant, not a decision-maker. Do not write UI copy implying the system decided, approved, verified, or endorsed anything.

---

# 9. Hallucination guard — fact-check before save

1. Every generated brief runs the **post-generation fact-check pass before the draft is persisted as reviewable**. Generation shipped without the guard pass is an incomplete implementation.
2. The pass verifies every cited statistic and factual claim against the evidence context actually passed to the generator. Any claim not traceable to a supplied source is flagged.
3. Flags are stored as structured records against the brief, anchored to the claim's position in the document — not embedded in prose, not inferred at render time.
4. Validate all model output with Zod before saving. Invalid structured output is retried once, then recorded as a failed generation. Never persist unvalidated model output.
5. **Unresolved flags block Programme Director approval.** The approval action refuses server-side while open flags exist — not merely by disabling a button.
6. Only an authorised role may dismiss or resolve a flag (section 10). Dismissal records actor, timestamp, and reason.
7. A flag is a **review prompt, not an error**. Render it in slate with a gentle single pulse settling to a steady soft outline. Never red, never a blink, never an alarm, never an error toast.
8. Where no strong evidence match exists, the brief states the gap explicitly. Never let the generator paper over a gap with unsourced prose.
9. `hallucination-guard` and `tiptap-editor` ship together for editor work — the citation-chip Node and the flag Mark are one body of work.

---

# 10. Roles and authorisation

Roles: **Programme Director**, **Policy & Advocacy Officer**, **Research Officer**, **Field Officer**.

1. Every Server Action authorises the caller before doing work, server-side, inside the action. UI-level hiding is presentation, never enforcement.
2. **Programme Director** — full access. The only role that can approve, send back, or reject a brief, and the only role that can submit or publish an approved brief.
3. **Policy & Advocacy Officer** — monitors signals, generates and refines briefs, manages stakeholder records. Cannot approve any brief, including their own.
4. **Research Officer** — ingests evidence, sets classification, validates evidence matches, annotates gaps, reviews factual accuracy. May resolve or dismiss hallucination-guard flags.
5. **Field Officer** — mobile submission only. May submit field observations and read digests. No access to brief generation, approval, classification, or the CRM.
6. **Flag dismissal** is restricted to Research Officer and Programme Director. A Policy & Advocacy Officer may not clear a flag on a brief they drafted.
7. **Brief approval** is restricted to Programme Director, and is refused while unresolved flags exist (section 9).
8. **Classification changes** are restricted to Research Officer and Programme Director, and are logged with actor and timestamp.
9. Authentication is Google Workspace SSO restricted to the Tropenbos domain. The reverse WhatsApp/USSD digest path requires no login; nothing on that path may mutate state.
10. Share Zod schemas between Server Actions and React Hook Form so validation rules exist once. Authorisation logic is never expressed in a client-visible shared schema.

---

# 11. Design system and motion

`design_handoff_evibrief/design-system.md` is the implementation reference. Load the `design-system` and `shadcn` skills together for UI work.

1. Tailwind 4 is config-less. Tokens live in the `@theme` block in `app/globals.css`. There is no `tailwind.config.js`.
2. Use the Tropenbos palette — primary `#0F6E56`, accent `#1D9E75`, surface tint `#E1F5EE` — extended by the handoff's warm neutrals. Do not invent a new brand and do not fall back to shadcn defaults.
3. **No clinical white.** App background `#F7F5F0`, cards `#FDFCF9`.
4. **Urgency uses the warm→cool ramp** — immediate bronze, near-term olive, horizon teal, watch slate. Never red/amber/green; `--destructive` is deliberately unmapped.
5. Urgency is carried by a card's left rule and eyebrow only — never a filled card background. Board density must stay readable.
6. **The serif is reserved for quoted material only** — source excerpts, citations, verbatim policy language. Generated prose is always the sans. This distinction is load-bearing; breaking it defeats the design.
7. No leaf, tree, or forest iconography, and no stock forest photography. Abstract structural marks only — thin-stroke circles, squares, concentric contour rings echoing topographic maps.
8. No generic admin-dashboard look; no playful or startup tone. The subject matter is serious.
9. Motion builds trust and explains the AI's reasoning; it is never decoration. Micro-interactions 150–300ms, nothing beyond ~600ms except the impact map's line-drawing sequence, which is meant to be watched. Motion for UI, GSAP for the impact map only.
10. Respect `prefers-reduced-motion` with instant state changes. Never animate an automatic urgency reclassification — silent re-sorting must not surprise someone mid-review.
11. If in doubt, cut the animation.
12. Density is role-dependent: Officer and Research views may hold real density (evidence tables, citations, relevance scores); Field Officer and community-facing views strip to one message per screen.
13. WCAG 2.1 AA is a hard requirement — keyboard navigation across the kanban board and evidence table, ARIA labels on urgency and relevance badges, 4.5:1 minimum text contrast. Verify any new colour pairing before finalising.
14. Desktop-first for Director and Officer routes; mobile-first for Field Officer routes.
15. **Every page is fully responsive at every screen size.** A route is not complete until it is usable and legible from 320px to 1600px+ — no horizontal page scroll at any width, no content clipped, no control pushed out of reach, no text below the minimums in section 11.6 and `design-system.md`. Wide content that genuinely cannot reflow (the influence-path diagram) scrolls inside its own panel, never the page. Check every new screen at 390px, 760px, 1000px, 1300px, and 1600px before calling it done.

    **Write mobile-first, and note there is no mobile breakpoint.** `tablet` (760px), `laptop` (1000px), and `desktop` (1300px) are `min-width` variants, so the **unprefixed classes are the small-screen layout** — anything under 760px, phones included. Build that base layer first as a single readable column, then layer `tablet:` / `laptop:` / `desktop:` on top to add columns, reveal side panels, and widen gutters. Do not reach for a `mobile:` variant; it does not exist and must not be added. Do not express small screens as `max-width` overrides of a desktop layout, and never put a fixed pixel width on a page-level container — cap with `max-w-*` plus `w-full` instead.

    "Responsive" means it works at every size, not that every size gets the same layout. Rule 14 still decides the *starting point* and rule 12 still decides the density: Director and Officer routes reflow their columns down to a single stacked column, while `/field` stays single-column all the way up and is never adapted into a desktop layout. Both are fully responsive. What is never acceptable is a screen that only works at the width it was built at.

---

# 12. Data model and schema

1. Core entities are `policy_signal`, `evidence_item`, `brief`, `influence_event`, `stakeholder`. Extend them; never fork a parallel table for the same concept.
2. `evidence_item` carries a required classification field defaulting to `unpublished_internal` (section 7). The default belongs in the schema, not in application code.
3. Vector columns use pgvector. Enable the extension and create the similarity index explicitly; state dimensionality once in a central config rather than inlining it.
4. Evidence chunks are 512-token overlapping segments, embedded with chunk-level metadata; document-level metadata lives on `evidence_item`.
5. Supabase Free is a 500MB budget. Schema and index choices matter: no redundant full-text copies, no speculative indexes, and prune raw upload artefacts once extraction succeeds.
6. All schema changes go through Prisma migrations. Never hand-edit the database to match code.
7. Enums for urgency, relevance, impact area, geography, audience target, brief type, brief status, and classification are defined once in the schema and imported everywhere. Do not re-declare them as string unions in UI code.
8. Ingestion is logged, and staff are notified of new knowledge base additions.

---

# 13. Gemini usage

1. Model IDs, generation parameters, and rate-limit budgets are centralised in a config module. Never inline a model ID in a route, action, or job.
2. Generation: Gemini 3.6 Flash, temperature 0.3, max tokens 4000. Embeddings: Gemini Embedding 2.
3. Free tier means roughly 1,500 requests/day and 15 RPM. Every call path handles 429 with exponential backoff. Embedding work is batched. A rate limit is a handled, user-visible state, never a crash.
4. **A rate limit hit mid-generation degrades gracefully** with a clear retry-timing message — never a generic error, never a lost draft.
5. Every Gemini call passes the governance gate first (section 7).
6. The brief-generation system prompt includes the Tropenbos mission statement, 2023–2027 strategy goals, Ghana forestry context, current TBI positions on EUDR and tree tenure, and audience tone guidelines. Keep it in one versioned location, not scattered across call sites.
7. Evidence context is the top 8 matched items passed as structured context with source metadata. Never pass unbounded context.
8. Validate every structured response with Zod before use (section 9).
9. Never log prompts or completions containing evidence body text (section 7).

---

# 14. Policy Radar and background jobs

1. All scheduled and event-triggered work runs as Inngest functions. Never a bare `setInterval`, never real work inline in a cron route, never a fire-and-forget promise in a request handler.
2. Respect per-source cadences — Ghana Gazette / Forestry Commission daily, EUDR weekly, UNFCCC daily during COP, Cocobod weekly, ITTO monthly, CBD monthly, news daily. Cadences live in config, not scattered across job definitions.
3. Structured sources are scraped with Playwright; RSS feeds are polled; unstructured monitoring uses Gemini with Google Search grounding.
4. Deduplicate signals with fuzzy text matching before creating a record. A repeat alert on the same event is a defect.
5. Radar jobs run server-side with retry logic and tolerate slow or unreachable sources without failing the whole run. One dead source does not abort the batch.
6. Structure jobs to stay within Inngest free-tier limits — batch and fan out deliberately rather than one invocation per item.
7. Staff receive a morning digest of classified signals via email (Resend) and/or Slack webhook. A source returning no new signals is reported in the weekly gap analysis — silence may mean a monitoring failure, not a quiet week.
8. The Evidence Matcher is triggered by signal detection. The Brief Generator is not (section 8).
9. The Impact Tracker runs weekly.

---

# 15. Evidence Matcher and RAG

1. Retrieval order is fixed: embed the signal text → pgvector cosine similarity → top 20 candidates → cross-encoder rerank → top 8 to the generator with relevance scores and source metadata.
2. Only `public_published` evidence enters retrieval (section 7).
3. Metadata filters are country, year, impact area, and evidence type (field data vs. literature).
4. **Evidence gaps are surfaced, not hidden.** When nothing clears the confidence threshold, return an explicit gap — and in the UI, an empty state with a real next step (broaden the search, flag as a research gap), never a blank panel.
5. Officers can add and remove matched evidence before generation; the final evidence set used for a brief is recorded on the brief.
6. RAG orchestration uses LangChain.js inside Server Actions. Retrieval logic stays in the AI and data layers, never in a component.

---

# 16. Brief generation output

1. Brief types are policy brief (4–6pp), technical submission (8–15pp), position paper (2–3pp), stakeholder note (1pp), media backgrounder (1pp). Length targets are part of the contract, not a suggestion.
2. Standard policy brief structure: header (issue title, date, audience, classification) → executive summary (3–4 sentences, one clear recommendation) → context (max 200 words) → evidence (3–5 findings with citations and landscape specificity) → recommendations (2–4 concrete asks, one per decision-maker type) → implementation pathway → about Tropenbos Ghana.
3. The five audience profiles are Ghana ministry official, cocoa company sustainability team, EU regulator / DG ENV, donor / programme officer, and CREMA community governance. Each has defined framing emphasis and tone; profiles live in one config location.
4. Audience switching reframes the **same** evidence — it must read as "same evidence, reframed", not "new document loaded". Citations stay anchored; diff against the current draft rather than replacing it wholesale.
5. Every brief records its signal, evidence set, audience, version, and generating model.
6. Translation assist renders Twi on demand for community-facing versions — not pre-computed, and still a Gemini call subject to section 7.
7. Generation target is a draft within 60 seconds, shown as sequenced progress states — "Reading evidence" → "Drafting" → "Verifying citations" — not a generic spinner.
8. Export goes Tiptap document → `docx` for Word, Pandoc for PDF, plus Google Docs. Export never bypasses flag state: exporting a brief with unresolved flags carries a visible notice.

---

# 17. Field officer, offline, and required UX states

1. Field Officer routes are mobile-first and low-bandwidth. Submission is a lightweight form (text, optional photo) with no login friction beyond initial SSO.
2. Offline submissions queue locally and sync automatically when connectivity returns, with a visible "waiting to sync" indicator. **Never a silent failure and never a silent queue.**
3. Field submissions enter as `community_sourced` at `unpublished_internal`, blocked from the AI pipeline until a Research Officer reviews them (section 7). A Research Officer is notified of each new submission.
4. Offline caching covers the last 30 signals and 10 briefs as static JSON via a service worker, with a visible "offline — showing cached data" banner rather than silent failure.
5. The WhatsApp/USSD digest path is read-only and requires no login.
6. These states need explicit design treatment on every relevant screen, not just the happy path:
   - **empty** — Evidence Matcher returns nothing above threshold, with a real next step
   - **rate-limited** — Gemini free-tier limit hit mid-generation, with retry timing
   - **offline / sync-pending** — queued field submission, visibly indicated
   - **classification-pending** — evidence awaiting review, surfaced as a queue count
   - **flagged** — hallucination-guard flag awaiting resolution, blocking approval

---

# 18. Security, code standards, and env vars

Never expose to browser code:

- Gemini / Google AI credentials
- Supabase service role key and direct database URL
- Auth.js secret and Google OAuth client secret
- Inngest signing and event keys
- Resend, Uploadthing, Twilio/360dialog, and Africa's Talking credentials
- Sentry auth token

Never run from browser code:

- Gemini or model calls
- Playwright scraping or radar processing
- embedding, retrieval, generation, or the fact-check pass
- Prisma queries or pgvector search
- job scheduling or Inngest invocation

## Environment variables

The canonical list lives in `.env.example`. Only `NEXT_PUBLIC_*` values may reach browser code; everything else is server-only.

| Variable | Purpose | Exposure |
| -------- | ------- | -------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini 3.6 Flash generation, Gemini Embedding 2, Google Search grounding | server only |
| `DATABASE_URL` | Supabase pooled connection for Prisma Client | server only |
| `DIRECT_URL` | Supabase direct connection for Prisma migrations | server only |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role access for server-side jobs and storage | server only |
| `AUTH_SECRET` | Auth.js v5 session and JWT signing | server only |
| `AUTH_URL` | Auth.js canonical deployment URL | server only |
| `AUTH_GOOGLE_ID` | Google Workspace OAuth client ID | server only |
| `AUTH_GOOGLE_SECRET` | Google Workspace OAuth client secret | server only |
| `AUTH_ALLOWED_DOMAIN` | Workspace domain restriction for SSO sign-in (section 10) | server only |
| `INNGEST_EVENT_KEY` | Sending events to Inngest | server only |
| `INNGEST_SIGNING_KEY` | Verifying Inngest requests to the serve endpoint | server only |
| `RESEND_API_KEY` | Morning digest and notification email | server only |
| `DIGEST_FROM_EMAIL` | Verified sender address for digests | server only |
| `UPLOADTHING_TOKEN` | PDF and document ingestion uploads | server only |
| `SLACK_WEBHOOK_URL` | Optional; signal digest delivery to Slack | server only |
| `WHATSAPP_API_TOKEN` | WhatsApp Business API auth (Twilio or 360dialog) | server only |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp sender identity | server only |
| `AFRICASTALKING_USERNAME` | Africa's Talking USSD gateway auth | server only |
| `AFRICASTALKING_API_KEY` | Africa's Talking USSD gateway auth | server only |
| `SENTRY_DSN` | Server-side error reporting | server only |
| `SENTRY_AUTH_TOKEN` | Source map upload at build time | server only |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser error reporting | client + server |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project key | client + server |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host (self-hosted) | client + server |

Keep this table and `.env.example` in sync when variables change. Never commit a real secret. Never send evidence body text to Sentry or PostHog (section 7).

## Code standards

Use TypeScript.

Prefer small functions, explicit types, centralised limits and model IDs, server-only modules, typed pipeline results, shared Zod schemas, and safe error handling.

Avoid `any`, unrelated refactors, over-engineering, long route handlers and Server Actions, mixed UI/business logic, silent catches, and unrequested features.

When in doubt:

1. Keep it small.
2. Use the relevant skill.
3. Check the governance gate.
4. Preserve server/client boundaries.
5. Ask a focused question if needed.
6. Save a prompt before coding.
7. Ask if it is good to execute.
8. Implement after confirmation.
9. Run available checks.
10. Share exact test steps.

---

# 19. Commands and checks

Scripts that currently exist in `package.json`:

- `npm run dev` — start the Next.js dev server (Turbopack); watch its terminal for job and pipeline logs
- `npm run build` — Next.js production build
- `npm run start` — run the production build locally after `npm run build`
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:generate` — `prisma generate`; writes the client to `lib/generated/prisma` (gitignored). Also runs automatically as `postinstall`.
- `npm run db:migrate:new -- <snake_case_name>` — author a migration from the live-database diff, for review. Writes a file; applies nothing.
- `npm run db:migrate` — `prisma migrate deploy && prisma generate`; applies pending migrations. Same command in dev, CI, and production. Needs `DIRECT_URL`.
- `npm run db:studio` — `prisma studio`

> **Never run `prisma migrate dev`.** Prisma has no HNSW index type, so the pgvector similarity indexes on `evidence_chunk.embedding` and `policy_signal.embedding` live only in migration SQL and are invisible to `schema.prisma`. Every diff consequently proposes `DROP INDEX` on both, and `migrate dev` writes those drops into the migration it generates — silently leaving both vector columns unindexed, which makes every retrieval a sequential scan (section 15.1). `npm run db:migrate:new` produces the same diff with those drops filtered out; it protects any index named `*_embedding_cosine_idx`, so name new pgvector indexes to that pattern. A migration that adds a vector column must have its HNSW cosine index written in by hand, as `prisma/migrations/20260730100000_init/migration.sql` does.

"Run available checks" (sections 2 and 18) currently means running `npm run lint` and `npm run typecheck`, plus `npm run build` when the change could affect the build, and reporting the exact output.

> **Known lint noise.** `npm run lint` currently reports 4 pre-existing errors from code this project does not own: `react-hooks/set-state-in-effect` in the vendored `components/ui/carousel.tsx` and `hooks/use-mobile.ts`, and two errors in `design_handoff_evibrief/support.js`, which is prototype runtime and not application code (section 2). Do not reformat vendored component files or the handoff to satisfy a style rule. Read the output for problems in *your* files.

> **Gaps to flag, not to invent.** There is no test script, and no Inngest or Playwright tooling in `package.json` yet. When a prompt first introduces one of these, add the script in that same change and update this section with it. Never reference a script name before it exists.

Report the exact command output; never claim a check passed without running it.
