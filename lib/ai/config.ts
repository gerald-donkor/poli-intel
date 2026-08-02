import "server-only";

import { CHARS_PER_TOKEN_APPROX } from "@/lib/ingestion/config";

/**
 * Central AI config — server-only.
 *
 * No model ID, dimension, batch size or rate-limit number is inlined in a
 * route, action or job (AGENTS.md §13.1). Every call path imports from here.
 *
 * Two call families live here: embedding, and brief generation with its
 * fact-check pass.
 */

/**
 * Embedding model that produces every vector this project stores.
 *
 * Verified 2026-07-30 against https://ai.google.dev/gemini-api/docs/embeddings.md.txt:
 * `gemini-embedding-2` is the current embedding model, uses Matryoshka
 * Representation Learning, and auto-normalises truncated dimensions.
 *
 * Store this alongside every vector (`embedding_model`). Changing the model
 * invalidates existing vectors, and without the record there is no safe
 * re-embedding path.
 */
export const EMBEDDING_MODEL = "gemini-embedding-2" as const;

/**
 * The single authoritative statement of embedding dimensionality.
 *
 * Verified from the same source: `gemini-embedding-2` supports an
 * `output_dimensionality` in the range 128–3072, with 768 / 1536 / 3072
 * recommended, and auto-normalises truncated outputs.
 *
 * 1536 is chosen because:
 *   - pgvector's `hnsw` / `ivfflat` indexes cap at 2000 dimensions, and an
 *     unindexed vector column is a sequential scan on every retrieval;
 *   - it halves vector storage against the 3072 default, which matters against
 *     the Supabase Free 500MB budget.
 *
 * Every embedding request MUST ask for exactly this many dimensions.
 *
 * The one unavoidable second copy of this number is the `vector(1536)` literal
 * in `prisma/schema.prisma` — SQL DDL cannot import TypeScript. The data layer
 * validates vector length against this constant before writing
 * (see `checkEmbeddingDimensions` in `lib/db`).
 */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Free-tier request budget (AGENTS.md §13.3, spec §6.1). Approximate, and a
 * budget to design within rather than a contract — re-check when limits bite.
 */
export const GEMINI_RPM_BUDGET = 15;
export const GEMINI_DAILY_REQUEST_BUDGET = 1500;

/**
 * The share of the RPM ceiling background embedding is allowed to occupy.
 *
 * Deliberately below `GEMINI_RPM_BUDGET`: brief generation is interactive and a
 * person is watching it, so a large ingest must not be able to consume the
 * whole minute and push a generation into a 429. This is the number the
 * embedding job's Inngest throttle is configured from — pacing is flow control,
 * not a sleep inside a step (`inngest-jobs`, `gemini-integration`).
 */
export const EMBEDDING_RPM_ALLOCATION = 10;

/**
 * Verified 2026-07-30 against
 * https://ai.google.dev/gemini-api/docs/embeddings.md.txt:
 * "The overall maximum input tokens limit is 8192 tokens."
 *
 * This is the ceiling for the WHOLE request, not per input, which is what makes
 * batch sizing a real constraint rather than a formality: chunks are ~512 tokens
 * (`lib/ingestion/config.ts`), so a naive batch of 32 would be rejected.
 *
 * The same page records two other facts this pipeline depends on:
 *   - "You cannot use the `task_type` field for the `gemini-embedding-2` model."
 *   - "Wrapping each input in a `Content` object and passing them in the
 *     `contents` parameter returns separate embeddings for each entry" —
 *     passing bare strings instead returns ONE aggregated vector for the batch,
 *     which would silently give every chunk in a batch the same embedding.
 */
export const EMBEDDING_MAX_INPUT_TOKENS_PER_REQUEST = 8192;

/**
 * Chunks per embedding request.
 *
 * 8 × ~512 tokens ≈ 4,096 tokens, half the request ceiling. Conservative on
 * purpose: the per-request input cap above is documented but the maximum
 * *number* of inputs is not, and chunk sizing is a character approximation of a
 * token count (`lib/ingestion/config.ts`), so the true token cost of a batch is
 * only ever estimated. Headroom here is cheaper than a rejected request.
 */
export const EMBEDDING_BATCH_SIZE = 8;

/**
 * The second half of the batch ceiling, in the unit the pipeline can actually
 * measure. A batch is closed when it hits either limit, so an unusually long
 * chunk cannot push a full-count batch over the token cap.
 *
 * 60% of the token ceiling, converted at the chunker's own chars-per-token
 * approximation so both halves of the pipeline size text the same way.
 */
const EMBEDDING_TOKEN_SAFETY_FACTOR = 0.6;

export const EMBEDDING_MAX_BATCH_CHARS = Math.floor(
  EMBEDDING_MAX_INPUT_TOKENS_PER_REQUEST *
    EMBEDDING_TOKEN_SAFETY_FACTOR *
    CHARS_PER_TOKEN_APPROX,
);

/**
 * How long to wait before retrying a 429 that carried no retry-delay hint, and
 * the ceiling applied to a hint that did arrive. Bounded so a pathological hint
 * cannot park a run for hours.
 */
export const EMBEDDING_DEFAULT_RETRY_AFTER_MS = 60_000;
export const EMBEDDING_MAX_RETRY_AFTER_MS = 15 * 60_000;

/**
 * Evidence items the daily sweep will pick up in one run. A ceiling, not a
 * target: the sweep re-runs tomorrow, and a bounded fan-out keeps a large
 * backlog from spending the whole Gemini day in one go.
 */
export const EMBEDDING_SWEEP_ITEM_LIMIT = 25;

/* ---------------------------------------------------------------------------
 * Brief generation and the hallucination-guard fact-check pass
 *
 * Both calls in the pair use the same model and the same temperature: the guard
 * is a reading task over supplied text, and a warmer verifier would invent
 * disagreement as readily as a warmer generator invents evidence.
 * ------------------------------------------------------------------------- */

/**
 * Verified 2026-07-31 against the installed `@google/genai` 2.15.0 and the
 * `gemini-api-dev` skill's current-models list: `gemini-3.6-flash` is the
 * current Flash model, 1M-token context, and is what spec §3.4 names.
 */
export const GENERATION_MODEL = "gemini-3.6-flash" as const;

/** Spec §3.4 — factual grounding, not fluency. */
export const GENERATION_TEMPERATURE = 0.3;

/** Spec §3.4. The ceiling for one generated brief, not per section. */
export const GENERATION_MAX_OUTPUT_TOKENS = 4000;

/**
 * Evidence items passed to the generator as structured context
 * (AGENTS.md §13.7, spec §3.3 step 4), and the cap on the pasted policy
 * document.
 *
 * Re-exported rather than declared here, for the same reason as
 * `EVIDENCE_SEARCH_MAX_QUERY_CHARS` below: the shared Zod schema needs both
 * numbers in the browser. See `lib/briefs/generation-limits.ts`.
 */
export {
  BRIEF_POLICY_TEXT_MAX_CHARS,
  GENERATION_EVIDENCE_CONTEXT_SIZE,
} from "@/lib/briefs/generation-limits";

/**
 * How much of each item's text travels with it.
 *
 * Bounded on purpose: "never pass unbounded context" (§13.7) is not satisfied by
 * bounding the item COUNT while letting a 90-page document ride along inside
 * one of them. 8 × 4,000 chars ≈ 8,000 tokens of evidence, which leaves the
 * model's window overwhelmingly to the policy text and the instructions.
 */
export const GENERATION_EVIDENCE_EXCERPT_CHARS = 4000;

/**
 * Structured output that fails Zod validation is retried exactly once, then the
 * attempt is recorded as failed (AGENTS.md §9.4, §13.8). One, not three: a model
 * that has produced malformed JSON twice at temperature 0.3 is not going to be
 * argued into it on the third attempt, and each retry spends free-tier budget a
 * person is waiting on.
 */
export const GENERATION_INVALID_OUTPUT_RETRIES = 1;

/* ---------------------------------------------------------------------------
 * Policy Radar
 *
 * Signal classification reuses GENERATION_MODEL and GENERATION_TEMPERATURE
 * above rather than declaring its own: it is a constrained reading task over a
 * supplied document, which is what 0.3 is for, and a second model ID would be a
 * second thing to keep in step (AGENTS.md §13.1).
 *
 * What is radar-specific is the SIZE of the work — how much of a fetched
 * document travels to the model, how many items one run may process, and the
 * share of the RPM ceiling the radar is allowed to occupy. Cadences are NOT
 * here: they live in lib/radar/sources.ts, which is the one place they live.
 * ------------------------------------------------------------------------- */

/**
 * How much of a fetched public document reaches the classification call.
 *
 * "Never pass unbounded context" (§13.7) is not only a generation rule. A
 * listing page can carry a whole site's navigation, and a feed entry can carry
 * a full article; 6,000 characters is roughly 1,500 tokens, which is ample for
 * judging urgency and impact area and nowhere near the point where a single
 * scraped page could dominate a day's budget.
 */
export const RADAR_MAX_DOCUMENT_CHARS = 6000;

/**
 * Items one source's run may process.
 *
 * A ceiling, not a target. Sources re-list, and the fetch runs again tomorrow
 * (or next Monday), so a bounded run costs at most a day's delay on the
 * eleventh item while making one run's Gemini spend predictable — which is what
 * the throttle below is derived from.
 */
export const RADAR_MAX_ITEMS_PER_RUN = 5;

/** Classification, then the signal's own embedding. Both per created item. */
export const RADAR_GEMINI_CALLS_PER_ITEM = 2;

/**
 * The share of the RPM ceiling the radar may occupy.
 *
 * Below GEMINI_RPM_BUDGET for the same reason EMBEDDING_RPM_ALLOCATION is: a
 * scheduled fan-out across seven sources must not be able to consume the whole
 * minute and push an officer's interactive generation into a 429.
 */
export const RADAR_RPM_ALLOCATION = 10;

/**
 * Fetch runs Inngest may START per minute — the radar's flow control, derived
 * rather than guessed.
 *
 * One run classifies and embeds up to RADAR_MAX_ITEMS_PER_RUN items, so its
 * worst case is that many × RADAR_GEMINI_CALLS_PER_ITEM requests. Dividing the
 * allocation by that worst case is what keeps the radar inside its share even
 * when every source returns a full page of new notices. Pacing is flow control,
 * never a sleep inside a step (`inngest-jobs`, `gemini-integration`).
 *
 * Floored at 1: the radar always makes progress, and a 429 that still lands is
 * a handled, recorded outcome rather than a crash (§13.3).
 */
export const RADAR_FETCH_RUNS_PER_MINUTE = Math.max(
  1,
  Math.floor(
    RADAR_RPM_ALLOCATION / (RADAR_MAX_ITEMS_PER_RUN * RADAR_GEMINI_CALLS_PER_ITEM),
  ),
);

/* ---------------------------------------------------------------------------
 * Evidence Library search
 *
 * These size the LIBRARY SEARCH path — a person typing into the filter rail on
 * /evidence. They are NOT the Evidence Matcher's retrieval order, which is a
 * separate, fixed contract: embed the signal → top 20 candidates → cross-encoder
 * rerank → top 8 to the generator (AGENTS.md §15.1). Nothing below reranks and
 * nothing below assembles generation context. Do not reuse these numbers there,
 * and do not read the Matcher's numbers back into here.
 * ------------------------------------------------------------------------- */

/**
 * The cap that makes the branded `SearchQuery` type structurally meaningful.
 *
 * Re-exported rather than declared here because the shared Zod schema needs the
 * same number in the browser — see `lib/evidence/search-limits.ts` for why the
 * source of truth sits outside this server-only module.
 */
export { EVIDENCE_SEARCH_MAX_QUERY_CHARS } from "@/lib/evidence/search-limits";

/**
 * Chunks the vector query retrieves before collapsing to one row per item.
 *
 * Over-fetches on purpose. The metadata filters live in the same `WHERE` as the
 * similarity ordering, so Postgres may post-filter the HNSW result set: an
 * aggressive filter can hand back fewer usable candidates than the limit
 * suggests. A long document also contributes many chunks that collapse to a
 * single row, so 60 chunks is nowhere near 60 items.
 *
 * A starting value with no corpus behind it. Raise it if filtered searches come
 * back thin; do not reach for `hnsw.ef_search` without something to measure.
 */
export const EVIDENCE_SEARCH_CANDIDATE_CHUNKS = 60;

/**
 * Items a semantic search returns. Stated in the UI when it bites ("showing the
 * 20 closest matches") rather than silently truncating. Pagination arrives when
 * a real corpus makes it necessary.
 */
export const EVIDENCE_SEARCH_MAX_ITEMS = 20;

/**
 * The browse ceiling — filters only, no query. Higher than the semantic cap
 * because a browse listing costs one indexed Prisma query and no Gemini
 * request, but still bounded: an unbounded listing is a page that gets slower
 * every week without anyone deciding it should.
 */
export const EVIDENCE_BROWSE_MAX_ITEMS = 100;

/**
 * Cosine similarity (`1 - distance`) a chunk must clear to be shown.
 *
 * A STARTING VALUE, not a measured one. There is no corpus to tune against yet,
 * and a guessed number presented as a verified one is worse than a documented
 * guess. Revisit once the library holds a real body of evidence and a Research
 * Officer can say whether 0.35 admits noise or hides matches.
 */
export const EVIDENCE_SEARCH_MIN_SIMILARITY = 0.35;

/**
 * How much of the closest-matching chunk the detail panel quotes. Enough to
 * recognise the passage, short enough not to reproduce the document.
 */
export const EVIDENCE_SEARCH_EXCERPT_CHARS = 400;
