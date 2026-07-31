/**
 * The two generation limits both halves of the product need.
 *
 * Same reason as `lib/evidence/search-limits.ts`: `lib/ai/config.ts` is
 * `server-only`, and these two numbers are also the `max()` and the array cap of
 * the Zod schema that ships to the browser with the generation form. A second
 * copy would let the form and the action disagree about what a valid request is.
 * `lib/ai/config.ts` re-exports both, so AI call sites still import every number
 * from one place (AGENTS.md §13.1).
 *
 * This module holds shape constants and nothing else. No role, no classification
 * rule, no eligibility predicate — it is client-visible (§10.10). Which evidence
 * may be selected is a governance question answered server-side by the gate.
 */

/**
 * The pasted policy document's ceiling. Long enough for a full implementing act
 * or consultation notice; short enough that one paste cannot spend the
 * free-tier day.
 */
export const BRIEF_POLICY_TEXT_MAX_CHARS = 60_000;

/**
 * Evidence items one brief is generated from — spec §3.3 step 4's top 8. In the
 * manual path the officer's selection IS the generation context, so the picker
 * enforces the same number the generator receives.
 */
export const GENERATION_EVIDENCE_CONTEXT_SIZE = 8;
