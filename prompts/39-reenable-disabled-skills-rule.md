# Goal

Update `AGENTS.md` so future agents must re-enable a disabled skill whenever a task requires it, before relying on that skill's instructions or substituting package/docs knowledge.

# Skills read

- None. This is a repository workflow documentation change, not an implementation task involving the approved technical stack.

# Existing code inspected

- `AGENTS.md`, especially sections 2 and 3 covering workflow and skills.
- `prompts/` filenames to determine the next prompt number.
- `git status --short` to identify existing unrelated working tree changes, including the currently disabled skill-folder moves under `.agents/`.

# Decisions or assumptions

- Add the new rule to the skills section, where skill availability and fallback behavior are already governed.
- The rule should distinguish between a missing skill and a disabled-but-present skill.
- Disabled-but-present means a skill folder exists in `.agents/skills.disabled/<name>` or another project-recognized disabled location.
- Re-enabling should be reversible and scoped: move only the required skill back into the active skills directory, then read its `SKILL.md` completely before acting.
- If filesystem permissions prevent re-enabling, request the necessary approval. If re-enabling still cannot be completed, state the blocker and continue only if the task can be done safely using installed package docs or other approved sources.
- Do not modify `.agents/skills` or `.agents/skills.disabled` as part of this prompt unless explicitly needed for verification; this prompt only changes the policy text.

# Files likely to change

- `AGENTS.md`

# Implementation requirements

- Add a concise rule under section 3, after the rule that forbids inventing or citing unavailable skills.
- The new rule must say that if a disabled skill is required or clearly needed for a task, the agent must re-enable it before implementation.
- The new rule must say re-enabled skills must be read fully before use, following the existing skill workflow.
- The new rule must preserve the existing constraint to use only approved skills.
- The new rule must avoid implying that agents can enable arbitrary new skills outside the approved list.
- Keep the wording operational, not advisory.

# Evidence classification impact

None — no evidence data path. This change only updates process instructions in `AGENTS.md`; it does not touch, store, move, read, or transmit evidence data and does not create any AI-layer entry point.

# Hallucination-guard implications

None. This change does not affect brief generation, fact-checking, claim extraction, flag storage, flag rendering, or approval blocking.

# Security requirements

- Do not add instructions that allow enabling arbitrary unapproved skills.
- Preserve the rule that missing/unavailable skills should not be invented or silently substituted.
- If re-enabling a skill requires filesystem changes outside the current sandbox permissions, require approval rather than bypassing restrictions.

# Acceptance criteria

- `AGENTS.md` contains a clear rule requiring disabled skills to be re-enabled when they are needed or required.
- The rule is scoped to approved skills only.
- The rule explains the expected behavior when re-enabling is blocked.
- No unrelated project files are modified.

# Checks to run

- `git diff -- AGENTS.md prompts/39-reenable-disabled-skills-rule.md`

# Exact manual test steps expected after implementation

1. Read section 3 of `AGENTS.md`.
2. Confirm it says a disabled but required approved skill must be re-enabled before implementation.
3. Confirm it does not permit arbitrary unapproved skills.
