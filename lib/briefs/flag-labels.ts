import { FlagReason } from "@/lib/generated/prisma/enums";

/**
 * What a flag is saying, in the guard's own register.
 *
 * ONE PLACE, BECAUSE THE REGISTER IS THE POINT. A flag says a claim is *not
 * traceable to the supplied evidence* — never that it is wrong, false, or
 * unverified (`hallucination-guard`, AGENTS.md §8.8). That sentence now appears
 * in two surfaces that a reader may see side by side: the flag panel on screen,
 * and the notice inside an exported `.docx` that leaves the building. Two copies
 * of it would be two things to drift apart, and the drift would be invisible
 * until the wrong word was already in a ministry official's inbox.
 *
 * It lives under `lib/briefs/` rather than in the route's `labels.ts` so the
 * export module can read it without a `lib/` module importing from `app/`.
 * `app/(app)/briefs/labels.ts` re-exports it, so the UI's import is unchanged.
 *
 * Client-visible, like the rest of `lib/briefs/`: no role, no governance rule,
 * no eligibility predicate (§10.10).
 */
export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  [FlagReason.unsupported]: "Not traceable to the supplied evidence",
  [FlagReason.altered]: "Differs from what the evidence states",
  [FlagReason.misattributed]: "Attributed to a source that does not say it",
};
