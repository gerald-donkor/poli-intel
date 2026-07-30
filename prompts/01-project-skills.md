# 01 — Project-specific skills

## Goal

Author the eight project-specific skills that `AGENTS.md` §3 declares as the closed skill set but which do not yet exist on disk. Each becomes `.claude/skills/<name>/SKILL.md`.

This closes the gap flagged in `AGENTS.md` §3: every rule in §7 (evidence governance), §9 (hallucination guard), §11 (design system), §13 (Gemini usage), and §14 (jobs) currently points at a skill file that isn't there.

Scope is **documentation only**. No application code, no schema, no dependency installs, no `package.json` changes. These skills describe conventions the later prompts will implement; writing one must not require the code it describes to exist yet.

## Skills read

None of the project skills — that is the point of this task.

Vendor skills to read *while writing*, so each project skill layers on top of its vendor counterpart instead of restating it:

- `gemini-api-dev` — before writing `gemini-integration`
- `supabase`, `supabase-postgres-best-practices`, `prisma-database-setup`, `prisma-client-api` — before `supabase-schema`
- `shadcn`, `frontend-design` — before `design-system`
- `inngest-setup`, `inngest-durable-functions`, `inngest-flow-control` — before `inngest-jobs`
- `langchain-rag` — for the retrieval-pipeline references in `gemini-integration` and `evidence-governance`

`evidence-governance`, `hallucination-guard`, and `tiptap-editor` have no vendor counterpart; they are wholly project-specific.

## Existing code inspected

- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — full. §10 (skill table + repo layout) is the source for what each skill must contain; §3.2, §3.4, §4.1, §4.3, §5.5–5.7 are the sources for the actual content.
- `AGENTS.md` — full. §3 fixes the skill names and the spec section each falls back to; §7–17 are the standing rules the skills must not contradict.
- `design_handoff_evibrief/README.md` — full, and `design-system.md` partially (the `@theme` token block). **`design-system.md` must be read in full before writing the `design-system` skill** — it is 19k and holds the shadcn token aliasing, `next/font` setup, per-component recipes, breakpoints, and keyframes.
- `.claude/skills/` — confirmed to contain only symlinks into `.agents/skills/`; none of the eight exist.
- `package.json` — confirmed the stack is currently Next 16.2 / React 19.2 / Tailwind 4 / shadcn only. Prisma, Inngest, Gemini SDK, Tiptap, Auth.js are **not installed yet**.

## Decisions and assumptions

1. **One prompt, eight files.** They share a single source section and are reference docs, not interacting code.
2. **Standard skill frontmatter** — `name` and `description` per the loaded-skill convention. The `description` states when to load the skill, since that is what drives selection.
3. **Skills describe conventions, not the current tree.** Since almost nothing is installed, each skill states the convention and cites its spec section rather than pointing at files that don't exist. No skill may claim a file, script, or package exists.
4. **No duplication of vendor knowledge.** Where a vendor skill covers the general mechanic, the project skill says so and links to it by name, then adds only what is EviBrief-specific.
5. **`server-actions` keeps Auth.js**, per spec §10.1's Phase 1 Auth row, rather than splitting a ninth skill. Flagged in the file as a deliberate choice so a later reader doesn't "fix" it.
6. **`AGENTS.md` stays the authority on the rules.** Skills carry the how-to; they do not restate §7–17 as competing prose. Where a skill must state a rule, it quotes the AGENTS.md section number.
7. **Verify model IDs before writing them.** `gemini-integration` must not hardcode a model ID that hasn't been checked against `gemini-api-dev` or live docs. If a value can't be verified, the skill says so explicitly rather than guessing.
8. `AGENTS.md` §3's gap callout is removed only for skills actually created — since all eight land here, the callout is replaced with a normal statement of where they live.

## Files likely to change

Created:

- `.claude/skills/evidence-governance/SKILL.md`
- `.claude/skills/hallucination-guard/SKILL.md`
- `.claude/skills/gemini-integration/SKILL.md`
- `.claude/skills/supabase-schema/SKILL.md`
- `.claude/skills/server-actions/SKILL.md`
- `.claude/skills/design-system/SKILL.md`
- `.claude/skills/inngest-jobs/SKILL.md`
- `.claude/skills/tiptap-editor/SKILL.md`

Modified:

- `AGENTS.md` — §3: replace the "Current gap" callout with a plain pointer to the created skills. No other section changes.

Write order: `evidence-governance` and `hallucination-guard` first (no vendor equivalent, highest consequence, and other skills reference them), then `gemini-integration`, `supabase-schema`, `server-actions`, `design-system`, `inngest-jobs`, `tiptap-editor`.

## Implementation requirements

**Every skill file must:**

- open with frontmatter (`name`, `description`) where the description says *when to load it*
- state its scope in one or two sentences, then get to the concrete guidance
- name the vendor skill it layers on, and what that vendor skill covers so the reader doesn't look for it here
- cite spec sections and `AGENTS.md` section numbers rather than paraphrasing rules into a second, drifting copy
- be honest about what is not yet installed or decided — an explicit "not yet installed; this is the convention for when it is" beats a confident fiction
- contain no invented API surface. If a signature, option name, or model ID cannot be verified from a vendor skill, `node_modules/`, or live docs, mark it as needing verification at implementation time

**Per-file content:**

`evidence-governance` — the hard gate. The three classification values and `unpublished_internal` as schema-level default; the enumerated list of call types the gate covers (embedding, summarisation, classification, generation, translation, fact-check); where the gate sits structurally (one chokepoint at the AI-layer entry, not scattered checks); refusal as a typed handled outcome with the shape it returns; the no-bypass rules (no trusted source, no feature flag, no anticipatory code); the logging prohibition (no evidence body text to Sentry/PostHog); and the two conditions that lift the gate. Must state that re-generation, audience switching, and translation are not exempt. Cross-reference `AGENTS.md` §7.

`hallucination-guard` — claim and statistic extraction from generated output; verification against the evidence context actually passed to the generator; the structured flag record with position anchoring; Zod validation with retry-once-then-fail; that the pass runs *before* the draft persists as reviewable; that unresolved flags block approval server-side; who may dismiss (§10) and what dismissal records; and the UI contract — slate, gentle single pulse settling to a steady outline, never red, never a blink, never an error toast. Cross-reference `AGENTS.md` §9 and §11.9.

`gemini-integration` — call patterns for generation and embeddings; the centralised config module for model IDs and parameters (temperature 0.3, max tokens 4000) with the rule that no model ID is inlined; free-tier limits (~1,500 req/day, 15 RPM) and exponential backoff on 429; embedding batching; the mid-generation rate-limit degradation contract (retry timing surfaced, draft not lost); the brief-generation system prompt structure from spec §3.4 kept in one versioned location; top-8 structured evidence context with source metadata; Zod validation of every structured response; and the governance gate as the first step of every call path. Layers on `gemini-api-dev`.

`supabase-schema` — Prisma conventions for the five entities in spec §4.1; the classification field with its schema-level default; pgvector enablement, vector column, similarity index, and dimensionality stated once centrally; 512-token overlapping chunks with chunk-level metadata vs. document-level metadata on `evidence_item`; enums defined once and imported (never re-declared as string unions in UI); migrations-only, never hand-edited DB; and the 500MB budget consequences — no redundant full-text copies, no speculative indexes, prune raw upload artefacts post-extraction. Layers on `supabase` and `prisma-*`.

`server-actions` — colocation with the routes that use them; Server Actions as the only mutation path; the authorise-first pattern with the §10 role matrix and the specific restrictions (Director-only approval, flag dismissal roles, drafting officer may not clear own flag, classification-change roles); Zod schemas shared with React Hook Form with authorisation never in a client-visible schema; error handling shape; `useOptimistic` for kanban and evidence selection; and the trimmed domain-restricted Auth.js v5 + Google Workspace SSO setup, with a note that the credentials-provider boilerplate is deliberately excluded. Flag that Auth.js lives here by choice.

`design-system` — read `design_handoff_evibrief/design-system.md` in full first, then point at it as authoritative rather than copying it wholesale; the `@theme` block location and that Tailwind 4 is config-less with no `tailwind.config.js`; the palette and warm neutrals; the warm→cool urgency ramp with `--destructive` deliberately unmapped and urgency carried by left rule + eyebrow only; the serif-for-quoted-material-only rule as load-bearing; the icon and imagery prohibitions; the component-to-shadcn mapping; motion principles (150–300ms, Motion for UI, GSAP for the impact map only, `prefers-reduced-motion`, never animate automatic reclassification, cut when in doubt); role-dependent density; and WCAG 2.1 AA as hard requirement. Layers on `shadcn` and `frontend-design`.

`inngest-jobs` — the per-source radar cadences from spec §3.2 held in config not scattered across definitions; job structure for radar / matcher-trigger / weekly impact runs; fan-out and batching to stay inside free-tier limits; retry and per-source failure isolation so one dead source doesn't abort a batch; fuzzy-match signal deduplication before record creation; the rule that detection triggers the Evidence Matcher and stops there, never the Brief Generator; and the weekly gap analysis for silent sources. Layers on `inngest-*`.

`tiptap-editor` — base setup and SSR handling; the citation-chip Node linking to `evidence_item`; the hallucination-flag Mark and its rendering contract; autosave via Server Action on debounce; document diffing for the audience switcher so switching reads as "same evidence, reframed" with citations staying anchored; and export handoff to `docx`/Pandoc/Google Docs including the unresolved-flag notice. Note that the citation Node and flag Mark ship together with `hallucination-guard`. No vendor skill — read the installed package when it lands.

## Evidence classification impact

**Indirect but central — this task authors the gate's specification.**

No evidence data is touched, read, moved, or transmitted: the deliverable is eight markdown files and one edit to `AGENTS.md`. No code path is created, so no classification check executes.

The impact is that `evidence-governance/SKILL.md` becomes the document every later AI-pipeline task loads first. If it is vague, permissive, or wrong about where the gate sits, every downstream implementation inherits that. Specific requirements:

- the three classification values and `unpublished_internal` as the schema-level default must be stated exactly, not approximated
- the gate must be described as a single structural chokepoint at the AI-layer entry — not "remember to check", which is what produces scattered, skippable checks
- refusal must be specified as a typed, handled return value, so no implementer reaches for a silent skip or a swallowed throw
- the covered-call-types list must be exhaustive and must name re-generation, audience switching, and translation as non-exempt
- no bypass may be described, sketched, or left as a TODO — including anticipatory "when we move to paid tier" code paths

`supabase-schema` shares this: it must place the classification default in the schema, so the safe state is the default rather than something application code must remember.

## Hallucination-guard implications

**Indirect — this task authors the guard's specification.**

Nothing is fact-checked and no flag renders, since no generation code exists yet. But `hallucination-guard/SKILL.md` defines, for every later task: what a claim is, what counts as traceable to a supplied source, the flag record's stored shape, and the render contract.

The render contract must be stated exactly, because it is the rule most likely to be violated by an implementer reaching for a familiar error pattern: **slate, gentle single pulse settling to a steady soft outline — never red, never a blink, never an alarm, never an error toast.** A flag is a review prompt, not a failure.

Two orderings must also be unambiguous, since both are load-bearing and easy to get backwards:

- the fact-check pass runs **before** the draft persists as reviewable
- unresolved flags block Director approval **server-side**, not by disabling a button

`tiptap-editor` must agree with this file on the flag Mark, and `server-actions` must agree on who may dismiss. Any disagreement between the three is a defect in this task.

## Security requirements

- No secrets, keys, tokens, or real credential values in any skill file. Env vars are referenced by name only, matching `AGENTS.md` §18's table.
- No real Tropenbos community-sourced or unpublished content as example data. Examples are synthetic and obviously so.
- Skills must not describe any path that sends ineligible data to a model, even as a counter-example with a workaround attached.
- `server-actions` must not describe an authorisation pattern that relies on client-side checks, and must not put authorisation logic in a schema shared with the client.
- Skill files are committed to the repo — write them as public-facing documentation.

## Acceptance criteria

1. All eight files exist at the exact paths in `AGENTS.md` §3, each with `name` + `description` frontmatter where the description says when to load it.
2. Every skill name matches `AGENTS.md` §3 exactly — no renames, no additions, no ninth skill.
3. Each of the five skills with a vendor counterpart names it and states what it defers to it.
4. No skill asserts that a file, script, package, or table exists. Unverifiable API surface is marked as needing verification, not guessed.
5. `evidence-governance` covers all eight points listed above, with the exhaustive call-type list and the non-exemption of re-generation, audience switching, and translation.
6. `hallucination-guard` states the render contract verbatim and both orderings unambiguously.
7. `hallucination-guard`, `tiptap-editor`, and `server-actions` do not contradict each other on the flag Mark or on dismissal authority.
8. No skill contradicts `AGENTS.md` §7–17. Where a rule is restated, the section number is cited.
9. `design-system` defers to `design_handoff_evibrief/design-system.md` as authoritative rather than forking a second copy of the tokens.
10. `AGENTS.md` §3's gap callout is replaced; no other section of `AGENTS.md` is edited.
11. No application code, schema, dependency, or `package.json` change in this task.
12. No secrets and no real community data in any file.

## Checks to run

- `npm run lint` — expected to be unaffected; markdown only. Report the actual output.
- `npx tsc --noEmit` — same. Run it because `AGENTS.md` §19 requires it in the absence of a `typecheck` script; note if it reports pre-existing errors unrelated to this change.
- `npm run build` — **skip.** No route, config, or server module changes. State that it was skipped and why.
- Manual: confirm the eight paths resolve, and confirm `ls .claude/skills/` shows them as real directories rather than symlinks into `.agents/skills/`.

## Exact manual test steps

1. `ls -la .claude/skills/ | grep -vE '\->'` — the eight new directories appear as real entries, distinct from the vendor symlinks.
2. `head -8 .claude/skills/*/SKILL.md` for the eight — each shows frontmatter with a `description` stating when to load it.
3. In a fresh Claude Code session in this repo, run `/`-completion or check the available-skills listing: all eight appear by name with their descriptions.
4. Invoke `evidence-governance` directly and confirm it loads, states the three classification values, and names `unpublished_internal` as the default.
5. Ask for an implementation task that touches the AI pipeline — e.g. "add embedding generation for uploaded evidence" — and confirm the workflow loads `evidence-governance` before proposing anything, per `AGENTS.md` §2 step 3, and that the resulting prompt file's evidence-classification field is filled from the skill rather than improvised.
6. `grep -rn 'tailwind.config' .claude/skills/design-system/SKILL.md` — no match. Tailwind 4 is config-less.
7. `grep -rniE 'red|amber|destructive' .claude/skills/hallucination-guard/SKILL.md` — matches only in prohibitions, never as an instruction.
8. Confirm `AGENTS.md` §3 no longer contains the "Current gap" callout and that §7–19 are byte-identical to before.
