import {
  BriefAudience,
  EvidenceMatchAssessment,
  InfluenceEventType,
  Urgency,
} from "@/lib/generated/prisma/enums";
import { TBI_PARTNER_COUNTRIES } from "./network-partners";

const audiences = Object.values(BriefAudience);
const eventTypes = Object.values(InfluenceEventType);

export type AnnualStrategicMetrics = {
  year: number;
  totalSignalsDetected: number;
  immediateSignalsCount: number;
  immediateSignalsCaptured: number;
  annualCaptureRate: number | null;
  totalBriefs: number;
  audienceDistribution: Record<BriefAudience, number>;
  verifiedEventsCount: number;
  eventsByType: Record<InfluenceEventType, number>;
  totalHectaresInfluenced: number;
  totalPeopleBenefited: number;
  networkPartnerAdoptionsCount: number;
  partnerCountryCoverage: Array<{ code: string; name: string; count: number }>;
  averageTurnaroundHours: number | null;
  overallMatchQualityPercentage: number | null;
};

type Input = {
  year: number;
  signals: Array<{ urgency: Urgency; captured: boolean }>;
  briefs: Array<{ audience: BriefAudience; signalDetectedAt: Date | null; completedAt: Date | null }>;
  events: Array<{ eventType: InfluenceEventType; hectaresImpacted: number | null; peopleImpacted: number | null; adaptedCountries: string[] }>;
  evidenceReviews: Array<{ assessment: EvidenceMatchAssessment }>;
};

function counts<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

export function calculateAnnualStrategicMetrics(input: Input): AnnualStrategicMetrics {
  const audienceDistribution = counts(audiences);
  const eventsByType = counts(eventTypes);
  const coverage = new Map<string, number>(TBI_PARTNER_COUNTRIES.map((partner) => [partner.code, 0]));
  const turnaround: number[] = [];
  let immediateSignalsCount = 0;
  let immediateSignalsCaptured = 0;
  let totalHectaresInfluenced = 0;
  let totalPeopleBenefited = 0;

  for (const signal of input.signals) {
    if (signal.urgency !== Urgency.immediate) continue;
    immediateSignalsCount += 1;
    if (signal.captured) immediateSignalsCaptured += 1;
  }
  for (const brief of input.briefs) {
    audienceDistribution[brief.audience] += 1;
    if (brief.signalDetectedAt && brief.completedAt) {
      const hours = (brief.completedAt.getTime() - brief.signalDetectedAt.getTime()) / 3_600_000;
      if (Number.isFinite(hours) && hours >= 0) turnaround.push(hours);
    }
  }
  for (const event of input.events) {
    eventsByType[event.eventType] += 1;
    totalHectaresInfluenced += Math.max(0, event.hectaresImpacted ?? 0);
    totalPeopleBenefited += Math.max(0, event.peopleImpacted ?? 0);
    for (const code of new Set(event.adaptedCountries)) {
      if (coverage.has(code)) coverage.set(code, (coverage.get(code) ?? 0) + 1);
    }
  }
  const relevant = input.evidenceReviews.filter((review) => review.assessment === EvidenceMatchAssessment.relevant).length;
  const partnerCountryCoverage = TBI_PARTNER_COUNTRIES.map((partner) => ({ code: partner.code, name: partner.country, count: coverage.get(partner.code) ?? 0 }));
  const adoptedCountries = partnerCountryCoverage.filter((partner) => partner.count > 0).length;

  return {
    year: input.year,
    totalSignalsDetected: input.signals.length,
    immediateSignalsCount,
    immediateSignalsCaptured,
    annualCaptureRate: immediateSignalsCount === 0 ? null : Math.round((immediateSignalsCaptured / immediateSignalsCount) * 100),
    totalBriefs: input.briefs.length,
    audienceDistribution,
    verifiedEventsCount: input.events.length,
    eventsByType,
    totalHectaresInfluenced,
    totalPeopleBenefited,
    networkPartnerAdoptionsCount: adoptedCountries,
    partnerCountryCoverage,
    averageTurnaroundHours: turnaround.length === 0 ? null : Math.round((turnaround.reduce((sum, value) => sum + value, 0) / turnaround.length) * 10) / 10,
    overallMatchQualityPercentage: input.evidenceReviews.length === 0 ? null : Math.round((relevant / input.evidenceReviews.length) * 100),
  };
}
