import "server-only";

import {
  EMBEDDING_MODEL,
  EVIDENCE_SEARCH_CANDIDATE_CHUNKS,
  EVIDENCE_SEARCH_MAX_ITEMS,
  EVIDENCE_SEARCH_MIN_SIMILARITY,
} from "@/lib/ai/config";
import { Prisma } from "@/lib/generated/prisma/client";
import { Classification } from "@/lib/generated/prisma/enums";

import { prisma } from "./client";
import type { EvidenceFilters } from "./evidence";

/**
 * The vector half of the data layer.
 *
 * Raw SQL lives here and only here — the one carve-out AGENTS.md §6 allows,
 * because Prisma cannot read, write or filter an `Unsupported("vector(1536)")`
 * column. Everything below is parameterised through Prisma's tagged templates;
 * no id, vector or enum value is ever interpolated into a statement string.
 *
 * Embedding state is DERIVED, not stored: `embedding IS NULL` means not
 * embedded. There is no status column, so there is nothing that can disagree
 * with the column it describes.
 */

/** Chunk ids awaiting a vector, with the size the batch planner needs. */
export type UnembeddedChunk = { id: string; charCount: number };

export function listUnembeddedChunks(
  evidenceItemId: string,
): Promise<UnembeddedChunk[]> {
  return prisma.$queryRaw<UnembeddedChunk[]>`
    SELECT id, length(chunk_text)::int AS "charCount"
    FROM evidence_chunk
    WHERE evidence_item_id = ${evidenceItemId}
      AND embedding IS NULL
    ORDER BY ordinal ASC
  `;
}

/**
 * The chunk text a batch will embed, joined to its item's CURRENT
 * classification.
 *
 * The classification is read here, from the database, at the moment of use —
 * never taken from an event payload. An event is transport: it can be replayed,
 * delayed, or delivered after a reclassification that happened in between, so a
 * payload claiming `public_published` proves nothing. Classification is not
 * duplicated onto chunks (`supabase-schema`), so this joins to the parent.
 *
 * `embedding IS NULL` is part of the filter, which is what makes a re-run
 * idempotent: an already-embedded chunk simply does not come back, so nothing
 * re-embeds and nothing is paid for twice.
 */
export type ChunkForEmbedding = {
  id: string;
  evidenceItemId: string;
  classification: Classification;
  text: string;
};

export async function loadChunksForEmbedding(
  chunkIds: readonly string[],
): Promise<ChunkForEmbedding[]> {
  if (chunkIds.length === 0) return [];

  return prisma.$queryRaw<ChunkForEmbedding[]>`
    SELECT c.id,
           c.evidence_item_id AS "evidenceItemId",
           i.classification::text AS "classification",
           c.chunk_text AS "text"
    FROM evidence_chunk c
    JOIN evidence_item i ON i.id = c.evidence_item_id
    WHERE c.id IN (${Prisma.join([...chunkIds])})
      AND c.embedding IS NULL
    ORDER BY c.ordinal ASC
  `;
}

/**
 * Writes vectors and the model identity that produced them, in one transaction.
 *
 * `embedding_model` is written with every vector because a change of embedding
 * model invalidates existing vectors; without the record there is no safe
 * re-embedding path (`gemini-integration`).
 *
 * The vector goes in as a bound text parameter and is cast in SQL. Building the
 * literal into the statement would be string-interpolating 1,536 floats into
 * SQL, which is exactly the thing not to do.
 */
export async function writeChunkEmbeddings(
  vectors: readonly { id: string; vector: number[] }[],
): Promise<number> {
  if (vectors.length === 0) return 0;

  const results = await prisma.$transaction(
    vectors.map(
      (row) => prisma.$executeRaw`
        UPDATE evidence_chunk
        SET embedding = ${JSON.stringify(row.vector)}::vector,
            embedding_model = ${EMBEDDING_MODEL}
        WHERE id = ${row.id}
      `,
    ),
  );

  return results.reduce((total, count) => total + count, 0);
}

/**
 * Deletes an item's derived vectors while leaving its chunk rows and their text
 * intact.
 *
 * This is the other half of the gate. A vector derived from evidence that is no
 * longer eligible is still derived from that evidence, and leaving it in the
 * index would let ineligible material reach retrieval through the back door.
 * Without this, the gate would hold only at the instant of embedding — which is
 * not a gate.
 *
 * The text stays. Only the derived artefact goes.
 */
export function purgeEvidenceItemEmbeddings(
  evidenceItemId: string,
): Promise<number> {
  return prisma.$executeRaw`
    UPDATE evidence_chunk
    SET embedding = NULL, embedding_model = NULL
    WHERE evidence_item_id = ${evidenceItemId}
      AND embedding IS NOT NULL
  `;
}

/**
 * Embedded-chunk counts for the items being rendered, for the detail panel.
 *
 * Scoped to the ids on screen now that the library filters and caps its result
 * set — counting the whole table to render at most a hundred rows was the
 * shortcut the previous note said to revisit.
 *
 * An empty id list returns an empty map without touching the database.
 */
export async function countEmbeddedChunksByItem(
  evidenceItemIds: readonly string[],
): Promise<Map<string, number>> {
  if (evidenceItemIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    { evidenceItemId: string; embeddedCount: number }[]
  >`
    SELECT evidence_item_id AS "evidenceItemId", COUNT(*)::int AS "embeddedCount"
    FROM evidence_chunk
    WHERE embedding IS NOT NULL
      AND evidence_item_id IN (${Prisma.join([...evidenceItemIds])})
    GROUP BY evidence_item_id
  `;

  return new Map(rows.map((row) => [row.evidenceItemId, row.embeddedCount]));
}

/** One item's closest matching chunk, and how close it was. */
export type EvidenceChunkMatch = {
  evidenceItemId: string;
  chunkOrdinal: number;
  chunkText: string;
  /** Cosine similarity, `1 - distance`. Higher is closer. */
  similarity: number;
};

/**
 * The Evidence Library's semantic search: cosine similarity over chunk vectors,
 * collapsed to one row per item.
 *
 * THE GATE, in the one place Prisma's `where` cannot reach. Classification is
 * not duplicated onto chunks (`supabase-schema`), so the join to the parent item
 * IS the enforcement:
 *
 *     i.classification = public_published
 *
 * is the same one fact as `ELIGIBLE_EVIDENCE_WHERE`, expressed in SQL the way
 * `listItemsWithUnembeddedChunks` already does. It is the third layer of that
 * rule, not a substitute for the other two — only eligible items are embedded at
 * all (`lib/ai/embeddings.ts`), and `purgeEvidenceItemEmbeddings` strips the
 * vectors again on a downgrade.
 *
 * INDEX BEHAVIOUR, honestly: the metadata filters sit in the same `WHERE` as the
 * similarity ordering, so Postgres may post-filter the HNSW result set. An
 * aggressive filter can therefore return fewer candidates than the limit
 * suggests — `EVIDENCE_SEARCH_CANDIDATE_CHUNKS` over-fetches for exactly that
 * reason. Do not tune `hnsw.ef_search` without a corpus to measure against.
 *
 * Every value below is a bound parameter, including the vector and the enums.
 * Nothing is interpolated into the statement.
 */
export async function searchEvidenceChunksByVector({
  queryVector,
  filters,
}: {
  queryVector: number[];
  filters: EvidenceFilters;
}): Promise<EvidenceChunkMatch[]> {
  const vector = JSON.stringify(queryVector);

  const conditions: Prisma.Sql[] = [];

  if (filters.country !== null) {
    conditions.push(Prisma.sql`AND i.country = ${filters.country}`);
  }

  if (filters.year !== null) {
    conditions.push(Prisma.sql`AND i.year = ${filters.year}::int`);
  }

  if (filters.impactArea !== null) {
    conditions.push(
      Prisma.sql`AND i.impact_area = ${filters.impactArea}::"impact_area"`,
    );
  }

  if (filters.sourceType !== null) {
    conditions.push(
      Prisma.sql`AND i.source_type = ${filters.sourceType}::"evidence_source_type"`,
    );
  }

  const filterSql =
    conditions.length > 0 ? Prisma.join(conditions, " ") : Prisma.empty;

  // Three nested selects, each doing one thing: rank chunks by distance, keep
  // each item's closest one, then apply the threshold and the item cap.
  // `DISTINCT ON` must lead its `ORDER BY` with the distinct expression, which
  // is why the similarity ordering cannot collapse into the same statement.
  return prisma.$queryRaw<EvidenceChunkMatch[]>`
    SELECT closest."evidenceItemId",
           closest."chunkOrdinal",
           closest."chunkText",
           closest."similarity"
    FROM (
      SELECT DISTINCT ON (candidate."evidenceItemId")
             candidate."evidenceItemId",
             candidate."chunkOrdinal",
             candidate."chunkText",
             (1 - candidate.distance)::float8 AS "similarity"
      FROM (
        SELECT c.evidence_item_id AS "evidenceItemId",
               c.ordinal AS "chunkOrdinal",
               c.chunk_text AS "chunkText",
               (c.embedding <=> ${vector}::vector) AS distance
        FROM evidence_chunk c
        JOIN evidence_item i ON i.id = c.evidence_item_id
        WHERE c.embedding IS NOT NULL
          AND i.extraction_completed_at IS NOT NULL
          AND i.classification = ${Classification.public_published}::"classification"
          ${filterSql}
        ORDER BY c.embedding <=> ${vector}::vector
        LIMIT ${EVIDENCE_SEARCH_CANDIDATE_CHUNKS}
      ) candidate
      ORDER BY candidate."evidenceItemId", candidate.distance ASC
    ) closest
    WHERE closest."similarity" >= ${EVIDENCE_SEARCH_MIN_SIMILARITY}
    ORDER BY closest."similarity" DESC
    LIMIT ${EVIDENCE_SEARCH_MAX_ITEMS}
  `;
}

/**
 * The sweep's input: eligible items that still have unembedded chunks.
 *
 * This is both the backfill (items classified before this pipeline existed) and
 * the self-heal (an `inngest.send()` that failed after its transaction
 * committed would otherwise strand an item forever).
 *
 * The eligibility filter is the enum value, bound as a parameter and cast to
 * the Postgres enum type — the same one fact as `ELIGIBLE_EVIDENCE_WHERE`,
 * expressed in the one place Prisma's `where` cannot reach.
 */
export function listItemsWithUnembeddedChunks(
  limit: number,
): Promise<{ evidenceItemId: string }[]> {
  return prisma.$queryRaw<{ evidenceItemId: string }[]>`
    SELECT DISTINCT c.evidence_item_id AS "evidenceItemId"
    FROM evidence_chunk c
    JOIN evidence_item i ON i.id = c.evidence_item_id
    WHERE c.embedding IS NULL
      AND i.extraction_completed_at IS NOT NULL
      AND i.classification = ${Classification.public_published}::"classification"
    LIMIT ${limit}
  `;
}
