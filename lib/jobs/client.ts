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
