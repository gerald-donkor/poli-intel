---
name: gemini-integration
description: Load when writing or changing any Gemini call in EviBrief — brief generation, signal classification, audience reframing, translation assist, embeddings, or the fact-check pass. Covers the central model/limit config, free-tier rate-limit and backoff handling, embedding batching, the brief-generation system prompt structure, and Zod validation of structured output.
---

# Gemini integration

Scope: **how this project calls Gemini.** Config placement, rate-limit behaviour, batching, prompt structure, output validation.

Layers on the vendor skill **`gemini-api-dev`**, which covers the general SDK surface: current model IDs, the `@google/genai` client for TypeScript, `generateContent`, multimodal input, function calling, structured outputs, and where the live docs are (`https://ai.google.dev/gemini-api/docs/llms.txt`). Read that skill for API mechanics; read this one for EviBrief's conventions. For RAG orchestration around these calls, also read `langchain-rag`.

Rules: `AGENTS.md` §13 (Gemini usage), §7 (the gate), §16 (generation output). Spec: §3.4, §6, §6.1.

**Nothing is installed yet.** `@google/genai` and `langchain` are not in `package.json` as of writing; the SDK version and its exact option names must be read from `node_modules/` once installed. Everything below is the convention for when it lands, not a description of existing files.

## First step of every call path: the gate

Every Gemini call passes the classification gate before anything else (`AGENTS.md` §13.5). Load **`evidence-governance`** — it is the authority on which evidence is eligible, where the gate sits structurally, and what refusal returns. Nothing in this skill overrides it, and no call path in this skill may be implemented without it.

Only `public_published` evidence reaches a model. Re-generation, audience switching, and translation are not exempt.

## Centralised config

**No model ID, temperature, token cap, or rate-limit number is inlined in a route, action, or job** (`AGENTS.md` §13.1). One server-only config module owns all of it, and every call path imports from there.

What the config module holds:

| Setting | Value | Source / status |
|---|---|---|
| Generation model | `gemini-3.6-flash` | Confirmed in `gemini-api-dev`'s current-models list, and verified live against the API on 2026-07-31 |
| Temperature | `0.3` | Spec §3.4 — factual grounding |
| Max output tokens | `4000` | Spec §3.4 |
| Embedding model | `gemini-embedding-2` | Verified 2026-07-30 against `https://ai.google.dev/gemini-api/docs/embeddings.md.txt`. Note `task_type` is NOT supported by this model, and each input must be wrapped in a `Content` object or the batch returns ONE aggregated vector. |
| Embedding dimensionality | `1536` | Chosen, not defaulted: pgvector's HNSW index caps at 2000 dimensions and the model auto-normalises truncated output. Stated **once** in `lib/ai/config.ts` and consumed by the pgvector column — see `supabase-schema` §"dimensionality". |
| Requests/day budget | ~1,500 | Spec §6.1, §8.2 — free tier, approximate |
| Requests/minute budget | 15 RPM | `AGENTS.md` §13.3 — approximate |
| Retrieval context size | top 8 evidence items | Spec §3.3 step 4, `AGENTS.md` §13.7 |

Free-tier figures are approximate and change; treat them as a budget to design within, not a contract, and re-check them when limits start biting.

Credentials come from `GOOGLE_GENERATIVE_AI_API_KEY`, **server-only** (`AGENTS.md` §18). Never referenced from client code, never prefixed `NEXT_PUBLIC_`.

## Server-only, always

Gemini calls run in the AI layer — Server Actions, Inngest jobs, Route Handlers for external callers. **Never in browser code** (`AGENTS.md` §5.3, §18). The UI never imports the AI module; it calls a Server Action that does.

## Rate limits are a handled, visible state

15 RPM and ~1,500 req/day on the free tier mean 429s are normal operation, not an exception (`AGENTS.md` §13.3).

- Every call path handles **429 with exponential backoff** and a bounded retry count. Honour a `Retry-After` / retry-delay hint from the response when one is present rather than guessing.
- A rate limit is **never a crash and never a generic error**.
- **Mid-generation degradation contract** (`AGENTS.md` §13.4, §17.6, spec §5.2 "Rate-limit state"): surface a clear **retry-timing** message and **do not lose the draft**. Whatever text has been produced is preserved; the user is told when to try again. The UI treatment is a slate/olive `Alert` with inline countdown text — never a destructive variant, never a generic error toast. See `design-system`.
- Inside Inngest jobs, prefer the platform's own flow control (throttle / concurrency / rate limit) over hand-rolled sleeps — see `inngest-jobs` and the vendor `inngest-flow-control` skill. A hand-rolled backoff inside a step that Inngest would retry anyway double-counts the wait.

## Embeddings are batched

Embedding is where request volume gets spent fastest — a single document becomes many 512-token chunks (spec §4.2 step 3).

- **Batch chunks per request** rather than one request per chunk. The batch API shape and its per-request limits come from the installed SDK; verify them, don't assume a number.
- Embedding work runs as background jobs, fanned out and batched to stay inside both Gemini's and Inngest's free-tier budgets (`AGENTS.md` §14.6).
- Filter by classification **before** batching, not after. Building a batch and then dropping ineligible members wastes the request and risks a partial send.
- Store the model identity alongside the vectors. A change of embedding model invalidates existing vectors; without recording which model produced them there is no safe migration.

## Brief-generation prompt structure

**One versioned location** for the system prompt — not scattered across call sites (`AGENTS.md` §13.6). Treat it as a versioned artefact: a brief records its generating model (`AGENTS.md` §16.5), so the prompt version that produced it must be recoverable too.

The system prompt includes (spec §3.4, `AGENTS.md` §13.6):

1. Tropenbos Ghana mission statement
2. 2023–2027 strategy goals
3. Ghana forestry context
4. Current TBI positions on EUDR and tree tenure
5. Audience tone guidelines

The per-call assembly adds:

- **Policy signal context** — full text of the detected policy document, or the relevant excerpt
- **Evidence context** — the **top 8** matched items as **structured** context with **relevance scores and source metadata** (spec §3.3 step 4). **Never pass unbounded context** (`AGENTS.md` §13.7).
- **Brief type and its length target** — policy brief 4–6pp, technical submission 8–15pp, position paper 2–3pp, stakeholder note 1pp, media backgrounder 1pp. Length is part of the contract, not a suggestion (`AGENTS.md` §16.1).
- **Audience profile** — one of the five, from the single audience-profile config location (`AGENTS.md` §16.3): Ghana ministry official, cocoa company sustainability team, EU regulator / DG ENV, donor / programme officer, CREMA community governance. Framing emphasis and tone per profile are in spec §3.4's audience table.
- **The standard brief structure** — header → executive summary (3–4 sentences, one clear recommendation) → context (max 200 words) → evidence (3–5 findings with citations and landscape specificity) → recommendations (2–4 concrete asks, one per decision-maker type) → implementation pathway → about Tropenbos Ghana (`AGENTS.md` §16.2).
- **The gap instruction** — where no strong evidence match exists, state the gap explicitly; never fill it with unsourced prose (`AGENTS.md` §9.8).

The prompt is not where governance is enforced. A prompt instruction is not a gate (`AGENTS.md` §7.2).

## Structured output and validation

Request structured output and **validate every structured response with Zod before use** (`AGENTS.md` §13.8, §9.4). The structured-output request shape belongs to the SDK — read `gemini-api-dev` and the installed package for the current field names rather than writing a generation-config key from memory.

- Invalid output is retried **once**, then recorded as a failed generation.
- Never persist unvalidated model output. No cast past a parse failure, no `any`.
- The same rule covers the fact-check pass's output — see `hallucination-guard`.

The request surface, verified against `@google/genai` 2.15.0 and a live call on 2026-07-31 — `lib/ai/structured.ts` is the one implementation:

- `models.generateContent({ model, contents, config })`, with the system prompt in `config.systemInstruction` (not a message).
- `config.responseMimeType: "application/json"` plus `config.responseJsonSchema` — JSON Schema, from Zod 4's `schema.toJSONSchema({ io: "output" })`.
- **`responseJsonSchema` accepts a documented SUBSET of JSON Schema**, and `z.toJSONSchema` emits more than that (`$schema`, `minLength`, `pattern`). Strip anything outside the SDK's allow-list before sending; the same Zod schema validates the response afterwards, which is where the dropped constraints were doing the real work. `lib/ai/structured.ts` holds the allow-list.
- `config.thinkingConfig.thinkingLevel` — on a thinking model the 4,000-token cap is shared with reasoning tokens, so a constrained reading-and-writing task sets `MINIMAL` and spends the cap on the document.
- **The SDK reads `GOOGLE_GENAI_USE_VERTEXAI` from the process environment** and silently routes to Vertex AI when it is set — which then 404s or 403s against a Gemini API key. If calls fail for no visible reason, check the shell that started the server.

## Progress states, not a spinner

Generation targets a draft within 60 seconds, shown as **sequenced progress states** — "Reading evidence" → "Drafting" → "Verifying citations" (`AGENTS.md` §16.7, spec §5.7). No indeterminate spinner anywhere. The stepper's motion contract is in `design-system`.

Those three stage names correspond to real work: retrieval (`langchain-rag`, and `AGENTS.md` §15's fixed retrieval order), generation, then the fact-check pass (`hallucination-guard`). Don't fake a stage that isn't running.

## Logging

**Never log prompts or completions containing evidence body text** (`AGENTS.md` §13.9, §7.6). No evidence text in Sentry events or PostHog properties, ever. Log model ID, token counts, latency, item ids, classifications, and outcomes — those debug the pipeline without exporting the data.

## Related

- `gemini-api-dev` (vendor) — SDK surface, model list, live docs
- `langchain-rag` (vendor) — general RAG pipeline patterns
- `evidence-governance` — the gate, first step of every call path
- `hallucination-guard` — the fact-check pass and its validation
- `supabase-schema` — where the embedding dimensionality is consumed
- `inngest-jobs` — where batched embedding and radar classification actually run
- `design-system` — the generation stepper and rate-limit alert treatment
