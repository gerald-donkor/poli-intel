/**
 * The translation assist's two shape constants.
 *
 * Same reason they are not declared in `lib/ai/config.ts`: that module is
 * `server-only`, and both numbers are also read by `extractKeyMessages` and by
 * the panel that renders the result, neither of which is server-only.
 * `lib/ai/config.ts` re-exports both, so AI call sites still import every limit
 * from one place (AGENTS.md §13.1).
 *
 * Shape constants and nothing else. No role, no classification rule, no
 * eligibility predicate — this module is client-visible (§10.10). Whether a
 * brief's evidence may reach a model is a governance question answered
 * server-side by the gate.
 */

/**
 * Key messages one translation request carries.
 *
 * A brief's key messages are its executive summary plus its recommendations,
 * and the generator is instructed to write 2–4 recommendations (spec §3.4), so
 * five is the expected number. Eight is headroom for a hand-edited brief, and a
 * bound on what one free-tier request has to render. A brief with more than this
 * has the surplus named in the panel, never silently dropped.
 */
export const TRANSLATION_MAX_MESSAGES = 8;

/**
 * The one language the assist renders. Spec §3.4 names Twi on the CREMA audience
 * row and nothing else; a second language is a product decision, not a constant
 * to widen speculatively.
 */
export const TRANSLATION_LANGUAGE = "Twi";
