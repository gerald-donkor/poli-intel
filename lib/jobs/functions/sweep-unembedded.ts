import "server-only";

import { cron } from "inngest";

import { EMBEDDING_SWEEP_ITEM_LIMIT } from "@/lib/ai/config";
import { listItemsWithUnembeddedChunks } from "@/lib/db";

import { evidenceClassificationChanged, inngest } from "../client";

/**
 * The daily sweep: backfill and self-heal in one function.
 *
 * BACKFILL — items classified `public_published` before this pipeline existed
 * have chunks but no vectors, and nothing else will ever come along and notice.
 *
 * SELF-HEAL — the classification event is sent after its transaction commits
 * (see `../client.ts`). A send that fails at that moment would strand an item
 * forever; this finds it the next morning instead.
 *
 * One run a day is a deliberate charge against the free-tier job budget: it is
 * the cheapest possible insurance against a silently unembedded corpus, which
 * would show up much later as an Evidence Matcher that quietly returns nothing.
 *
 * ONE FAILING ITEM DOES NOT ABORT THE SWEEP. The sweep does no embedding
 * itself — it emits one event per item, so each item becomes its own run with
 * its own retries, and a document that fails to embed cannot take the rest of
 * the backlog down with it (AGENTS.md §14.5).
 */
export const sweepUnembeddedEvidence = inngest.createFunction(
  {
    id: "sweep-unembedded-evidence",
    name: "Sweep evidence with unembedded chunks",
    // 05:30 UTC — before the working day in Kumasi, so the morning's evidence
    // is embedded by the time anyone looks at it.
    triggers: [cron("30 5 * * *")],
    retries: 2,
  },
  async ({ step }) => {
    const items = await step.run("find-unembedded-items", () =>
      listItemsWithUnembeddedChunks(EMBEDDING_SWEEP_ITEM_LIMIT),
    );

    if (items.length === 0) return { itemCount: 0 };

    await step.sendEvent(
      "request-embedding",
      items.map(({ evidenceItemId }) =>
        evidenceClassificationChanged.create({ evidenceItemId }),
      ),
    );

    return { itemCount: items.length };
  },
);
