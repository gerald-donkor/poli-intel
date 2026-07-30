import "server-only";

import { ELIGIBLE_EVIDENCE_WHERE, PENDING_CLASSIFICATION } from "@/lib/governance/gate";
import { Prisma } from "@/lib/generated/prisma/client";
import type {
  Classification,
  EvidenceSourceType,
  ImpactArea,
} from "@/lib/generated/prisma/enums";
import type { TextChunk } from "@/lib/ingestion/chunk";

import { prisma } from "./client";
import { countEmbeddedChunksByItem } from "./evidence-vectors";

/**
 * Evidence reads and writes. Every listing that feeds the Evidence Library goes
 * through `ELIGIBLE_EVIDENCE_WHERE`, so untagged evidence is not searchable
 * (AGENTS.md §7.5) by the same one fact that decides what may reach a model.
 */

/** Shape the evidence table and detail panel render. Serialisable to a client component. */
export type EvidenceListItem = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  sourceType: EvidenceSourceType;
  country: string | null;
  impactArea: ImpactArea | null;
  citationKey: string;
  classification: Classification;
  sourceUrl: string | null;
  sourceFileName: string | null;
  ingestedAt: string;
  chunkCount: number;
  /**
   * How many of those chunks currently carry a vector. Derived from
   * `embedding IS NOT NULL`, never from a status column — see
   * `evidence-vectors.ts`.
   */
  embeddedChunkCount: number;
  /** A short opening excerpt for the detail panel — quoted material, set in the serif. */
  excerpt: string;
};

const EXCERPT_CHARS = 600;

type EvidenceRow = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  sourceType: EvidenceSourceType;
  country: string | null;
  impactArea: ImpactArea | null;
  citationKey: string;
  classification: Classification;
  sourceUrl: string | null;
  sourceFileName: string | null;
  ingestedAt: Date;
  fullText: string;
  _count: { chunks: number };
};

const evidenceListSelect = {
  id: true,
  title: true,
  authors: true,
  year: true,
  sourceType: true,
  country: true,
  impactArea: true,
  citationKey: true,
  classification: true,
  sourceUrl: true,
  sourceFileName: true,
  ingestedAt: true,
  fullText: true,
  _count: { select: { chunks: true } },
} as const;

function toListItem(
  row: EvidenceRow,
  embeddedCounts: Map<string, number>,
): EvidenceListItem {
  const excerpt = row.fullText.slice(0, EXCERPT_CHARS);

  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    year: row.year,
    sourceType: row.sourceType,
    country: row.country,
    impactArea: row.impactArea,
    citationKey: row.citationKey,
    classification: row.classification,
    sourceUrl: row.sourceUrl,
    sourceFileName: row.sourceFileName,
    ingestedAt: row.ingestedAt.toISOString(),
    chunkCount: row._count.chunks,
    embeddedChunkCount: embeddedCounts.get(row.id) ?? 0,
    excerpt:
      row.fullText.length > EXCERPT_CHARS ? `${excerpt.trimEnd()}…` : excerpt,
  };
}

/**
 * The Evidence Library listing. Gated: only `public_published` items appear.
 *
 * Filters (country, year, impact area, source type) and keyword/semantic search
 * arrive with the evidence-library-search prompt; this returns the whole
 * eligible set for now.
 */
export async function listEligibleEvidence(): Promise<EvidenceListItem[]> {
  const [rows, embeddedCounts] = await Promise.all([
    prisma.evidenceItem.findMany({
      where: {
        ...ELIGIBLE_EVIDENCE_WHERE,
        extractionCompletedAt: { not: null },
      },
      orderBy: { ingestedAt: "desc" },
      select: evidenceListSelect,
    }),
    countEmbeddedChunksByItem(),
  ]);

  return rows.map((row) => toListItem(row, embeddedCounts));
}

/**
 * The classification queue: items held at the schema default, oldest first, so
 * the longest-waiting document is triaged first.
 *
 * `extractionCompletedAt: { not: null }` excludes shells whose upload never
 * finished — those are deleted on every failure path, so this only guards
 * against a browser that vanished mid-upload.
 */
export async function listPendingClassification(): Promise<EvidenceListItem[]> {
  const rows = await prisma.evidenceItem.findMany({
    where: {
      classification: PENDING_CLASSIFICATION,
      extractionCompletedAt: { not: null },
    },
    orderBy: { ingestedAt: "asc" },
    select: evidenceListSelect,
  });

  // Nothing in this queue is eligible, so nothing in it can hold a vector. The
  // empty map is the honest answer, not a shortcut.
  return rows.map((row) => toListItem(row, new Map()));
}

/** The queue count the classification-pending banner renders (§7.5). */
export function countPendingClassification(): Promise<number> {
  return prisma.evidenceItem.count({
    where: {
      classification: PENDING_CLASSIFICATION,
      extractionCompletedAt: { not: null },
    },
  });
}

export type CreateEvidenceShellInput = {
  title: string;
  authors: string[];
  year: number | null;
  sourceType: EvidenceSourceType;
  country: string | null;
  impactArea: ImpactArea | null;
  citationKey: string;
  sourceUrl: string | null;
  sourceFileName: string;
  ingestedById: string;
};

export type CreateEvidenceShellResult =
  | { ok: true; evidenceItemId: string }
  | { ok: false; reason: "citation_key_taken" };

/**
 * Creates the item the upload will fill in.
 *
 * `classification` is absent by design and is not accepted as an argument: the
 * schema default is the only way the column gets its initial value (§7.3).
 * `fullText` starts empty and `extractionCompletedAt` stays null until
 * `completeEvidenceExtraction` runs, so an unfinished item is distinguishable
 * from a finished one without a second status column.
 */
export async function createEvidenceShell(
  input: CreateEvidenceShellInput,
): Promise<CreateEvidenceShellResult> {
  try {
    const item = await prisma.evidenceItem.create({
      data: {
        title: input.title,
        authors: input.authors,
        year: input.year,
        sourceType: input.sourceType,
        country: input.country,
        impactArea: input.impactArea,
        citationKey: input.citationKey,
        sourceUrl: input.sourceUrl,
        sourceFileName: input.sourceFileName,
        ingestedById: input.ingestedById,
        fullText: "",
      },
      select: { id: true },
    });

    return { ok: true, evidenceItemId: item.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "citation_key_taken" };
    }

    throw error;
  }
}

/**
 * Writes the extraction and its chunks in ONE transaction.
 *
 * A partial write here would leave an item that looks complete while carrying a
 * truncated chunk set — which the embedding pass would later embed as if it
 * were the whole document.
 */
export async function completeEvidenceExtraction({
  evidenceItemId,
  fullText,
  chunks,
}: {
  evidenceItemId: string;
  fullText: string;
  chunks: TextChunk[];
}): Promise<void> {
  await prisma.$transaction([
    prisma.evidenceItem.update({
      where: { id: evidenceItemId },
      data: { fullText, extractionCompletedAt: new Date() },
    }),
    prisma.evidenceChunk.createMany({
      data: chunks.map((chunk) => ({
        evidenceItemId,
        ordinal: chunk.ordinal,
        chunkText: chunk.text,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        sourcePage: chunk.sourcePage,
        // `embedding` and `embeddingModel` stay null. An item is
        // `unpublished_internal` at ingestion, so it is ineligible for the
        // embedding pass at exactly this moment (§7.3). Embedding is triggered
        // by classification to `public_published`, never by upload.
      })),
    }),
  ]);
}

/** Removes a shell whose ingestion failed, so no half-ingested item survives. */
export async function deleteEvidenceItem(evidenceItemId: string): Promise<void> {
  await prisma.evidenceItem.delete({ where: { id: evidenceItemId } });
}

export function findEvidenceItemForIngestion(evidenceItemId: string) {
  return prisma.evidenceItem.findUnique({
    where: { id: evidenceItemId },
    select: {
      id: true,
      ingestedById: true,
      sourceType: true,
      extractionCompletedAt: true,
    },
  });
}

/**
 * What the embedding job needs to judge an item and log the run.
 *
 * `classification` is read here, from the database, and is the ONLY value the
 * gate is allowed to judge — never a field carried on an event payload
 * (see `evidence-vectors.ts`).
 */
export function findEvidenceItemForEmbedding(evidenceItemId: string) {
  return prisma.evidenceItem.findUnique({
    where: { id: evidenceItemId },
    select: {
      id: true,
      classification: true,
      citationKey: true,
      sourceType: true,
      extractionCompletedAt: true,
    },
  });
}

export type ClassifyEvidenceResult =
  | { ok: true; previousClassification: Classification }
  | { ok: false; reason: "not_found" | "unchanged" };

/**
 * Sets an item's classification AND records the audit row in one transaction
 * (AGENTS.md §10.8).
 *
 * An audit row that can fail independently of the change it records is not an
 * audit trail, so these are never two statements.
 *
 * Authorisation happens in the Server Action, before this is reached.
 */
export async function classifyEvidenceItem({
  evidenceItemId,
  actorId,
  newClassification,
  reason,
}: {
  evidenceItemId: string;
  actorId: string;
  newClassification: Classification;
  reason: string | null;
}): Promise<ClassifyEvidenceResult> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.evidenceItem.findUnique({
      where: { id: evidenceItemId },
      select: { classification: true },
    });

    if (!item) return { ok: false as const, reason: "not_found" as const };

    if (item.classification === newClassification) {
      return { ok: false as const, reason: "unchanged" as const };
    }

    await tx.evidenceItem.update({
      where: { id: evidenceItemId },
      data: { classification: newClassification },
    });

    await tx.evidenceClassificationChange.create({
      data: {
        evidenceItemId,
        actorId,
        previousClassification: item.classification,
        newClassification,
        reason,
      },
    });

    return { ok: true as const, previousClassification: item.classification };
  });
}
