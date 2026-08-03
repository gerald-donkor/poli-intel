import "server-only";

import { Inngest, eventType, staticSchema } from "inngest";

/**
 * The Inngest client and this project's event contract.
 *
 * Everything scheduled or event-triggered is an Inngest function — never a bare
 * `setInterval`, never real work inline in a route, never a fire-and-forget
 * promise in a request handler (AGENTS.md §14.1).
 *
 * EVENT PAYLOADS CARRY IDS, NEVER EVIDENCE TEXT. An event travels through
 * Inngest's infrastructure and is retained there, so a payload is third-party
 * storage by another name (§7.6). Every function below loads the text it needs
 * from the database at the moment it needs it.
 *
 * `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are read from the environment by
 * the SDK and are server-only (§18).
 */

/**
 * An item's classification changed and its vectors need to catch up — embed if
 * it is now eligible, purge if it is not.
 *
 * ONE event for both directions, deliberately. Two events would let the purge
 * path be forgotten or drift out of step with the embed path; one function that
 * always asks "is this item eligible right now?" cannot.
 *
 * There is no `classification` field, by design. The job re-reads the item's
 * current classification from the database, so a field here could only ever be
 * a value the gate must ignore — and a value the gate must ignore is better not
 * carried at all (`evidence-governance`).
 */
export const evidenceClassificationChanged = eventType(
  "evidence/classification.changed",
  { schema: staticSchema<{ evidenceItemId: string }>() },
);

/**
 * One request's worth of chunks to embed. Emitted by the fan-out above, one per
 * batch — never one per chunk (AGENTS.md §14.6).
 */
export const evidenceEmbeddingBatchRequested = eventType(
  "evidence/embedding.batch.requested",
  { schema: staticSchema<{ evidenceItemId: string; chunkIds: string[] }>() },
);

/**
 * One source is due — go and fetch it.
 *
 * Emitted by the radar scheduler, one per due source, so each source's fetch is
 * its own run with its own retries. That is what stops a timeout on ITTO losing
 * the day's Gazette results (AGENTS.md §14.5).
 *
 * `dueOn` is the UTC date the scheduler decided for, and it is half of the
 * idempotency key: a replayed or double-fired cron re-requests the same source
 * for the same day and Inngest drops it.
 */
export const radarSourceFetchRequested = eventType(
  "radar/source.fetch.requested",
  { schema: staticSchema<{ sourceId: string; dueOn: string }>() },
);

/**
 * A new policy signal exists.
 *
 * THE EVIDENCE MATCHER SUBSCRIBES TO THIS. The Brief Generator does not, and
 * must not: detection triggers the Matcher and stops there, and generation is
 * on demand only (AGENTS.md §8.4, §14.8).
 *
 * Carries the signal id and nothing else. Not `summaryText`, not the title, not
 * the source document: the standing rule at the top of this file is not being
 * weakened for the one payload where the text would have been convenient.
 */
export const signalDetected = eventType("signal/detected", {
  schema: staticSchema<{ signalId: string }>(),
});

/**
 * A person asked for the Evidence Matcher to run again on a signal.
 *
 * A SEPARATE EVENT FROM `signal/detected`, deliberately. That one is idempotent
 * on the signal id for 24 hours, which is right for a replayed detection and
 * wrong for a deliberate re-run — an officer who has just classified more
 * evidence and presses Re-match means it. Re-emitting detection would have the
 * request silently dropped, which looks identical to a matcher that found
 * nothing.
 *
 * Carries the signal id and nothing else, exactly like its sibling. Not who
 * asked: the run row records the outcome, and an actor in a payload is one more
 * copy of staff identity in third-party storage for no gain.
 */
export const signalRematchRequested = eventType("signal/rematch.requested", {
  schema: staticSchema<{ signalId: string }>(),
});

/**
 * One published brief is due its weekly citation search.
 *
 * Emitted by the Impact Tracker's scheduler, one per eligible brief, so each
 * brief's detection is its own run with its own retries — the same failure
 * isolation the radar's fan-out has (AGENTS.md §14.5).
 *
 * `dueOn` is the UTC date the scheduler decided for, and it is half of the
 * idempotency key: a replayed or double-fired cron re-requests the same brief
 * for the same week and Inngest drops it.
 *
 * Carries the brief id and nothing else. Not the title, not the audience, and
 * above all not a line of the document — the rule at the top of this file holds
 * here too, and the job re-reads what it needs at the moment it needs it.
 */
export const impactDetectionRequested = eventType(
  "impact/detection.requested",
  { schema: staticSchema<{ briefId: string; dueOn: string }>() },
);

export const inngest = new Inngest({
  id: "evibrief",
  // v4 defaults to Cloud mode, which requires a signing key. Scoped to
  // NODE_ENV the same way the Prisma client's hot-reload guard is: a production
  // build is never dev, so this cannot leak into a deployment.
  isDev: process.env.NODE_ENV !== "production",
});

/**
 * Emitted AFTER the classification transaction commits, never inside it.
 *
 * An event announcing a transaction that later rolled back is a lie. A commit
 * whose event failed to send is merely late — the daily sweep finds the item
 * and embeds it. That asymmetry is why the send sits outside, and why a failed
 * send is reported rather than escalated into a failed classification.
 */
export async function sendEvidenceClassificationChanged(
  evidenceItemId: string,
): Promise<void> {
  try {
    await inngest.send(evidenceClassificationChanged.create({ evidenceItemId }));
  } catch {
    // Not a silent catch: the outcome is recorded, and it is recoverable by
    // design (the sweep). Deliberately without the error object — an id and a
    // machine reason debug this, and nothing about evidence belongs in a log.
    console.warn(
      `[jobs] classification event could not be sent; the daily sweep will pick this up: evidenceItemId=${evidenceItemId}`,
    );
  }
}

/**
 * Queues a re-match, and says whether it was actually queued.
 *
 * REPORTED, NOT SWALLOWED — and unlike the classification event above there is
 * no sweep to catch a failed send, so the caller must be able to tell the person
 * that nothing was queued rather than showing them a confirmation for work that
 * will never run (`server-actions`: no silent catches, no lost outcomes).
 */
export async function sendSignalRematchRequested(
  signalId: string,
): Promise<boolean> {
  try {
    await inngest.send(signalRematchRequested.create({ signalId }));

    return true;
  } catch {
    // An id and the fact of the failure. Nothing about the signal's content
    // belongs in a log line (§7.6).
    console.warn(
      `[jobs] re-match could not be queued: signalId=${signalId}`,
    );

    return false;
  }
}
