import "server-only";

import { cron } from "inngest";

import { recordRadarRun } from "@/lib/db";
import { dueSourcesOn, toIsoDate } from "@/lib/radar/sources";

import { inngest, radarSourceFetchRequested } from "../client";

/**
 * The Policy Radar scheduler: decide what is due today, and fan out.
 *
 * IT FETCHES NOTHING ITSELF. One event per due source means one run per source,
 * each with its own retries and its own failure, which is how a dead source
 * cannot abort the batch (AGENTS.md §14.5) — the same shape as the evidence
 * sweep next door.
 *
 * ONE DAILY CRON, NOT ONE CRON PER CADENCE BUCKET. The registry's cadences are
 * period-dependent — UNFCCC is weekly between sessions and daily during COP
 * (spec §3.2) — so a source does not belong to a fixed bucket, and per-bucket
 * crons would need a source to appear in two of them and then agree not to run
 * twice. Asking the registry "what is due on this date?" keeps that decision in
 * the one place cadences live, as a pure function of the date.
 *
 * NO CADENCE LITERAL APPEARS HERE. The 05:00 below is when the radar wakes, not
 * how often any source is checked.
 */
export const scheduleRadarSources = inngest.createFunction(
  {
    id: "schedule-radar-sources",
    name: "Schedule due Policy Radar sources",
    // 05:00 UTC — ahead of the Kumasi working day and ahead of the evidence
    // sweep at 05:30, so a morning's signals are classified before anyone opens
    // the board.
    triggers: [cron("0 5 * * *")],
    retries: 2,
  },
  async ({ step }) => {
    const dueOn = toIsoDate(new Date());

    const plan = await step.run("resolve-due-sources", async () => {
      const due = dueSourcesOn(new Date(`${dueOn}T00:00:00Z`));

      // A `grounded` source is DECLARED in the registry but has no
      // implementation yet, so it records `not_implemented` rather than being
      // skipped in silence. The distinction is the whole point: the gap
      // analysis must read "not yet monitored", never "a quiet week" (§14.7).
      const notImplemented = due.filter((source) => source.method === "grounded");

      for (const source of notImplemented) {
        await recordRadarRun({
          sourceId: source.id,
          sourceName: source.name,
          outcome: "not_implemented",
          startedAt: new Date(),
          failureReason: "retrieval_method_not_implemented:grounded",
        });
      }

      return {
        fetchable: due
          .filter((source) => source.method !== "grounded")
          .map((source) => source.id),
        notImplemented: notImplemented.length,
      };
    });

    if (plan.fetchable.length > 0) {
      await step.sendEvent(
        "request-source-fetches",
        plan.fetchable.map((sourceId) =>
          radarSourceFetchRequested.create({ sourceId, dueOn }),
        ),
      );
    }

    return {
      dueOn,
      requested: plan.fetchable.length,
      notImplemented: plan.notImplemented,
    };
  },
);
