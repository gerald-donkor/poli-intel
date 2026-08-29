import { expect, test } from "@playwright/test";

import { reviewEvidenceMatchSchema } from "@/app/(app)/signals/[id]/schema";
import { canReviewEvidenceMatch } from "@/lib/auth/authorize";
import {
  EvidenceMatchAssessment,
  StaffRole,
} from "@/lib/generated/prisma/enums";

test.describe("Evidence Match Review Contract", () => {
  test("restricts review authority to Research Officer and Programme Director", () => {
    expect(canReviewEvidenceMatch(StaffRole.programme_director)).toBe(true);
    expect(canReviewEvidenceMatch(StaffRole.research_officer)).toBe(true);
    expect(canReviewEvidenceMatch(StaffRole.policy_advocacy_officer)).toBe(false);
    expect(canReviewEvidenceMatch(StaffRole.field_officer)).toBe(false);
  });

  test("validates schema with proper UUIDs and assessment enums", () => {
    const valid = reviewEvidenceMatchSchema.safeParse({
      signalId: "123e4567-e89b-12d3-a456-426614174000",
      evidenceItemId: "123e4567-e89b-12d3-a456-426614174001",
      assessment: EvidenceMatchAssessment.relevant,
      note: "Useful context on tree tenure.",
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.assessment).toBe(EvidenceMatchAssessment.relevant);
      expect(valid.data.note).toBe("Useful context on tree tenure.");
    }
  });

  test("trims empty note to null", () => {
    const parsed = reviewEvidenceMatchSchema.safeParse({
      signalId: "123e4567-e89b-12d3-a456-426614174000",
      evidenceItemId: "123e4567-e89b-12d3-a456-426614174001",
      assessment: EvidenceMatchAssessment.not_relevant,
      note: "   ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.note).toBeNull();
    }
  });

  test("rejects notes exceeding 500 characters", () => {
    const parsed = reviewEvidenceMatchSchema.safeParse({
      signalId: "123e4567-e89b-12d3-a456-426614174000",
      evidenceItemId: "123e4567-e89b-12d3-a456-426614174001",
      assessment: EvidenceMatchAssessment.uncertain,
      note: "a".repeat(501),
    });

    expect(parsed.success).toBe(false);
  });

  test("rejects invalid UUIDs and invalid assessments", () => {
    const invalidId = reviewEvidenceMatchSchema.safeParse({
      signalId: "not-a-uuid",
      evidenceItemId: "123e4567-e89b-12d3-a456-426614174001",
      assessment: EvidenceMatchAssessment.relevant,
    });
    expect(invalidId.success).toBe(false);

    const invalidEnum = reviewEvidenceMatchSchema.safeParse({
      signalId: "123e4567-e89b-12d3-a456-426614174000",
      evidenceItemId: "123e4567-e89b-12d3-a456-426614174001",
      assessment: "not_an_enum_value" as unknown as EvidenceMatchAssessment,
    });
    expect(invalidEnum.success).toBe(false);
  });
});
