import "server-only";

import {
  canChangeEvidenceClassification,
  canGenerateBrief,
  canIngestEvidence,
  canLogInfluenceEvent,
  canManageStakeholders,
  canSubmitFieldObservation,
} from "@/lib/auth/authorize";
import type { StaffUser } from "@/lib/generated/prisma/client";
import { SignalStatus } from "@/lib/generated/prisma/enums";
import { ELIGIBLE_EVIDENCE_WHERE } from "@/lib/governance/gate";

import { prisma } from "@/lib/db/client";
import { countEmbeddedChunksByItem } from "@/lib/db/evidence-vectors";

import type {
  CommandDestination,
  CommandEvidence,
  CommandIndex,
  CommandQuickStart,
  CommandSignal,
} from "./types";

export const COMMAND_SIGNAL_LIMIT = 16;
export const COMMAND_EVIDENCE_LIMIT = 16;

const DESTINATIONS: CommandDestination[] = [
  {
    kind: "destination",
    id: "dashboard",
    label: "Dashboard",
    description: "Executive overview and approval queue",
    href: "/dashboard",
    shortcut: "G D",
  },
  {
    kind: "destination",
    id: "signals",
    label: "Signals",
    description: "Policy developments awaiting review",
    href: "/signals",
    shortcut: "G S",
  },
  {
    kind: "destination",
    id: "briefs",
    label: "Briefs",
    description: "Drafts, reviews, and submitted work",
    href: "/briefs",
    shortcut: "G B",
  },
  {
    kind: "destination",
    id: "tracker",
    label: "Tracker",
    description: "Policy windows and submission timing",
    href: "/tracker",
    shortcut: "G T",
  },
  {
    kind: "destination",
    id: "stakeholders",
    label: "Stakeholders",
    description: "Contacts and brief history",
    href: "/stakeholders",
    shortcut: "G C",
  },
  {
    kind: "destination",
    id: "evidence",
    label: "Evidence",
    description: "Public published evidence library",
    href: "/evidence",
    shortcut: "G E",
  },
  {
    kind: "destination",
    id: "impact",
    label: "Impact",
    description: "Influence events and reports",
    href: "/impact",
    shortcut: "G I",
  },
];

export async function loadCommandIndex(user: StaffUser): Promise<CommandIndex> {
  const [signals, evidence] = await Promise.all([
    listCommandSignals(),
    listCommandEvidence(),
  ]);

  return {
    role: user.role,
    destinations: DESTINATIONS,
    quickStarts: quickStartsForRole(user.role),
    signals,
    evidence,
    limits: {
      signals: COMMAND_SIGNAL_LIMIT,
      evidence: COMMAND_EVIDENCE_LIMIT,
    },
  };
}

function quickStartsForRole(role: StaffUser["role"]): CommandQuickStart[] {
  const starts: CommandQuickStart[] = [];

  if (canGenerateBrief(role)) {
    starts.push({
      kind: "quick-start",
      id: "new-brief",
      label: "New brief",
      description: "Open the manual brief generator",
      href: "/briefs/new",
    });
  }

  if (canIngestEvidence(role)) {
    starts.push({
      kind: "quick-start",
      id: "add-evidence",
      label: "Add evidence",
      description: "Upload and classify a source",
      href: "/evidence/new",
    });
  }

  if (canChangeEvidenceClassification(role)) {
    starts.push({
      kind: "quick-start",
      id: "classification-queue",
      label: "Classification queue",
      description: "Review evidence held by the governance gate",
      href: "/evidence/queue",
    });
  }

  if (canManageStakeholders(role)) {
    starts.push({
      kind: "quick-start",
      id: "stakeholder-record",
      label: "Stakeholder record",
      description: "Open stakeholder records",
      href: "/stakeholders",
    });
  }

  if (canLogInfluenceEvent(role)) {
    starts.push({
      kind: "quick-start",
      id: "impact-log",
      label: "Impact log",
      description: "Record an influence event",
      href: "/impact",
    });
  }

  if (canSubmitFieldObservation(role)) {
    starts.push({
      kind: "quick-start",
      id: "field-submission",
      label: "Field submission",
      description: "Open the mobile observation form",
      href: "/field/submit",
    });
  }

  return starts;
}

async function listCommandSignals(): Promise<CommandSignal[]> {
  const rows = await prisma.policySignal.findMany({
    where: { status: { not: SignalStatus.archived } },
    orderBy: { detectedAt: "desc" },
    take: COMMAND_SIGNAL_LIMIT,
    select: {
      id: true,
      title: true,
      sourceName: true,
      detectedAt: true,
      urgency: true,
      relevance: true,
      impactArea: true,
      geography: true,
      audienceTarget: true,
      _count: {
        select: {
          evidenceMatches: { where: { evidenceItem: ELIGIBLE_EVIDENCE_WHERE } },
        },
      },
      matchRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { outcome: true },
      },
    },
  });

  return rows.map((row) => ({
    kind: "signal",
    id: row.id,
    title: row.title,
    sourceName: row.sourceName,
    detectedAt: row.detectedAt.toISOString(),
    urgency: row.urgency,
    relevance: row.relevance,
    impactArea: row.impactArea,
    geography: row.geography,
    audienceTarget: row.audienceTarget,
    matchCount: row._count.evidenceMatches,
    latestMatchOutcome: row.matchRuns[0]?.outcome ?? null,
  }));
}

async function listCommandEvidence(): Promise<CommandEvidence[]> {
  const rows = await prisma.evidenceItem.findMany({
    where: {
      ...ELIGIBLE_EVIDENCE_WHERE,
      extractionCompletedAt: { not: null },
    },
    orderBy: { ingestedAt: "desc" },
    take: COMMAND_EVIDENCE_LIMIT,
    select: {
      id: true,
      title: true,
      citationKey: true,
      year: true,
      country: true,
      impactArea: true,
      sourceType: true,
    },
  });

  const embeddedCounts = await countEmbeddedChunksByItem(
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    kind: "evidence",
    id: row.id,
    title: row.title,
    citationKey: row.citationKey,
    year: row.year,
    country: row.country,
    impactArea: row.impactArea,
    sourceType: row.sourceType,
    embeddedChunkCount: embeddedCounts.get(row.id) ?? 0,
  }));
}
