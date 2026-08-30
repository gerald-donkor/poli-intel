import { expect, test } from "@playwright/test";

import {
  BRIEF_QA_NOTES_MAX_CHARS,
  saveBriefQaReviewSchema,
} from "@/app/(app)/briefs/[id]/schema";
import { canReviewBriefQa } from "@/lib/auth/authorize";
import { StaffRole } from "@/lib/generated/prisma/enums";

const brief = { createdById: "brief-author" };
const reviewer = "independent-reviewer";

test.describe("Brief QA review contracts", () => {
  test("permits only independent Research Officers and Programme Directors", () => {
    expect(canReviewBriefQa(StaffRole.research_officer, brief, reviewer)).toBe(true);
    expect(canReviewBriefQa(StaffRole.programme_director, brief, reviewer)).toBe(true);
    expect(canReviewBriefQa(StaffRole.policy_advocacy_officer, brief, reviewer)).toBe(false);
    expect(canReviewBriefQa(StaffRole.field_officer, brief, reviewer)).toBe(false);

    expect(canReviewBriefQa(StaffRole.research_officer, brief, "brief-author")).toBe(false);
    expect(canReviewBriefQa(StaffRole.programme_director, brief, "brief-author")).toBe(false);
  });

  test("validates every review dimension and bounds reviewer notes", () => {
    const base = {
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      factualGroundingChecked: true,
      landscapeSpecificityChecked: true,
      audienceFramingChecked: true,
      actionableAsksChecked: true,
      crossCuttingThemesChecked: true,
      notes: "Reviewed against the cited evidence and intended Ministry audience.",
    };

    expect(saveBriefQaReviewSchema.safeParse(base).success).toBe(true);
    expect(saveBriefQaReviewSchema.safeParse({ ...base, notes: "x".repeat(BRIEF_QA_NOTES_MAX_CHARS + 1) }).success).toBe(false);
    expect(saveBriefQaReviewSchema.safeParse({ ...base, factualGroundingChecked: "yes" }).success).toBe(false);
  });
});
