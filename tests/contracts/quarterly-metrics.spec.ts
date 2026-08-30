import { expect, test } from "@playwright/test";

import { calculateQuarterlyOperationalMetrics } from "@/lib/impact/quarterly-metrics";
import {
  BriefAudience,
  BriefStatus,
  EvidenceMatchAssessment,
  Urgency,
} from "@/lib/generated/prisma/enums";

test("quarterly scorecard calculates median, review quality, and capture rate from stored rows", () => {
  const metrics = calculateQuarterlyOperationalMetrics({
    signals: [
      { urgency: Urgency.immediate, captured: true },
      { urgency: Urgency.immediate, captured: false },
      { urgency: Urgency.near_term, captured: false },
      { urgency: Urgency.horizon, captured: false },
      { urgency: Urgency.watch, captured: false },
    ],
    briefs: [
      {
        status: BriefStatus.reviewed,
        audience: BriefAudience.ghana_ministry_official,
        signalDetectedAt: new Date("2026-04-01T08:00:00Z"),
        completedAt: new Date("2026-04-01T10:00:00Z"),
      },
      {
        status: BriefStatus.submitted,
        audience: BriefAudience.eu_regulator,
        signalDetectedAt: new Date("2026-04-01T08:00:00Z"),
        completedAt: new Date("2026-04-01T13:00:00Z"),
      },
      {
        status: BriefStatus.draft,
        audience: BriefAudience.crema_community_governance,
        signalDetectedAt: null,
        completedAt: null,
      },
    ],
    evidenceReviews: [
      { assessment: EvidenceMatchAssessment.relevant },
      { assessment: EvidenceMatchAssessment.relevant },
      { assessment: EvidenceMatchAssessment.not_relevant },
    ],
  });

  expect(metrics.turnaroundHoursMedian).toBe(3.5);
  expect(metrics.evidenceMatchQuality).toBe(67);
  expect(metrics.policyWindowCaptureRate).toBe(50);
  expect(metrics.urgencyCounts).toEqual({
    immediate: 2,
    near_term: 1,
    horizon: 1,
    watch: 1,
  });
  expect(metrics.briefStatusCounts).toEqual({
    draft: 1,
    reviewed: 1,
    submitted: 1,
    published: 0,
  });
  expect(metrics.audienceDistribution).toEqual({
    ghana_ministry_official: 1,
    cocoa_company_sustainability: 0,
    eu_regulator: 1,
    donor_programme_officer: 0,
    crema_community_governance: 1,
  });
});

test("quarterly scorecard keeps unavailable rates explicit and rejects negative turnaround intervals", () => {
  const metrics = calculateQuarterlyOperationalMetrics({
    signals: [{ urgency: Urgency.near_term, captured: false }],
    briefs: [
      {
        status: BriefStatus.reviewed,
        audience: BriefAudience.cocoa_company_sustainability,
        signalDetectedAt: new Date("2026-04-02T12:00:00Z"),
        completedAt: new Date("2026-04-02T08:00:00Z"),
      },
    ],
    evidenceReviews: [],
  });

  expect(metrics.turnaroundHoursMedian).toBeNull();
  expect(metrics.evidenceMatchQuality).toBeNull();
  expect(metrics.policyWindowCaptureRate).toBeNull();
});
