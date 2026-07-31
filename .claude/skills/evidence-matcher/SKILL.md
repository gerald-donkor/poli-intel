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

Related: `evidence-governance` (the classification gate), `supabase-schema` (pgvector columns and HNSW indexes), `inngest-jobs` (what triggers the matcher).
