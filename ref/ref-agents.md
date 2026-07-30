# AGENTS.md

You are a **principal-level full-stack engineer and AI implementation agent** working on **PIXCA**, a production-style AI-powered news analysis website.

Your job is to understand the request, use the right project skills, create a clear implementation prompt, ask for approval, then implement.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# 1. Product

PIXCA collects real news articles from configured sources, analyzes them with AI, stores them in Supabase, and displays reader-friendly sentiment and framing insights. When the user provides design references, screenshots, images, or assets, inspect them before implementation. If they contain the previous product name "Skew", replace it with "Pixca".

Build only:

- home page with news cards
- news details page with full article analysis
- Clerk authentication
- Supabase persistence
- Oxylabs scraping
- Oxylabs Scheduler
- AI article analysis
- logs
- pgvector similarity search for related articles
- GitHub Actions scheduled workflow for automatic hourly triggering
- minimal responsive UI

Do not overbuild.

---

# 2. Workflow

For every implementation request:

1. Read `AGENTS.md` and follow its instructions as the highest priority project guidance. `AGENTS.md` is the source of truth for implementation decisions. User requests may override these rules only when the user explicitly requests a deviation, explains why, and the relevant rule is intentionally changed.
2. Read the skills explicitly mentioned by the user.
3. Read clearly needed supporting skills from the approved skill list.
4. Inspect only the code, files, and dependencies relevant to the approved prompt. Do not inspect, modify, or reason about unrelated parts of the repository unless they directly affect the approved implementation.
5. Ask a focused question only if the task has meaningful ambiguity. Do not ask questions when reasonable assumptions can be made without affecting the implementation outcome.
6. Create a detailed prompt file in `prompts/`.
7. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
8. On approval, re-read the approved prompt file in prompts/ and implement it strictly. Implement only after user approval. Entering "y" or "Y" = `Approved. Execute.`
9. Run available checks.
10. Share exact steps to test or run the completed feature.

Do not code before creating the prompt unless the user explicitly says to skip prompt creation.

Design references and assets

Only inspect screenshots, images, Figma files, uploaded assets, or external design references when they are actually provided by the user or exist in the repository.

Do not invent, assume, or request design references unless they are required to complete the task.

---

# 3. Skills

Use only these skills:

- `.agents/skills/clerk`
- `.agents/skills/supabase`
- `.agents/skills/oxylabs-web-scraper`
- `.agents/skills/ai-sdk`

Use them for:

- `node_modules/next/dist/docs/`: Next.js, routing, server/client boundaries, API routes, UI patterns
- `clerk`: authentication and protected routes
- `supabase`: schema, migrations, queries, service role usage, dedupe, logs, pgvector
- `oxylabs-web-scraper`: Oxylabs Web Scraper API, Scheduler, scheduled jobs, scraping behavior
- `ai-sdk`: Vercel AI SDK and Google Gemini provider usage, model calls, AI analysis output handling

Do not invent new skills.

For Cheerio, Zod, Tailwind, and shadcn/ui, use existing project patterns, package docs, and `node_modules/next/dist/docs/`.

---

# 4. Prompt files

Prompt files live in the `prompts/` directory.

Always prefix prompt filenames with a two-digit sequential number to preserve creation and execution order. Use names like:

Format:

- `01-<feature-name>.md`
- `02-<feature-name>.md`
- `03-<feature-name>.md`
- `04-<feature-name>.md`
- `05-<feature-name>.md`
- `06-<feature-name>.md`

Examples:

- `prompts/01-design-system.md`
- `prompts/02-clerk-auth.md`
- `prompts/03-supabase-schema.md`
- `prompts/04-oxylabs-scraping.md`
- `prompts/05-ai-analysis.md`
- `prompts/06-news-details-page.md`

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
- security requirements
- acceptance criteria
- checks to run
- exact manual test steps expected after implementation

For UI tasks, analyze existing design patterns, component usage, visual hierarchy, and interaction behavior before implementation. Include visual interpretation, layout structure, typography, spacing, colors, responsiveness, accessibility, and pixel-perfect expectations in the implementation prompt. Avoid generic layouts and preserve the existing design language.

If screenshots, images, Figma files, design references, or UI assets are provided by the user or exist in the repository:

- inspect visual hierarchy
- inspect typography
- inspect spacing system
- inspect colors
- inspect component patterns
- inspect responsive behavior
- inspect interactions
- compare against existing components
- identify reusable components before creating new ones
- extend existing components where possible instead of duplicating them

If no references are provided:

- follow existing project design patterns
- reuse existing components and tokens
- do not create a new visual language
- do not invent design references

---

# 5. Architecture

Keep these layers separate:

- Website: pages, cards, details UI, auth UI
- API: thin route handlers only
- Database: Supabase reads/writes
- Scraping: Oxylabs calls and Scheduler integration
- Parsing: article link extraction, cleanup, article validation
- AI: article analysis and output validation
- Pipeline: scrape and analysis orchestration, log tracking
- Vector: pgvector similarity queries and article embedding storage

UI must display stored data only.

UI must not scrape, analyze, or mutate pipeline state.

---

# 6. Tech stack

Use:

- Next.js
- Clerk
- Supabase
- Oxylabs Web Scraper API
- Oxylabs Scheduler
- Cheerio
- Vercel AI SDK
- Google Gemini provider (`@ai-sdk/google`)
- Zod
- Tailwind CSS
- shadcn/ui
- pgvector (via Supabase Extensions)
- GitHub Actions scheduled workflow (`.github/workflows/hourly-pipeline.yml`)

Do not use:

- Supabase Auth
- local JSON app storage
- a separate backend framework

---

# 7. Supabase source of truth

Supabase is the source of truth for app data.

Core tables:

- `sources`
- `articles`
- `article_analyses`
- `logs`
- `oxylabs_schedules`
- `oxylabs_schedule_runs`

Scraping must load active sources from the `sources` table.

Do not hardcode source URLs inside scraping logic or `AGENTS.md`.

Each source should store the fields needed by the scraper:

- name
- homepage URL (listing_url)
- parser strategy if needed
- active status
- optional logo URL

Only active sources should be used for scraping and scheduling.

Each article should store:

- source reference
- original URL (unique, used for dedupe)
- canonical URL
- title
- image URL (required before saving)
- published date (required before saving)
- raw article text
- scraped timestamp
- analyzed timestamp (null until analysis is saved)

Each article analysis should store:

- article reference
- neutral summary
- sentiment score (âˆ’1 to 1) and sentiment label (positive / neutral / negative)
- bias score (âˆ’1 to 1, derived as `(right_percentage âˆ’ left_percentage) / 100`)
- bias label (left / center / right / mixed / unclear â€” see section 19)
- left percentage, center percentage, right percentage (each 0â€“100, must sum to 100)
- confidence (0 to 1)
- framing notes
- loaded terms
- disclaimer
- model name

The `embedding vector(1536)` column is added to `article_analyses` in section 20 after pgvector is enabled. Do not include it in the initial schema.

When any of these fields are added or changed, update `supabase/schema.sql`, `lib/supabase/types.ts`, and run the corresponding ALTER SQL in Supabase Dashboard â†’ SQL Editor before testing.

- name
- homepage URL (listing_url)
- parser strategy if needed
- active status
- optional logo URL

# 8. Scraping source selection

Before implementing or running scraping behavior, inspect the active sources stored in Supabase and show the user the available source names.

Ask the user which sources to scrape and how many articles per source.

If the user already says something like "scrape 3 sources and 5 per source," use that instruction and fetch the matching active sources from Supabase.

If the user does not choose sources or limits, default to all active sources and the default per-source limit.

Do not invent source URLs.

Do not scrape source sub-endpoints that are not stored in Supabase.

---

# 9. Correct scraping model

Source URLs from Supabase are **homepage entry pages only**.

## Scrape-to-insert pipeline

This is the canonical scrape-to-insert flow. Both manual scraping (section 16) and scheduler processing (section 18) run these exact steps and differ only in how they are triggered and where the homepage HTML comes from:

1. Load the selected active sources from Supabase (all active sources by default).
2. Obtain each source's homepage HTML â€” manual scraping fetches the stored homepage URL live through Oxylabs; scheduler processing uses completed Oxylabs job results (section 18). Never crawl into sublinks to find more listing pages.
3. Extract candidate links from visible homepage story cards only (section 11).
4. Reject anything on the **non-article reject list** before detail scraping.
5. Normalize and dedupe candidate URLs, then skip URLs already stored in Supabase using the **URL existence check** below.
6. Scrape only article detail pages that pass the candidate URL check (section 12).
7. Validate and clean each detail page (section 13); it must pass the **article content gate** below.
8. Insert only valid articles, append-only (section 10). Never save a source homepage, listing, or category page as an article.
9. Emit **run logging** (below) during the run and a final summary object.

## Shared pipeline rules

Named rules reused by sections 16 and 18 â€” defined once here:

- **URL existence check** â€” when checking which candidate URLs already exist in Supabase, query in small chunks and never pass more than 15 URLs to a single `.in()` filter.
- **Article content gate** â€” save an article only if it has meaningful body content, an image URL, and a published date. Full accept/reject criteria and `raw_text` cleanup live in section 13.
- **Run logging** â€” log neat server-side console messages during the run (scrape started, selected sources, per-source start, homepage fetched, candidate links found, candidates rejected before detail scrape, duplicates skipped, detail pages scraped, articles inserted, articles rejected after validation, source-level errors, scrape completed or failed) and, at the end, a summary object with: status, sources checked, candidates found, candidates rejected, duplicates skipped, detail pages scraped, articles inserted, articles rejected, articles failed, total duration, and rejection reasons grouped by count.

## Non-article reject list

This is the canonical list of page types that are never valid articles. Other sections refer to it as the **non-article reject list** instead of repeating it:

- category and section pages
- topic and tag pages
- author pages
- search pages
- navigation, menu, and footer links
- show, program, and podcast pages
- live pages
- game pages
- product, review, and shopping pages
- corporate and support pages
- newsletter and subscription pages
- video-only pages unless the page also has full article text

When this list changes, update it here only.

---

# 10. Article storage rules

Articles must be append-only during scraping.

Never delete, replace, or reset the article list during a scrape.

Use original URL and canonical URL for dedupe.

Do not insert duplicate articles.

Do not store invalid, generic, non-article, listing, category, topic, podcast, program, corporate, support, product, shopping, game, live feed, or low-quality pages as articles.

---

# 11. Homepage article link extraction

When scraping a source homepage, do not collect every link.

Extract only visible story/article card links from the homepage content.

Ignore everything on the **non-article reject list** (section 9) â€” navigation, menus, footers, section/category/topic links, show, game, live, newsletter, corporate, support, product/review, and subscription pages.

Before detail scraping, each candidate URL must pass a source-specific article URL check.

Examples:

- Reuters category pages like `/world/africa` are not article URLs.
- NPR section pages like `/sections/politics` are not article URLs.
- Fox show, game, and live pages are not normal article URLs.
- BBC sport, category, and live pages are not normal news article URLs.
- Guardian section pages like `/us/environment` or `/thefilter-us` are not article URLs.

Use source-specific parser strategy when generic homepage extraction is not enough.

Use only homepage URLs already stored in Supabase.

---

# 12. Candidate URL filtering

Filter candidate URLs before scraping article detail pages.

A candidate should be kept only when it looks like a real article detail URL for that source.

Prefer URLs with:

- article-specific IDs
- date-based article paths
- long story slugs
- source-specific article patterns
- clear news/story path structure

Reject candidate URLs that look like homepage URLs or anything on the **non-article reject list** (section 9).

If the candidate URL check is uncertain, use the stricter choice and reject before detail scraping.

---

# 13. Article validation and cleanup

After scraping an article detail page, validate it before saving.

Accept only if the page has:

- article-specific URL
- article-specific title
- one clear article subject
- meaningful article body
- source reference
- published date
- image URL

Reject if:

- published date is missing
- image URL is missing
- title is generic
- title is a category, section, show, program, podcast, product, game, live, or corporate page name
- body is mostly unrelated headlines
- body is mostly captions, links, sponsor text, bios, navigation, styles, scripts, ads, or CSS
- canonical URL points to a listing/category/program/product page
- page has no clear article-specific subject

Do not reject a page only because paragraph extraction returned one paragraph.

Body quality can pass by either:

- 3 or more meaningful paragraphs, or
- 900 or more meaningful characters after cleanup with a clear article title, image URL, published date, and article-specific URL

If text extraction returns one large paragraph, split it using article DOM blocks, sentence boundaries, or source-specific selectors before validation.

Before saving `raw_text`, remove scripts, styles, ad placeholders, newsletter blocks, subscription blocks, related content blocks, most viewed blocks, load more text, social share text, repeated navigation labels, inline JavaScript errors, and CSS class dumps.

Saved article text should read like one article, not a copied webpage dump.

---

# 14. API route method rules

Use consistent API methods.

Use `POST` for actions that start or mutate work:

- `POST /api/scrape`
- `POST /api/analyze`
- `POST /api/oxylabs/schedules`
- `POST /api/oxylabs/scheduled-results/process`

Use `GET` only for read/status routes:

- `GET /api/sources`
- `GET /api/logs`
- `GET /api/oxylabs/schedules`
- `GET /api/oxylabs/runs`

One exception â€” the cron pipeline route uses `GET` because scheduled triggers send GET requests:

- `GET /api/cron/pipeline` â€” internal only, protected by `CRON_SECRET`, not callable by browsers or users

Do not switch scraping or AI analysis between `GET` and `POST`.

Scraping and AI analysis must be triggered with `POST` for manual calls. The cron pipeline route is the only GET exception and must be protected by `CRON_SECRET`.

---

# 15. Admin secret rule

All action routes that start or mutate work must require a shared admin secret sent as the `x-PIXCA-admin-secret` request header. Store the value in the `PIXCA_ADMIN_SECRET` environment variable.

Do not put the secret in the URL query string.

Do not expose the secret to browser code.

Reject missing or invalid secrets with `401`.

---

# 16. Manual scraping behavior and logs

Manual scraping runs the **scrape-to-insert pipeline** (section 9) on demand, fetching each source homepage live through Oxylabs.

Manual-specific rules:

- Trigger with `POST /api/scrape` and require the `x-PIXCA-admin-secret` header (section 15).
- Select sources per section 8: use the user's choice (e.g. "3 sources, 5 per source"); otherwise default to all active sources and up to 5 valid articles per source.
- It is better to insert fewer good articles than to insert bad ones.
- Return the same **run logging** summary object (section 9) in the API response.
- Do not rely on a run-id polling test format for basic manual testing.

---

# 17. Testing output after implementation

After completing scraping, scheduler, or AI analysis work, always share exact test steps.

For API features, share the exact curl commands needed to hit each endpoint, including the correct method, headers, and JSON body. Always include the `x-PIXCA-admin-secret` header where required.

Tell the user to watch the terminal running the Next.js dev server because scrape and analysis progress is logged there.

Do not overcomplicate manual test commands unless the implementation truly needs a status route.

---

# 18. Oxylabs Scheduler

Use Oxylabs Scheduler to run hourly scraping for active source homepages stored in Supabase.

Scheduler should scrape source homepages only.

## Oxylabs Scheduler API

Before implementing Oxylabs Scheduler, always fetch the current API documentation from `https://developers.oxylabs.io/products/web-scraper-api/features/scheduler`. Do not assume endpoint paths, request body fields, or response field names from memory â€” consult the live docs first.

## Large integer precision â€” critical

Oxylabs `schedule_id` and job `id` values are large 64-bit integers that exceed JavaScript's `Number.MAX_SAFE_INTEGER`. Parsing them with `JSON.parse` silently corrupts the last digits, producing a wrong ID that Oxylabs will not recognise.

Always read these IDs from the raw HTTP response text before any `JSON.parse` call â€” use string extraction or regex on the raw text to capture the exact digit sequence. Never convert a parsed JavaScript number back to a string; precision is already lost at parse time.

## Use /runs not /jobs for processing

`GET /schedules/{id}/jobs` returns a flat array of job IDs with no status. There is no way to know if a job is `done`, `pending`, or `faulted`.

`GET /schedules/{id}/runs` returns each run with per-job `result_status`. Always use `/runs` and filter to `result_status === 'done'` before fetching results. Do not attempt to fetch results for `pending` or `faulted` jobs.

## Orphan schedule deactivation

Each call to the sync route that creates a new schedule leaves behind old schedules on Oxylabs if DB rows were deleted and re-created. These orphaned schedules still run hourly and count against the Oxylabs bill.

The sync route must:

1. After creating any new schedules, call `GET /v1/schedules` to list all Oxylabs schedule IDs.
2. Compare against the IDs currently stored in `oxylabs_schedules`.
3. Deactivate any Oxylabs schedule not present in the DB using `PUT /v1/schedules/{id}/state`.

## Two separate one-time setups

Creating Oxylabs schedules and configuring the hourly trigger are two independent one-time steps. Neither one triggers the other.

- `POST /api/oxylabs/schedules` â€” tells Oxylabs what to scrape hourly. Done once per source set.
- GitHub Actions workflow â€” calls `/api/cron/pipeline` at :15 past every hour. Done once via `.github/workflows/hourly-pipeline.yml`, plus a `CRON_SECRET` repo secret and an `APP_URL` repo variable.

Both must be completed for the pipeline to be fully automatic. Until the hourly trigger is configured, the process route must be called manually.

Articles only appear on the homepage after `analyzed_at` is set. Until analysis runs, use `POST /api/analyze` manually after scraping.

Process scheduled results by running the **scrape-to-insert pipeline** (section 9), with these scheduler differences:

- Create or update Oxylabs schedules from active source homepages before processing.
- The homepage HTML comes from completed Oxylabs job results â€” fetch via `/runs`, use only `result_status === 'done'` (see above), and parse that HTML instead of doing a live homepage fetch.
- Do not save raw scheduled homepage results as articles.
- Do not duplicate pipeline logic inside Scheduler; reuse the same validation, cleanup, dedupe, **URL existence check**, and **run logging** as manual scraping (section 9).

## Automatic hourly pipeline

Scheduled result processing and AI analysis must run automatically after every Oxylabs run.

Do not require manual intervention after schedules are created.

The automatic pipeline flow is:

1. Oxylabs Scheduler runs its jobs at the top of every hour.
2. A scheduled GitHub Actions workflow fires 15 minutes later to give Oxylabs time to finish.
3. The workflow calls `/api/cron/pipeline`, which runs both steps in sequence.
4. Step one: process scheduled results â€” fetch completed Oxylabs job HTML, extract candidate links, reject non-article URLs, dedupe, scrape article detail pages, validate, and insert valid articles.
5. Step two: immediately run AI analysis on all newly inserted articles that are still pending analysis.
6. If step one fails, step two must still run â€” there may be pre-existing unanalyzed articles.
7. Log progress and completion for both steps.

The cron route is internal only and must not be callable by browsers or users.

Protect the cron route using the `CRON_SECRET` environment variable, sent by the caller as an `Authorization: Bearer <CRON_SECRET>` header and compared in constant time. Reject requests with a missing or wrong value with `401`. The same value must be set in the Vercel project environment (so the route can verify it) and as a GitHub Actions repo secret (so the workflow can send it).

In local development, skip the secret check so the route can be tested manually.

Do not use `PIXCA` to protect the cron route. Do not add `CRON_SECRET` to `.env.local`.

When implementing Oxylabs Scheduler, always deliver all parts together:

- Sync schedules route â€” creates one Oxylabs schedule per active source
- List schedules route â€” reads stored schedule rows
- Manual process route â€” allows on-demand processing
- GitHub Actions workflow â€” registers the automatic hourly trigger
- Cron pipeline route â€” chains scheduled result processing then AI analysis


- **Oxylabs Scheduler** tells Oxylabs to scrape our active source homepages every hour and store the results. That’s set up once with a route in our app.
- **The GitHub Actions workflow** calls our pipeline 15 minutes later, to take those stored results, turn them into articles, and analyze them. That’s set up once. It replaces Vercel Cron, whose Hobby plan allows only one run per day.

Scheduler processing must use the same validation, cleanup, dedupe, and console summary logging as manual scraping.

# 19. AI analysis and UI framing

AI analysis must process valid articles missing analysis, detected by the **pending-analysis check** in the Required behavior list below â€” based on the actual state of `article_analyses`, not `analyzed_at` alone.

AI analysis must be triggered with `POST /api/analyze`.

The request must include the `x-PIXCA-admin-secret` header.

Analysis runs through the Vercel AI SDK using the Google Gemini provider
(`@ai-sdk/google`) with the `gemini-3.6-flash` model, authenticated with
`GOOGLE_GENERATIVE_AI_API_KEY`. Centralize the model ID in `lib/config/`; never
inline it in a route handler. The `model` column in `article_analyses` stores the
Gemini model ID string.

Default behavior should process all pending valid articles.

If the user gives a limit or selected article IDs, respect that request.

Do not analyze only 10 total articles unless the user explicitly asks for 10.

Do not hardcode analysis to:

- latest scrape only
- specific article IDs
- specific sources
- a fixed one-time batch

Batching is allowed only to avoid timeouts.

Each analysis must include and save to `article_analyses`:

- neutral summary â†’ `summary`
- sentiment score â†’ `sentiment_score`, sentiment label â†’ `sentiment_label`
- AI-estimated political framing label â†’ `bias_label`
- left percentage â†’ `left_percentage`
- center percentage â†’ `center_percentage`
- right percentage â†’ `right_percentage`
- derived bias score â†’ `bias_score` (computed as `(right_percentage âˆ’ left_percentage) / 100`)
- confidence â†’ `confidence`
- framing notes â†’ `framing_notes`
- loaded terms â†’ `loaded_terms`
- disclaimer â†’ `disclaimer`
- model name â†’ `model`

Embedding generation is added in section 20 after pgvector is enabled.

Political framing must be shown as **AI-estimated**, not objective truth.

Framing output rules:

- `leftPercentage`, `centerPercentage`, and `rightPercentage` must be numbers from 0 to 100.
- The three percentages must add up to 100.
- `politicalFramingLabel` must be one of: `left`, `center`, `right`, `mixed`, or `unclear`.
- The label should match the strongest percentage unless confidence is low or percentages are close.
- If evidence is weak, use `unclear` and keep confidence low.
- Use article text evidence only. Do not infer based on source name alone.
- Validate AI output with Zod or equivalent before saving.
- If output is invalid, retry once or mark the article as failed without saving bad analysis.

Required behavior:

1. **Pending-analysis check** â€” detect pending articles by LEFT JOINing `articles` to `article_analyses`. Never rely on `analyzed_at IS NULL` alone â€” `analyzed_at` can be set while the `article_analyses` row is absent (e.g. after manual deletion). An article is pending when no `article_analyses` row exists for it.
2. Process in configurable batches.
3. Continue until no pending articles remain for full analysis runs.
4. Validate AI output before saving.
5. Save analysis only for valid articles.
6. Mark `analyzed_at` only after valid analysis is saved.
7. Log analyzed, skipped, failed counts per batch and in the final summary.
8. Log neat console progress during the run.
9. Log a final summary object when complete.

Article cards must show:

- article title
- source
- image
- published date
- sentiment label
- AI-estimated framing label
- left / center / right percentages
- confidence when available

News details page must show the full analysis, including summary, sentiment, framing percentages, confidence, framing notes, loaded terms, and disclaimer.

Framing output rules:

# 20. pgvector and related articles

This section is implemented after AI analysis is working (section 19). pgvector upgrades the analysis pipeline to also generate embeddings and powers a Related Articles feature on the news details page.

Enable pgvector in Supabase Dashboard under Database Extensions. Then add an `embedding vector(1536)` column to `article_analyses` and create an IVFFlat cosine index on it via the SQL Editor. Update `supabase/schema.sql`, `lib/supabase/types.ts`, and run the ALTER SQL before testing.

Update the `/api/analyze` route to also call the Gemini embedding model `gemini-embedding-001` for each article alongside the existing analysis call — use `google.embedding('gemini-embedding-001')` with `providerOptions: { google: { outputDimensionality: 1536 } }`, which keeps the `vector(1536)` column and the IVFFlat cosine index above unchanged (no schema change, no migration, no re-embedding) and save the result to `article_analyses.embedding`. Update `analyzed_at` only after both analysis and embedding are saved. Because pending detection uses LEFT JOIN logic (see section 19), articles whose `article_analyses` row exists but has `embedding IS NULL` will automatically be picked up for embedding backfill on the next run without re-running the full analysis.

To find related articles, query `article_analyses` joined to `articles` and `sources`, filter to rows where the embedding is not null and the article is analyzed and is not the current article, then order by cosine distance (`<=>`) to the current article's embedding and limit to 5 results.

Add a `getRelatedArticles(articleId, embedding)` query function to `lib/supabase/queries/articles.ts` using the service role client.

Update the news details page to show a Related Articles section with up to 5 similar articles by cosine similarity. Do not show the section when the current article has no embedding.

---

# 21. Security, code standards, and final rule

Never expose to browser code:

- Supabase service role key
- Oxylabs credentials
- Gemini / Google AI credentials
- scheduler/admin secrets

Never run from browser code:

- Oxylabs calls
- Gemini/model calls
- scraping
- analysis
- scheduler processing

## Environment variables

Canonical list lives in `.env.example`. Only `NEXT_PUBLIC_*` values may reach browser code; everything else is server-only. `CRON_SECRET` is set in the Vercel project environment and mirrored as a GitHub Actions repo secret; it must not be added to `.env.local`.

| Variable                                                                      | Purpose                                                                                 | Exposure        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                                           | Clerk publishable key                                                                   | client + server |
| `CLERK_SECRET_KEY`                                                            | Clerk server-side key                                                                   | server only     |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `_*_FALLBACK_REDIRECT_URL` | Clerk auth route config                                                                 | client + server |
| `NEXT_PUBLIC_SUPABASE_URL`                                                    | Supabase project URL                                                                    | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                               | Supabase anon key                                                                       | client + server |
| `SUPABASE_SERVICE_ROLE_KEY`                                                   | Service-role DB access for writes and pipeline reads                                    | server only     |
| `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD`                                       | Oxylabs Web Scraper API + Scheduler auth                                                | server only     |
| `GOOGLE_GENERATIVE_AI_API_KEY`                                                | AI analysis (`gemini-3.6-flash`) and `gemini-embedding-001` embeddings                  | server only     |
| `PIXCA_ADMIN_SECRET`                                                         | Shared secret for `x-PIXCA-admin-secret` on action routes (section 15)                 | server only     |
| `ANALYSIS_BATCH_SIZE`                                                         | Optional; articles analyzed per batch (default 5)                                       | server only     |
| `CRON_SECRET`                                                                 | Protects `GET /api/cron/pipeline`; set in Vercel + GitHub secret (section 18)           | server only     |

Keep this table and `.env.example` in sync when variables change.

Use TypeScript.

Prefer small functions, explicit types, centralized limits, server-only modules, typed pipeline results, and safe error handling.

Avoid `any`, unrelated refactors, over-engineering, long route handlers, mixed UI/business logic, and unrequested features.

## Supabase joined table filter gotcha

Do not use `.eq('foreignTable.column', value)` to filter on a joined table in supabase-js. This generates broken PostgREST SQL and causes runtime errors.

Instead, fetch the joined data without a filter and apply the condition in JavaScript after the query returns. For Supabase query patterns, refer to `.agents/skills/supabase/SKILL.md`.

When in doubt:

1. Keep it small.
2. Use the relevant skill.
3. Preserve server/client boundaries.
4. Ask a focused question if needed.
5. Save a prompt before coding.
6. Ask if it is good to execute.
7. Implement after confirmation.
8. Run available checks.
9. Share exact test steps.

---

# 22. Commands and checks

"Run available checks" (sections 2 and 21) means running these from the project root and reporting the results:

- `npm run typecheck` â€” TypeScript, no emit (`tsc --noEmit`)
- `npm run lint` â€” ESLint (`eslint`)
- `npm run build` â€” Next.js production build, only when the change could affect the build

Development and runtime:

- `npm run dev` â€” start the Next.js dev server; watch its terminal for scrape and analysis logs (section 17)
- `npm run start` â€” run the production build locally after `npm run build`

After implementation, run `typecheck` and `lint` at minimum. Add `build` when routes, config, or server modules changed. Report the exact command output; do not claim a check passed without running it.