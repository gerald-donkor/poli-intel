import {
  BriefAudience,
  BriefStatus,
  EvidenceMatchAssessment,
  Urgency,
} from "@/lib/generated/prisma/enums";

const URGENCY_ORDER = [
  Urgency.immediate,
  Urgency.near_term,
  Urgency.horizon,
  Urgency.watch,
] as const;

const BRIEF_STATUS_ORDER = [
  BriefStatus.draft,
  BriefStatus.reviewed,
  BriefStatus.submitted,
  BriefStatus.published,
] as const;

const BRIEF_AUDIENCE_ORDER = [
  BriefAudience.ghana_ministry_official,
  BriefAudience.cocoa_company_sustainability,
  BriefAudience.eu_regulator,
  BriefAudience.donor_programme_officer,
  BriefAudience.crema_community_governance,
] as const;

export type QuarterlyOperationalMetrics = {
  signalsCount: number;
  urgencyCounts: Record<Urgency, number>;
  briefsCount: number;
  briefStatusCounts: Record<BriefStatus, number>;
  turnaroundHoursMedian: number | null;
  evidenceMatchQuality: number | null;
  evidenceReviewsRelevant: number;
  evidenceReviewsTotal: number;
  policyWindowCaptureRate: number | null;
  immediateSignalsCaptured: number;
  immediateSignalsTotal: number;
  audienceDistribution: Record<BriefAudience, number>;
};

export type QuarterlyOperationalMetricInput = {
  signals: Array<{ urgency: Urgency; captured: boolean }>;
  briefs: Array<{
    status: BriefStatus;
    audience: BriefAudience;
    signalDetectedAt: Date | null;
    completedAt: Date | null;
  }>;
  evidenceReviews: Array<{ assessment: EvidenceMatchAssessment }>;
};

function emptyCounts<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

/**
 * Keeps the quarterly scorecard's mathematics independent of Prisma. That makes
 * the donor-facing numbers contract-testable without a database fixture.
 */
export function calculateQuarterlyOperationalMetrics({
  signals,
  briefs,
  evidenceReviews,
}: QuarterlyOperationalMetricInput): QuarterlyOperationalMetrics {
  const urgencyCounts = emptyCounts(URGENCY_ORDER);
  const briefStatusCounts = emptyCounts(BRIEF_STATUS_ORDER);
  const audienceDistribution = emptyCounts(BRIEF_AUDIENCE_ORDER);
  const turnaroundHours: number[] = [];

  let immediateSignalsCaptured = 0;

  for (const signal of signals) {
    urgencyCounts[signal.urgency] += 1;
    if (signal.urgency === Urgency.immediate && signal.captured) {
      immediateSignalsCaptured += 1;
    }
  }

  for (const brief of briefs) {
    briefStatusCounts[brief.status] += 1;
    audienceDistribution[brief.audience] += 1;

    if (brief.signalDetectedAt && brief.completedAt) {
      const hours =
        (brief.completedAt.getTime() - brief.signalDetectedAt.getTime()) /
        (1000 * 60 * 60);

      // A bad import must not turn a scorecard into a claim of impossible speed.
      if (Number.isFinite(hours) && hours >= 0) turnaroundHours.push(hours);
    }
  }

  turnaroundHours.sort((left, right) => left - right);
  const midpoint = Math.floor(turnaroundHours.length / 2);
  const turnaroundHoursMedian =
    turnaroundHours.length === 0
      ? null
      : turnaroundHours.length % 2 === 1
        ? turnaroundHours[midpoint]
        : (turnaroundHours[midpoint - 1] + turnaroundHours[midpoint]) / 2;

  const evidenceReviewsRelevant = evidenceReviews.filter(
    (review) => review.assessment === EvidenceMatchAssessment.relevant,
  ).length;
  const immediateSignalsTotal = urgencyCounts[Urgency.immediate];

  return {
    signalsCount: signals.length,
    urgencyCounts,
    briefsCount: briefs.length,
    briefStatusCounts,
    turnaroundHoursMedian,
    evidenceMatchQuality:
      evidenceReviews.length === 0
        ? null
        : Math.round((evidenceReviewsRelevant / evidenceReviews.length) * 100),
    evidenceReviewsRelevant,
    evidenceReviewsTotal: evidenceReviews.length,
    policyWindowCaptureRate:
      immediateSignalsTotal === 0
        ? null
        : Math.round((immediateSignalsCaptured / immediateSignalsTotal) * 100),
    immediateSignalsCaptured,
    immediateSignalsTotal,
    audienceDistribution,
  };
}
