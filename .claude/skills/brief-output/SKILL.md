---
name: brief-output
description: Load when generating, reframing, translating, or exporting an EviBrief brief. Defines the five brief types and their length targets, the standard policy-brief structure, the five audience profiles, audience-switch diffing, what each brief records, progress states, and export rules.
---

# Brief generation output

Migrated from `AGENTS.md` §16. Load alongside `gemini-integration` (the call itself and the system prompt) and `hallucination-guard` (the fact-check pass that must run before a draft is persisted as reviewable).

1. Brief types are policy brief (4–6pp), technical submission (8–15pp), position paper (2–3pp), stakeholder note (1pp), media backgrounder (1pp). Length targets are part of the contract, not a suggestion.
2. Standard policy brief structure: header (issue title, date, audience, classification) → executive summary (3–4 sentences, one clear recommendation) → context (max 200 words) → evidence (3–5 findings with citations and landscape specificity) → recommendations (2–4 concrete asks, one per decision-maker type) → implementation pathway → about Tropenbos Ghana.
3. The five audience profiles are Ghana ministry official, cocoa company sustainability team, EU regulator / DG ENV, donor / programme officer, and CREMA community governance. Each has defined framing emphasis and tone; profiles live in one config location.
4. Audience switching reframes the **same** evidence — it must read as "same evidence, reframed", not "new document loaded". Citations stay anchored; diff against the current draft rather than replacing it wholesale.
5. Every brief records its signal, evidence set, audience, version, and generating model.
6. Translation assist renders Twi on demand for community-facing versions — not pre-computed, and still a Gemini call subject to `AGENTS.md` §7.
7. Generation target is a draft within 60 seconds, shown as sequenced progress states — "Reading evidence" → "Drafting" → "Verifying citations" — not a generic spinner.
8. Export goes Tiptap document → `docx` for Word, Pandoc for PDF, plus Google Docs. Export never bypasses flag state: exporting a brief with unresolved flags carries a visible notice.

Remember `AGENTS.md` §8: generation produces a reviewed draft, never an autonomous submission. Landscape specificity (§1.0) is a requirement of the evidence section, not a nicety.
