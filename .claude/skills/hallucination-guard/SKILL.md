---
name: hallucination-guard
description: Load when implementing or changing EviBrief's post-generation fact-check pass, claim extraction, flag storage, flag rendering, flag dismissal, or anything that blocks brief approval. Defines what a claim is, how it is verified against the evidence actually passed to the generator, the stored flag record, and the exact visual contract for a flag.
---

# Hallucination guard — fact-check before save

Scope: **the verification pass that runs on every generated brief, the flag records it produces, and the contract for how a flag behaves and looks.** Generation mechanics and prompt structure are in `gemini-integration`; the editor Mark that renders a flag is in `tiptap-editor`; who may clear a flag is enforced per `server-actions`.

There is no vendor counterpart — this is verification logic against this project's own evidence schema (spec §10.1, Phase 2).

Rules: `AGENTS.md` §9 (the guard), §11.9 (motion), §10.6–10.7 (authority). Spec sources: §3.4 "Hallucination guard", §5.7 motion table, §5.2 Programme Director workflow step 2.

EviBrief's whole value proposition is traceability. The guard is where that claim is either true or theatre.

## The pass is gated too

The fact-check pass is a Gemini call and it receives evidence context, so it goes through the classification gate like every other call. Load `evidence-governance` before implementing it. It is call type 8 in that skill's covered list.

## Ordering — both of these are load-bearing

1. **The fact-check pass runs *before* the draft persists as reviewable.** Generation → validate → fact-check → then persist. A brief that reached a reviewable state without the pass having run is an incomplete implementation (`AGENTS.md` §9.1). Persisting first and checking later is wrong: it creates a window where a Director could approve an unchecked draft.
2. **Unresolved flags block Programme Director approval server-side.** The approval Server Action refuses while open flags exist — it re-reads flag state inside the action and returns a refusal. A disabled button is presentation, not enforcement (`AGENTS.md` §9.5, §10.1). Do both: the button is disabled *and* the action refuses. Only the second one is the control.

Getting either of these backwards is the most likely failure mode in this area.

## What gets verified

Verify **every cited statistic and every factual claim** in the generated output against **the evidence context actually passed to the generator** — the recorded evidence set for that brief, not the whole library, and not the model's own recollection.

A claim is any assertion the brief presents as fact about the world: a number, a proportion, a date, a named policy provision, an attributed position, a causal or comparative statement about a landscape or a policy. Framing, recommendations, and tone are not claims — the brief's asks are Tropenbos's position, not a fact to trace.

Traceable means the claim's substance is supported by a specific supplied source, identified by evidence item and ideally chunk. Anything not traceable to a supplied source is flagged (`AGENTS.md` §9.2). Three things get flagged:

- a statistic that appears nowhere in the supplied context
- a statistic that appears but has been altered (different figure, different year, different geography, different denominator)
- an assertion attributed to a source that does not say it

**Where no strong evidence match exists, the brief states the gap explicitly.** The generator must never paper over a gap with unsourced prose (`AGENTS.md` §9.8, spec §3.3 step 5). A stated gap is correct output; unsourced filler is a flag.

## Validate before saving

Every structured model response is validated with Zod before use (`AGENTS.md` §9.4, §13.8). This covers both the generation output and the fact-check output.

- Invalid structured output is **retried once**.
- If the retry also fails validation, the attempt is **recorded as a failed generation** — a real, visible, queryable outcome with a reason.
- **Never persist unvalidated model output.** No "best effort" partial save, no `as` cast past a parse failure, no `any`.

Rate-limit failures mid-pass are the `gemini-integration` degradation contract, not a validation failure: surface retry timing, never lose the draft.

## The flag record

Flags are **structured records stored against the brief, anchored to the claim's position in the document.** Not embedded in prose. Not inferred at render time. Not a regex re-scan on load (`AGENTS.md` §9.3).

Each flag record carries, at minimum:

- the brief (and brief version) it belongs to
- a position anchor into the document, stable enough to survive ordinary editing around it
- the claim text as generated
- the reason: unsupported, altered, or misattributed
- the evidence items checked against
- status: open or resolved/dismissed
- on dismissal: actor, timestamp, and reason (`AGENTS.md` §9.6)

Field names and the anchor representation are decided in the schema task — see `supabase-schema`, and `tiptap-editor` for how the anchor and the Mark correspond. Nothing here asserts that a table or column already exists.

Because every edit to a brief is versioned and no prior version is overwritten (`AGENTS.md` §8.7), flag state belongs to a version. Regenerating or audience-switching produces new output and therefore a new pass and new flags — it does not inherit the old brief's cleared state.

## Who may clear a flag

- **Research Officer** and **Programme Director** may resolve or dismiss a flag (`AGENTS.md` §10.4, §10.6).
- A **Policy & Advocacy Officer** may not clear a flag — including, explicitly, on a brief they drafted themselves (`AGENTS.md` §10.6).
- Dismissal records actor, timestamp, and reason.
- Enforced server-side inside the Server Action. `server-actions` holds the authorise-first pattern; it must agree with this file, and any disagreement between the two is a defect.

## The visual contract — state it exactly

A flag is a **review prompt, not an error**. `AGENTS.md` §9.7, verbatim:

> Render it in slate with a gentle single pulse settling to a steady soft outline. Never red, never a blink, never an alarm, never an error toast.

Concretely, from `design_handoff_evibrief/design-system.md` (authoritative for tokens):

- Slate is the **watch** ramp: surface `#E7EDF2`, border `#C6D4DF`, text `#33495A`. The guard-flag panel recipe is `bg-watch-surface border border-watch-border rounded-card p-4 text-watch-ink`.
- Panel primitive is shadcn `Alert` with a **custom slate variant — never the `destructive` variant.** `--destructive` is deliberately unmapped in this product's token layer; nothing in EviBrief is red (`AGENTS.md` §11.4).
- Icon: 16px circle, 2px stroke `#496375`, filled centre dot. **Round** — a circle means "review flag". A square means "classification-pending governance hold". The shapes are how the two states are told apart at a glance, not just the colour.
- Pulse: `flag-pulse`, 900ms, **once**. Background opacity 0 → 0.35 → 0, easing to a steady 2px underline. No colour change during the pulse. No loop, no repeat, no attention-seeking re-fire on re-render.
- Never an error toast. Never a red badge, count chip, or border anywhere in this feature.
- `prefers-reduced-motion` gets the settled state instantly, with no pulse.
- Approval button: **disabled, not hidden**, while a flag is open, with the reason stated inline next to it — and the server refuses regardless.

The flag panel is never the content dropped at smaller breakpoints; it promotes above the fold instead (`design-system`, responsive rules).

## Export

Export never bypasses flag state. Exporting a brief with unresolved flags carries a **visible notice** in the exported document (`AGENTS.md` §16.8). Export handoff details are in `tiptap-editor`.

## Copy

Never write UI copy implying the system decided, approved, verified, or endorsed anything (`AGENTS.md` §8.8). A flag says the claim needs a human's eyes, not that the claim is false. "Not traceable to the supplied evidence" is right; "incorrect" is not.

## Ships with the editor work

The citation-chip Node and the flag Mark are **one body of work** — `hallucination-guard` and `tiptap-editor` ship together for editor tasks (`AGENTS.md` §9.9, spec §10.1 Phase 2). Do not build the flag Mark against a different contract than this file states.

## Related

- `evidence-governance` — the gate the pass itself passes through
- `gemini-integration` — generation, Zod validation of structured output, rate-limit degradation
- `tiptap-editor` — the flag Mark, the citation chip, position anchoring
- `server-actions` — dismissal authority and the approval refusal
- `design-system` — the slate tokens, the pulse keyframe, icon shape rules
