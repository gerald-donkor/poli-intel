import { expect, test } from "@playwright/test";

import { logResearchGapSchema, updateResearchGapSchema } from "@/app/(app)/evidence/gaps/schema";
import { canLogResearchGap, canManageResearchGaps } from "@/lib/auth/authorize";
import { ImpactArea, ResearchGapPriority, ResearchGapStatus, StaffRole } from "@/lib/generated/prisma/enums";

const signalId = "123e4567-e89b-12d3-a456-426614174000";

test("research-gap permissions retain policy logging but reserve management to research", () => {
  expect(canLogResearchGap(StaffRole.policy_advocacy_officer)).toBe(true);
  expect(canLogResearchGap(StaffRole.research_officer)).toBe(true);
  expect(canLogResearchGap(StaffRole.programme_director)).toBe(true);
  expect(canLogResearchGap(StaffRole.field_officer)).toBe(false);
  expect(canManageResearchGaps(StaffRole.research_officer)).toBe(true);
  expect(canManageResearchGaps(StaffRole.programme_director)).toBe(true);
  expect(canManageResearchGaps(StaffRole.policy_advocacy_officer)).toBe(false);
});

test("research-gap schemas validate signal association and bounded human context", () => {
  const parsed = logResearchGapSchema.safeParse({ signalId, impactArea: ImpactArea.community_forestry, topic: "Community benefit-sharing evidence", description: "Need published evidence on locally governed benefit-sharing arrangements.", priority: ResearchGapPriority.high });
  expect(parsed.success).toBe(true);
  expect(logResearchGapSchema.safeParse({ signalId: "nope", impactArea: ImpactArea.restoration, topic: "x", description: "short" }).success).toBe(false);
  expect(updateResearchGapSchema.safeParse({ id: signalId, status: ResearchGapStatus.resolved, resolutionNotes: "A published study has been ingested." }).success).toBe(true);
});
