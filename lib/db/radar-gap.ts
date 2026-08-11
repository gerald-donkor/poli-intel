import "server-only";

import { prisma } from "./client";

/**
 * The weekly source-health report reads only RadarRun rows.
 *
 * No source body, signal prose, evidence content, or staff-authored notes are
 * selected here. The email path is an egress path, so the data surface is
 * deliberately counts, outcomes, short machine reasons, and timestamps.
 */
export type RadarGapRunRow = {
  sourceId: string;
  sourceName: string;
  outcome: "found" | "empty" | "failed" | "not_implemented";
  itemsSeen: number;
  signalsCreated: number;
  duplicatesSuppressed: number;
  failureReason: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export function listRadarRunsInWindow(
  start: Date,
  end: Date,
): Promise<RadarGapRunRow[]> {
  return prisma.radarRun.findMany({
    where: { startedAt: { gte: start, lt: end } },
    orderBy: [{ sourceId: "asc" }, { startedAt: "desc" }],
    select: {
      sourceId: true,
      sourceName: true,
      outcome: true,
      itemsSeen: true,
      signalsCreated: true,
      duplicatesSuppressed: true,
      failureReason: true,
      startedAt: true,
      finishedAt: true,
    },
  });
}
