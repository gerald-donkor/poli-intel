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
  /** The signal this brief was drafted from, or null for a manual draft. */
  signalId: string | null;
  briefType: BriefType;
  audience: BriefAudience;
  evidenceItemIds: string[];
  /**
   * Rerank score by evidence item id, for the items that came from this
   * signal's stored match set. An item the officer added by hand is absent and
   * stays absent — see the note on the transaction below.
   */
  relevanceScores: ReadonlyMap<string, number>;
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
 * `relevanceScore` IS WRITTEN ONLY WHERE SOMETHING COMPUTED ONE — the stored
 * rerank score of an item that came from this signal's match set. An item the
 * officer picked by hand keeps a null score permanently, because manual
 * selection produces no score and inventing one would put a number in front of a
 * reader that nothing computed (AGENTS.md §15.5). The two cases are genuinely
 * different and collapsing them would be the fabrication, not the honesty.
 *
 * `signalId` is the other half of the same record: the brief carries its signal,
 * its evidence set, its audience, its version and its generating model
 * (`brief-output` rule 5), all written in this one transaction.
 */
export async function persistGeneratedBrief(
  input: PersistGeneratedBriefInput,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const brief = await tx.brief.create({
      data: {
        signalId: input.signalId,
        briefType: input.briefType,
        audience: input.audience,
        status: BriefStatus.draft,
        currentVersion: 1,
        generatedAt: new Date(),
        createdById: input.createdById,
        evidenceSet: {
          create: input.evidenceItemIds.map((evidenceItemId) => ({
            evidenceItemId,
            relevanceScore: input.relevanceScores.get(evidenceItemId) ?? null,
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
  /**
   * Who last changed this flag's state, when, and why (§9.6).
   *
   * The three columns describe the CURRENT state rather than a resolution
   * specifically: on `resolved`/`dismissed` they are the person who cleared it,
   * and on a reopened flag they are the person who reopened it. There is no
   * per-flag audit table and this prompt adds no migration, so reading them as
   * "the last state change" is the only shape that keeps a reopening's reason
   * recorded at all — and a discarded reason would be worse than a reused
   * column.
   */
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
};

/** The columns every flag read needs, so the two reads cannot drift apart. */
const FLAG_SELECT = {
  id: true,
  claimText: true,
  reason: true,
  status: true,
  checkedEvidenceItemIds: true,
  anchorFrom: true,
  anchorTo: true,
  resolvedAt: true,
  resolutionReason: true,
  resolvedBy: { select: { name: true } },
} as const;

type FlagRow = {
  id: string;
  claimText: string;
  reason: FlagReason;
  status: FlagStatus;
  checkedEvidenceItemIds: string[];
  anchorFrom: number;
  anchorTo: number;
  resolvedAt: Date | null;
  resolutionReason: string | null;
  resolvedBy: { name: string | null } | null;
};

function toBriefFlag(row: FlagRow): BriefFlag {
  return {
    id: row.id,
    claimText: row.claimText,
    reason: row.reason,
    status: row.status,
    checkedEvidenceItemIds: row.checkedEvidenceItemIds,
    anchorFrom: row.anchorFrom,
    anchorTo: row.anchorTo,
    resolvedByName: row.resolvedBy?.name ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionReason: row.resolutionReason,
  };
}

/** One decision on a brief, as recorded (§8.3). */
export type BriefStatusEvent = {
  id: string;
  actorName: string | null;
  previousStatus: BriefStatus | null;
  newStatus: BriefStatus;
  reason: string | null;
  changedAt: string;
};

export type BriefDetail = {
  id: string;
  briefType: BriefType;
  audience: BriefAudience;
  status: BriefStatus;
  generatedAt: string | null;
  /**
   * The author, for the object-level half of `canDismissFlag`. Nobody clears a
   * flag on a brief they drafted, whatever their role (§10.6).
   */
  createdById: string | null;
  createdByName: string | null;
  /**
   * Where this brief came from. Null for a manual draft — said in words on the
   * page rather than rendered as an empty row.
   */
  signal: { id: string; title: string; sourceName: string } | null;
  statusHistory: BriefStatusEvent[];
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

/**
 * The read behind /briefs/[id] — the current version, its flags, the evidence
 * set, and the record of who moved this brief and why.
 *
 * The status history is read here rather than lazily: it is the audit trail
 * behind the review panel on the same screen, and a decision nobody can see
 * recorded is the same as no review at all (§8.3).
 */
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
      createdById: true,
      createdBy: { select: { name: true } },
      // Provenance, not content: the signal's own title and source name, so the
      // page can link back to where the draft came from.
      signal: { select: { id: true, title: true, sourceName: true } },
      statusChanges: {
        orderBy: { changedAt: "desc" },
        select: {
          id: true,
          previousStatus: true,
          newStatus: true,
          reason: true,
          changedAt: true,
          actor: { select: { name: true } },
        },
      },
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
            select: FLAG_SELECT,
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
    createdById: brief.createdById,
    createdByName: brief.createdBy?.name ?? null,
    signal: brief.signal,
    statusHistory: brief.statusChanges.map((row) => ({
      id: row.id,
      actorName: row.actor?.name ?? null,
      previousStatus: row.previousStatus,
      newStatus: row.newStatus,
      reason: row.reason,
      changedAt: row.changedAt.toISOString(),
    })),
    version: version.version,
    bodyText: version.bodyText,
    generatingModel: version.generatingModel,
    promptVersion: version.promptVersion,
    flags: version.flags.map(toBriefFlag),
    evidence: brief.evidenceSet.map((row) => row.evidenceItem),
  };
}

/* -------------------------------------------------------------------------
 * Export
 * ---------------------------------------------------------------------- */

export type BriefForExport = {
  id: string;
  /** The current version's first line — the brief's own title (`listBriefs`). */
  title: string;
  briefType: BriefType;
  audience: BriefAudience;
  status: BriefStatus;
  generatedAt: string | null;
  version: number;
  bodyText: string;
  /** Null for every brief generated before the editor existed. */
  documentJson: unknown;
  generatingModel: string | null;
  /** OPEN flags only — see below. */
  openFlags: { claimText: string; reason: FlagReason }[];
  evidence: {
    title: string;
    authors: string[];
    year: number | null;
    citationKey: string;
    country: string | null;
    sourceUrl: string | null;
  }[];
};

/**
 * The read behind the Word download.
 *
 * SHAPED FOR THE ROUTE, not bolted onto `findBriefDetail`, which four other
 * things already read and which does not return `documentJson` at all.
 *
 * IT READS ONLY WHAT LEAVES THE BUILDING. `classification` is deliberately not
 * selected — the export makes no Gemini call, so it has no gate to run and no
 * business widening its read towards one (§7). No chunk table is touched, and
 * no evidence body text is read: the file carries citation metadata only, the
 * same fields `CitationList` renders on screen.
 *
 * ONLY OPEN FLAGS ARE SELECTED. Closed flags produce neither the notice nor the
 * list, so loading their claim text would be reading document content for
 * nothing (§7.6). Flag state is read from the CURRENT version, exactly as
 * approval reads it.
 */
export async function findBriefForExport(
  briefId: string,
): Promise<BriefForExport | null> {
  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
    select: {
      id: true,
      briefType: true,
      audience: true,
      status: true,
      generatedAt: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          version: true,
          bodyText: true,
          documentJson: true,
          generatingModel: true,
          flags: {
            where: { status: FlagStatus.open },
            orderBy: { anchorFrom: "asc" },
            select: { claimText: true, reason: true },
          },
        },
      },
      evidenceSet: {
        orderBy: { addedAt: "asc" },
        select: {
          evidenceItem: {
            select: {
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

  if (!brief || !version) return null;

  return {
    id: brief.id,
    title: firstLine(version.bodyText),
    briefType: brief.briefType,
    audience: brief.audience,
    status: brief.status,
    generatedAt: brief.generatedAt?.toISOString() ?? null,
    version: version.version,
    bodyText: version.bodyText,
    documentJson: version.documentJson,
    generatingModel: version.generatingModel,
    openFlags: version.flags,
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
            select: FLAG_SELECT,
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
    flags: version.flags.map(toBriefFlag),
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
 * Whether a brief's document may still be changed.
 *
 * `reviewed` is in the not-editable set alongside `submitted` and `published`,
 * and that is deliberate: approval attaches to a document, so if editing
 * continued after approval a Director's approval would sit on text they never
 * read. The alternative — silently returning an edited brief to `draft` — would
 * move a status without an explicit human action, which §8.3 forbids. A Director
 * who wants changes SENDS THE BRIEF BACK first, which is what send-back is for.
 *
 * The route reads this to render its panel; the save transaction re-reads it
 * because between the two is exactly where the status can change.
 */
export function isEditableStatus(status: BriefStatus): boolean {
  return status === BriefStatus.draft;
}

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

    if (!isEditableStatus(brief.status)) {
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

/* -------------------------------------------------------------------------
 * Review — flag resolution and the status chain
 * ---------------------------------------------------------------------- */

export type FlagForResolution = {
  id: string;
  briefId: string;
  /** Null where the author's row is gone. Nobody can be that person, so the
   *  object-level half of `canDismissFlag` cannot match — which is correct. */
  briefCreatedById: string | null;
  status: FlagStatus;
  /** A flag on a superseded version is history and is not resolvable (§8.7). */
  isCurrentVersion: boolean;
};

/**
 * The object a flag-resolution caller must authorise against, read before any
 * validation of the rest of the input.
 *
 * It returns IDS AND STATE ONLY — no claim text. An authorisation check has no
 * business loading the claim it is about (§7.6).
 */
export async function findFlagForResolution(
  flagId: string,
): Promise<FlagForResolution | null> {
  const flag = await prisma.hallucinationFlag.findUnique({
    where: { id: flagId },
    select: {
      id: true,
      status: true,
      briefVersion: {
        select: {
          version: true,
          brief: {
            select: { id: true, createdById: true, currentVersion: true },
          },
        },
      },
    },
  });

  if (!flag) return null;

  return {
    id: flag.id,
    briefId: flag.briefVersion.brief.id,
    briefCreatedById: flag.briefVersion.brief.createdById,
    status: flag.status,
    isCurrentVersion:
      flag.briefVersion.version === flag.briefVersion.brief.currentVersion,
  };
}

export type ResolveFlagInput = {
  flagId: string;
  actorId: string;
  /** `resolved` and `dismissed` clear a flag; `open` reopens a cleared one. */
  nextStatus: FlagStatus;
  reason: string;
};

export type ResolveFlagResult =
  | { ok: true; briefId: string; status: FlagStatus; openFlagCount: number }
  | { ok: false; reason: "not-found" | "not-current-version" | "wrong-state" };

/**
 * A flag's state, changed under authority and recorded (§9.6).
 *
 * `resolved` and `dismissed` are DIFFERENT OUTCOMES and both are kept: resolved
 * means a person checked the claim against a source and it holds; dismissed
 * means the claim is being let through without that check, because the sentence
 * was rewritten or removed. Both stop blocking approval, and the difference is
 * the entire audit value of the record — collapsing them into one "clear" would
 * throw it away.
 *
 * One transaction, re-reading the flag inside it: the caller authorised against
 * a read from before the click, and the flag can be cleared or the version
 * superseded in between.
 */
export async function resolveHallucinationFlag(
  input: ResolveFlagInput,
): Promise<ResolveFlagResult> {
  return prisma.$transaction(async (tx) => {
    const flag = await tx.hallucinationFlag.findUnique({
      where: { id: input.flagId },
      select: {
        id: true,
        status: true,
        briefVersionId: true,
        briefVersion: {
          select: {
            version: true,
            brief: { select: { id: true, currentVersion: true } },
          },
        },
      },
    });

    if (!flag) return { ok: false, reason: "not-found" };

    if (flag.briefVersion.version !== flag.briefVersion.brief.currentVersion) {
      return { ok: false, reason: "not-current-version" };
    }

    const reopening = input.nextStatus === FlagStatus.open;
    const isOpen = flag.status === FlagStatus.open;

    // Reopening a flag that is open, or clearing one that is already cleared,
    // is a stale click. Refused, not silently re-applied — the second write
    // would overwrite the first reviewer's record.
    if (reopening === isOpen) return { ok: false, reason: "wrong-state" };

    await tx.hallucinationFlag.update({
      where: { id: flag.id },
      data: {
        status: input.nextStatus,
        // The three columns record the LAST STATE CHANGE, so a reopening keeps
        // its actor, time and reason rather than discarding them. `status` is
        // what says whether that change was a clearing or a reopening.
        resolvedById: input.actorId,
        resolvedAt: new Date(),
        resolutionReason: input.reason,
      },
    });

    const openFlagCount = await tx.hallucinationFlag.count({
      where: { briefVersionId: flag.briefVersionId, status: FlagStatus.open },
    });

    return {
      ok: true,
      briefId: flag.briefVersion.brief.id,
      status: input.nextStatus,
      openFlagCount,
    };
  });
}

/** The four named moves. There is deliberately no generic "set status". */
export type BriefTransition = "approve" | "send_back" | "submit" | "publish";

export type ChangeBriefStatusInput = {
  briefId: string;
  actorId: string;
  transition: BriefTransition;
  reason: string | null;
};

export type ChangeBriefStatusResult =
  | { ok: true; status: BriefStatus }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "wrong-status"; status: BriefStatus }
  | { ok: false; reason: "open-flags"; openFlagCount: number };

/** Which statuses each transition may start from, and where it lands. */
const TRANSITIONS: Record<
  BriefTransition,
  { from: readonly BriefStatus[]; to: BriefStatus }
> = {
  approve: { from: [BriefStatus.draft], to: BriefStatus.reviewed },
  send_back: {
    from: [BriefStatus.draft, BriefStatus.reviewed],
    to: BriefStatus.draft,
  },
  submit: { from: [BriefStatus.reviewed], to: BriefStatus.submitted },
  publish: { from: [BriefStatus.reviewed], to: BriefStatus.published },
};

/**
 * A status move, as an explicit human decision, with its audit row written in
 * the same transaction (§8.3).
 *
 * THE APPROVAL REFUSAL LIVES HERE (§9.5). `approve` counts the CURRENT
 * version's open flags inside the transaction — not a count passed from the
 * client, not a value read when the page rendered — because the window between
 * render and click is exactly where a flag gets reopened or a new version
 * written. The disabled button is presentation; this count is the control.
 *
 * A decline is recorded even when it moves nothing: sending back a brief that is
 * still `draft` writes a row with `previousStatus = newStatus = draft`. The row
 * records a DECISION, not only a transition, and the reason is its payload.
 *
 * The approved version is pinned structurally rather than stored: a brief is not
 * editable from `reviewed` onward (`isEditableStatus`), so the version that was
 * approved is `brief.currentVersion` and cannot change under the approval.
 */
export async function changeBriefStatus(
  input: ChangeBriefStatusInput,
): Promise<ChangeBriefStatusResult> {
  const rule = TRANSITIONS[input.transition];

  return prisma.$transaction(async (tx) => {
    const brief = await tx.brief.findUnique({
      where: { id: input.briefId },
      select: { id: true, status: true, currentVersion: true },
    });

    if (!brief) return { ok: false, reason: "not-found" };

    if (!rule.from.includes(brief.status)) {
      return { ok: false, reason: "wrong-status", status: brief.status };
    }

    if (input.transition === "approve") {
      const openFlagCount = await tx.hallucinationFlag.count({
        where: {
          status: FlagStatus.open,
          briefVersion: {
            briefId: brief.id,
            version: brief.currentVersion,
          },
        },
      });

      if (openFlagCount > 0) {
        return { ok: false, reason: "open-flags", openFlagCount };
      }
    }

    await tx.brief.update({
      where: { id: brief.id },
      data: {
        status: rule.to,
        ...(input.transition === "approve"
          ? { reviewedById: input.actorId }
          : {}),
      },
    });

    await tx.briefStatusChange.create({
      data: {
        briefId: brief.id,
        actorId: input.actorId,
        previousStatus: brief.status,
        newStatus: rule.to,
        reason: input.reason,
      },
    });

    return { ok: true, status: rule.to };
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
