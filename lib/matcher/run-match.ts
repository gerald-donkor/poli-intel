import "server-only";

import { NonRetriableError, RetryAfterError } from "inngest";

import { MATCHER_MATCH_SET_SIZE, MATCHER_MIN_RELEVANCE } from "@/lib/ai/config";
import {
  gateCandidatesForRerank,
  rerankEvidenceCandidates,
  type RerankItem,
} from "@/lib/ai/rerank";
import type { StructuredCallFailure } from "@/lib/ai/structured";
import {
  findEvidenceMatchCandidates,
  findSignalForMatching,
  recordEvidenceMatchRun,
  replaceSignalEvidenceMatches,
  type EvidenceMatchCandidate,
  type SignalEvidenceMatchInput,
} from "@/lib/db";
import type { EvidenceMatchOutcome } from "@/lib/generated/prisma/enums";

/**
 * The Evidence Matcher's pipeline body — ONE implementation, two triggers.
 *
 * `signal/detected` runs it on detection; `signal/rematch.requested` runs it
 * when a person asks for it again from the signal detail. The two differ only in
 * their Inngest configuration (the detection subscriber is idempotent on the
 * signal id for 24 hours, which is right for a replayed detection and wrong for
 * a deliberate human re-run) and share this file so the retrieval order cannot
 * drift into two versions of itself.
 *
 * The fixed retrieval order, in one function and in one order
 * (`evidence-matcher` rule 1): the signal's stored vector → cosine similarity
 * over eligible chunks → top 20 candidate items → rerank → top 8, stored with
 * their scores. No step is optional and none may be reordered.
 *
 * THE ONLY ENTRY POINT TAKES A SIGNAL ID. It reads the signal, the candidates
 * and their classifications from the database itself. There is deliberately no
 * variant that accepts candidates from a caller — that would be a second door
 * into the rerank, past `gateCandidatesForRerank`, which is the gate
 * (`evidence-governance`, AGENTS.md §7.2).
 *
 * DETECTION AND RE-MATCH BOTH STOP HERE. Nothing in this file creates a brief,
 * emits an event a Brief Generator could subscribe to, or writes to
 * `PolicySignal.status`: generation is on demand only and acting on a signal is
 * always a human decision (§8.4, §8.5, §14.8).
 *
 * IT THROWS INNGEST'S ERRORS, by design. Both callers are Inngest functions and
 * the retry/backoff decision genuinely belongs to the caller's runtime — a
 * `RetryAfterError` IS the backoff (`inngest-jobs`). No Server Action calls
 * this; the re-match action sends an event and returns.
 */

/** Retries allowed on both subscribers, so the "last attempt" test is shared. */
export const MATCH_RETRIES = 2;

/** Attempt numbers are zero-indexed, so this is the last one. */
const FINAL_ATTEMPT = MATCH_RETRIES;

/** What one attempt produced — ids and counts, no text. */
export type EvidenceMatchResult = {
  outcome: EvidenceMatchOutcome;
  candidateCount: number;
  matchedCount: number;
  refusedCount: number;
  failureReason: string | null;
  matchedItemIds: string[];
};

/**
 * One matcher attempt for one signal.
 *
 * Safe to retry without memoization: retrieval is a read, the match set is
 * replaced atomically, and a run row is written once per outcome rather than
 * once per attempt.
 */
export async function runEvidenceMatch({
  signalId,
  attempt,
}: {
  signalId: string;
  /** Zero-indexed attempt number from the Inngest run. */
  attempt: number;
}): Promise<EvidenceMatchResult> {
  const startedAt = new Date();
  const signal = await findSignalForMatching(signalId);

  // A signal that no longer exists cannot be matched and cannot carry a run
  // row — the record's foreign key is the signal itself. Retrying is pointless.
  if (!signal) {
    throw new NonRetriableError(`Unknown policy signal: signalId=${signalId}`);
  }

  // NO NEW EMBEDDING CALL. The vector was written at detection, inside the same
  // transaction as the row. A signal without one predates the radar, and
  // re-embedding it here would put a second embedding path in a second module
  // for a case that resolves itself.
  if (!signal.embedding) {
    return recordAndReturn({
      signalId,
      startedAt,
      outcome: "failed",
      failureReason: "signal_not_embedded",
    });
  }

  const candidates = await findEvidenceMatchCandidates({
    signalVector: signal.embedding,
  });

  // THE GAP, WITHOUT SPENDING A REQUEST. Nothing cleared the similarity
  // threshold, so there is nothing to rerank and no reason to call Gemini. The
  // stale match set is cleared: a re-run that now finds nothing must not leave
  // yesterday's matches on the board.
  if (candidates.length === 0) {
    await replaceSignalEvidenceMatches({ signalId, matches: [] });

    return recordAndReturn({ signalId, startedAt, outcome: "gap" });
  }

  // THE GATE, structurally. `gateCandidatesForRerank` is the only constructor of
  // the argument the rerank accepts, and it partitions by classification itself.
  // A refusal here can only mean an item was reclassified between the query and
  // this line — the candidates are dropped and counted, never sent (§7.2, §7.6).
  const { candidates: gated, refused } = gateCandidatesForRerank(
    candidates.map(toRerankCandidate),
  );

  if (gated.length === 0) {
    await replaceSignalEvidenceMatches({ signalId, matches: [] });

    return recordAndReturn({
      signalId,
      startedAt,
      outcome: "gap",
      refusedCount: refused.length,
    });
  }

  const reranked = await rerankEvidenceCandidates({
    signalSummary: signal.summaryText,
    candidates: gated,
  });

  if (!reranked.ok) {
    throw await rerankFailure({
      signalId,
      startedAt,
      candidateCount: gated.length,
      refusedCount: refused.length,
      failure: reranked.failure,
      attempt,
    });
  }

  const matches = selectMatchSet(
    gated,
    candidates,
    new Map(reranked.scores.map((score) => [score.citationKey, score.relevance])),
  );

  await replaceSignalEvidenceMatches({ signalId, matches });

  return recordAndReturn({
    signalId,
    startedAt,
    outcome: matches.length > 0 ? "matched" : "gap",
    candidateCount: gated.length,
    matchedCount: matches.length,
    refusedCount: refused.length,
    matchedItemIds: matches.map((match) => match.evidenceItemId),
  });
}

function toRerankCandidate(candidate: EvidenceMatchCandidate) {
  return {
    id: candidate.evidenceItemId,
    classification: candidate.classification,
    citationKey: candidate.citationKey,
    title: candidate.title,
    year: candidate.year,
    country: candidate.country,
    similarity: candidate.similarity,
    chunkText: candidate.chunkText,
  };
}

/**
 * Narrows the reranked candidates to the stored set.
 *
 * TWO THRESHOLDS AT TWO MEANINGS. `MATCHER_MIN_SIMILARITY` already decided what
 * could be a candidate; `MATCHER_MIN_RELEVANCE` decides what survives the
 * rerank. A candidate the model scored below it is dropped.
 *
 * A candidate the model OMITTED is not dropped. A response returning 18 of 20
 * ids must not silently delete two eligible items, so an unscored candidate
 * keeps a null score and its retrieval rank, and fills a remaining slot after
 * the scored ones. The two are not interleaved because a relevance score and a
 * cosine similarity are not the same scale and ordering them together would
 * invent a comparison neither number supports.
 */
function selectMatchSet(
  gated: readonly RerankItem[],
  candidates: readonly EvidenceMatchCandidate[],
  scores: ReadonlyMap<string, number>,
): SignalEvidenceMatchInput[] {
  const chunkOrdinals = new Map(
    candidates.map((candidate) => [
      candidate.evidenceItemId,
      candidate.chunkOrdinal,
    ]),
  );

  const scored: { item: RerankItem; relevance: number }[] = [];
  const unscored: RerankItem[] = [];

  for (const item of gated) {
    const relevance = scores.get(item.citationKey);

    if (relevance === undefined) {
      unscored.push(item);
    } else if (relevance >= MATCHER_MIN_RELEVANCE) {
      scored.push({ item, relevance });
    }
  }

  scored.sort(
    (a, b) => b.relevance - a.relevance || b.item.similarity - a.item.similarity,
  );

  const ordered: { item: RerankItem; relevance: number | null }[] = [
    ...scored,
    ...unscored.map((item) => ({ item, relevance: null })),
  ];

  return ordered
    .slice(0, MATCHER_MATCH_SET_SIZE)
    .map(({ item, relevance }, index) => ({
      evidenceItemId: item.id,
      similarity: item.similarity,
      rerankScore: relevance,
      rank: index + 1,
      chunkOrdinal: chunkOrdinals.get(item.id) ?? 0,
    }));
}

/**
 * Records a rerank failure exactly once and returns the error to throw for it.
 *
 * The match set is deliberately left ALONE on every failure path: a rate limit
 * is not a reason to wipe a good set of matches off the board.
 *
 * Never includes the caught error's message or any excerpt — an API error body
 * can echo request material back, so only the machine reason and the HTTP
 * status leave here (§7.6, §13.9).
 */
async function rerankFailure({
  signalId,
  startedAt,
  candidateCount,
  refusedCount,
  failure,
  attempt,
}: {
  signalId: string;
  startedAt: Date;
  candidateCount: number;
  refusedCount: number;
  failure: StructuredCallFailure;
  attempt: number;
}): Promise<Error> {
  // Terminal failures are configuration, not weather. `invalid_output` is
  // terminal because `callStructured` has ALREADY retried it once: a model that
  // has produced malformed JSON twice at temperature 0.3 will not be argued
  // into it by a third run, and each attempt spends free-tier budget.
  const terminal =
    failure.reason === "missing_api_key" || failure.reason === "invalid_output";
  const reason = describeFailure(failure);

  // One row per failure, not one per attempt: a retryable failure is recorded
  // once its retries are spent, a terminal one immediately.
  if (terminal || attempt >= FINAL_ATTEMPT) {
    await recordEvidenceMatchRun({
      signalId,
      outcome: "failed",
      startedAt,
      candidateCount,
      refusedCount,
      failureReason: `rerank:${reason}`,
    });
  }

  if (failure.reason === "rate_limited") {
    // The free tier's 429 is normal operation, not an exception (§13.3).
    // Rescheduling through Inngest IS the backoff — no hand-rolled sleep inside
    // a step, which a retrying step would double-count.
    return new RetryAfterError(
      `Gemini rate limit reached while reranking evidence: signalId=${signalId}`,
      failure.retryAfterMs,
    );
  }

  if (terminal) {
    return new NonRetriableError(
      `Evidence rerank cannot be retried (${reason}): signalId=${signalId}`,
    );
  }

  return new Error(`Evidence rerank failed (${reason}): signalId=${signalId}`);
}

function describeFailure(failure: StructuredCallFailure): string {
  switch (failure.reason) {
    case "rate_limited":
      return `rate_limited:${Math.round(failure.retryAfterMs / 1000)}s`;
    case "request_failed":
      return `request_failed:${failure.status ?? "unknown"}`;
    case "invalid_output":
      return "invalid_output";
    case "missing_api_key":
      return "missing_api_key";
  }
}

/**
 * EXACTLY ONE RUN ROW PER COMPLETED ATTEMPT, including the ones that matched
 * nothing. An empty run is the record that distinguishes "the corpus has
 * nothing on this" from "the matcher never ran" (`evidence-matcher` rule 4).
 */
async function recordAndReturn({
  signalId,
  startedAt,
  outcome,
  candidateCount = 0,
  matchedCount = 0,
  refusedCount = 0,
  failureReason = null,
  matchedItemIds = [],
}: {
  signalId: string;
  startedAt: Date;
  outcome: EvidenceMatchOutcome;
  candidateCount?: number;
  matchedCount?: number;
  refusedCount?: number;
  failureReason?: string | null;
  matchedItemIds?: string[];
}): Promise<EvidenceMatchResult> {
  await recordEvidenceMatchRun({
    signalId,
    outcome,
    startedAt,
    candidateCount,
    matchedCount,
    refusedCount,
    failureReason: failureReason ?? undefined,
  });

  return {
    outcome,
    candidateCount,
    matchedCount,
    refusedCount,
    failureReason,
    matchedItemIds,
  };
}
