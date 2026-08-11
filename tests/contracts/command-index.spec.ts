import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CommandEvidence } from "@/lib/command/types";

const COMMAND_INDEX_SOURCE = readFileSync(
  join(process.cwd(), "lib/command/index.ts"),
  "utf8",
);

test.describe("Command Index Contract", () => {
  test("should use the same evidence eligibility filter as governed retrieval", () => {
    expect(COMMAND_INDEX_SOURCE).toContain("...ELIGIBLE_EVIDENCE_WHERE");
    expect(COMMAND_INDEX_SOURCE).toContain(
      "extractionCompletedAt: { not: null }",
    );
  });

  test("should keep command index limits bounded", () => {
    expect(COMMAND_INDEX_SOURCE).toContain("COMMAND_SIGNAL_LIMIT = 16");
    expect(COMMAND_INDEX_SOURCE).toContain("COMMAND_EVIDENCE_LIMIT = 16");
  });

  test("should define evidence command rows as metadata only", () => {
    const row = {
      kind: "evidence",
      id: "evidence-1",
      title: "Public cocoa agroforestry study",
      citationKey: "TBG-2026-01",
      year: 2026,
      country: "Ghana",
      impactArea: null,
      sourceType: "research",
      embeddedChunkCount: 4,
    } satisfies CommandEvidence;

    expect(Object.keys(row).sort()).toEqual([
      "citationKey",
      "country",
      "embeddedChunkCount",
      "id",
      "impactArea",
      "kind",
      "sourceType",
      "title",
      "year",
    ]);

    expect(row).not.toHaveProperty("fullText");
    expect(row).not.toHaveProperty("excerpt");
    expect(row).not.toHaveProperty("chunkText");
  });
});
