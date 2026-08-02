# 20 — Translation assist (Twi key messages)

## Goal

Render a finished brief's **key messages in Twi, on demand**, for community-facing use — spec §3.4's "translated to Twi where needed" on the CREMA audience row, and `AGENTS.md` §1's "translation assist — Twi rendering of key messages for community-facing versions".

One surface: a **"Twi key messages" panel on `/briefs/[id]`** with a control that runs the translation, shows the English and the Twi side by side, and records what was produced.

Scope is **key messages, not the whole brief**. `brief-output` rule 6 says "key messages"; spec §3.4 says "translated to Twi where needed". A full-document translation would be a different feature with different length, export, and review costs, and nothing in the spec asks for one. The messages are the **executive summary** and **each recommendation** — the two blocks a community reader acts on — extracted deterministically from the stored `bodyText`.

Scope explicitly **excludes**: translating the Word export (export rendering with a second language is its own work), any WhatsApp/USSD delivery of the Twi text (Phase 3/4 items with their own prompts), and any language other than Twi.

## Skills read

- **`gemini-integration`** (project) — the central config, the single versioned prompt location, structured output validated with Zod, the 429 contract with retry timing, and the rule that no model ID or generation parameter is inlined at a call site.
- **`evidence-governance`** (project) — translation is call type 7 of the eight, and §7.8 states it is **not exempt** because the evidence was cleared once before. Read for the gate's structural position and the typed refusal.
- **`brief-output`** (project) — rule 6 (on demand, not pre-computed), rule 5 (what a brief records), rule 3 (the CREMA audience profile's plain-language register).
- **`hallucination-guard`** (project) — read to confirm the non-change recorded below: what a flag blocks is fixed, and this task adds nothing to that list.
- **`server-actions`** (project) — authorise-first ordering, the typed refusal shape, the rule that a shared schema carries shape only.
- **`design-system`** (project) + `design_handoff_evibrief/design-system.md` — the panel's tokens, the serif rule, the named-progress-state rule (no indeterminate spinner), `prefers-reduced-motion`.
- **`supabase-schema`** (project) — the additive-migration path and `npm run db:migrate:new`, since this task adds one table.
- **`shadcn`** (vendor) — `Button`, `Alert`, the existing panel composition on this route.
- **`gemini-api-dev`** (vendor) — the SDK surface `lib/ai/structured.ts` already wraps.

## Existing code inspected

- `lib/ai/evidence-context.ts` — `GatedEvidenceContext`, the branded type whose **only** constructor is `gateEvidenceForGeneration`. This is the "no unchecked door" mechanism this task must reuse rather than re-implement.
- `lib/ai/generate-brief.ts` — `assembleBodyText` (the block contract), `briefDraftShape`, and `draftSchemaFor`'s `superRefine` pattern for rejecting output that does not correspond to what was supplied.
- `lib/briefs/body.ts` — `parseBriefBody`, the exact inverse of `assembleBodyText`. Blocks are separated by one blank line; a multi-line block is heading + prose. **This is how the key messages are extracted — no second parser.**
- `lib/ai/structured.ts` — `callStructured`, the JSON-Schema allow-list, and `StructuredCallFailure` (invalid output, rate limit, call failure).
- `lib/ai/config.ts` — `GENERATION_MODEL`, `GENERATION_TEMPERATURE`, `GENERATION_MAX_OUTPUT_TOKENS`, `GENERATION_INVALID_OUTPUT_RETRIES`. Nothing is inlined at a call site.
- `lib/ai/brief-prompt.ts` — `PROMPT_VERSION = "brief-prompt/1"`, and the single versioned location pattern this task copies for its own prompt.
- `lib/ai/audience-profiles.ts` — the CREMA row's comment already reserves itself for this feature: *"Spec §3.4 adds 'translated to Twi where needed' here. That is the translation assist (§16.6) … It returns to this row when that feature ships."* **Update that comment as part of this task.**
- `app/(app)/briefs/[id]/reframe/actions.ts` — the closest analogue: re-reads the brief's own evidence set, re-gates it, and never assumes a prior clearance still holds.
- `app/(app)/briefs/[id]/page.tsx`, `audience-switcher.tsx`, `share-panel.tsx`, `flag-panel.tsx` — the rail this panel joins, and the existing panel composition.
- `prisma/schema.prisma` — `BriefVersion` (bodyText, documentJson, generatingModel, promptVersion, per-version audience), `Brief.currentVersion`, `BriefEvidence`.
- `lib/db/briefs.ts` — `findBriefForReframe` (the shape of a read that returns a brief plus its gate candidates), `BriefDetail`.
- `lib/auth/authorize.ts` — `canGenerateBrief`, `ActionRefusal`, `unauthorised()`.

## Decisions and assumptions

1. **The translation is stored, keyed to the brief version that produced it.** `brief-output` rule 6's "not pre-computed" forbids translating every brief automatically; it does not forbid keeping the result of an explicit request. Storing it means the Twi text a community was actually given is recoverable, carries its generating model and prompt version like every other generated artefact (rule 5), and does not re-spend a free-tier request every time the page is opened. New table `BriefTranslation`, one row per `(briefVersionId, language)`.

2. **A new version does not inherit the old version's translation.** The row hangs off `BriefVersion`, not `Brief`. Editing a brief and then showing the previous version's Twi text beside the new English would be the worst outcome this feature can produce — a community reading something the brief no longer says. When the current version has no translation, the panel says so and offers to run one.

3. **Nothing is overwritten.** Re-running the translation for a version that already has one **replaces that row** — it is the same version's same messages, and keeping a pile of alternate Twi renderings of identical English serves nobody. This is not §8.7 versioning: §8.7 governs the brief's own document, and the translation is a derived rendering of a version that itself is never overwritten. Record `createdById` and `createdAt` on each write so the last run's actor and time are always known.

4. **The gate runs on the brief's evidence set, and a whole-run refusal is correct.** Read the brief's `BriefEvidence` set, build the gate candidates, and call `gateEvidenceForGeneration` before the model call — exactly as the reframe does. If any item has since been reclassified to `community_sourced` or `unpublished_internal`, refuse the whole run.

   The counter-argument, stated so it is not re-litigated silently: the translation sends the brief's *own prose*, not evidence text, so one could argue the gate has nothing to judge. It is rejected because the prose is **derived from** that evidence — its findings are that evidence restated — and transmitting derived text about newly-restricted community data to an API whose terms permit training on it is precisely what §7 exists to prevent. §7.8 already makes the same call for audience switching. Consistency here is also what keeps the gate structural rather than a judgment call per feature.

5. **`GatedEvidenceContext` is a required argument even though the evidence text is not sent.** `lib/ai/translate.ts` takes the branded context as proof the gate ran, and the module's own documentation states plainly that it transmits the key messages and nothing from the context. This keeps the AI layer's invariant intact — no exported function accepts unchecked input — and is cheaper than inventing a second brand for "gated but not transmitted". Say so in the module comment; a reader who finds an unused parameter and deletes it would silently remove the gate.

6. **The fact-check pass does not re-run on the Twi text, and no new flags are created.** The guard verifies claims against the evidence context that was passed to the generator (`hallucination-guard`); it has no Twi-capable path and pretending otherwise would produce verdicts nobody could trust. The translation is a rendering of text that was already checked in English. The panel therefore **carries the source version's open-flag notice** — the same mechanism the Word export uses (§16.8) — rather than blocking, and rather than staying silent.

7. **Unresolved flags do not block a translation.** §9.5 makes an open flag block Programme Director approval and nothing else. `canExportBrief` already records this reasoning for the export. Adding a second thing a flag blocks would change the guard's contract by accident.

8. **Brief status does not gate it either.** A draft is exactly what gets discussed with a community before it is finalised. The panel shows the version and the status beside the Twi text so nobody mistakes a draft for a final position.

9. **Who may run it: `canGenerateBrief`** — Programme Director and Policy & Advocacy Officer. A translation is a generation: it spends a free-tier request and produces model prose. Reuse the predicate; do not declare a tenth one. A Research Officer is refused here for the same reason they are refused a reframe, and a Field Officer reaches no brief surface at all (§10.5). **Reading** an existing translation is open to any role that can already read the brief — it is the brief's own content, and hiding it would be pointless.

10. **The register is the CREMA profile's, and the model is told what it is doing.** The system prompt says: this is a translation assist for community governance readers in Ghana; render meaning, not word-for-word; plain language; keep figures, dates, place names and organisation names exactly; do not add, drop, soften, or explain a claim; never translate internal vocabulary ("signal", "urgency", "relevance score") because it must not appear in community-facing text at all (§11.12). Live in `lib/ai/translation-prompt.ts` with its own `TRANSLATION_PROMPT_VERSION = "translation-prompt/1"`, mirroring `brief-prompt.ts`.

11. **The output is validated structurally, and message-for-message.** The model returns one Twi rendering per supplied message, in order. The Zod schema requires the array length to equal the number of messages sent, via a `superRefine` in the same spirit as `draftSchemaFor`'s citation check: a translation that silently drops a recommendation is worse than one that fails. Invalid output retries once (`GENERATION_INVALID_OUTPUT_RETRIES`), then is a recorded failure surfaced in the panel.

12. **One call, one named progress state.** Not the three-stage stepper — there is no retrieval and no verification stage here, and faking one would violate `gemini-integration`'s "don't fake a stage that isn't running". The button enters a "Translating key messages" state. No indeterminate spinner.

13. **Twi text is Inter, not the serif.** It is the product's own generated prose. The serif is reserved for quoted source material and this distinction is load-bearing (§11.6). This is worth stating because "foreign-language block" is a common instinct to italicise or set differently — do neither.

14. **`preferredLanguage` on a stakeholder is not wired to this yet.** Prompt 19 added the field and the CRM reads it; a "these three contacts read Twi" affordance on the brief page is a plausible next step and is **not** in this task. Adding it would mean deciding what the product does with that knowledge, which is a decision this prompt has no mandate to take.

## Files likely to change

**Schema and migration**

- `prisma/schema.prisma` — `BriefTranslation` model; back-relations on `BriefVersion` and `StaffUser`.
- `prisma/migrations/<timestamp>_brief_translation/migration.sql` — authored with `npm run db:migrate:new -- brief_translation`. **Never `prisma migrate dev`.** No vector column, so no hand-written HNSW index; confirm the generated SQL contains no `DROP INDEX` on `*_embedding_cosine_idx` before applying.

**Key-message extraction**

- `lib/briefs/key-messages.ts` (new) — `extractKeyMessages(bodyText)` over `parseBriefBody`. Returns the executive summary block and each recommendation block as `{ kind, heading, text }`, capped by a constant. Pure, no I/O, client-visible, holds no governance rule.

**AI layer**

- `lib/ai/translation-prompt.ts` (new) — the versioned system prompt and `TRANSLATION_PROMPT_VERSION`.
- `lib/ai/translate.ts` (new) — the translation door: takes the messages plus `GatedEvidenceContext`, calls `callStructured`, validates, returns `{ ok: true, messages, generatingModel, promptVersion } | { ok: false, failure }`.
- `lib/ai/config.ts` — `TRANSLATION_MAX_MESSAGES` and `TRANSLATION_LANGUAGE = "Twi"`. Reuses `GENERATION_MODEL`, temperature, token cap and retry count; **no new model ID**.
- `lib/ai/audience-profiles.ts` — update the CREMA row's comment, which explicitly says it returns here when this ships.

**Data layer**

- `lib/db/brief-translations.ts` (new) — `findTranslationForVersion`, `saveTranslation`, `findBriefForTranslation` (the version's bodyText plus its evidence-set gate candidates, in one read), and their DTOs.
- `lib/db/index.ts` — re-export.

**Route**

- `app/(app)/briefs/[id]/translation-panel.tsx` (new) — client; the control, the run states, and the side-by-side rendering.
- `app/(app)/briefs/[id]/actions.ts` — add `translateKeyMessagesAction`.
- `app/(app)/briefs/[id]/page.tsx` — read the current version's translation and render the panel.

## Implementation requirements

### Extraction

- `extractKeyMessages` reads the "Executive summary" block and every block under the "Recommendations" heading, using `parseBriefBody`'s output only. It must not re-implement the block contract.
- The recommendations section ends at the "Implementation pathway" heading — the assembler's fixed order. Read `assembleBodyText` and match it exactly; if the two ever disagree the extraction silently ships half a translation.
- Cap at `TRANSLATION_MAX_MESSAGES`. If a brief has more recommendations than the cap, translate the first N **and say so in the panel** — never truncate silently.
- A brief whose body has no recognisable summary or recommendations returns an empty list, and the panel says the brief has no key messages to translate rather than calling the model with nothing.

### The AI layer

- One entry point. `translateKeyMessages` accepts `{ messages, context }` where `context: GatedEvidenceContext`, and there is no second export that skips it.
- Structured output through `callStructured`, with the JSON-Schema allow-list already implemented there. Zod-validate before returning; length-match enforced by `superRefine`.
- Retry invalid output once, then return the typed failure. Never persist unvalidated output.
- 429 returns the rate-limit failure with its retry timing intact.
- Log model id, message count, latency and outcome. **Never the English text, never the Twi text, never an evidence excerpt** (§7.6, §13.9).

### The Server Action

Order, no exceptions: `getCurrentStaffUser()` → `canGenerateBrief(role)` → `safeParse` → read the brief version and its evidence set → **gate** → call → save → typed result.

- Return `{ ok: true, translation } | { ok: false, refusal: ActionRefusal }` matching the existing actions.
- Map the gate's refusal to `refused-ineligible-classification` with item **ids, titles and classifications only** — the variant already exists and already carries exactly those fields.
- Map a rate limit to `rate-limited` with `retryAfterMs`. Nothing is lost when it happens: no translation existed, and the English is untouched.
- Map invalid output and call failure to `generation-failed` with a plain message.
- `revalidatePath("/briefs/[id]")` on success.
- Action stays short. Extraction, prompt assembly, and the call all live in their own modules.

### UI

Read `design_handoff_evibrief/design-system.md` first.

**Placement.** A panel in the same rail as the flag panel, review panel, status history and share panel on `/briefs/[id]`, after the share panel. It is not a governance surface and must never be promoted above one at a smaller width.

**Layout.** Inside the panel, message pairs stack: English above, Twi below, at every width up to `laptop`; at `desktop` the rail is 380px so they stay stacked there too — do not force a two-column split into a narrow rail. Each pair is separated by a `border-line` top rule, matching the share panel's list.

**Typography.** Inter throughout, both languages (decision 13). English at 12.5px as the secondary reference, Twi at 13px as the thing being read. IBM Plex Mono for the version number, the model id and the timestamp. Nothing below 12.5px.

**Colour.** `card` surface, `line` borders, `ink-3` for the labels. The "check this before use" notice is the **watch ramp** (`watch-surface` / `watch-border` / `watch-ink`) — the same slate the guard and the export notice use, because it is a review prompt, not an error. Never red; `--destructive` stays unmapped.

**Copy.** It is an **assist**, and the product verified nothing (§8.8). "Twi key messages", "Translate the key messages", "A translation assist — a Twi speaker checks this before it is used with a community." Never "Translated and verified", never "Official Twi version", never "Send".

**States**, all designed:

- **No translation yet** — explains what would be produced and offers the control.
- **No key messages found** — the brief's body has no summary or recommendations to translate; says so, offers nothing.
- **Running** — the named state, "Translating key messages…", control disabled, no spinner.
- **Rate-limited** — slate alert with the retry timing in words ("try again in about 3 minutes"), nothing lost.
- **Refused: ineligible classification** — names the items by title and classification with a link to `/evidence/queue`, and states plainly that a brief cannot be re-sent to a model when its evidence is no longer eligible.
- **Failed** — recorded, plain, retryable.
- **Stale-version guard** — if a translation exists for an older version only, the panel says the brief has changed since it was translated and offers a re-run; it does **not** display the old Twi text beside the new English (decision 2).
- **Open flags on the source version** — the notice rides along, exactly as the export's does.

**Accessibility.** WCAG 2.1 AA. The Twi block carries `lang="tw"` and the English `lang="en"` so a screen reader switches voice — this is the one accessibility requirement unique to this task and it is not optional. Every control labelled; run state announced with `role="status"`; visible accent focus ring with offset; keyboard reachable throughout.

**Motion.** The panel's appearance is a 150–300ms fade at most. Nothing else. Respect `prefers-reduced-motion` — instant. If in doubt, cut it.

**Responsive.** Verify at 390px, 760px, 1000px, 1300px, 1600px. No horizontal page scroll; long Twi words wrap rather than overflowing (`break-words`).

## Evidence classification impact

**This task touches the AI pipeline. Call type 7 — translation assist — which `evidence-governance` names explicitly and `AGENTS.md` §7.8 states is not exempt.**

- **Classifications involved:** all three. Only `public_published` is eligible; `community_sourced` and `unpublished_internal` refuse the run.
- **Enforcement point in code:** `gateEvidenceForGeneration` in `lib/ai/evidence-context.ts`, called by `translateKeyMessagesAction` before `translateKeyMessages` is reached. The branded `GatedEvidenceContext` is a required argument of the AI-layer function, so there is no unchecked path in (decision 5). No new gate is written; the existing one is reused.
- **What is transmitted:** the brief's own key messages — the executive summary and the recommendations. **No evidence body text, no excerpt, and no chunk is sent by this feature.** The gate still runs, for the reason in decision 4.
- **Blocked items:** whole-run refusal, never a partial translation. The refusal is typed (`refused-ineligible-classification`), carries item ids, titles and classifications, and renders as a named state pointing at the classification queue. Never a silent skip, never a swallowed error.
- **No bypass:** no flag, no env var, no `force`, no dev branch, and no code anticipating the gate lifting (§7.7).
- **Logging:** ids, classifications, counts, model id, latency, outcome. No English text, no Twi text, no evidence text — in a log line, a Sentry event, or a PostHog property (§7.6).

## Hallucination-guard implications

**None.**

Nothing here changes what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks. No new flags are created and the fact-check pass does not run on the Twi output (decision 6).

Two explicit non-changes, because this panel sits on the same page as the flag panel:

- **A translation is not gated on flag state, and must not become a fifth thing a flag blocks.** §9.5 fixes an unresolved flag to blocking Programme Director approval and nothing else; `canExportBrief` already records the identical reasoning. The panel reads the source version's open-flag count for **display only** and never for a decision.
- **The flag rendering contract is untouched.** Where the open-flag notice appears in this panel it is the existing slate treatment — circle glyph, `watch` ramp, no pulse, no red, no alarm — reusing the same components as the export notice rather than a new variant.

## Security requirements

- The action authorises server-side, inside the action, before any work (§10.1). The panel's control is presentation.
- No client-supplied text reaches the model: the messages are extracted server-side from the stored `bodyText` by id. **The action accepts a brief id, and nothing else that becomes prompt content.**
- The shared schema module carries shape only — no role, no predicate, nothing from `lib/auth/authorize.ts` (§10.10).
- `lib/ai/translate.ts`, `lib/ai/translation-prompt.ts`, and `lib/db/brief-translations.ts` are `server-only`.
- No new env var, no new secret, no new external service. `GOOGLE_GENERATIVE_AI_API_KEY` stays server-only.
- No model ID, temperature, or token cap inlined at a call site (§13.1).

## Acceptance criteria

1. `/briefs/[id]` shows a "Twi key messages" panel with the current version's translation when one exists, and an offer to run one when it does not.
2. Running it produces one Twi rendering per key message, in order, stored against the current `BriefVersion` with its generating model, prompt version, actor and timestamp.
3. The messages are the executive summary and every recommendation, extracted from the stored `bodyText` — verifiable by comparing the panel against the brief body on screen.
4. Re-running replaces that version's row; it does not accumulate duplicates and does not error.
5. Saving a new version of the brief leaves the panel offering a fresh run and **not** displaying the older version's Twi text.
6. An evidence item reclassified away from `public_published` causes the whole run to be refused, named by title and classification, with a route to the queue — and no translation is written.
7. A Research Officer and a Field Officer are refused by the action, not only by a hidden control.
8. Model output whose message count does not match the input is rejected, retried once, then surfaced as a recorded failure — never stored.
9. A 429 renders the slate rate-limit state with retry timing; nothing is lost.
10. `Brief.status`, `Brief.currentVersion`, and every hallucination flag are unchanged by every path in this task.
11. The Twi block carries `lang="tw"` and the English `lang="en"`.
12. Neither language is set in the serif; `--destructive` remains unmapped and nothing rendered here is red.
13. The migration is additive, authored via `npm run db:migrate:new`, contains no `DROP INDEX`, and applies cleanly.
14. No new Gemini model ID, no new env var, no new Inngest event.
15. Every screen is usable with no horizontal page scroll at 390px, 760px, 1000px, 1300px, 1600px.
16. `npm run lint` and `npm run typecheck` are clean apart from the four known pre-existing errors.

## Checks to run

```
npm run db:migrate:new -- brief_translation   # then READ the generated SQL before applying
npm run db:migrate
npm run lint
npm run typecheck
npm run build
```

Report the exact output of each.

## Manual test steps

1. `npm run dev`, sign in as a Programme Director, open a brief that has an executive summary and at least two recommendations.
2. Expect the "Twi key messages" panel with no translation yet and a clear description of what running it would produce.
3. Run it. Expect the named "Translating key messages…" state — no spinner — then one Twi rendering per message, each paired with its English.
4. Confirm the message list matches the brief's own executive summary and recommendations, in the same order.
5. Confirm the panel shows the version number, the model id, and who ran it, in the mono face.
6. Run it again. Expect one row replaced, not two rows, and no error.
7. Edit the brief and save a new version. Reload `/briefs/[id]` and confirm the panel offers a fresh run and does **not** show the previous version's Twi text next to the new English.
8. Reload and confirm the brief's status, current version, and flag panel are unchanged by every step so far.
9. In `npm run db:studio`, change one of the brief's evidence items to `community_sourced`. Run the translation again and expect the whole run refused, the item named by title and classification, a link to the classification queue, and no row written. Set it back to `public_published`.
10. On a brief with an open flag, confirm the panel carries the same slate "still being checked" notice the export does, and that the translation still runs.
11. Change your own `StaffUser.role` to `research_officer`, reload, and confirm the run control is gone **and** that the action refuses server-side in the devtools network tab. Repeat as `field_officer`. Set it back.
12. With a VoiceOver/Orca screen reader, confirm the Twi block is announced with a Twi language switch rather than read as English.
13. Resize `/briefs/[id]` to 390px, 760px, 1000px, 1300px, 1600px. Confirm no horizontal page scroll, long Twi words wrap, and the panel never sits above the flag panel.
14. With `prefers-reduced-motion: reduce`, confirm the panel appears instantly with no animation.
