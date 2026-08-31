import "server-only";

import type {
  ImpactArea,
  ResearchGapPriority,
  ResearchGapStatus,
} from "@/lib/generated/prisma/enums";

import { prisma } from "./client";

export type ResearchGapView = {
  id: string;
  signalId: string | null;
  signalTitle: string | null;
  impactArea: ImpactArea;
  topic: string;
  description: string;
  priority: ResearchGapPriority;
  status: ResearchGapStatus;
  loggedByName: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  resolvedEvidenceItemId: string | null;
  resolvedEvidenceTitle: string | null;
};

type GapRow = {
  id: string; signalId: string | null; impactArea: ImpactArea; topic: string;
  description: string; priority: ResearchGapPriority; status: ResearchGapStatus;
  createdAt: Date; resolvedAt: Date | null; resolutionNotes: string | null;
  resolvedEvidenceItemId: string | null;
  signal: { title: string } | null;
  loggedBy: { name: string };
  resolvedEvidenceItem: { title: string } | null;
};

const gapSelect = {
  id: true, signalId: true, impactArea: true, topic: true, description: true,
  priority: true, status: true, createdAt: true, resolvedAt: true,
  resolutionNotes: true, resolvedEvidenceItemId: true,
  signal: { select: { title: true } },
  loggedBy: { select: { name: true } },
  resolvedEvidenceItem: { select: { title: true } },
} as const;

function toView(row: GapRow): ResearchGapView {
  return {
    id: row.id, signalId: row.signalId, signalTitle: row.signal?.title ?? null,
    impactArea: row.impactArea, topic: row.topic, description: row.description,
    priority: row.priority, status: row.status, loggedByName: row.loggedBy.name,
    createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNotes: row.resolutionNotes, resolvedEvidenceItemId: row.resolvedEvidenceItemId,
    resolvedEvidenceTitle: row.resolvedEvidenceItem?.title ?? null,
  };
}

export async function listResearchGaps(): Promise<ResearchGapView[]> {
  const rows = await prisma.researchGap.findMany({ orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }], select: gapSelect });
  return rows.map((row) => toView(row));
}

export async function countOpenResearchGaps(): Promise<number> {
  return prisma.researchGap.count({ where: { status: { in: ["open", "in_progress"] } } });
}

export async function findResearchGapForSignal(signalId: string): Promise<ResearchGapView | null> {
  const row = await prisma.researchGap.findFirst({
    where: { signalId, status: { in: ["open", "in_progress"] } },
    orderBy: { createdAt: "desc" }, select: gapSelect,
  });
  return row ? toView(row) : null;
}

export async function findResearchGap(id: string): Promise<ResearchGapView | null> {
  const row = await prisma.researchGap.findUnique({ where: { id }, select: gapSelect });
  return row ? toView(row) : null;
}

export type CreateResearchGapInput = {
  signalId?: string | null; impactArea: ImpactArea; topic: string; description: string;
  priority: ResearchGapPriority; loggedById: string;
};

export async function createResearchGap(input: CreateResearchGapInput): Promise<ResearchGapView> {
  const row = await prisma.researchGap.create({ data: input, select: gapSelect });
  return toView(row);
}

export type UpdateResearchGapInput = {
  id: string; priority?: ResearchGapPriority; status?: ResearchGapStatus;
  resolutionNotes?: string | null; resolvedEvidenceItemId?: string | null; actorId: string;
};

export async function updateResearchGap(input: UpdateResearchGapInput): Promise<{ ok: true; gap: ResearchGapView } | { ok: false; reason: "unknown_gap" | "unknown_evidence" }> {
  const gap = await prisma.researchGap.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!gap) return { ok: false, reason: "unknown_gap" };
  if (input.resolvedEvidenceItemId) {
    const evidence = await prisma.evidenceItem.findUnique({ where: { id: input.resolvedEvidenceItemId }, select: { id: true } });
    if (!evidence) return { ok: false, reason: "unknown_evidence" };
  }
  const resolving = input.status === "resolved";
  const row = await prisma.researchGap.update({
    where: { id: input.id },
    data: {
      priority: input.priority,
      status: input.status,
      resolutionNotes: input.resolutionNotes,
      resolvedEvidenceItemId: input.resolvedEvidenceItemId,
      ...(resolving ? { resolvedById: input.actorId, resolvedAt: new Date() } : {}),
    }, select: gapSelect,
  });
  return { ok: true, gap: toView(row) };
}

/** Link a newly-created ingestion record and make the gap visibly in progress. */
export async function attachEvidenceToResearchGap(gapId: string, evidenceItemId: string): Promise<void> {
  await prisma.researchGap.updateMany({
    where: { id: gapId, status: { in: ["open", "in_progress"] } },
    data: { resolvedEvidenceItemId: evidenceItemId, status: "in_progress" },
  });
}
