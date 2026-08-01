import "server-only";

import type { BriefDocument } from "@/lib/briefs/document";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  BriefStatus,
  FlagStatus,
  GenerationStage,
  type BriefAudience,
  type BriefType,
  type Classification,
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
  /**
   * The Tiptap document for version 1, built from the same draft as `bodyText`
   * and carrying the findings' citation chips. `bodyText` stays canonical: the
   * document renders back to it exactly, chips included, because a chip renders
   * to nothing in text (`lib/briefs/document.ts`).
   */
  documentJson: BriefDocument;
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
        // A flag's anchors are character offsets into `bodyText`
        // (`anchorClaim` in lib/ai/fact-check.ts). The editor maps them onto
        // this document at load and back out at save; they are never stored
        // twice.
        documentJson: toJson(input.documentJson),
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

/* -------------------------------------------------------------------------
 * The editor
 * ---------------------------------------------------------------------- */

export type BriefForEdit = {
  id: string;
  briefType: BriefType;
  audience: BriefAudience;
  status: BriefStatus;
  createdById: string | null;
  createdByName: string | null;
  generatedAt: string | null;
  /** The version the editor opens from, and the one a save must come back with. */
  version: number;
  bodyText: string;
  /** Null for every brief generated before the editor existed. */
  documentJson: unknown;
  flags: BriefFlag[];
  evidence: {
    id: string;
    title: string;
    authors: string[];
    year: number | null;
    citationKey: string;
    country: string | null;
    sourceUrl: string | null;
    classification: Classification;
  }[];
};

/**
 * The read behind /briefs/[id]/edit.
 *
 * `classification` is selected here and nowhere else on this route: the chip's
 * dot and the evidence Sheet display it. It is DISPLAYED, never changed — no
 * classification mutation exists on this route (§10.8).
 *
 * The evidence set is the brief's RECORDED set (`brief.evidenceSet`), which
 * passed the classification gate at generation. The cite control has no other
 * source, so the editor cannot introduce an ungated item into a brief.
 */
export async function findBriefForEdit(
  briefId: string,
): Promise<BriefForEdit | null> {
  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
    select: {
      id: true,
      briefType: true,
      audience: true,
      status: true,
      createdById: true,
      generatedAt: true,
      createdBy: { select: { name: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          version: true,
          bodyText: true,
          documentJson: true,
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
              classification: true,
            },
          },
        },
      },
    },
  });

  const version = brief?.versions[0];

  if (!brief || !version) return null;

  return {
    id: brief.id,
    briefType: brief.briefType,
    audience: brief.audience,
    status: brief.status,
    createdById: brief.createdById,
    createdByName: brief.createdBy?.name ?? null,
    generatedAt: brief.generatedAt?.toISOString() ?? null,
    version: version.version,
    bodyText: version.bodyText,
    documentJson: version.documentJson,
    flags: version.flags,
    evidence: brief.evidenceSet.map((row) => row.evidenceItem),
  };
}

export type SaveBriefVersionInput = {
  briefId: string;
  /** The version the client edited from. A save from a stale one is refused. */
  fromVersion: number;
  createdById: string;
  document: BriefDocument;
  bodyText: string;
  /** Flag id → its re-anchored character range in the new `bodyText`. */
  flagAnchors: Map<string, { anchorFrom: number; anchorTo: number }>;
};

export type SaveBriefVersionResult =
  | { ok: true; version: number }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-editable"; status: BriefStatus }
  | { ok: false; reason: "conflict"; currentVersion: number };

/**
 * An edit, as a NEW version. No prior version is ever overwritten (§8.7).
 *
 * FLAGS CARRY FORWARD, re-anchored, with status and resolution metadata intact.
 * Both alternatives are wrong: dropping them would let typing one word silently
 * clear a governance hold that blocks approval, and reopening resolved ones
 * would mean no flag could ever stay resolved through an edit. A regeneration or
 * an audience switch is a different matter — that is new output, a new pass, and
 * new flags — and it does not come through here.
 *
 * `generatingModel` and `promptVersion` are null: they describe a generation,
 * and a human edit is not one.
 *
 * NO STATUS CHANGE, no `reviewedById`, no `BriefStatusChange` row. Autosave
 * never advances a brief (§8.3).
 *
 * One transaction. A version that landed without its flags would read as a clean
 * draft — the same failure mode `persistGeneratedBrief` exists to prevent.
 */
export async function saveBriefVersion(
  input: SaveBriefVersionInput,
): Promise<SaveBriefVersionResult> {
  return prisma.$transaction(async (tx) => {
    const brief = await tx.brief.findUnique({
      where: { id: input.briefId },
      select: { id: true, status: true, currentVersion: true },
    });

    if (!brief) return { ok: false, reason: "not-found" };

    if (
      brief.status === BriefStatus.submitted ||
      brief.status === BriefStatus.published
    ) {
      return { ok: false, reason: "not-editable", status: brief.status };
    }

    // Object-level concurrency: two officers in the same document must not
    // silently overwrite one another.
    if (brief.currentVersion !== input.fromVersion) {
      return { ok: false, reason: "conflict", currentVersion: brief.currentVersion };
    }

    const previous = await tx.briefVersion.findUnique({
      where: {
        briefId_version: { briefId: brief.id, version: brief.currentVersion },
      },
      select: {
        flags: {
          select: {
            id: true,
            claimText: true,
            reason: true,
            status: true,
            checkedEvidenceItemIds: true,
            anchorFrom: true,
            anchorTo: true,
            resolvedById: true,
            resolvedAt: true,
            resolutionReason: true,
          },
        },
      },
    });

    if (!previous) return { ok: false, reason: "not-found" };

    const nextVersion = brief.currentVersion + 1;

    const version = await tx.briefVersion.create({
      data: {
        briefId: brief.id,
        version: nextVersion,
        bodyText: input.bodyText,
        documentJson: toJson(input.document),
        createdById: input.createdById,
      },
      select: { id: true },
    });

    if (previous.flags.length > 0) {
      await tx.hallucinationFlag.createMany({
        data: previous.flags.map((flag) => {
          // Not re-anchored means the claim's text is gone from the document.
          // `0/0` keeps its existing meaning — recorded, rendered from
          // `claimText`, position unavailable — rather than the flag vanishing.
          const anchor = input.flagAnchors.get(flag.id) ?? {
            anchorFrom: 0,
            anchorTo: 0,
          };

          return {
            briefVersionId: version.id,
            claimText: flag.claimText,
            reason: flag.reason,
            checkedEvidenceItemIds: flag.checkedEvidenceItemIds,
            anchorFrom: anchor.anchorFrom,
            anchorTo: anchor.anchorTo,
            status: flag.status,
            resolvedById: flag.resolvedById,
            resolvedAt: flag.resolvedAt,
            resolutionReason: flag.resolutionReason,
          };
        }),
      });
    }

    await tx.brief.update({
      where: { id: brief.id },
      data: { currentVersion: nextVersion },
    });

    return { ok: true, version: nextVersion };
  });
}

function firstLine(text: string): string {
  return text.split("\n", 1)[0]?.trim() ?? "";
}

/**
 * The one cast between the document model and Prisma's Json input type.
 *
 * `BriefDocument` is a plain JSON-safe structure — validated by
 * `briefDocumentSchema` before it ever reaches here — but its recursive shape
 * does not line up structurally with `Prisma.InputJsonValue`.
 */
function toJson(document: BriefDocument): Prisma.InputJsonValue {
  return document as unknown as Prisma.InputJsonValue;
}
