import type { RadarGapRunRow } from "@/lib/db/radar-gap";
import type { RadarRetrievalMethod } from "@/lib/radar/sources";
import { effectiveCadence, RADAR_SOURCES } from "@/lib/radar/sources";

export type RadarGapStatus =
  | "not_checked"
  | "failed"
  | "not_implemented"
  | "quiet"
  | "signals_found";

export type RadarGapSourceRow = {
  sourceId: string;
  sourceName: string;
  cadenceLabel: string;
  retrievalMethod: RadarRetrievalMethod;
  signalTypes: string;
  status: RadarGapStatus;
  latestRun:
    | {
        outcome: RadarGapRunRow["outcome"];
        startedAt: string;
        finishedAt: string | null;
        failureReason: string | null;
      }
    | null;
  totals: {
    runs: number;
    found: number;
    empty: number;
    failed: number;
    notImplemented: number;
    itemsSeen: number;
    signalsCreated: number;
    duplicatesSuppressed: number;
  };
};

export type RadarGapReport = {
  weekKey: string;
  windowStart: string;
  windowEnd: string;
  totals: {
    sources: number;
    notChecked: number;
    failed: number;
    notImplemented: number;
    quiet: number;
    signalsFound: number;
    runs: number;
    itemsSeen: number;
    signalsCreated: number;
    duplicatesSuppressed: number;
  };
  sources: RadarGapSourceRow[];
};

type BuildReportInput = {
  runs: RadarGapRunRow[];
  window: { start: Date; end: Date };
};

export function radarGapStatusForRuns(
  runs: readonly Pick<
    RadarGapRunRow,
    "outcome" | "signalsCreated" | "startedAt"
  >[],
): RadarGapStatus {
  if (runs.length === 0) return "not_checked";

  const latest = latestRun(runs);

  if (latest.outcome === "failed") return "failed";
  if (latest.outcome === "not_implemented") return "not_implemented";
  if (runs.some((run) => run.signalsCreated > 0)) return "signals_found";

  return "quiet";
}

export function buildRadarGapReport({
  runs,
  window,
}: BuildReportInput): RadarGapReport {
  const rows = RADAR_SOURCES.map((source) => {
    const sourceRuns = runs
      .filter((run) => run.sourceId === source.id)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const latest = sourceRuns[0] ?? null;
    const cadence = effectiveCadence(source, window.end);
    const totals = sourceRuns.reduce(
      (acc, run) => {
        acc.runs += 1;
        acc.itemsSeen += run.itemsSeen;
        acc.signalsCreated += run.signalsCreated;
        acc.duplicatesSuppressed += run.duplicatesSuppressed;

        if (run.outcome === "found") acc.found += 1;
        else if (run.outcome === "empty") acc.empty += 1;
        else if (run.outcome === "failed") acc.failed += 1;
        else acc.notImplemented += 1;

        return acc;
      },
      {
        runs: 0,
        found: 0,
        empty: 0,
        failed: 0,
        notImplemented: 0,
        itemsSeen: 0,
        signalsCreated: 0,
        duplicatesSuppressed: 0,
      },
    );

    return {
      sourceId: source.id,
      sourceName: latest?.sourceName ?? source.name,
      cadenceLabel: cadence.window
        ? `${cadence.cadence} during ${cadence.window}`
        : cadence.cadence,
      retrievalMethod: source.method,
      signalTypes: source.signalTypes,
      status: radarGapStatusForRuns(sourceRuns),
      latestRun: latest
        ? {
            outcome: latest.outcome,
            startedAt: latest.startedAt.toISOString(),
            finishedAt: latest.finishedAt?.toISOString() ?? null,
            failureReason: latest.failureReason,
          }
        : null,
      totals,
    } satisfies RadarGapSourceRow;
  });

  return {
    weekKey: window.end.toISOString().slice(0, 10),
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    totals: {
      sources: rows.length,
      notChecked: rows.filter((row) => row.status === "not_checked").length,
      failed: rows.filter((row) => row.status === "failed").length,
      notImplemented: rows.filter((row) => row.status === "not_implemented")
        .length,
      quiet: rows.filter((row) => row.status === "quiet").length,
      signalsFound: rows.filter((row) => row.status === "signals_found").length,
      runs: rows.reduce((sum, row) => sum + row.totals.runs, 0),
      itemsSeen: rows.reduce((sum, row) => sum + row.totals.itemsSeen, 0),
      signalsCreated: rows.reduce(
        (sum, row) => sum + row.totals.signalsCreated,
        0,
      ),
      duplicatesSuppressed: rows.reduce(
        (sum, row) => sum + row.totals.duplicatesSuppressed,
        0,
      ),
    },
    sources: rows,
  };
}

function latestRun<T extends Pick<RadarGapRunRow, "startedAt">>(
  runs: readonly T[],
): T {
  return runs.reduce((latest, run) =>
    run.startedAt > latest.startedAt ? run : latest,
  );
}
