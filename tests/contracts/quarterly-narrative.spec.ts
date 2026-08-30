import { expect, test } from "@playwright/test";

import { quarterlyNarrativeSchema } from "@/app/(app)/impact/schema";

test("quarterly narrative requires all four bounded staff-authored dimensions", () => {
  const valid = {
    quarterKey: "2026-Q2",
    wins: "A ministry consultation cited the evidence brief.",
    missedWindows: "The procurement consultation closed before engagement.",
    evidenceGaps: "Need local evidence on farmer verification costs.",
    systemImprovement: "Create a named owner for each policy window.",
  };

  expect(quarterlyNarrativeSchema.safeParse(valid).success).toBe(true);
  expect(quarterlyNarrativeSchema.safeParse({ ...valid, wins: " " }).success).toBe(false);
  expect(quarterlyNarrativeSchema.safeParse({ ...valid, quarterKey: "2026-Q5" }).success).toBe(false);
  expect(quarterlyNarrativeSchema.safeParse({ ...valid, evidenceGaps: "x".repeat(3001) }).success).toBe(false);
});
