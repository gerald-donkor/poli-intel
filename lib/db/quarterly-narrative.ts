import "server-only";

import { prisma } from "./client";

/** The serialisable quarterly evaluation shape consumed by the Impact UI. */
export type QuarterlyNarrativeView = {
  id: string;
  quarterKey: string;
  wins: string;
  missedWindows: string;
  evidenceGaps: string;
  systemImprovement: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertQuarterlyNarrativeInput = {
  quarterKey: string;
  authorId: string;
  wins: string;
  missedWindows: string;
  evidenceGaps: string;
  systemImprovement: string;
};

const narrativeSelect = {
  id: true,
  quarterKey: true,
  wins: true,
  missedWindows: true,
  evidenceGaps: true,
  systemImprovement: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { name: true, role: true } },
} as const;

type NarrativeRow = {
  id: string;
  quarterKey: string;
  wins: string;
  missedWindows: string;
  evidenceGaps: string;
  systemImprovement: string;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string; role: string };
};

function toView(row: NarrativeRow): QuarterlyNarrativeView {
  return {
    id: row.id,
    quarterKey: row.quarterKey,
    wins: row.wins,
    missedWindows: row.missedWindows,
    evidenceGaps: row.evidenceGaps,
    systemImprovement: row.systemImprovement,
    authorName: row.author.name,
    authorRole: row.author.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findQuarterlyNarrativeByQuarter(
  quarterKey: string,
): Promise<QuarterlyNarrativeView | null> {
  const row = await prisma.quarterlyEvidenceNarrative.findUnique({
    where: { quarterKey },
    select: narrativeSelect,
  });

  return row ? toView(row) : null;
}

/** One narrative per quarter; the person who last saves it remains accountable. */
export async function upsertQuarterlyNarrative(
  input: UpsertQuarterlyNarrativeInput,
): Promise<QuarterlyNarrativeView> {
  const row = await prisma.quarterlyEvidenceNarrative.upsert({
    where: { quarterKey: input.quarterKey },
    create: input,
    update: input,
    select: narrativeSelect,
  });

  return toView(row);
}
