import { expect, test } from "@playwright/test";

import { calculateAnnualStrategicMetrics } from "@/lib/impact/annual-metrics";
import { getPartnerByCode, isValidPartnerCode } from "@/lib/impact/network-partners";
import { BriefAudience, EvidenceMatchAssessment, InfluenceEventType, Urgency } from "@/lib/generated/prisma/enums";

test("annual strategic metrics aggregate only supplied confirmed-event data", () => {
  const metrics = calculateAnnualStrategicMetrics({
    year: 2026,
    signals: [{ urgency: Urgency.immediate, captured: true }, { urgency: Urgency.immediate, captured: false }, { urgency: Urgency.watch, captured: false }],
    briefs: [{ audience: BriefAudience.ghana_ministry_official, signalDetectedAt: new Date("2026-01-01T00:00:00Z"), completedAt: new Date("2026-01-01T04:00:00Z") }],
    events: [{ eventType: InfluenceEventType.policy_citation, hectaresImpacted: 125000, peopleImpacted: 45000, adaptedCountries: ["UG", "ID", "UG"] }],
    evidenceReviews: [{ assessment: EvidenceMatchAssessment.relevant }, { assessment: EvidenceMatchAssessment.not_relevant }],
  });
  expect(metrics.annualCaptureRate).toBe(50);
  expect(metrics.totalHectaresInfluenced).toBe(125000);
  expect(metrics.totalPeopleBenefited).toBe(45000);
  expect(metrics.networkPartnerAdoptionsCount).toBe(2);
  expect(metrics.partnerCountryCoverage.find((country) => country.code === "UG")?.count).toBe(1);
  expect(metrics.overallMatchQualityPercentage).toBe(50);
  expect(metrics.averageTurnaroundHours).toBe(4);
});

test("network partner taxonomy excludes Ghana from adoption coverage", () => {
  expect(getPartnerByCode("GH")?.host).toBe(true);
  expect(isValidPartnerCode("UG")).toBe(true);
  expect(isValidPartnerCode("ZZ")).toBe(false);
});
