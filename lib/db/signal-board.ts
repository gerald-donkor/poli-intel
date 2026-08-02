import "server-only";

import {
  SIGNAL_BOARD_MAX_ITEMS,
  SIGNAL_MATCH_EXCERPT_CHARS,
} from "@/lib/ai/config";
import type {
  AudienceTarget,
  EvidenceMatchOutcome,
  Geography,
  ImpactArea,
  Relevance,
  SignalStatus,
  Urgency,
} from "@/lib/generated/prisma/enums";
import { SignalStatus as SignalStatusEnum } from "@/lib/generated/prisma/enums";
import { ELIGIBLE_EVIDENCE_WHERE } from "@/lib/governance/gate";

import { prisma } from "./client";

/**
 * The signal dashboard's data layer: what the board renders, what the detail
 * page renders, and the reclassification write with its audit row.
 *
 * THE GATE'S RETRIEVAL FACE APPEARS ONCE MORE HERE, in `findSignalDetail`. A
 * stored match is a historical fact — the item was `public_published` when the
 * matcher wrote the row — but an item downgraded since is not something to
 * render a title and an excerpt for (§7.5). Ineligible matches are COUNTED and
 * surfaced as "awaiting re-classification", never rendered and never silently
 * dropped (`evidence-governance`: refusal is data).
 *
 * Everything returned here is serialisable, because it crosses into client
 * components: dates are ISO strings, and no Prisma model instance escapes.
 */

/** One card on the board. */
export type SignalBoardCard = {
  id: string;
  title: string;
  /** Written by the classification call — generated prose, so never the serif. */
  summaryText: string;
  sourceName: string;
  detectedAt: string;
  urgency: Urgency;
  relevance: Relevance;
  impactArea: ImpactArea;
  geography: Geography;
  audienceTarget: AudienceTarget | null;
  /** Size of the CURRENT match set, eligible items only. */
  matchCount: number;
  /** `null` where the Evidence Matcher has never run for this signal. */
  latestMatchOutcome: EvidenceMatchOutcome | null;
};

export type SignalBoardPage = {
  signals: SignalBoardCard[];
  /** True when SIGNAL_BOARD_MAX_ITEMS cut the list short — stated, not hidden. */
  truncated: boolean;
};

/**
 * Every live signal, newest first, for the board to group by urgency.
 *
 * GROUPED IN THE COMPONENT, NOT HERE. The column order is the enum's
 * declaration order and belongs with the rendering that relies on it; a
 * pre-grouped shape would make the board's ordering a property of a query
 * nobody looking at the board would think to read.
 *
 * `archived` is excluded. Nothing in the product archives a signal today — §8.5
 * forbids auto-advancing one — but a board that would silently start showing
 * archived signals the day something does is a defect waiting for its trigger.
 *
 * The match count is the CURRENT set filtered by eligibility, so a board count
 * and the detail page's list cannot disagree.
 */
export async function listSignalBoard(): Promise<SignalBoardPage> {
  const rows = await prisma.policySignal.findMany({
    where: { status: { not: SignalStatusEnum.archived } },
    orderBy: { detectedAt: "desc" },
    // One extra row purely to tell "exactly the ceiling" from "more than the
    // ceiling", so the UI can say which without a second count query.
    take: SIGNAL_BOARD_MAX_ITEMS + 1,
    select: {
      id: true,
      title: true,
      summaryText: true,
      sourceName: true,
      detectedAt: true,
      urgency: true,
      relevance: true,
      impactArea: true,
      geography: true,
      audienceTarget: true,
      _count: {
        select: {
          evidenceMatches: { where: { evidenceItem: ELIGIBLE_EVIDENCE_WHERE } },
        },
      },
      matchRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { outcome: true },
      },
    },
  });

  const truncated = rows.length > SIGNAL_BOARD_MAX_ITEMS;

  return {
    truncated,
    signals: rows.slice(0, SIGNAL_BOARD_MAX_ITEMS).map((row) => ({
      id: row.id,
      title: row.title,
      summaryText: row.summaryText,
      sourceName: row.sourceName,
      detectedAt: row.detectedAt.toISOString(),
      urgency: row.urgency,
      relevance: row.relevance,
      impactArea: row.impactArea,
      geography: row.geography,
      audienceTarget: row.audienceTarget,
      matchCount: row._count.evidenceMatches,
      latestMatchOutcome: row.matchRuns[0]?.outcome ?? null,
    })),
  };
}

/** One matched evidence item, as the detail panel renders it. */
export type SignalEvidenceMatchView = {
  evidenceItemId: string;
  rank: number;
  title: string;
  citationKey: string;
  year: number | null;
  country: string | null;
  /** Cosine similarity, 0–1. Rendered as number AND bar, never colour alone. */
  similarity: number;
  /** The rerank's 0–1 score, or null where the model omitted this candidate. */
  rerankScore: number | null;
  /**
   * The matched passage, verbatim from the source — which is why the UI sets it
   * in the serif and the signal's own summary in the sans (§11.6). Null where
   * the chunk has since been re-extracted away.
   */
  excerpt: string | null;
};

export type SignalMatchRunView = {
  id: string;
  outcome: EvidenceMatchOutcome;
  candidateCount: number;
  matchedCount: number;
  refusedCount: number;
  /** A short machine reason. Never an excerpt, never an error message. */
  failureReason: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type SignalReclassificationView = {
  id: string;
  previousUrgency: Urgency;
  newUrgency: Urgency;
  reason: string | null;
  changedAt: string;
  /** The audit row's whole point: who. The relation is required, so never null. */
  actorName: string;
};

export type SignalDetail = {
  id: string;
  title: string;
  summaryText: string;
  sourceName: string;
  /** External and untrusted: linked with `rel="noreferrer"`, never fetched. */
  sourceUrl: string;
  detectedAt: string;
  status: SignalStatus;
  urgency: Urgency;
  relevance: Relevance;
  impactArea: ImpactArea;
  geography: Geography;
  audienceTarget: AudienceTarget | null;
  matches: SignalEvidenceMatchView[];
  /**
   * Stored matches held back by the gate because the item is no longer
   * `public_published`. A COUNT, never the titles — the point is that the
   * backlog is visible, not that the held item is readable anyway (§7.5).
   */
  ineligibleMatchCount: number;
  /** Newest first. `[]` means the matcher has never run — a fourth state. */
  matchRuns: SignalMatchRunView[];
  reclassifications: SignalReclassificationView[];
};

/**
 * One signal, everything the detail page renders, in one place.
 *
 * The four states of the matched-evidence panel are ALL read from stored facts:
 * `matchRuns[0]` says `matched`, `gap` or `failed`, and an empty `matchRuns`
 * says the matcher has never run. An empty `matches` array is never read as a
 * gap — that inference is exactly what the run row exists to make unnecessary
 * (`evidence-matcher` rule 4).
 */
export async function findSignalDetail(
  signalId: string,
): Promise<SignalDetail | null> {
  const signal = await prisma.policySignal.findUnique({
    where: { id: signalId },
    select: {
      id: true,
      title: true,
      summaryText: true,
      sourceName: true,
      sourceUrl: true,
      detectedAt: true,
      status: true,
      urgency: true,
      relevance: true,
      impactArea: true,
      geography: true,
      audienceTarget: true,
      matchRuns: {
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          outcome: true,
          candidateCount: true,
          matchedCount: true,
          refusedCount: true,
          failureReason: true,
          startedAt: true,
          finishedAt: true,
        },
      },
      reclassifications: {
        orderBy: { changedAt: "desc" },
        take: 10,
        select: {
          id: true,
          previousUrgency: true,
          newUrgency: true,
          reason: true,
          changedAt: true,
          actor: { select: { name: true } },
        },
      },
      _count: { select: { evidenceMatches: true } },
    },
  });

  if (!signal) return null;

  // THE GATE. Eligibility is re-read now, not trusted from when the match was
  // written. What the filter removes is counted below rather than vanishing.
  const matches = await prisma.signalEvidenceMatch.findMany({
    where: { signalId, evidenceItem: ELIGIBLE_EVIDENCE_WHERE },
    orderBy: { rank: "asc" },
    select: {
      evidenceItemId: true,
      rank: true,
      similarity: true,
      rerankScore: true,
      chunkOrdinal: true,
      evidenceItem: {
        select: {
          title: true,
          citationKey: true,
          year: true,
          country: true,
        },
      },
    },
  });

  const excerpts = await loadMatchExcerpts(matches);

  return {
    id: signal.id,
    title: signal.title,
    summaryText: signal.summaryText,
    sourceName: signal.sourceName,
    sourceUrl: signal.sourceUrl,
    detectedAt: signal.detectedAt.toISOString(),
    status: signal.status,
    urgency: signal.urgency,
    relevance: signal.relevance,
    impactArea: signal.impactArea,
    geography: signal.geography,
    audienceTarget: signal.audienceTarget,
    matches: matches.map((match) => ({
      evidenceItemId: match.evidenceItemId,
      rank: match.rank,
      title: match.evidenceItem.title,
      citationKey: match.evidenceItem.citationKey,
      year: match.evidenceItem.year,
      country: match.evidenceItem.country,
      similarity: match.similarity,
      rerankScore: match.rerankScore,
      excerpt:
        excerpts.get(`${match.evidenceItemId}:${match.chunkOrdinal}`) ?? null,
    })),
    ineligibleMatchCount: signal._count.evidenceMatches - matches.length,
    matchRuns: signal.matchRuns.map((run) => ({
      id: run.id,
      outcome: run.outcome,
      candidateCount: run.candidateCount,
      matchedCount: run.matchedCount,
      refusedCount: run.refusedCount,
      failureReason: run.failureReason,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
    reclassifications: signal.reclassifications.map((change) => ({
      id: change.id,
      previousUrgency: change.previousUrgency,
      newUrgency: change.newUrgency,
      reason: change.reason,
      changedAt: change.changedAt.toISOString(),
      actorName: change.actor.name,
    })),
  };
}

/**
 * The matched passages, by `(item, ordinal)`.
 *
 * `chunkOrdinal` is stored on the match precisely so the passage can be quoted
 * without re-running retrieval. Only the ALREADY-GATED items are looked up —
 * this never widens what `findSignalDetail` decided was readable.
 */
async function loadMatchExcerpts(
  matches: readonly { evidenceItemId: string; chunkOrdinal: number }[],
): Promise<Map<string, string>> {
  if (matches.length === 0) return new Map();

  const chunks = await prisma.evidenceChunk.findMany({
    where: {
      OR: matches.map((match) => ({
        evidenceItemId: match.evidenceItemId,
        ordinal: match.chunkOrdinal,
      })),
    },
    select: { evidenceItemId: true, ordinal: true, chunkText: true },
  });

  return new Map(
    chunks.map((chunk) => [
      `${chunk.evidenceItemId}:${chunk.ordinal}`,
      truncate(chunk.chunkText, SIGNAL_MATCH_EXCERPT_CHARS),
    ]),
  );
}

function truncate(text: string, limit: number): string {
  const trimmed = text.trim();

  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit)}…`;
}

export type ReclassifySignalUrgencyResult =
  | { ok: true; previousUrgency: Urgency; newUrgency: Urgency }
  | { ok: false; reason: "not_found" | "unchanged" };

/**
 * Move a signal to a different urgency, and record who moved it.
 *
 * ONE TRANSACTION. The update and the audit row are the same fact — a stored
 * urgency nobody can attribute is exactly what §8.6 exists to prevent — so
 * neither may commit without the other.
 *
 * RELEVANCE IS CARRIED THROUGH UNCHANGED on both sides of the audit row. The
 * table records it because a future control may change it; a column move does
 * not, and writing a different relevance here would put a classification nobody
 * chose into the audit log.
 *
 * A NO-OP WRITES NOTHING. Dropping a card back into its own column is not a
 * reclassification and must not leave a row saying it was.
 *
 * STATUS IS UNTOUCHED. The board groups by urgency; no column move implies a
 * status change, and nothing here advances a signal (§8.5).
 */
export function reclassifySignalUrgency({
  signalId,
  actorId,
  newUrgency,
}: {
  signalId: string;
  actorId: string;
  newUrgency: Urgency;
}): Promise<ReclassifySignalUrgencyResult> {
  return prisma.$transaction(async (tx) => {
    const signal = await tx.policySignal.findUnique({
      where: { id: signalId },
      select: { urgency: true, relevance: true },
    });

    if (!signal) return { ok: false, reason: "not_found" } as const;

    if (signal.urgency === newUrgency) {
      return { ok: false, reason: "unchanged" } as const;
    }

    await tx.policySignal.update({
      where: { id: signalId },
      data: { urgency: newUrgency },
      select: { id: true },
    });

    await tx.signalReclassification.create({
      data: {
        signalId,
        actorId,
        previousUrgency: signal.urgency,
        newUrgency,
        previousRelevance: signal.relevance,
        newRelevance: signal.relevance,
      },
      select: { id: true },
    });

    return {
      ok: true,
      previousUrgency: signal.urgency,
      newUrgency,
    } as const;
  });
}
