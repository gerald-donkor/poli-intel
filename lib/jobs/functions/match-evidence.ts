import "server-only";

import { MATCHER_RUNS_PER_MINUTE } from "@/lib/ai/config";
import {
  MATCH_RETRIES,
  runEvidenceMatch,
  type EvidenceMatchResult,
} from "@/lib/matcher/run-match";

import { inngest, signalDetected } from "../client";

/**
 * The Evidence Matcher — what `signal/detected` means.
 *
 * The pipeline itself lives in `lib/matcher/run-match.ts`, shared with the
 * on-demand re-match. This file is the DETECTION trigger and its flow control,
 * nothing else.
 *
 * DETECTION TRIGGERS THE MATCHER AND STOPS THERE. Nothing here creates a brief,
 * emits an event a Brief Generator could subscribe to, or writes to
 * `PolicySignal.status` (AGENTS.md §8.4, §8.5, §14.8, `inngest-jobs` rule 8).
 *
 * THE WHOLE PIPELINE IS ONE STEP, for the reason `radar-fetch.ts` gives and one
 * stronger one: a step's return value is stored by Inngest, so splitting
 * retrieval from the rerank would put candidate EVIDENCE EXCERPTS into
 * third-party storage — precisely what §7.6 forbids. The step returns ids and
 * counts only, and the rest of the pipeline's state never leaves that closure.
 */
export const matchEvidenceForSignal = inngest.createFunction(
  {
    id: "match-evidence-for-signal",
    name: "Match evidence to a detected signal",
    triggers: [signalDetected],
    // Event-level idempotency: a replayed or double-fired detection for the
    // same signal must not re-spend a rerank request from the free-tier day.
    //
    // KNOWN CONSEQUENCE: Inngest dedupes on this key for 24 hours, so replaying
    // `signal/detected` for the same signal inside that window is dropped. That
    // is exactly why the on-demand re-match is its own event
    // (`signal/rematch.requested`) rather than a re-emitted detection — a
    // person asking for a re-run twice in a day means it twice.
    idempotency: "event.data.signalId",
    // One Gemini request per run (the rerank; retrieval is SQL and the signal's
    // vector already exists), so throttling run starts throttles requests.
    // Flow control, not a sleep inside a step (`inngest-jobs`).
    throttle: { limit: MATCHER_RUNS_PER_MINUTE, period: "1m" },
    concurrency: 1,
    retries: MATCH_RETRIES,
  },
  async ({ event, step, attempt }) => {
    const { signalId } = event.data;

    return step.run(
      "match-evidence",
      (): Promise<EvidenceMatchResult> =>
        runEvidenceMatch({ signalId, attempt }),
    );
  },
);
