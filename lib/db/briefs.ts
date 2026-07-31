import "server-only";

import {
  BriefStatus,
  FlagStatus,
  GenerationStage,
  type BriefAudience,
  type BriefType,
  type FlagReason,
} from "@/lib/generated/prisma/enums";

import { prisma } from "./client";

/**
 * Brief reads, and the one transaction that turns a verified draft into a brief.
 *
 * `persistGeneratedBrief` IS THE ONLY WRITER OF A `Brief` ROW in the codebase,
 * and it is reachable only from the verify stage, after the fact-check pass has
 * returned. That is how §9.1's ordering is structural rather than a convention:
 * there is no code path that creates a brief without the guard having run.
 */

export type GeneratedFlag = {
  claimText: string;
  reason: FlagReason;
  checkedEvidenceItemIds: string[];
  anchorFrom: number;
  anchorTo: number;
};

export type PersistGeneratedBriefInput = {
  generationId: string;
  createdById: string;
  briefType: BriefType;
  audience: BriefAudience;
  evidenceItemIds: string[];
  bodyText: string;
  generatingModel: string;
  promptVersion: string;
  flags: GeneratedFlag[];
};

/**
 * Brief + evidence set + version 1 + flags, in ONE transaction, and the attempt
 * row closed in the same one.
 *
 * Partial state here would be the worst kind this product can produce: a brief
 * whose flags did not land reads as a clean draft, and a Director could approve
 * it. So either all of it exists or none of it does.
 *
 * `relevanceScore` is left null on every row. Manual selection produces no
 * score, and inventing one would put a number in front of a reader that nothing
 * computed (AGENTS.md §15.5).
 */
export async function persistGeneratedBrief(
  input: PersistGeneratedBriefInput,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const brief = await tx.brief.create({
      data: {
        briefType: input.briefType,
        audience: input.audience,
        status: BriefStatus.draft,
        currentVersion: 1,
        generatedAt: new Date(),
        createdById: input.createdById,
        evidenceSet: {
          create: input.evidenceItemIds.map((evidenceItemId) => ({
            evidenceItemId,
          })),
        },
      },
      select: { id: true },
    });

    const version = await tx.briefVersion.create({
      data: {
        briefId: brief.id,
        version: 1,
        bodyText: input.bodyText,
        // Tiptap document JSON arrives with the editor prompt. Until then a
        // flag's anchors are character offsets into `bodyText` — see
        // `anchorClaim` in lib/ai/fact-check.ts.
        generatingModel: input.generatingModel,
        promptVersion: input.promptVersion,
        createdById: input.createdById,
      },
      select: { id: true },
    });

    if (input.flags.length > 0) {
      await tx.hallucinationFlag.createMany({
        data: input.flags.map((flag) => ({
          briefVersionId: version.id,
          claimText: flag.claimText,
          reason: flag.reason,
          checkedEvidenceItemIds: flag.checkedEvidenceItemIds,
          anchorFrom: flag.anchorFrom,
          anchorTo: flag.anchorTo,
          // `status` is left to the schema default (`open`). A flag is open
          // until a person with the authority resolves it (§10.6).
        })),
      });
    }

    await tx.briefGeneration.update({
      where: { id: input.generationId },
      data: { stage: GenerationStage.complete, briefId: brief.id },
    });

    return brief.id;
  });
}

export type BriefListItem = {
  id: string;
  title: string;
  briefType: BriefType;
  audience: BriefAudience;
  status: BriefStatus;
  generatedAt: string | null;
  createdByName: string | null;
  openFlagCount: number;
};

/**
 * The brief list.
 *
 * A brief's display title is its current version's first line — `bodyText`
 * opens with the generated title (`assembleBodyText`). There is no separate
 * title column, and adding one would create a second place for the same fact to
 * live and drift from the document.
 */
export async function listBriefs(): Promise<BriefListItem[]> {
  const rows = await prisma.brief.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      briefType: true,
      audience: true,
      status: true,
      generatedAt: true,
      currentVersion: true,
      createdBy: { select: { name: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          bodyText: true,
          _count: { select: { flags: { where: { status: FlagStatus.open } } } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: firstLine(row.versions[0]?.bodyText ?? "") || "Untitled draft",
    briefType: row.briefType,
    audience: row.audience,
    status: row.status,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    createdByName: row.createdBy?.name ?? null,
    openFlagCount: row.versions[0]?._count.flags ?? 0,
  }));
}

export type BriefFlag = {
  id: string;
  claimText: string;
  reason: FlagReason;
  status: FlagStatus;
  checkedEvidenceItemIds: string[];
  anchorFrom: number;
  anchorTo: number;
};

export type BriefDetail = {
  id: string;
  briefType: BriefType;
  audience: BriefAudience;
  status: BriefStatus;
  generatedAt: string | null;
  createdByName: string | null;
  version: number;
  bodyText: string;
  generatingModel: string | null;
  promptVersion: string | null;
  flags: BriefFlag[];
  evidence: {
    id: string;
    title: string;
    authors: string[];
    year: number | null;
    citationKey: string;
    country: string | null;
    sourceUrl: string | null;
  }[];
};

/** The read behind /briefs/[id]. Current version only; history is a later prompt. */
export async function findBriefDetail(
  briefId: string,
): Promise<BriefDetail | null> {
  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
    select: {
      id: true,
      briefType: true,
      audience: true,
      status: true,
      generatedAt: true,
      createdBy: { select: { name: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          version: true,
          bodyText: true,
          generatingModel: true,
          promptVersion: true,
          flags: {
            orderBy: { anchorFrom: "asc" },
            select: {
              id: true,
              claimText: true,
              reason: true,
              status: true,
              checkedEvidenceItemIds: true,
              anchorFrom: true,
              anchorTo: true,
            },
          },
        },
      },
      evidenceSet: {
        orderBy: { addedAt: "asc" },
        select: {
          evidenceItem: {
            select: {
              id: true,
              title: true,
              authors: true,
              year: true,
              citationKey: true,
              country: true,
              sourceUrl: true,
            },
          },
        },
      },
    },
  });

  const version = brief?.versions[0];

  // A brief with no version is not a renderable brief. It cannot occur through
  // `persistGeneratedBrief`, which writes both in one transaction, and treating
  // it as "not found" is honest rather than rendering an empty document.
  if (!brief || !version) return null;

  return {
    id: brief.id,
    briefType: brief.briefType,
    audience: brief.audience,
    status: brief.status,
    generatedAt: brief.generatedAt?.toISOString() ?? null,
    createdByName: brief.createdBy?.name ?? null,
    version: version.version,
    bodyText: version.bodyText,
    generatingModel: version.generatingModel,
    promptVersion: version.promptVersion,
    flags: version.flags,
    evidence: brief.evidenceSet.map((row) => row.evidenceItem),
  };
}

function firstLine(text: string): string {
  return text.split("\n", 1)[0]?.trim() ?? "";
}
