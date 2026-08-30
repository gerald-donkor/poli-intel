import "server-only";

import {
  BriefStatus,
  FlagStatus,
  InfluenceEventType,
  SignalStatus,
  Urgency,
  type BriefAudience,
  type BriefType,
} from "@/lib/generated/prisma/enums";

import { firstLine } from "./briefs";
import { prisma } from "./client";

const APPROVAL_QUEUE_LIMIT = 12;
const URGENT_SIGNAL_LIMIT = 8;
const INFLUENCE_HIGHLIGHT_LIMIT = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExecutiveDashboardData {
  metrics: {
    pendingApprovalCount: number;
    blockedByFlagsCount: number;
    immediateSignalsCount: number;
    nearTermSignalsCount: number;
    closingSoonWindowsCount: number;
    unclassifiedEvidenceCount: number;
    verifiedInfluenceCount: number;
  };
  approvalQueue: Array<{
    id: string;
    title: string;
    briefType: BriefType;
    targetAudience: BriefAudience;
    status: BriefStatus;
    createdAt: Date;
    authorName: string | null;
    authorEmail: string;
    citationsCount: number;
    openFlagsCount: number;
    qaCompleted: boolean;
    canBeApproved: boolean;
  }>;
  urgentSignals: Array<{
    id: string;
    title: string;
    sourceName: string;
    urgency: Urgency;
    detectedAt: Date;
    windowClosesAt: Date | null;
    matchedEvidenceCount: number;
    briefCount: number;
  }>;
  closingWindows: Array<{
    signalId: string;
    signalTitle: string;
    windowClosesAt: Date;
    daysRemaining: number;
    briefStatus: BriefStatus | null;
    briefId: string | null;
  }>;
  recentInfluence: Array<{
    id: string;
    eventType: InfluenceEventType;
    policyDocument: string;
    description: string;
    detectedAt: Date;
    briefTitle: string;
    briefId: string;
  }>;
}

/**
 * The executive dashboard's metadata-only read model. It intentionally does
 * not select evidence bodies, chunk text, or brief prose beyond a current
 * version's first line for a human-readable title. This is a read-only view;
 * it neither invokes nor prepares an AI pipeline entry point.
 */
export async function readExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * DAY_MS);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * DAY_MS);
  const pendingStatuses = [BriefStatus.draft, BriefStatus.reviewed];

  const [
    pendingApprovalCount,
    blockedBriefRows,
    immediateSignalsCount,
    nearTermSignalsCount,
    closingSoonWindowsCount,
    unclassifiedEvidenceCount,
    verifiedInfluenceCount,
    approvalRows,
    urgentRows,
    closingWindowRows,
    influenceRows,
  ] = await prisma.$transaction([
    prisma.brief.count({ where: { status: { in: pendingStatuses } } }),
    prisma.brief.findMany({
      where: {
        status: { in: pendingStatuses },
        versions: { some: { flags: { some: { status: FlagStatus.open } } } },
      },
      select: { id: true },
    }),
    prisma.policySignal.count({
      where: { status: { not: SignalStatus.archived }, urgency: Urgency.immediate },
    }),
    prisma.policySignal.count({
      where: { status: { not: SignalStatus.archived }, urgency: Urgency.near_term },
    }),
    prisma.policySignal.count({
      where: {
        status: { not: SignalStatus.archived },
        windowClosesAt: { gte: now, lte: fourteenDaysFromNow },
      },
    }),
    prisma.evidenceItem.count({
      where: {
        classification: "unpublished_internal",
        extractionCompletedAt: { not: null },
      },
    }),
    prisma.influenceEvent.count({ where: { verified: true } }),
    prisma.brief.findMany({
      where: { status: { in: pendingStatuses } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: APPROVAL_QUEUE_LIMIT,
      select: {
        id: true,
        briefType: true,
        audience: true,
        status: true,
        currentVersion: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            bodyText: true,
            _count: { select: { flags: { where: { status: FlagStatus.open } } } },
          },
        },
        _count: { select: { evidenceSet: true } },
        qaReviews: {
          where: { completedAt: { not: null } },
          select: { briefVersion: true },
        },
      },
    }),
    prisma.policySignal.findMany({
      where: {
        status: { not: SignalStatus.archived },
        urgency: { in: [Urgency.immediate, Urgency.near_term] },
      },
      orderBy: [{ urgency: "asc" }, { detectedAt: "desc" }],
      take: URGENT_SIGNAL_LIMIT,
      select: {
        id: true,
        title: true,
        sourceName: true,
        urgency: true,
        detectedAt: true,
        windowClosesAt: true,
        _count: { select: { evidenceMatches: true, briefs: true } },
      },
    }),
    prisma.policySignal.findMany({
      where: {
        status: { not: SignalStatus.archived },
        windowClosesAt: { gte: now, lte: thirtyDaysFromNow },
      },
      orderBy: { windowClosesAt: "asc" },
      select: {
        id: true,
        title: true,
        windowClosesAt: true,
        briefs: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true, status: true },
        },
      },
    }),
    prisma.influenceEvent.findMany({
      where: { verified: true },
      orderBy: [{ detectedAt: "desc" }, { createdAt: "desc" }],
      take: INFLUENCE_HIGHLIGHT_LIMIT,
      select: {
        id: true,
        eventType: true,
        sourceDocument: true,
        sourceTitle: true,
        description: true,
        detectedAt: true,
        briefId: true,
        brief: {
          select: {
            versions: {
              orderBy: { version: "desc" },
              take: 1,
              select: { bodyText: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    metrics: {
      pendingApprovalCount,
      blockedByFlagsCount: blockedBriefRows.length,
      immediateSignalsCount,
      nearTermSignalsCount,
      closingSoonWindowsCount,
      unclassifiedEvidenceCount,
      verifiedInfluenceCount,
    },
    approvalQueue: approvalRows.map((row) => {
      const openFlagsCount = row.versions[0]?._count.flags ?? 0;
      return {
        id: row.id,
        title: firstLine(row.versions[0]?.bodyText ?? "") || "Untitled draft",
        briefType: row.briefType,
        targetAudience: row.audience,
        status: row.status,
        createdAt: row.createdAt,
        authorName: row.createdBy?.name ?? null,
        authorEmail: row.createdBy?.email ?? "Not recorded",
        citationsCount: row._count.evidenceSet,
        openFlagsCount,
        qaCompleted: row.qaReviews.some(
          (review) => review.briefVersion === row.currentVersion,
        ),
        canBeApproved: row.status === BriefStatus.reviewed && openFlagsCount === 0,
      };
    }),
    urgentSignals: urgentRows.map((row) => ({
      id: row.id,
      title: row.title,
      sourceName: row.sourceName,
      urgency: row.urgency,
      detectedAt: row.detectedAt,
      windowClosesAt: row.windowClosesAt,
      matchedEvidenceCount: row._count.evidenceMatches,
      briefCount: row._count.briefs,
    })),
    closingWindows: closingWindowRows.flatMap((row) => {
      if (!row.windowClosesAt) return [];
      const latestBrief = row.briefs[0] ?? null;
      return [{
        signalId: row.id,
        signalTitle: row.title,
        windowClosesAt: row.windowClosesAt,
        daysRemaining: Math.max(0, Math.ceil((row.windowClosesAt.getTime() - endOfToday.getTime()) / DAY_MS)),
        briefStatus: latestBrief?.status ?? null,
        briefId: latestBrief?.id ?? null,
      }];
    }),
    recentInfluence: influenceRows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      policyDocument: row.sourceTitle ?? row.sourceDocument ?? "Policy document not named",
      description: row.description,
      detectedAt: row.detectedAt,
      briefTitle: firstLine(row.brief.versions[0]?.bodyText ?? "") || "Untitled brief",
      briefId: row.briefId,
    })),
  };
}
