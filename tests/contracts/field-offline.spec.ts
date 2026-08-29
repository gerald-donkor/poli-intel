import { expect, test } from "@playwright/test";

import {
  fieldObservationSchema,
  type FieldObservationInput,
} from "@/app/field/schema";
import { canSubmitFieldObservation } from "@/lib/auth/authorize";
import {
  FIELD_CACHE_MAX_BRIEFS,
  FIELD_CACHE_MAX_SIGNALS,
  FIELD_CACHE_PATH,
  FIELD_SENT_MAX_ITEMS,
  FIELD_SUBMISSION_COUNTRY,
} from "@/lib/field/config";
import {
  BRIEF_STATUS_PLAIN_LABEL,
  URGENCY_PLAIN_LABEL,
  plainDate,
  plainDateTime,
} from "@/lib/field/plain-language";
import type { QueuedSubmission } from "@/lib/field/queue";
import {
  BriefStatus,
  StaffRole,
  Urgency,
} from "@/lib/generated/prisma/enums";

test.describe("Field and Offline Contracts", () => {
  test("validates fieldObservationSchema input bounds and format", () => {
    const valid = fieldObservationSchema.safeParse({
      submissionKey: "123e4567-e89b-12d3-a456-426614174000",
      title: "Cocoa plot wildfire incident",
      observation: "Observed new wildfire buffer creation in Juabeso landscape.",
      locationNote: "Juabeso-Bia District",
      observedAt: "2026-08-01",
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.submissionKey).toBe(
        "123e4567-e89b-12d3-a456-426614174000",
      );
      expect(valid.data.title).toBe("Cocoa plot wildfire incident");
      expect(valid.data.locationNote).toBe("Juabeso-Bia District");
    }
  });

  test("rejects observation payloads with missing required fields or invalid bounds", () => {
    // Title under 3 chars
    const shortTitle = fieldObservationSchema.safeParse({
      submissionKey: "123e4567-e89b-12d3-a456-426614174000",
      title: "No",
      observation: "A valid observation of at least 20 characters length.",
    });
    expect(shortTitle.success).toBe(false);

    // Observation under 20 chars
    const shortObs = fieldObservationSchema.safeParse({
      submissionKey: "123e4567-e89b-12d3-a456-426614174000",
      title: "Wildfire update",
      observation: "Too short.",
    });
    expect(shortObs.success).toBe(false);

    // Invalid UUID submissionKey
    const invalidKey = fieldObservationSchema.safeParse({
      submissionKey: "not-a-uuid",
      title: "Wildfire update",
      observation: "A valid observation of at least 20 characters length.",
    });
    expect(invalidKey.success).toBe(false);

    // Future observedAt date
    const futureDate = fieldObservationSchema.safeParse({
      submissionKey: "123e4567-e89b-12d3-a456-426614174000",
      title: "Wildfire update",
      observation: "A valid observation of at least 20 characters length.",
      observedAt: "2099-01-01",
    });
    expect(futureDate.success).toBe(false);
  });

  test("proves field schema prevents client-supplied classification or auth state", () => {
    const rawInput = {
      submissionKey: "123e4567-e89b-12d3-a456-426614174000",
      title: "Tree tenure discussion",
      observation: "Farmers discussed boundary registration in Sefwi Wiawso.",
      classification: "public_published",
      role: "programme_director",
      staffUserId: "admin-id",
      isAiEligible: true,
      status: "published",
    };

    const parsed = fieldObservationSchema.parse(rawInput);

    // Zod strips undeclared keys so none of these can reach downstream actions
    expect((parsed as Record<string, unknown>).classification).toBeUndefined();
    expect((parsed as Record<string, unknown>).role).toBeUndefined();
    expect((parsed as Record<string, unknown>).staffUserId).toBeUndefined();
    expect((parsed as Record<string, unknown>).isAiEligible).toBeUndefined();
    expect((parsed as Record<string, unknown>).status).toBeUndefined();
  });

  test("defines offline queue record structure free of auth or model state", () => {
    const input: FieldObservationInput = {
      submissionKey: "123e4567-e89b-12d3-a456-426614174000",
      title: "Observation title",
      observation: "Synthetic field observation text describing local agroforestry.",
      locationNote: "Sefwi-Wiawso",
      observedAt: "2026-08-15",
    };

    const queuedItem: QueuedSubmission = {
      submissionKey: input.submissionKey,
      values: input,
      queuedAt: "2026-08-15T10:00:00.000Z",
      reason: "offline",
    };

    expect(queuedItem.submissionKey).toBe(input.submissionKey);
    expect(queuedItem.reason).toBe("offline");
    expect(Object.keys(queuedItem).sort()).toEqual([
      "queuedAt",
      "reason",
      "submissionKey",
      "values",
    ]);
  });

  test("maintains fixed field cache configuration and caps", () => {
    expect(FIELD_CACHE_MAX_SIGNALS).toBe(30);
    expect(FIELD_CACHE_MAX_BRIEFS).toBe(10);
    expect(FIELD_SENT_MAX_ITEMS).toBe(20);
    expect(FIELD_SUBMISSION_COUNTRY).toBe("Ghana");
    expect(FIELD_CACHE_PATH).toBe("/api/field/cache");
  });

  test("allows field observation submission for all staff roles", () => {
    for (const role of Object.values(StaffRole)) {
      expect(canSubmitFieldObservation(role)).toBe(true);
    }
  });

  test("maps internal urgency and brief status enums to plain language", () => {
    expect(URGENCY_PLAIN_LABEL[Urgency.immediate]).toBe("Act this month");
    expect(URGENCY_PLAIN_LABEL[Urgency.near_term]).toBe(
      "Coming in the next few months",
    );
    expect(URGENCY_PLAIN_LABEL[Urgency.horizon]).toBe("Coming later this year");
    expect(URGENCY_PLAIN_LABEL[Urgency.watch]).toBe("Worth knowing about");

    expect(BRIEF_STATUS_PLAIN_LABEL[BriefStatus.draft]).toBe("Being written");
    expect(BRIEF_STATUS_PLAIN_LABEL[BriefStatus.reviewed]).toBe("With the office");
    expect(BRIEF_STATUS_PLAIN_LABEL[BriefStatus.submitted]).toBe(
      "Sent to the people it was written for",
    );
    expect(BRIEF_STATUS_PLAIN_LABEL[BriefStatus.published]).toBe("Published");
  });

  test("formats plain dates in British English locale format", () => {
    const formattedDate = plainDate("2026-08-29T14:30:00.000Z");
    expect(formattedDate).toBe("29 August 2026");

    const formattedDateTime = plainDateTime("2026-08-29T14:30:00.000Z");
    expect(formattedDateTime).toContain("29 August 2026 at");
  });
});
