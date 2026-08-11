import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildRadarGapReport,
  radarGapStatusForRuns,
} from "@/lib/radar/gap-analysis-core";
import { RADAR_SOURCES } from "@/lib/radar/sources";

type TestRun = Parameters<typeof buildRadarGapReport>[0]["runs"][number];

const WINDOW = {
  start: new Date("2026-08-03T07:00:00.000Z"),
  end: new Date("2026-08-10T07:00:00.000Z"),
};

function run(input: Partial<TestRun> = {}): TestRun {
  return {
    sourceId: "ghana-gazette",
    sourceName: "Ghana Gazette / Forestry Commission",
    outcome: "empty",
    itemsSeen: 0,
    signalsCreated: 0,
    duplicatesSuppressed: 0,
    failureReason: null,
    startedAt: new Date("2026-08-10T05:00:00.000Z"),
    finishedAt: new Date("2026-08-10T05:01:00.000Z"),
    ...input,
  };
}

test.describe("Radar Gap Analysis", () => {
  test("maps no runs to not_checked", () => {
    expect(radarGapStatusForRuns([])).toBe("not_checked");
  });

  test("maps latest failed run to failed", () => {
    expect(
      radarGapStatusForRuns([
        run({ outcome: "found", signalsCreated: 2 }),
        run({
          outcome: "failed",
          startedAt: new Date("2026-08-10T06:00:00.000Z"),
        }),
      ]),
    ).toBe("failed");
  });

  test("maps created signals to signals_found", () => {
    expect(radarGapStatusForRuns([run({ outcome: "found", signalsCreated: 1 })]))
      .toBe("signals_found");
  });

  test("maps only empty runs to quiet", () => {
    expect(radarGapStatusForRuns([run({ outcome: "empty" })])).toBe("quiet");
  });

  test("maps latest not implemented run to not_implemented", () => {
    expect(radarGapStatusForRuns([run({ outcome: "not_implemented" })])).toBe(
      "not_implemented",
    );
  });

  test("includes every registry source exactly once when no runs exist", () => {
    const report = buildRadarGapReport({ runs: [], window: WINDOW });
    const ids = report.sources.map((source) => source.sourceId);

    expect(ids).toEqual(RADAR_SOURCES.map((source) => source.id));
    expect(new Set(ids).size).toBe(RADAR_SOURCES.length);
    expect(report.sources.every((source) => source.status === "not_checked"))
      .toBe(true);
  });

  test("keeps the report builder free of evidence and AI read paths", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/radar/gap-analysis.ts"),
      "utf8",
    );

    for (const forbidden of [
      "lib/db/evidence",
      "lib/db/briefs",
      "lib/db/field",
      "lib/db/stakeholders",
      "lib/ai",
      "fullText",
      "chunkText",
      "bodyText",
      "claimText",
      "prompt",
      "completion",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
