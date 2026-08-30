import "server-only";

import { BriefStatus } from "@/lib/generated/prisma/enums";
import { calculateAnnualStrategicMetrics, type AnnualStrategicMetrics } from "@/lib/impact/annual-metrics";

import { firstLine } from "./briefs";
import { prisma } from "./client";

const COMPLETED_BRIEF_STATUSES = [BriefStatus.reviewed, BriefStatus.submitted, BriefStatus.published] as const;

export type AnnualStrategicEvent = {
  id: string;
  briefId: string;
  briefTitle: string;
  eventType: string;
  description: string;
  sourceTitle: string | null;
  sourceDocument: string | null;
  detectedAt: string;
  hectaresImpacted: number | null;
  peopleImpacted: number | null;
  adaptedCountries: string[];
};

export type AnnualStrategicReport = {
  metrics: AnnualStrategicMetrics;
  events: AnnualStrategicEvent[];
  evidence: Array<{ id: string; title: string; citationKey: string; eventCount: number }>;
};

/** Read-only annual assembly. This selects only bibliographic evidence identity. */
export async function readAnnualStrategicReport({ year }: { year: number }): Promise<AnnualStrategicReport> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const window = { gte: start, lt: end };

  const [signals, briefs, eventRows, evidenceReviews] = await Promise.all([
    prisma.policySignal.findMany({
      where: { detectedAt: window },
      select: { urgency: true, briefs: { where: { status: { in: [...COMPLETED_BRIEF_STATUSES] } }, select: { id: true } } },
    }),
    prisma.brief.findMany({
      where: { OR: [{ createdAt: window }, { statusChanges: { some: { changedAt: window } } }] },
      select: {
        audience: true,
        signal: { select: { detectedAt: true } },
        statusChanges: { where: { changedAt: window, newStatus: { in: [...COMPLETED_BRIEF_STATUSES] } }, orderBy: { changedAt: "asc" }, take: 1, select: { changedAt: true } },
      },
    }),
    prisma.influenceEvent.findMany({
      where: { verified: true, verifiedAt: window },
      orderBy: [{ verifiedAt: "asc" }, { detectedAt: "asc" }],
      select: {
        id: true, briefId: true, eventType: true, description: true, sourceTitle: true, sourceDocument: true, detectedAt: true,
        hectaresImpacted: true, peopleImpacted: true, adaptedCountries: true,
        brief: { select: { versions: { orderBy: { version: "desc" }, take: 1, select: { bodyText: true } } } },
      },
    }),
    prisma.evidenceMatchReview.findMany({ where: { reviewedAt: window }, select: { assessment: true } }),
  ]);

  const metrics = calculateAnnualStrategicMetrics({
    year,
    signals: signals.map((signal) => ({ urgency: signal.urgency, captured: signal.briefs.length > 0 })),
    briefs: briefs.map((brief) => ({ audience: brief.audience, signalDetectedAt: brief.signal?.detectedAt ?? null, completedAt: brief.statusChanges[0]?.changedAt ?? null })),
    events: eventRows.map((event) => ({ eventType: event.eventType, hectaresImpacted: event.hectaresImpacted, peopleImpacted: event.peopleImpacted, adaptedCountries: event.adaptedCountries })),
    evidenceReviews,
  });
  const events = eventRows.map((event) => ({
    id: event.id, briefId: event.briefId, briefTitle: firstLine(event.brief.versions[0]?.bodyText ?? "") || "Untitled brief",
    eventType: event.eventType, description: event.description, sourceTitle: event.sourceTitle, sourceDocument: event.sourceDocument,
    detectedAt: event.detectedAt.toISOString(), hectaresImpacted: event.hectaresImpacted, peopleImpacted: event.peopleImpacted, adaptedCountries: event.adaptedCountries,
  }));
  return { metrics, events, evidence: await readEvidence(events.map((event) => event.briefId)) };
}

async function readEvidence(briefIds: readonly string[]) {
  if (briefIds.length === 0) return [];
  const rows = await prisma.briefEvidence.findMany({ where: { briefId: { in: [...new Set(briefIds)] } }, select: { briefId: true, evidenceItem: { select: { id: true, title: true, citationKey: true } } } });
  const perBrief = new Map<string, number>();
  for (const briefId of briefIds) perBrief.set(briefId, (perBrief.get(briefId) ?? 0) + 1);
  const totals = new Map<string, { id: string; title: string; citationKey: string; eventCount: number }>();
  for (const row of rows) {
    const eventCount = perBrief.get(row.briefId) ?? 0;
    const current = totals.get(row.evidenceItem.id);
    if (current) current.eventCount += eventCount;
    else totals.set(row.evidenceItem.id, { ...row.evidenceItem, eventCount });
  }
  return [...totals.values()].sort((a, b) => b.eventCount - a.eventCount || a.title.localeCompare(b.title));
}
