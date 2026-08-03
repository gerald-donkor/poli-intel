import "server-only";

import { EVIDENCE_BROWSE_MAX_ITEMS } from "@/lib/ai/config";
import { FIELD_SUBMISSION_COUNTRY } from "@/lib/field/config";
import { ELIGIBLE_EVIDENCE_WHERE, PENDING_CLASSIFICATION } from "@/lib/governance/gate";
import { Prisma } from "@/lib/generated/prisma/client";
import { EvidenceSourceType as EvidenceSourceTypeEnum } from "@/lib/generated/prisma/enums";
import type {
  Classification,
  EvidenceSourceType,
  ImpactArea,
} from "@/lib/generated/prisma/enums";
import { chunkDocument, type TextChunk } from "@/lib/ingestion/chunk";

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

/**
 * The rows the generation gate judges.
 *
 * `ELIGIBLE_EVIDENCE_WHERE` IS DELIBERATELY ABSENT, and this is the one listing
 * in this module where that is correct. The gate must SEE an ineligible item to
 * refuse it by name (`gateEvidenceForGeneration`); filtering here would instead
 * silently shrink the officer's chosen set and generate from a different
 * selection than the one on screen. Read at generation time, so a classification
 * changed between picking and generating is caught (§7.1).
 *
 * `fullText` is read here and is bounded into an excerpt inside the gate, never
 * before it — a caller that only wanted metadata has no reason to be here.
 */
export function loadEvidenceForGenerationContext(ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([]);

  return prisma.evidenceItem.findMany({
    where: { id: { in: [...ids] }, extractionCompletedAt: { not: null } },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
      country: true,
      impactArea: true,
      sourceType: true,
      citationKey: true,
      classification: true,
      fullText: true,
    },
  });
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

export type CreateFieldSubmissionInput = {
  /** Generated on the officer's device at compose time. The idempotency key. */
  submissionKey: string;
  title: string;
  /** The observation itself. Becomes `fullText` and is chunked in place. */
  observation: string;
  locationNote: string | null;
  observedAt: Date | null;
  ingestedById: string;
};

export type CreateFieldSubmissionResult = {
  evidenceItemId: string;
  /** True when this key had already landed — a replay, not a second item. */
  deduped: boolean;
  /** Chunks written. 0 on a replay, which wrote nothing. */
  chunkCount: number;
};

/**
 * The citation key for a field submission, derived from its submission key.
 *
 * DERIVED RATHER THAN RANDOM, because both unique columns must collide together
 * on a replay. If this were random, the second attempt at the same observation
 * would trip `submission_key` (handled, deduped) on one code path and
 * `citation_key` (a different, unhandled shape) on another depending on which
 * index Postgres reported first. One deterministic value keeps the replay a
 * single, predictable outcome.
 *
 * The upload path takes its key from the Research Officer, who is transcribing
 * a real bibliographic reference. A field observation has no such reference, so
 * it gets a synthetic one that reads as what it is.
 */
export function fieldSubmissionCitationKey(submissionKey: string): string {
  return `field-${submissionKey.replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Records a field observation as an `EvidenceItem`.
 *
 * `classification` IS ABSENT AND IS NOT AN ARGUMENT, exactly as
 * `createEvidenceShell` is: the schema default holds the row at
 * `unpublished_internal` until a Research Officer tags it, and there is no
 * auto-classification by source — an observation is not trusted into
 * eligibility by virtue of coming from a Tropenbos officer (§7.3).
 *
 * `extractionCompletedAt` IS SET HERE, unlike the upload path, and the reason is
 * that there is nothing to extract: the officer typed the text, so it is
 * complete the moment it arrives. That is what puts the row in the
 * classification queue rather than leaving it looking like an upload that never
 * finished.
 *
 * CHUNKS ARE WRITTEN, WITH NO VECTORS. Chunking is local text splitting and
 * makes no model call, so it is outside the gate entirely — and it is what the
 * upload path already does for an item at the same classification
 * (`completeEvidenceExtraction`). Without it a field observation classified
 * `public_published` later would have nothing for the embedding pass to embed
 * and could never enter retrieval. `embedding` stays null; only classification
 * to `public_published` starts an embedding run.
 *
 * The replay case is decided by the DATABASE, not by a read-then-create: two
 * replays milliseconds apart would both see nothing and both insert.
 */
export async function createFieldSubmission(
  input: CreateFieldSubmissionInput,
): Promise<CreateFieldSubmissionResult> {
  const chunks = chunkDocument(input.observation, null);

  try {
    const item = await prisma.evidenceItem.create({
      data: {
        title: input.title,
        authors: [],
        year: null,
        sourceType: EvidenceSourceTypeEnum.field_data,
        country: FIELD_SUBMISSION_COUNTRY,
        impactArea: null,
        citationKey: fieldSubmissionCitationKey(input.submissionKey),
        submissionKey: input.submissionKey,
        locationNote: input.locationNote,
        observedAt: input.observedAt,
        fullText: input.observation,
        extractionCompletedAt: new Date(),
        ingestedById: input.ingestedById,
        chunks: {
          create: chunks.map((chunk) => ({
            ordinal: chunk.ordinal,
            chunkText: chunk.text,
            charStart: chunk.charStart,
            charEnd: chunk.charEnd,
            sourcePage: chunk.sourcePage,
          })),
        },
      },
      select: { id: true },
    });

    return {
      evidenceItemId: item.id,
      deduped: false,
      chunkCount: chunks.length,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.evidenceItem.findUnique({
        where: { submissionKey: input.submissionKey },
        select: { id: true },
      });

      // A unique violation that is NOT this key is not a replay and must not be
      // reported as one. Nothing else can realistically collide — the citation
      // key is derived from the same uuid — so this is a genuine surprise and
      // is rethrown rather than swallowed.
      if (existing) {
        return { evidenceItemId: existing.id, deduped: true, chunkCount: 0 };
      }
    }

    throw error;
  }
}

/** Where a field submission has got to, in the submitting officer's own view. */
export type FieldSubmissionSummary = {
  id: string;
  submissionKey: string;
  title: string;
  locationNote: string | null;
  observedAt: string | null;
  submittedAt: string;
  /** True once a Research Officer has moved it off the schema default. */
  reviewed: boolean;
};

/**
 * The officer's own recent submissions, for `/field/sent`.
 *
 * SCOPED TO THE CALLER, always — this takes a staff user id rather than
 * offering an "all submissions" mode, so there is no shape here through which a
 * Field Officer could read somebody else's observation.
 *
 * `reviewed` is derived from the classification rather than exposing it: §11.12
 * forbids internal taxonomy vocabulary on this surface, and "waiting for review"
 * is the honest plain-language rendering of `unpublished_internal` here. No
 * observation text is selected at all.
 */
export async function listFieldSubmissionsByStaffUser(
  staffUserId: string,
  limit: number,
): Promise<FieldSubmissionSummary[]> {
  const rows = await prisma.evidenceItem.findMany({
    where: {
      ingestedById: staffUserId,
      submissionKey: { not: null },
    },
    orderBy: { ingestedAt: "desc" },
    take: limit,
    select: {
      id: true,
      submissionKey: true,
      title: true,
      locationNote: true,
      observedAt: true,
      ingestedAt: true,
      classification: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    // Non-null by the `where` above; Prisma's type cannot express that.
    submissionKey: row.submissionKey ?? "",
    title: row.title,
    locationNote: row.locationNote,
    observedAt: row.observedAt?.toISOString() ?? null,
    submittedAt: row.ingestedAt.toISOString(),
    reviewed: row.classification !== PENDING_CLASSIFICATION,
  }));
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
