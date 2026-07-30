import "server-only";

import { EVIDENCE_BROWSE_MAX_ITEMS } from "@/lib/ai/config";
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
 * The four metadata filters retrieval works with (AGENTS.md §15.3). `null` means
 * "not filtered", never "match null" — an item with no country recorded is not
 * excluded by leaving the country filter unset.
 *
 * Every value is enum- or length-validated before it reaches here; the free-text
 * `country` is bound as a parameter like everything else.
 */
export type EvidenceFilters = {
  country: string | null;
  year: number | null;
  impactArea: ImpactArea | null;
  sourceType: EvidenceSourceType | null;
};

export type EvidenceKeywordQuery = EvidenceFilters & {
  /** `null` browses; a string adds the keyword `OR` block. */
  query: string | null;
};

export const NO_EVIDENCE_FILTERS: EvidenceFilters = {
  country: null,
  year: null,
  impactArea: null,
  sourceType: null,
};

function toFilterWhere(filters: EvidenceFilters) {
  return {
    ...(filters.country !== null ? { country: filters.country } : {}),
    ...(filters.year !== null ? { year: filters.year } : {}),
    ...(filters.impactArea !== null ? { impactArea: filters.impactArea } : {}),
    ...(filters.sourceType !== null ? { sourceType: filters.sourceType } : {}),
  };
}

/**
 * The keyword half of library search.
 *
 * Runs against existing columns — no tsvector column, no second copy of the
 * document, no new extension (`supabase-schema`, the 500MB budget: "keyword
 * search can run against existing columns before it earns a duplicate"). The
 * four filter columns are already indexed by the init migration.
 *
 * RECORD, DON'T BUILD: when the corpus grows to where scanning `full_text`
 * bites, the answer is a GIN expression index on `to_tsvector('english',
 * full_text)` — an index, not a third copy of the text. That is a later decision
 * with measurements behind it.
 *
 * `authors` is the one field matched exactly rather than case-insensitively:
 * Prisma's scalar-list filters offer `has`/`hasSome` and no insensitive
 * substring, and reaching for raw SQL here would step outside the pgvector
 * carve-out that is the only raw-SQL licence this project has (AGENTS.md §6).
 * In practice an author's name usually also appears in `full_text`, which is
 * matched insensitively.
 */
function toKeywordWhere(query: string) {
  return {
    OR: [
      { title: { contains: query, mode: "insensitive" as const } },
      { citationKey: { contains: query, mode: "insensitive" as const } },
      { country: { contains: query, mode: "insensitive" as const } },
      { authors: { has: query } },
      { fullText: { contains: query, mode: "insensitive" as const } },
    ],
  };
}

/** What a listing returned, and whether the ceiling cut it short. */
export type EvidenceListingPage = {
  items: EvidenceListItem[];
  /** True when more eligible items matched than the ceiling allows. */
  truncated: boolean;
};

/**
 * The Evidence Library listing — browse, filters, and keyword search.
 *
 * Gated: `ELIGIBLE_EVIDENCE_WHERE` is spread FIRST and is not negotiable by any
 * argument. Filters narrow the eligible set; they can never widen it (§7.5).
 *
 * Bounded at `EVIDENCE_BROWSE_MAX_ITEMS`. One extra row is fetched purely to
 * tell "exactly the ceiling" from "more than the ceiling", so the UI can say
 * which without a second count query.
 */
export async function listEligibleEvidence(
  input: EvidenceKeywordQuery = { ...NO_EVIDENCE_FILTERS, query: null },
): Promise<EvidenceListingPage> {
  const rows = await prisma.evidenceItem.findMany({
    where: {
      ...ELIGIBLE_EVIDENCE_WHERE,
      extractionCompletedAt: { not: null },
      ...toFilterWhere(input),
      ...(input.query !== null ? toKeywordWhere(input.query) : {}),
    },
    orderBy: { ingestedAt: "desc" },
    take: EVIDENCE_BROWSE_MAX_ITEMS + 1,
    select: evidenceListSelect,
  });

  const truncated = rows.length > EVIDENCE_BROWSE_MAX_ITEMS;
  const page = truncated ? rows.slice(0, EVIDENCE_BROWSE_MAX_ITEMS) : rows;

  const embeddedCounts = await countEmbeddedChunksByItem(
    page.map((row) => row.id),
  );

  return {
    items: page.map((row) => toListItem(row, embeddedCounts)),
    truncated,
  };
}

/**
 * Hydrate the listing shape for a set of ids, preserving the caller's order.
 *
 * `ELIGIBLE_EVIDENCE_WHERE` is RE-APPLIED even though these ids came out of the
 * vector query, which already enforced the same rule in SQL. Belt and braces on
 * the one rule that matters: a future caller passing ids from somewhere less
 * careful does not get to bypass the gate by choosing this function.
 */
export async function loadEvidenceListItems(
  ids: readonly string[],
): Promise<EvidenceListItem[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.evidenceItem.findMany({
    where: {
      ...ELIGIBLE_EVIDENCE_WHERE,
      extractionCompletedAt: { not: null },
      id: { in: [...ids] },
    },
    select: evidenceListSelect,
  });

  const embeddedCounts = await countEmbeddedChunksByItem(
    rows.map((row) => row.id),
  );

  const byId = new Map(rows.map((row) => [row.id, toListItem(row, embeddedCounts)]));

  // The caller's order is the ranking. Anything the gate dropped simply is not
  // in the map, and falls out of the list here.
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is EvidenceListItem => item !== undefined);
}

/** The country and year options the filter rail offers. */
export type EvidenceFacets = {
  countries: string[];
  years: number[];
};

/**
 * Facet values, derived from the ELIGIBLE set only.
 *
 * An unclassified item's country must never appear as a filter option: the rail
 * would otherwise disclose the existence and the metadata of evidence the gate
 * is holding, which is the leak the queue count is careful not to be (§7.5).
 *
 * Impact area and source type are absent on purpose — those come from the Prisma
 * enums and every value is always offered, because they are taxonomy rather than
 * data (AGENTS.md §12.7).
 */
export async function listEvidenceFacets(): Promise<EvidenceFacets> {
  const rows = await prisma.evidenceItem.findMany({
    where: {
      ...ELIGIBLE_EVIDENCE_WHERE,
      extractionCompletedAt: { not: null },
    },
    select: { country: true, year: true },
  });

  const countries = new Set<string>();
  const years = new Set<number>();

  for (const row of rows) {
    if (row.country !== null && row.country.length > 0) countries.add(row.country);
    if (row.year !== null) years.add(row.year);
  }

  return {
    countries: [...countries].sort((a, b) => a.localeCompare(b)),
    years: [...years].sort((a, b) => b - a),
  };
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
