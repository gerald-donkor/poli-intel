# 21 — Policy Radar: grounded search (the seventh source)

## Goal

Implement **Gemini with Google Search grounding** as the Policy Radar's third retrieval method, lighting up the one source that is declared and not monitored: `news-ghana-forestry` (Reuters / AllAfrica, daily, "political signals, minister statements").

This completes `AGENTS.md` §14.3 / `inngest-jobs` rule 3 — "structured sources are scraped with Playwright; RSS feeds are polled; **unstructured monitoring uses Gemini with Google Search grounding**" — which is the only part of the Policy Radar still unbuilt. Six of seven sources work today.

Scope is **the retrieval method and its wiring into the existing radar run**. Everything downstream — dedup, classification, embedding, the signal row, the board, the digest — already exists and must be reused unchanged.

Scope explicitly **excludes**: the Impact Tracker's influence detection (prompt 22 territory, though it will reuse this module), any new source in the registry, any change to cadences, and any change to how signals are classified or deduplicated.

## Skills read

- **`inngest-jobs`** (project) — rule 3 (grounded search is the method for unstructured monitoring), rule 4 (deduplicate before the insert), rule 5 (one dead source does not abort the batch), rule 7 (silence is reported, not assumed), rule 6 (the free-tier job budget).
- **`gemini-integration`** (project) — the central config, no inlined model ID or limit, 429 with backoff as a handled visible state, structured output validated with Zod, and the rule against logging prompts or completions.
- **`evidence-governance`** (project) — read to establish the finding recorded below: this path has no evidence data path, and *why* that is true rather than assumed.
- **`gemini-api-dev`** (vendor) — the SDK surface for the `googleSearch` tool and the grounding metadata on the response.
- **`design-system`** (project) — only for the signal detail's treatment of a grounded signal's summary (decision 4). No new screen.
- **`supabase-schema`** (project) — read to confirm no schema change is needed.

## Existing code inspected

- `lib/radar/extract.ts` — `fetchSource`, the `switch` on `source.method`, and `DetectedItem` / `FetchResult`. Line 77 currently returns `{ ok: false, failure: { reason: "not_implemented:grounded" } }`. **This is the seam.** The module comment states the bounding rules every fetch path obeys — timeout, response-size cap, per-item character cap, per-run item cap — and grounded search must obey the equivalents.
- `lib/radar/sources.ts` — `RadarRetrievalMethod = "rss" | "scrape" | "grounded"`, and the `news-ghana-forestry` row at line 173 with its placeholder `url` recorded as "where a person would go to read the same material by hand". Cadences live here and nowhere else.
- `lib/jobs/functions/radar-schedule.ts` — lines 44–62: grounded sources are split out of the due list, recorded as `not_implemented`, and **filtered out of the fan-out**. That filter is what this prompt removes.
- `lib/jobs/functions/radar-fetch.ts` — the per-source run: fetch → dedup → create → classify → embed, with `RadarOutcome` (`found` / `empty` / `failed` / `not_implemented`) and a `failureReason` string recorded per run. A rate limit mid-run is already a recorded, non-terminal outcome.
- `lib/radar/dedup.ts` — domain-level fuzzy title matching before the insert.
- `lib/ai/classify-signal.ts`, `lib/ai/signal-embedding.ts` — the two Gemini calls each created item already costs (`RADAR_GEMINI_CALLS_PER_ITEM = 2`).
- `lib/ai/config.ts` — `RADAR_MAX_DOCUMENT_CHARS`, `RADAR_MAX_ITEMS_PER_RUN`, `RADAR_GEMINI_CALLS_PER_ITEM`, `RADAR_RPM_ALLOCATION`, `RADAR_FETCH_RUNS_PER_MINUTE` (derived, not guessed).
- `lib/ai/structured.ts` — `callStructured`, the JSON-Schema allow-list, `StructuredCallFailure`. Note it sets `responseMimeType` + `responseJsonSchema` and passes **no tools**.
- `lib/ai/gemini.ts` — `getGeminiClient`, `toGeminiRequestFailure` (the 429 → `rate_limited` mapping with retry timing).
- `node_modules/@google/genai/dist/genai.d.ts` — `Tool.googleSearch?: GoogleSearch` (line 13315), `GroundingMetadata.groundingChunks` (6755), `GroundingChunkWeb.{uri,title}` (6745).

## Decisions and assumptions

1. **Two calls, not one: a grounded call, then a structured extraction call.**

   Whether Google Search grounding may be combined with `responseMimeType: "application/json"` + `responseJsonSchema` in a single request **is not documented** — Google's own grounding page does not address it, and the free-tier quota was exhausted at the time of writing so it could not be settled live. Betting the radar's seventh source on an undocumented combination is the wrong risk to take.

   So: **step 1** issues the grounded call with `tools` enabled and no response schema, and takes back prose plus grounding metadata. **step 2** passes that prose through the existing `callStructured` — no tools — to get a Zod-validated list of candidate items. Two requests per run, once daily, against a ~1,500/day budget.

   **If a later change verifies the single-call combination works, collapsing the two is a legitimate optimisation — but it is not this prompt's job, and it must not be attempted speculatively.**

2. **The tool's config shape is verified against the installed SDK at implementation time, not written from this file.** There are two shapes in play and they disagree: the installed `@google/genai` types expose `Tool.googleSearch?: GoogleSearch` (i.e. `tools: [{ googleSearch: {} }]`), while Google's current docs page shows `tools: [{ type: "google_search" }]`. Both appear in the SDK's type surface. **Read the installed types, use what they accept, and record which in a comment.** Do not write either from memory.

3. **A grounded `DetectedItem`'s `text` is model-authored, and that must be visible.** For `rss` and `scrape`, `text` is the publisher's own words. For `grounded`, the model writes a summary of what it found. Same shape, materially different provenance.

   Consequences, all required: the extracted summary is capped at `RADAR_MAX_DOCUMENT_CHARS` like any other; it is **never rendered in the serif**, because the serif is reserved for quoted source material and this is generated prose (§11.6 — this is exactly the distinction that rule protects); and the signal detail says in words that this source is monitored by search rather than fetched, so nobody mistakes the summary for the notice itself.

4. **`source_url` must be a URL a person can actually open.** Gemini's grounding metadata frequently returns *redirect* URIs rather than publisher URLs. A signal whose source link goes to an API redirect is a signal an officer cannot verify, which defeats the point of the row.

   **Verify what `groundingChunks[].web.uri` actually contains before storing it.** If it is a redirect, either resolve it to the publisher URL server-side or store the redirect and record the publisher domain/title alongside — decide on the evidence, state the decision in a comment, and never store a URL that has not been validated as absolute http(s) (the existing `DetectedItem` contract already requires this).

5. **An item with no grounding URI is dropped, not invented.** If the model names a story the grounding metadata cannot source, there is no URL to store and no way for a person to check it. Dropping it is correct; fabricating a plausible URL is precisely the failure mode this product exists to prevent. Dropped items are counted in the run record.

6. **Dedup is load-bearing here in a way it is not for the other six sources.** A news search re-surfaces the same story every day for a week. The existing domain-level fuzzy title matching in `lib/radar/dedup.ts` handles this and must be used unchanged — `touchSignalDetectedAt` on a match, exactly as the other sources do. Expect the steady state of this source to be `empty`, and that is a healthy result, not a broken one.

7. **The search query is built from the source registry, not from anything a user typed and not from the database.** It is a fixed topic query about Ghana forest and cocoa policy, assembled in the grounded module from the source's declared `signalTypes` and topic terms. No evidence, no signal text, no staff input reaches it (see the governance section).

8. **Recency is bounded.** The daily cadence means the run should ask for recent material only; the SDK's `GoogleSearch.timeRangeFilter` is documented as supported on the Gemini API (and not on Vertex AI). **Verify it against the installed types and the live API.** If it does not work, bound recency in the prompt text instead and say so — do not ship an unbounded search that re-reports last year's stories daily.

9. **No new model ID, no new rate-limit number, no new cadence.** Reuses `GENERATION_MODEL` at `GENERATION_TEMPERATURE`, the same judgement signal classification already makes. What *is* new is that a grounded run costs **2 requests before any item exists**, on top of `RADAR_GEMINI_CALLS_PER_ITEM` per created item — so `RADAR_FETCH_RUNS_PER_MINUTE`'s derivation must be re-read and updated if the worst case no longer fits `RADAR_RPM_ALLOCATION`. Derive it; do not re-guess it.

10. **Google's Terms of Service may require displaying Search Suggestions alongside grounded results.** The docs reference this without stating it plainly. **Check before shipping.** If it is required, the signal detail renders the returned `searchEntryPoint` / suggestions for grounded signals; if it is not, nothing is added. Either way, record the finding in a comment — a compliance requirement discovered later is a retrofit across a governance surface.

11. **`not_implemented` stops being reachable for this source and stays reachable as an outcome.** The enum value is not removed: it is the correct record for any future declared-but-unbuilt method, and the gap analysis's "not yet monitored" versus "a quiet week" distinction depends on it (`inngest-jobs` rule 7).

## Files likely to change

**Retrieval**

- `lib/radar/grounded.ts` (new) — the grounded fetch path: build the query, issue the grounded call, extract candidates via `callStructured`, map grounding URIs onto them, return `FetchResult`. Server-only.
- `lib/radar/extract.ts` — replace the `not_implemented:grounded` branch with a call into the above. No other change; the bounding rules in its module comment now apply to three methods.
- `lib/radar/sources.ts` — the `news-ghana-forestry` row gains its topic terms (decision 7). The placeholder `url` comment is updated, since a person's read-by-hand link is no longer the only thing that field means.

**Jobs**

- `lib/jobs/functions/radar-schedule.ts` — remove the grounded split at lines 44–62 so grounded sources fan out like any other. **The `not_implemented` recording path stays** for any future unbuilt method (decision 11).
- `lib/jobs/functions/radar-fetch.ts` — likely unchanged. Verify: a grounded fetch failure must already map to `failed` with its reason, and a 429 in step 1 or 2 must already be the recorded non-terminal rate-limit outcome. If it does not, fix it here rather than in the grounded module.

**Config**

- `lib/ai/config.ts` — `RADAR_GROUNDED_CALLS_PER_RUN = 2` (the fixed cost before any item exists), and `RADAR_FETCH_RUNS_PER_MINUTE` re-derived to include it. No new model ID.

**UI**

- `app/(app)/signals/[id]/…` — the signal detail says a grounded signal was found by search and that its summary is written from search results, not quoted from the source (decision 3). Small copy and provenance addition; no new screen, no new component if an existing one fits.

## Implementation requirements

### The grounded fetch

- One entry point, `fetchGroundedSource(source)`, returning the same `FetchResult` every other method returns. The rest of the pipeline must not learn that grounded exists.
- Bounded exactly like the other two paths: a request timeout, `RADAR_MAX_ITEMS_PER_RUN` items, `RADAR_MAX_DOCUMENT_CHARS` per item summary. "Never pass unbounded context" binds on the way *out* of the model here as much as on the way in.
- Every candidate URL validated as absolute http(s) before it is returned, reusing the existing validation rather than a second copy.
- An item without a resolvable grounding URI is dropped and counted (decision 5).
- Step 2's Zod schema requires, per item: title, summary, and the index or identifier tying it to a grounding chunk. Invalid output retries once via `callStructured`'s existing rule, then is a typed failure.
- A 429 in either step returns the rate-limit failure with its retry timing intact, mapped through `toGeminiRequestFailure` — not a new mapping.
- **Logging: source id, item counts, dropped counts, model, latency, outcome. Never the query, never the returned prose, never a title.** The existing radar modules already hold this line; match them.

### The schedule

- Grounded sources fan out on their declared cadence like any other source. Per-source failure isolation is unchanged: this source failing must not affect the other six (`inngest-jobs` rule 5).
- The run record distinguishes *searched and found nothing* (`empty`) from *the search failed* (`failed`). Given decision 6, `empty` will be the common case and must not read as a fault.

### The budget

- Re-derive `RADAR_FETCH_RUNS_PER_MINUTE` from the new worst case: `RADAR_GROUNDED_CALLS_PER_RUN + (RADAR_MAX_ITEMS_PER_RUN × RADAR_GEMINI_CALLS_PER_ITEM)`. Keep the existing `Math.max(1, …)` floor and the comment explaining why pacing is flow control rather than a sleep inside a step.

## Evidence classification impact

**None — no evidence data path.** Stated with the reason, because this is a Gemini call and the default answer for a Gemini call is "the gate applies".

- **Nothing from the evidence library reaches this path.** The query is assembled from `lib/radar/sources.ts`'s static topic terms (decision 7). No `evidence_item` row is read, no chunk is retrieved, no `full_text` is touched, and no `GatedEvidenceContext` is constructed because there is no evidence to gate.
- **Nothing this path produces becomes evidence.** `lib/radar/extract.ts`'s module comment already states the rule and it holds here unchanged: a policy document the radar finds is the **subject** of a signal, never evidence. Nothing in the radar writes to `evidence_item`, and a grounded result does not enter the knowledge base.
- **What is transmitted:** a fixed topic query about public Ghanaian and EU forest policy, and — in step 2 — the model's own prose from step 1. Both are public-domain subject matter and neither is Tropenbos data.
- **This is not a licence to widen the input later.** If a future change wants to seed the search from a signal's summary, an evidence item, or a brief, that is a different data path and it must be re-assessed against `evidence-governance` before it is written. Say so in the module comment, at the point where the query is built.
- **No bypass, no flag, no env var** — there is nothing here to bypass.
- **Logging:** ids, counts, timings, outcomes. Never the query, never the model's prose (§7.6, §13.9).

## Hallucination-guard implications

**None.**

Nothing here changes what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks. The guard verifies a generated brief against the evidence context passed to its generator; this path produces neither a brief nor evidence.

One explicit non-change worth stating, because grounded search is a model asserting facts about the world: **a grounded signal's summary is not fact-checked and must not be presented as though it were.** It is a lead for a person to follow, which is why decision 5 drops any item without a source URL and decision 3 requires the detail to say where the summary came from. Adding guard flags to signals would invent a second flag surface with a different contract from `hallucination-guard`'s.

## Security requirements

- Server-only and jobs-only. Grounded search never runs in browser code and never inside a request handler (§18, §14.1). `lib/radar/grounded.ts` is `server-only`.
- `GOOGLE_GENERATIVE_AI_API_KEY` stays server-only. No new env var, no new secret, no new external service beyond the Gemini call already configured.
- Every returned URL is untrusted input: validated as absolute http(s) before it is stored, never followed by the scraper as a side effect of this path, and never rendered as a link without that validation.
- No returned text is evaluated, interpolated into a query, or written anywhere but the signal's own capped fields.
- No model ID, temperature, token cap or rate-limit number inlined at a call site (§13.1).

## Acceptance criteria

1. `news-ghana-forestry` fans out on its daily cadence and is no longer filtered out of the schedule.
2. A grounded run produces `DetectedItem`s indistinguishable in shape from RSS and scrape items, and flows through the existing dedup → create → classify → embed path with no branch on method.
3. Every created signal from this source has a `source_url` that is absolute http(s) and opens the material a person would read. No redirect-only or fabricated URL is ever stored.
4. An item the grounding metadata cannot source is dropped and counted, never stored with an invented URL.
5. Running the source twice in a day creates no duplicate signals — the second run matches on title and touches `detectedAt`.
6. A run that searched successfully and found nothing new records `empty`, not `failed` and not `not_implemented`.
7. A 429 in either call records the rate-limit outcome with retry timing and does not fail the other six sources' runs.
8. `not_implemented` remains a reachable outcome for any future declared-but-unbuilt method.
9. `RADAR_FETCH_RUNS_PER_MINUTE` is re-derived from the new worst case, not re-guessed, and stays inside `RADAR_RPM_ALLOCATION`.
10. The signal detail states that a grounded signal was found by search and that its summary is written from search results. That summary is not set in the serif.
11. The tool config shape and `timeRangeFilter` support are both verified against the installed SDK, with the finding recorded in a comment.
12. Google's Search Suggestions display requirement is checked and the finding recorded either way (decision 10).
13. No new Gemini model ID, no new env var, no schema change, no new migration.
14. `npm run lint` and `npm run typecheck` are clean apart from the four known pre-existing errors.

## Checks to run

```
npm run lint
npm run typecheck
npm run build
```

No migration: this prompt adds no schema. Report the exact output of each.

## Manual test steps

1. `npm run dev` and `npm run inngest:dev` together.
2. At <http://localhost:8288>, trigger `radar/source.fetch.requested` with `{"sourceId":"news-ghana-forestry","dueOn":"<today>"}`. Read the step trace: two Gemini calls, then the existing dedup/create path.
3. Confirm the run record is `found` or `empty` — **never** `not_implemented`.
4. Open `/signals` and find any created signal. Confirm its urgency, relevance, impact area and geography were classified by the existing path.
5. Open the signal detail. **Click the source link and confirm it lands on a readable article**, not an API redirect or a 404. This is acceptance criterion 3 and it is the one most likely to fail.
6. Confirm the detail says the signal was found by search and that its summary is written from search results — and that the summary is in the sans, not the serif.
7. Trigger the same source again with the same `dueOn`. Confirm Inngest drops it as a duplicate event.
8. Trigger it again with a *different* `dueOn`. Confirm no duplicate signals are created and `detectedAt` is touched instead.
9. Trigger the other six sources and confirm they are unaffected.
10. With quota exhausted (or by temporarily pointing at a bad key), confirm a rate limit records the retry timing and does not fail the batch.
11. Check the signal detail at 390px, 760px, 1000px, 1300px, 1600px — no horizontal page scroll, and any added provenance line wraps.
