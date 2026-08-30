import "server-only";

import { prisma } from "./client";
import { BriefStatus } from "@/lib/generated/prisma/enums";

export type BriefQaReviewView = {
  id: string;
  briefId: string;
  briefVersion: number;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  factualGroundingChecked: boolean;
  landscapeSpecificityChecked: boolean;
  audienceFramingChecked: boolean;
  actionableAsksChecked: boolean;
  crossCuttingThemesChecked: boolean;
  notes: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type SaveBriefQaReviewInput = {
  briefId: string;
  briefVersion: number;
  reviewerId: string;
  factualGroundingChecked: boolean;
  landscapeSpecificityChecked: boolean;
  audienceFramingChecked: boolean;
  actionableAsksChecked: boolean;
  crossCuttingThemesChecked: boolean;
  notes?: string;
};

export type BriefQaTarget = {
  id: string;
  createdById: string | null;
  currentVersion: number;
  status: BriefStatus;
};

/** Minimal trusted state needed to authorise a QA action. */
export async function findBriefQaTarget(
  briefId: string,
): Promise<BriefQaTarget | null> {
  return prisma.brief.findUnique({
    where: { id: briefId },
    select: { id: true, createdById: true, currentVersion: true, status: true },
  });
}

const QA_REVIEW_SELECT = {
  id: true,
  briefId: true,
  briefVersion: true,
  reviewerId: true,
  factualGroundingChecked: true,
  landscapeSpecificityChecked: true,
  audienceFramingChecked: true,
  actionableAsksChecked: true,
  crossCuttingThemesChecked: true,
  notes: true,
  completedAt: true,
  updatedAt: true,
  reviewer: { select: { name: true, role: true } },
} as const;

/** The current version's QA assessment, including the person who recorded it. */
export async function findQaReviewForBrief(
  briefId: string,
  briefVersion: number,
): Promise<BriefQaReviewView | null> {
  const row = await prisma.briefQaReview.findFirst({
    where: { briefId, briefVersion },
    orderBy: { updatedAt: "desc" },
    select: QA_REVIEW_SELECT,
  });

  if (!row) return null;

  return {
    ...row,
    reviewerName: row.reviewer.name,
    reviewerRole: row.reviewer.role,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * One checklist belongs to one immutable brief version. Re-saving updates that
 * reviewer's record only because the action has already enforced that it is the
 * only permitted reviewer for this version.
 */
export async function saveBriefQaReview(
  input: SaveBriefQaReviewInput,
): Promise<BriefQaReviewView> {
  const complete =
    input.factualGroundingChecked &&
    input.landscapeSpecificityChecked &&
    input.audienceFramingChecked &&
    input.actionableAsksChecked &&
    input.crossCuttingThemesChecked;

  const data = {
    reviewerId: input.reviewerId,
    factualGroundingChecked: input.factualGroundingChecked,
    landscapeSpecificityChecked: input.landscapeSpecificityChecked,
    audienceFramingChecked: input.audienceFramingChecked,
    actionableAsksChecked: input.actionableAsksChecked,
    crossCuttingThemesChecked: input.crossCuttingThemesChecked,
    notes: input.notes?.trim() || null,
    completedAt: complete ? new Date() : null,
  };

  const row = await prisma.briefQaReview.upsert({
    where: {
      briefId_briefVersion_reviewerId: {
        briefId: input.briefId,
        briefVersion: input.briefVersion,
        reviewerId: input.reviewerId,
      },
    },
    create: { briefId: input.briefId, briefVersion: input.briefVersion, ...data },
    update: data,
    select: QA_REVIEW_SELECT,
  });

  return {
    ...row,
    reviewerName: row.reviewer.name,
    reviewerRole: row.reviewer.role,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
