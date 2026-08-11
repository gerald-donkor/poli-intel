import "server-only";

import { listRadarRunsInWindow } from "@/lib/db/radar-gap";
import { buildRadarGapReport } from "@/lib/radar/gap-analysis-core";
import type { RadarGapReport } from "@/lib/radar/gap-analysis-core";

export type {
  RadarGapReport,
  RadarGapSourceRow,
  RadarGapStatus,
} from "@/lib/radar/gap-analysis-core";

export async function readRadarGapReport(window: {
  start: Date;
  end: Date;
}): Promise<RadarGapReport> {
  const runs = await listRadarRunsInWindow(window.start, window.end);

  return buildRadarGapReport({ runs, window });
}
