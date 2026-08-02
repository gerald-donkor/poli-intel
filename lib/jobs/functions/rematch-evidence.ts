import "server-only";

import { MATCHER_RUNS_PER_MINUTE } from "@/lib/ai/config";
import {
  MATCH_RETRIES,
  runEvidenceMatch,
  type EvidenceMatchResult,
} from "@/lib/matcher/run-match";

import { inngest, signalRematchRequested } from "../client";

/**
 * The on-demand re-match — a person asked for the Evidence Matcher to run again
 * on a signal they are looking at.
 *
 * SAME PIPELINE, DIFFERENT TRIGGER. It shares `runEvidenceMatch` with the
 * detection subscriber, so the retrieval order, the gate, and the run row are
 * one implementation rather than two that can drift.
 *
 * NO IDEMPOTENCY KEY, and that is the whole reason this function exists rather
 * than the Server Action re-emitting `signal/detected`. That subscriber dedupes
 * on the signal id for 24 hours, which is right for a replayed detection and
 * wrong for a deliberate human re-run: an officer who has just classified more
 * evidence and presses Re-match means it, and a silently dropped run would look
 * exactly like a matcher that found nothing.
 *
 * THE SAME THROTTLE, though. The free-tier request budget does not care which
 * event spent it, and a person holding down a button must not be able to spend
 * the day's rerank allowance (`inngest-jobs`, §13.3).
 *
 * A re-match still stops at the match set. It creates no brief and advances no
 * status (§8.4, §8.5).
 */
export const rematchEvidenceForSignal = inngest.createFunction(
  {
    id: "rematch-evidence-for-signal",
    name: "Re-match evidence to a signal on request",
    triggers: [signalRematchRequested],
    throttle: { limit: MATCHER_RUNS_PER_MINUTE, period: "1m" },
    concurrency: 1,
    retries: MATCH_RETRIES,
  },
  async ({ event, step, attempt }) => {
    const { signalId } = event.data;

    return step.run(
      "rematch-evidence",
      (): Promise<EvidenceMatchResult> =>
        runEvidenceMatch({ signalId, attempt }),
    );
  },
);
