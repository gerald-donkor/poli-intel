import "server-only";

import {
  MATCHER_CANDIDATE_CHUNKS,
  MATCHER_CANDIDATE_ITEMS,
  MATCHER_MIN_SIMILARITY,
} from "@/lib/ai/config";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  Classification,
  type EvidenceMatchOutcome,
} from "@/lib/generated/prisma/enums";

import { prisma } from "./client";
import { NO_EVIDENCE_FILTERS, type EvidenceFilters } from "./evidence";

/**
 * The Evidence Matcher's data layer: the candidate query, the transactional
 * replace of a signal's match set, and the run record that makes a gap a stored
 * fact rather than an absence.
 *
 * Raw SQL again, and for the same one reason as `evidence-vectors.ts`: Prisma
 * cannot read, write or filter an `Unsupported("vector(1536)")` column
 * (AGENTS.md §6). Everything below is parameterised through Prisma's tagged
 * templates; no id, vector or enum value is interpolated into a statement
 * string.
 *
 * Ids, counts, outcomes and short machine reasons only in `evidence_match_run`
 * — never a signal summary, never a candidate excerpt, never a caught error's
 * message (§7.6, §13.9).
 */

/** What the job needs to run a match: the signal's summary and its vector. */
export type SignalForMatching = {
  id: string;
  summaryText: string;
  /** NULL only for a row that predates the radar. Never re-embedded here. */
  embedding: number[] | null;
};

/**
 * Reads the signal's summary and vector for one matcher run.
 *
 * The vector comes back as pgvector's text form and is parsed here rather than
 * in the job, so the vector column's representation stays inside the data layer
 * like every other detail of it.
 */
export async function findSignalForMatching(
  signalId: string,
): Promise<SignalForMatching | null> {
  const rows = await prisma.$queryRaw<
    { id: string; summaryText: string; embedding: string | null }[]
  >`
    SELECT id,
           summary_text AS "summaryText",
           embedding::text AS "embedding"
    FROM policy_signal
    WHERE id = ${signalId}
  `;

  const row = rows[0];

  if (!row) return null;

  return {
    id: row.id,
    summaryText: row.summaryText,
    embedding: parseVector(row.embedding),
  };
}

function parseVector(value: string | null): number[] | null {
  if (value === null) return null;

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) && parsed.every((n) => typeof n === "number")
      ? parsed
      : null;
  } catch {
    // A vector that will not parse is treated exactly as an absent one: the run
    // is recorded `failed`, and nothing is re-embedded or guessed at.
    return null;
  }
}

/** One candidate item, its closest chunk, and the text the rerank will read. */
export type EvidenceMatchCandidate = {
  evidenceItemId: string;
  /** Read at query time and re-judged by the gate before the model call. */
  classification: Classification;
  citationKey: string;
  title: string;
  year: number | null;
  country: string | null;
  chunkOrdinal: number;
  chunkText: string;
  /** Cosine similarity, `1 - distance`. Higher is closer. */
  similarity: number;
};

/**
 * Step 2 of the fixed retrieval order: cosine similarity over eligible chunks,
 * collapsed to one row per item, capped at the top 20 candidates
 * (`evidence-matcher` rule 1).
 *
 * THE GATE'S RETRIEVAL FACE, in the one place Prisma's `where` cannot reach.
 * Classification is not duplicated onto chunks (`supabase-schema`), so the join
 * to the parent item IS the enforcement:
 *
 *     i.classification = public_published
 *
 * is the same one fact as `ELIGIBLE_EVIDENCE_WHERE`. It is not optional, not
 * parameterised by the caller, and not skippable — there is no argument to this
 * function that can widen it. It is the third layer of that rule rather than a
 * substitute for the other two: ineligible items are never embedded at all
 * (`lib/ai/embeddings.ts`), and `purgeEvidenceItemEmbeddings` strips the vectors
 * again on a downgrade, so an ineligible item has no vector to match on.
 *
 * The metadata filters (`evidence-matcher` rule 3) are accepted but the
 * scheduled path passes none: a signal's own classification is a hypothesis
 * about relevance, and pre-filtering on it would hide exactly the cross-cutting
 * evidence an officer most needs to see. The parameter exists for the on-demand
 * path.
 *
 * INDEX BEHAVIOUR: the filters sit in the same `WHERE` as the similarity
 * ordering, so Postgres may post-filter the HNSW result set —
 * `MATCHER_CANDIDATE_CHUNKS` over-fetches for that reason.
 */
export async function findEvidenceMatchCandidates({
  signalVector,
  filters,
}: {
  signalVector: number[];
  filters?: EvidenceFilters;
}): Promise<EvidenceMatchCandidate[]> {
  const vector = JSON.stringify(signalVector);
  const active = filters ?? NO_EVIDENCE_FILTERS;

  const conditions: Prisma.Sql[] = [];

  if (active.country !== null) {
    conditions.push(Prisma.sql`AND i.country = ${active.country}`);
  }

  if (active.year !== null) {
    conditions.push(Prisma.sql`AND i.year = ${active.year}::int`);
  }

  if (active.impactArea !== null) {
    conditions.push(
      Prisma.sql`AND i.impact_area = ${active.impactArea}::"impact_area"`,
    );
  }

  if (active.sourceType !== null) {
    conditions.push(
      Prisma.sql`AND i.source_type = ${active.sourceType}::"evidence_source_type"`,
    );
  }

  const filterSql =
    conditions.length > 0 ? Prisma.join(conditions, " ") : Prisma.empty;

  // Three nested selects, each doing one thing: rank chunks by distance, keep
  // each item's closest one, then apply the threshold and the candidate cap.
  // `DISTINCT ON` must lead its `ORDER BY` with the distinct expression, which
  // is why the similarity ordering cannot collapse into the same statement.
  return prisma.$queryRaw<EvidenceMatchCandidate[]>`
    SELECT closest."evidenceItemId",
           closest."classification",
           closest."citationKey",
           closest."title",
           closest."year",
           closest."country",
           closest."chunkOrdinal",
           closest."chunkText",
           closest."similarity"
    FROM (
      SELECT DISTINCT ON (candidate."evidenceItemId")
             candidate."evidenceItemId",
             candidate."classification",
             candidate."citationKey",
             candidate."title",
             candidate."year",
             candidate."country",
             candidate."chunkOrdinal",
             candidate."chunkText",
             (1 - candidate.distance)::float8 AS "similarity"
      FROM (
        SELECT c.evidence_item_id AS "evidenceItemId",
               i.classification::text AS "classification",
               i.citation_key AS "citationKey",
               i.title AS "title",
               i.year AS "year",
               i.country AS "country",
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
        LIMIT ${MATCHER_CANDIDATE_CHUNKS}
      ) candidate
      ORDER BY candidate."evidenceItemId", candidate.distance ASC
    ) closest
    WHERE closest."similarity" >= ${MATCHER_MIN_SIMILARITY}
    ORDER BY closest."similarity" DESC
    LIMIT ${MATCHER_CANDIDATE_ITEMS}
  `;
}

/** One row of the set that replaces a signal's current matches. */
export type SignalEvidenceMatchInput = {
  evidenceItemId: string;
  similarity: number;
  rerankScore: number | null;
  rank: number;
  chunkOrdinal: number;
};

/**
 * Replaces a signal's match set atomically.
 *
 * A signal has ONE current match set. Delete-then-insert in a single
 * transaction is what stops the board rendering half of it mid-rematch, and it
 * is why this is one function rather than two the caller sequences.
 *
 * An empty set is a legitimate argument: a re-run that now finds nothing clears
 * the stale matches, and the `gap` run row records why.
 */
export function replaceSignalEvidenceMatches({
  signalId,
  matches,
}: {
  signalId: string;
  matches: readonly SignalEvidenceMatchInput[];
}): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.signalEvidenceMatch.deleteMany({ where: { signalId } });

    if (matches.length === 0) return 0;

    const created = await tx.signalEvidenceMatch.createMany({
      data: matches.map((match) => ({ signalId, ...match })),
    });

    return created.count;
  });
}

export type RecordEvidenceMatchRunInput = {
  signalId: string;
  outcome: EvidenceMatchOutcome;
  startedAt: Date;
  candidateCount?: number;
  matchedCount?: number;
  refusedCount?: number;
  /** Short machine reason. Never an excerpt, never an error message. */
  failureReason?: string;
};

/**
 * EVERY attempt writes exactly one of these — including the ones that matched
 * nothing, and the ones that failed.
 *
 * This is what makes the gap data (`evidence-matcher` rule 4). Without it, "we
 * searched and the corpus has nothing on this" and "the matcher never ran" are
 * the same empty join, and neither the weekly gap analysis nor the signal board
 * can tell them apart.
 */
export function recordEvidenceMatchRun(
  input: RecordEvidenceMatchRunInput,
): Promise<{ id: string }> {
  return prisma.evidenceMatchRun.create({
    data: {
      signalId: input.signalId,
      outcome: input.outcome,
      startedAt: input.startedAt,
      finishedAt: new Date(),
      candidateCount: input.candidateCount ?? 0,
      matchedCount: input.matchedCount ?? 0,
      refusedCount: input.refusedCount ?? 0,
      failureReason: input.failureReason ?? null,
    },
    select: { id: true },
  });
}
