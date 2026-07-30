---
name: evidence-governance
description: Load before implementing anything that touches the AI pipeline in EviBrief — embedding, summarisation, classification, generation, re-generation, audience switching, translation assist, or the fact-check pass. Defines the hard data-classification gate that decides which evidence may reach a Gemini call, and the typed refusal that happens when it may not.
---

# Evidence governance — the classification gate

Scope: **what may reach a model, and what happens when it may not.** This skill is the authority on the gate's values, its structural position, and its refusal contract. It is not a Gemini how-to — call patterns, rate limits, and prompt structure live in `gemini-integration`.

There is no vendor counterpart. This is wholly project-specific.

The rule this enforces is `AGENTS.md` §7, derived from spec §4.3 and spec §9's "Community data exposed to third-party AI APIs" risk row. Where this skill and `AGENTS.md` §7 appear to differ, §7 wins and this file is the thing to correct.

## Why the gate exists

The AI stack runs on Gemini's free tier, whose terms permit using submitted prompts and outputs for model training (spec §4.3, §6.1). Tropenbos Ghana's community-sourced field data and unpublished internal research must stay under Tropenbos control. Those two facts are incompatible, so the resolution is that ineligible evidence never enters the pipeline at all.

This is a standing constraint, not a setup step. It applies on every task, in every phase, permanently.

## The three classification values

Exactly these three, no others, no synonyms:

- `public_published`
- `community_sourced`
- `unpublished_internal`

**Only `public_published` is eligible for the AI pipeline.**

**The default is `unpublished_internal`, and the default belongs in the Prisma schema, not in application code** (see `supabase-schema`). Every newly ingested item — upload, field submission, scrape, import — enters at `unpublished_internal` and stays blocked until a Research Officer explicitly tags it (spec §4.2 step 11, §5.2 Research Officer workflow step 4).

There is no auto-classification by source and no trusted-source bypass. A `.gov.gh` URL, a published DOI, or an "obviously public" PDF does not classify itself.

Classification changes are restricted to Research Officer and Programme Director, and are logged with actor and timestamp (`AGENTS.md` §10.8). Enforce that inside the Server Action — see `server-actions`.

## What the gate covers

Every one of these is a Gemini call and every one goes through the gate:

1. **Embedding** — evidence chunks, and any text embedded for similarity search
2. **Summarisation** — extraction summaries, digest copy derived from evidence
3. **Classification** — signal urgency/relevance/impact-area/geography/audience scoring
4. **Generation** — brief generation, every brief type
5. **Re-generation** — regenerating an existing brief, for any reason
6. **Audience switching** — reframing an existing brief for a new audience
7. **Translation assist** — Twi rendering of key messages
8. **Fact-checking** — the hallucination-guard pass itself (see `hallucination-guard`)

**Items 5, 6, and 7 are not exempt.** Being cleared once does not clear the evidence forever, and reframing existing prose still transmits the evidence context to the model. `AGENTS.md` §7.8 states this explicitly; spec §10.1's Phase 3 table repeats it for the audience switcher. If an implementation routes re-generation, audience switching, or translation around the gate "because the evidence was already checked", that is a defect.

Item 8 is also not exempt: the fact-check pass receives the evidence context as input, so it is a transmission like any other.

## Where the gate sits

**One structural chokepoint at the AI layer's entry, not a check scattered across call sites.**

The AI layer (`AGENTS.md` §5.2) is reachable only through the gate. Concretely: the module that owns Gemini calls exposes no function that accepts raw evidence. The only way in takes candidate items, partitions them, and returns a typed result. A caller cannot forget to check, because there is no unchecked path to forget.

Anti-pattern — this is what "remember to check" produces, and it is exactly what must not be written:

```ts
// WRONG — a convention, not a gate. Skippable, and someone will skip it.
if (item.classification !== "public_published") return;   // silent skip
await embedEvidence(item.fullText);
```

The shape to build instead — one entry, no unchecked door:

```ts
// AI-layer entry. There is no exported variant that skips this.
type GateResult<T> = {
  eligible: T[];
  refused: Array<{ id: string; classification: Classification; reason: "ineligible_classification" }>;
};
```

Callers must handle `refused`. Refusal is data, so it is visible in the UI, countable in a queue, and impossible to swallow.

## Refusal is a typed, handled outcome

Never a silent skip. Never a swallowed `catch`. Never a thrown error that a caller can ignore.

- The gate returns refusals alongside eligibles; it does not throw for the ordinary ineligible case.
- Every caller surfaces refusals to the user. Items pending classification appear as a **visible queue count** so the backlog cannot be quietly forgotten (`AGENTS.md` §7.5, spec §5.2 "classification-pending state"). The design contract for that pill and banner is in `design-system` — square glyph, distinct from the round guard-flag icon.
- If **every** candidate is refused, that is an explicit outcome with a real next step in the UI, not an empty panel and not a generic error.
- Untagged evidence is also **not searchable** in the Evidence Library and not eligible for the Evidence Matcher (`AGENTS.md` §7.5, spec §5.2 step 5). The gate is not only about model calls; it is also a retrieval filter. `AGENTS.md` §15.2: only `public_published` evidence enters retrieval.

## No bypass

- No trusted-source exemption.
- No feature flag, env var, config key, or `force` parameter that turns the gate off.
- No anticipatory code for the gate lifting — no `if (PAID_TIER)` branch, no commented-out path, no TODO sketching one. `AGENTS.md` §7.7.
- No "development only" bypass. A dev bypass is a production bypass with a different name.

The gate lifts only when the project moves to paid Gemini or Vertex AI (which does not train on submitted data), or when explicit anonymisation and consent exist for a specific dataset (spec §4.3, §6.1 graduation triggers). Neither has happened. When one does, it is a deliberate change to this skill and to `AGENTS.md` §7 — not a flag flip.

## Logging and telemetry prohibition

Community-sourced and unpublished data stays on Tropenbos-controlled infrastructure. Never copy evidence body text into third-party storage, logs, error reports, or analytics payloads (`AGENTS.md` §7.6, §13.9).

- **No evidence body text in a Sentry event** — not in the message, not in `extra`, not in breadcrumbs, not in a captured exception's payload.
- **No evidence body text in a PostHog property.**
- **Never log prompts or completions** that contain evidence body text.
- Log identifiers, classifications, counts, and timings. Those are enough to debug the pipeline.

```ts
// WRONG
Sentry.captureException(err, { extra: { chunk: chunk.text } });

// RIGHT
Sentry.captureException(err, { extra: { evidenceItemId: item.id, chunkIndex, classification: item.classification } });
```

This applies to refusal reporting too: report the id and the classification, never the text that was refused.

## When a requested change would breach the gate

Stop and say so before implementing. This is one of the few cases in this project where a blocking question is the right move (`AGENTS.md` §7, closing line). Do not implement a partial version, and do not implement it behind a flag while asking.

## Filling a prompt file's governance field

`AGENTS.md` §4 requires every prompt file to state its evidence classification impact. Answer from this skill, not from improvisation:

- Which of the eight call types does the task touch?
- Where exactly is the enforcement point in code — name the module and function.
- What happens to refused items — where does the user see them, and what is the next step?
- If there is genuinely no evidence data path, write "none — no evidence data path" and say why.

## Related

- `supabase-schema` — the schema-level default, so the safe state is the default
- `gemini-integration` — the call paths this gate guards
- `hallucination-guard` — the fact-check pass, itself gated
- `server-actions` — who may change a classification, and the authorise-first pattern
- `design-system` — the classification-pending pill and banner treatment
