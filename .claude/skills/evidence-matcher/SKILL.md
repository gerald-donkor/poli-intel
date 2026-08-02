---
name: evidence-matcher
description: Load when implementing or changing EviBrief's Evidence Matcher — pgvector retrieval, reranking, metadata filters, gap detection, and the officer's add/remove of matched evidence before generation. Defines the fixed retrieval order and what happens when nothing clears the threshold.
---

# Evidence Matcher and RAG

Migrated from `AGENTS.md` §15. This is the implementation contract for retrieval; it applies whenever the matcher is built or changed.

1. Retrieval order is fixed: embed the signal text → pgvector cosine similarity → top 20 candidates → cross-encoder rerank → top 8 to the generator with relevance scores and source metadata.
2. Only `public_published` evidence enters retrieval (`AGENTS.md` §7 — load the `evidence-governance` skill).
3. Metadata filters are country, year, impact area, and evidence type (field data vs. literature).
4. **Evidence gaps are surfaced, not hidden.** When nothing clears the confidence threshold, return an explicit gap — and in the UI, an empty state with a real next step (broaden the search, flag as a research gap), never a blank panel.
5. Officers can add and remove matched evidence before generation; the final evidence set used for a brief is recorded on the brief.
6. RAG orchestration uses LangChain.js inside Server Actions. Retrieval logic stays in the AI and data layers, never in a component.

## Two recorded deviations, from the implementation in prompt 14

**"Cross-encoder rerank" in rule 1 is an LLM reranker here.** There is no cross-encoder reranking endpoint on the Gemini free tier, and the Vertex Ranking API is a different platform this project has not moved to. The implementation is one Zod-validated structured Gemini call scoring all 20 candidates in a single request (`lib/ai/rerank.ts`) — the rule's *purpose*, a second and semantically richer pass over the top 20, preserved on the stack that exists. A candidate the model omits from its response keeps its retrieval rank and a null score rather than being dropped. Revisit if the project moves to Vertex AI.

**LangChain is not used by the Matcher, and is not installed.** Rule 6 says RAG orchestration uses LangChain.js inside Server Actions. The scheduled matcher pipeline is one pgvector query and one structured Gemini call, both of which already have first-class implementations here (`findEvidenceMatchCandidates`, `callStructured`), and it runs in an **Inngest job**, not a Server Action. Adding the dependency would have bought a second Gemini call path and a second place the gate could be bypassed. Rule 6's substance — retrieval logic in the AI and data layers, never in a component — holds unchanged.

Related: `evidence-governance` (the classification gate), `supabase-schema` (pgvector columns and HNSW indexes), `inngest-jobs` (what triggers the matcher).
