# 44 — Scope the lint check to code this project owns

## Goal

Make `npm run lint` mean something again.

AGENTS.md §19 documents a known-noise baseline of **4 pre-existing errors**. The
check currently reports **34 problems (9 errors, 25 warnings)**. Every single one
of those 34 — except two — comes from a file this project does not own and has
already decided not to fix:

| Source | Problems | What it is |
| --- | --- | --- |
| `.agents/skills/vercel-optimize/**/*.mjs` | 10 warnings | Installed vendor agent-skill package (§3). Tooling, not application code. |
| `design_handoff_evibrief/support.js` | 2 errors, 8 warnings | Prototype runtime. §2 and §19 both say it "has no place in the application". |
| `fix.js`, `fix.cjs`, `test.ts` | 5 errors, 1 warning | Gitignored scratch scripts (`.gitignore:54-56`), untracked by design. |
| `components/ui/carousel.tsx` | 1 error | Vendored shadcn. §19: do not reformat. **Keep visible.** |
| `hooks/use-mobile.ts` | 1 error | Vendored shadcn. §19: do not reformat. **Keep visible.** |

The consequence is the one §19 warns about directly — *"Read the output for
problems in **your** files"* — except the noise now outnumbers the signal 17 to 1
and is growing (it was 4, it is 9, adding a vendor skill adds more). A lint error
introduced in `app/` or `lib/` on the next task is a needle in that haystack, and
the workflow's step 9 ("run available checks") is the gate every prompt passes
through.

Two things fall out of fixing it:

1. `eslint.config.mjs` must ignore files this project does not own.
2. AGENTS.md §19's "Known lint noise" note becomes **stale and wrong** the moment
   it does, and §19 is the document that tells the next session what a clean run
   looks like. Correcting it is part of the task, not a follow-up.

Also in scope: `test_frame.jpg`, a 71 KB scratch artefact committed to the repo
root in the most recent commit (`c30d707 "Add test_frame.jpg"`) and referenced by
nothing in the tree.

## Skills read

**None apply, and that is stated rather than papered over.** No project skill and
no approved vendor skill (§3) governs ESLint configuration or repository hygiene.
Per §3's closing rule — *"If a task seems to need a skill that does not exist, say
so and proceed using the installed package's own docs"* — this task is governed by
**AGENTS.md §19** (the authority on what the checks mean) and by the installed
`eslint` / `eslint-config-next` flat-config API.

Deliberately **not** loaded, with reasons, so a reviewer can see the omissions are
decisions:

- `evidence-governance` — no evidence data path (see below).
- `design-system` — no UI file is touched.
- `playwright-skill` — `npm run test` is run as a check, not modified.

## Existing code inspected

- `eslint.config.mjs` — flat config; `globalIgnores([...])` currently lists
  `.next/**`, `out/**`, `build/**`, `next-env.d.ts`, `lib/generated/**`. Nothing
  else.
- `.gitignore:52-56` — the `# scratch scripts` block already ignores `/fix.cjs`,
  `/fix.js`, `/test.ts`. Git ignores them; ESLint does not.
- `package.json` — `"lint": "eslint"`, no path argument, no `--max-warnings`.
- `.agents/skills/` — 819 tracked files, vendor skill packages, symlinked into
  `.claude/skills/`. Tracked deliberately; still not application code.
- `git ls-files` — confirms `test_frame.jpg` is tracked and `grep -rn test_frame`
  over the tree (excluding `node_modules`/`.git`) returns nothing.
- `npm run typecheck` — currently **passes clean**. Not a concern here.

## Decisions and assumptions

1. **Ignore, do not fix.** Every noisy file is one AGENTS.md already says not to
   touch (§19: "Do not reformat vendored component files or the handoff to
   satisfy a style rule"). Rewriting `support.js` or a vendor skill's `.mjs` to
   satisfy a rule would be exactly the unrelated refactor §18 forbids.

2. **`components/ui/carousel.tsx` and `hooks/use-mobile.ts` stay linted.** They
   are vendored *into the application* and ship in the bundle — unlike the
   handoff and the skills, which do not. Suppressing them would hide two real
   React errors in code that actually runs, and would make the §19 baseline a
   lie in the other direction. They remain the documented, deliberate noise.
   **Do not add an eslint-disable comment to either file.**

3. **`--max-warnings` is not added.** Warnings drop to zero on their own once the
   ignores are right; adding a threshold flag would be a second mechanism doing
   the same job, and would make an unrelated future warning fail the build in a
   way no one asked for. Keep the change to the ignore list.

4. **`test_frame.jpg` is removed.** Nothing references it, it is not an asset any
   route or component loads, and its commit message ("Add test_frame.jpg")
   records no purpose. It is removed with `git rm` and the root pattern added to
   `.gitignore`'s scratch block so it does not return. **If it is in fact a
   deliberate asset, say so at approval and this item drops out** — the rest of
   the prompt stands without it.

5. **Scratch files are ignored by pattern, not by name-by-name drift.** The
   ignore entries mirror the `.gitignore` scratch block exactly, so the two
   places stay legible as the same decision. This is a small duplication;
   teaching ESLint to read `.gitignore` (`includeIgnoreFile`) would need
   `@eslint/compat`, a new dependency for a three-line problem — not worth it
   (§18: keep it small, no over-engineering).

## Files likely to change

- `eslint.config.mjs` — add ignore entries, each with a one-line comment saying
  *why* that path is not this project's code.
- `AGENTS.md` — §19's "Known lint noise" block, rewritten to the post-change
  truth (2 errors, named, with the same do-not-reformat instruction).
- `.gitignore` — add `/test_frame.jpg` to the scratch block.
- `test_frame.jpg` — deleted (`git rm`).

No file under `app/`, `lib/`, `components/`, `prisma/`, or `tests/` changes.

## Implementation requirements

1. Extend `globalIgnores` in `eslint.config.mjs` with:
   - `.agents/**` — installed vendor agent-skill packages (AGENTS.md §3). Tracked
     for reproducibility; not this project's source. Covers `skills.disabled/`
     too, so re-enabling a skill (§3, prompt 39) can never reintroduce noise.
   - `design_handoff_evibrief/**` — prototype runtime and browser-openable
     reference (AGENTS.md §2). `support.js` "has no place in the application".
   - `fix.js`, `fix.cjs`, `test.ts` — gitignored scratch scripts
     (`.gitignore:54-56`).
2. Keep the existing five ignore entries and their comments intact.
3. Every new entry carries a comment naming the AGENTS.md section that justifies
   it, so the next session can tell an intentional exclusion from a convenient one.
4. Rewrite AGENTS.md §19's `> **Known lint noise.**` block so it states: two
   errors remain, both `react-hooks/set-state-in-effect`, in
   `components/ui/carousel.tsx` and `hooks/use-mobile.ts`; both are vendored
   shadcn that ships in the bundle; do not reformat them; anything else in the
   output is yours. Do not silently drop the paragraph — a wrong baseline is
   worse than a loud one.
5. `git rm test_frame.jpg` and add `/test_frame.jpg` to the `# scratch scripts`
   block in `.gitignore`.
6. Do not touch `package.json`. Do not add a dependency. Do not add an
   `eslint-disable` comment anywhere.

## Evidence classification impact

**None — no evidence data path.** This task changes a linter's ignore list, a
`.gitignore` entry, one Markdown paragraph, and deletes an unreferenced JPEG. It
adds no code path, reads no `evidence_item`, opens no Prisma client, and reaches
no Gemini call. The governance gate in `lib/governance/gate.ts` is not read,
imported, or modified, and `ELIGIBLE_EVIDENCE_WHERE` keeps every current call
site. `test_frame.jpg` is verified unreferenced and is not evidence-derived — it
is a scratch capture in the repo root, outside every ingestion path.

## Hallucination-guard implications

**None.** Nothing about claim extraction, the fact-check pass, flag storage, flag
rendering, dismissal authorisation, or the approval block changes. No file under
`lib/ai/`, `lib/briefs/`, or `app/(app)/briefs/` is touched. The §9.7 visual
contract — slate, a single gentle pulse settling to a steady soft outline, never
red, never a blink — is untouched because no component renders differently.

## Security requirements

- Confirm `test_frame.jpg` contains nothing sensitive before deleting it — open
  it and look. Deleting it from the working tree does **not** remove it from
  history (`c30d707`), so if it turns out to show credentials, evidence text, a
  farmer's submission, or anything under §7.6, **stop and report it** rather than
  quietly committing the deletion. History rewriting is the user's call, not a
  side effect of a lint fix.
- No secret, env var, or credential is read, added, or logged.
- Ignoring `.agents/**` is a lint-scope change only. It does not weaken any check
  that runs over application code, and `npm run test` and `npm run typecheck`
  keep their current scope untouched.

## Acceptance criteria

1. `npm run lint` reports exactly **2 errors and 0 warnings**, both
   `react-hooks/set-state-in-effect`, in `components/ui/carousel.tsx:98` and
   `hooks/use-mobile.ts:14`.
2. No output line references `.agents/`, `design_handoff_evibrief/`, `fix.js`,
   `fix.cjs`, or `test.ts`.
3. AGENTS.md §19's known-noise block matches that output exactly — same count,
   same two paths, same do-not-reformat instruction.
4. `npm run typecheck` still passes clean.
5. `npm run test` still passes.
6. `npm run build` still succeeds.
7. `git status` is clean after the commit, and `test_frame.jpg` is gone from the
   working tree and from `git ls-files`.
8. Introducing a deliberate lint error in an `app/` file makes it the *first*
   thing visible in the output. Revert the probe before committing.

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build` — included because `eslint.config.mjs` is build-adjacent and
  Next.js reads it; the change must not alter build behaviour.

Report the exact output of each (§19). Do not claim a check passed without
running it.

## Manual test steps

1. `npm run lint` — read the full output. Expect two errors, zero warnings, and
   no path outside `components/ui/` and `hooks/`.
2. Add `const unusedProbe = 1;` to the top of `app/(app)/evidence/page.tsx`, run
   `npm run lint`, and confirm the probe appears and is easy to spot among three
   total problems. Delete the probe.
3. `git status` — confirm the only modified files are `eslint.config.mjs`,
   `AGENTS.md`, and `.gitignore`, plus the deletion of `test_frame.jpg`.
4. `npm run typecheck` — clean.
5. `npm run test` — passes.
6. `npm run build` — succeeds.
7. Open AGENTS.md §19 and read the known-noise paragraph against the step 1
   output. They must say the same thing.
