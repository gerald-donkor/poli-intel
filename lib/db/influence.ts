import "server-only";

import {
  IMPACT_DETECTION_WINDOW_DAYS,
  IMPACT_MAX_BRIEFS_PER_RUN,
} from "@/lib/ai/config";
import {
  BriefStatus,
  InfluenceDetectionMethod,
  type ImpactDetectionOutcome,
  type InfluenceEventType,
} from "@/lib/generated/prisma/enums";
import type { BriefAudience, BriefType } from "@/lib/generated/prisma/enums";
import {
  calculateQuarterlyOperationalMetrics,
  type QuarterlyOperationalMetricInput,
  type QuarterlyOperationalMetrics,
} from "@/lib/impact/quarterly-metrics";
import {
  findDuplicateInfluenceEvent,
  influenceSourceKey,
  type InfluenceDedupCandidate,
} from "@/lib/impact/dedup";

import { firstLine } from "./briefs";
import { prisma } from "./client";

/**
 * The Impact Tracker's reads and writes.
 *
 * NOT ONE COLUMN OF `evidence_item.full_text` OR `evidence_chunk` IS SELECTED
 * ANYWHERE IN THIS MODULE, and that is the governance answer for the whole
 * feature (§7). The quarterly report's evidence section reads evidence IDS AND
 * TITLES through `brief_evidence` — a database aggregate over what briefs
 * already recorded, transmitted to nobody. There is no `GatedEvidenceContext`
 * here because there is no evidence going to a model.
 *
 * Everything returned by the job-facing reads is serialisable: those values
 * cross an Inngest step boundary, so dates are ISO strings and no Prisma model
 * instance escapes.
 */

/* ---------------------------------------------------------------------------
 * Detection — what the weekly job reads and writes
 * ------------------------------------------------------------------------- */

/**
 * Briefs eligible for the weekly search.
 *
 * `submitted` and `published` ONLY. This is the FIRST half of decision 4's rule
 * and deliberately not the whole of it: a `where` clause is a filter somebody can
 * later widen, so `toPublishedBriefSubject` re-applies the status rule at the AI
 * layer's door where it cannot be forged (`lib/ai/detect-influence.ts`).
 *
 * BOUNDED THREE WAYS. Only briefs that went out inside
 * IMPACT_DETECTION_WINDOW_DAYS are checked at all; at most
 * IMPACT_MAX_BRIEFS_PER_RUN are taken in one run; and they are taken
 * LEAST-RECENTLY-CHECKED FIRST, so a backlog drains across consecutive weeks
 * rather than one brief being searched every Monday while another never is.
 */
export type BriefForInfluenceDetection = {
  id: string;
  title: string;
  audience: BriefAudience;
  briefType: BriefType;
  status: BriefStatus;
};

export async function listBriefsForInfluenceDetection(
  now: Date,
): Promise<BriefForInfluenceDetection[]> {
  const since = new Date(
    now.getTime() - IMPACT_DETECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const rows = await prisma.brief.findMany({
    where: {
      status: { in: [BriefStatus.submitted, BriefStatus.published] },
      statusChanges: {
        some: {
          newStatus: { in: [BriefStatus.submitted, BriefStatus.published] },
          changedAt: { gte: since },
        },
      },
    },
    select: {
      id: true,
      audience: true,
      briefType: true,
      status: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { bodyText: true },
      },
      impactRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { startedAt: true },
      },
    },
  });

  // Ordered in application code rather than SQL: "never checked" must sort
  // BEFORE "checked longest ago", and a `NULLS FIRST` ordering over a related
  // table's aggregate is not something Prisma's query surface expresses. The set
  // is bounded by the window above, so this sorts a small list.
  return rows
    .sort((left, right) => {
      const a = left.impactRuns[0]?.startedAt?.getTime() ?? 0;
      const b = right.impactRuns[0]?.startedAt?.getTime() ?? 0;

      return a - b;
    })
    .slice(0, IMPACT_MAX_BRIEFS_PER_RUN)
    .map((row) => ({
      id: row.id,
      title: firstLine(row.versions[0]?.bodyText ?? "") || "Untitled brief",
      audience: row.audience,
      briefType: row.briefType,
      status: row.status,
    }));
}

/** One brief, re-read at the moment its own run starts. */
export async function findBriefForInfluenceDetection(
  briefId: string,
): Promise<BriefForInfluenceDetection | null> {
  const row = await prisma.brief.findUnique({
    where: { id: briefId },
    select: {
      id: true,
      audience: true,
      briefType: true,
      status: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { bodyText: true },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    title: firstLine(row.versions[0]?.bodyText ?? "") || "Untitled brief",
    audience: row.audience,
    briefType: row.briefType,
    status: row.status,
  };
}

/** What one detected candidate carries into the database. */
export type DetectedInfluenceCandidate = {
  eventType: InfluenceEventType;
  description: string;
  quotedText: string | null;
  sourceUrl: string;
  sourceTitle: string | null;
};

export type RecordDetectedInfluenceResult = {
  created: number;
  matched: number;
  createdIds: string[];
};

/**
 * File a run's candidates against one brief.
 *
 * DEDUP BEFORE THE INSERT (§14.4). A re-detection TOUCHES the existing row's
 * `lastSeenAt` and never creates a second, so running the job twice against the
 * same brief produces no duplicates — which is acceptance criterion 7.
 *
 * EVERYTHING IT CREATES IS `verified: false`, and there is no argument to say
 * otherwise. The model does not decide that Tropenbos influenced anything (§8);
 * a Programme Director does, later, through `verifyInfluenceEvent`.
 *
 * The unique index on `(briefId, sourceKey)` is the second line of defence
 * behind the in-process dedup: two runs racing on the same citation is a
 * constraint violation rather than two rows, and the violation is caught and
 * counted as a match.
 */
export async function recordDetectedInfluenceEvents({
  briefId,
  candidates,
  detectedAt,
}: {
  briefId: string;
  candidates: readonly DetectedInfluenceCandidate[];
  detectedAt: Date;
}): Promise<RecordDetectedInfluenceResult> {
  const existing: InfluenceDedupCandidate[] =
    await prisma.influenceEvent.findMany({
      where: { briefId },
      select: { id: true, sourceKey: true, description: true },
    });

  const createdIds: string[] = [];
  let matched = 0;

  for (const candidate of candidates) {
    const sourceKey = influenceSourceKey(candidate.sourceUrl);
    const duplicate = findDuplicateInfluenceEvent(
      { sourceKey, description: candidate.description },
      existing,
    );

    if (duplicate.duplicate) {
      // A re-detection is evidence the citation is still there, which is worth
      // recording — but it never re-opens a verification decision a person has
      // already taken, so `verified` is untouched.
      await prisma.influenceEvent.update({
        where: { id: duplicate.eventId },
        data: { lastSeenAt: detectedAt },
      });
      matched += 1;
      continue;
    }

    try {
      const created = await prisma.influenceEvent.create({
        data: {
          briefId,
          eventType: candidate.eventType,
          detectionMethod: InfluenceDetectionMethod.detected_by_search,
          sourceDocument: candidate.sourceUrl,
          sourceTitle: candidate.sourceTitle,
          sourceKey,
          detectedAt,
          lastSeenAt: detectedAt,
          description: candidate.description,
          quotedText: candidate.quotedText,
          verified: false,
        },
        select: { id: true },
      });

      createdIds.push(created.id);
      existing.push({
        id: created.id,
        sourceKey,
        description: candidate.description,
      });
    } catch (error) {
      // A concurrent run got there first. The unique index did its job, so this
      // is a match rather than a failure — and it is checked by CODE, never
      // swallowed by a bare catch.
      if (!isUniqueViolation(error)) throw error;

      matched += 1;
    }
  }

  return { created: createdIds.length, matched, createdIds };
}

/** Prisma's unique-constraint code. Nothing else is treated as a duplicate. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export type RecordImpactDetectionRunInput = {
  briefId: string;
  outcome: ImpactDetectionOutcome;
  startedAt: Date;
  candidatesSeen?: number;
  eventsCreated?: number;
  eventsMatched?: number;
  candidatesDropped?: number;
  failureReason?: string;
};

/**
 * One row per attempt, INCLUDING the ones that found nothing.
 *
 * That row is the whole reason a brief with no influence events can say whether
 * it was searched and came back quiet or was never searched at all (§14.7).
 */
export async function recordImpactDetectionRun(
  input: RecordImpactDetectionRunInput,
): Promise<void> {
  await prisma.impactDetectionRun.create({
    data: {
      briefId: input.briefId,
      outcome: input.outcome,
      startedAt: input.startedAt,
      candidatesSeen: input.candidatesSeen ?? 0,
      eventsCreated: input.eventsCreated ?? 0,
      eventsMatched: input.eventsMatched ?? 0,
      candidatesDropped: input.candidatesDropped ?? 0,
      failureReason: input.failureReason ?? null,
    },
  });
}

/* ---------------------------------------------------------------------------
 * The screen
 * ------------------------------------------------------------------------- */

/** One influence event as `/impact` renders it. */
export type InfluenceEventView = {
  id: string;
  briefId: string;
  briefTitle: string;
  eventType: InfluenceEventType;
  detectionMethod: InfluenceDetectionMethod;
  sourceDocument: string | null;
  sourceTitle: string | null;
  detectedAt: string;
  /** Prose about the event — the sans. */
  description: string;
  /** Verbatim from the citing document — the serif, and the only one (§11.6). */
  quotedText: string | null;
  verified: boolean;
  verifiedByName: string | null;
  verifiedAt: string | null;
  loggedByName: string | null;
  /**
   * Who wrote the brief. Surfaced so a Programme Director verifying an event on
   * their own brief can SEE that they are doing so — decision 11 implements
   * role-level verification and leaves the object-level question open rather
   * than silently settling it.
   */
  briefAuthorName: string | null;
  briefAuthorId: string | null;
};

export async function listInfluenceEvents(): Promise<InfluenceEventView[]> {
  const rows = await prisma.influenceEvent.findMany({
    orderBy: [{ detectedAt: "desc" }, { createdAt: "desc" }],
    select: influenceEventSelect,
  });

  return rows.map(toInfluenceEventView);
}

const influenceEventSelect = {
  id: true,
  briefId: true,
  eventType: true,
  detectionMethod: true,
  sourceDocument: true,
  sourceTitle: true,
  detectedAt: true,
  description: true,
  quotedText: true,
  verified: true,
  verifiedAt: true,
  verifiedBy: { select: { name: true } },
  loggedBy: { select: { name: true } },
  brief: {
    select: {
      createdById: true,
      createdBy: { select: { name: true } },
      versions: {
        orderBy: { version: "desc" as const },
        take: 1,
        select: { bodyText: true },
      },
    },
  },
} as const;

type InfluenceEventRow = {
  id: string;
  briefId: string;
  eventType: InfluenceEventType;
  detectionMethod: InfluenceDetectionMethod;
  sourceDocument: string | null;
  sourceTitle: string | null;
  detectedAt: Date;
  description: string;
  quotedText: string | null;
  verified: boolean;
  verifiedAt: Date | null;
  verifiedBy: { name: string } | null;
  loggedBy: { name: string } | null;
  brief: {
    createdById: string | null;
    createdBy: { name: string } | null;
    versions: { bodyText: string }[];
  };
};

function toInfluenceEventView(row: InfluenceEventRow): InfluenceEventView {
  return {
    id: row.id,
    briefId: row.briefId,
    briefTitle:
      firstLine(row.brief.versions[0]?.bodyText ?? "") || "Untitled brief",
    eventType: row.eventType,
    detectionMethod: row.detectionMethod,
    sourceDocument: row.sourceDocument,
    sourceTitle: row.sourceTitle,
    detectedAt: row.detectedAt.toISOString(),
    description: row.description,
    quotedText: row.quotedText,
    verified: row.verified,
    verifiedByName: row.verifiedBy?.name ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    loggedByName: row.loggedBy?.name ?? null,
    briefAuthorName: row.brief.createdBy?.name ?? null,
    briefAuthorId: row.brief.createdById,
  };
}

/** Briefs a person may log an event against — every brief, newest first. */
export type BriefOption = {
  id: string;
  title: string;
  status: BriefStatus;
};

export async function listBriefOptionsForInfluence(): Promise<BriefOption[]> {
  const rows = await prisma.brief.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { bodyText: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: firstLine(row.versions[0]?.bodyText ?? "") || "Untitled brief",
    status: row.status,
  }));
}

/* ---------------------------------------------------------------------------
 * The map
 * ------------------------------------------------------------------------- */

/** One outcome node — an influence event, which is the map's spine. */
export type ImpactMapOutcome = {
  id: string;
  briefId: string;
  eventType: InfluenceEventType;
  sourceTitle: string | null;
  sourceDocument: string | null;
  detectedAt: string;
  verified: boolean;
};

/** One brief node. Only briefs an outcome names appear. */
export type ImpactMapBrief = {
  id: string;
  title: string;
  briefType: BriefType;
  audience: BriefAudience;
};

/**
 * One evidence node — BIBLIOGRAPHIC IDENTITY ONLY.
 *
 * `title` and `citationKey`, the same two columns `readQuarterlyImpactReport`
 * already reads. No `full_text`, no chunk, no excerpt. A citation path is made
 * of citations, not of content (§7).
 */
export type ImpactMapEvidence = {
  id: string;
  title: string;
  citationKey: string;
};

export type ImpactMapLink = {
  evidenceId: string;
  briefId: string;
};

export type ImpactMap = {
  outcomes: ImpactMapOutcome[];
  briefs: ImpactMapBrief[];
  evidence: ImpactMapEvidence[];
  links: ImpactMapLink[];
};

/**
 * The evidence → brief → outcome lattice `/impact` draws.
 *
 * DERIVED FROM THE INFLUENCE EVENT OUTWARDS, never from the brief list. A brief
 * nobody has recorded an outcome against has no path and does not appear: this
 * screen is the record of what reached policy, not a catalogue of what was
 * drafted.
 *
 * OUTCOMES ARE RETURNED IN CITATION-DATE ORDER, ASCENDING, because that is the
 * order the timeline draws in. The ordering is a property of the data, not a
 * sort the component re-invents.
 *
 * THREE QUERIES, ONE PER LEVEL — never an N+1 walk down the lattice. Everything
 * returned is serialisable: it crosses a Server Component boundary into a client
 * component, so dates are ISO strings and no Prisma model instance escapes.
 *
 * NO CLASSIFICATION FILTER, DELIBERATELY. The gate's retrieval face (§7.5, §15.2)
 * governs what may enter retrieval and what is searchable in the library; this
 * performs neither. It renders a stored historical relation between rows a person
 * already selected, and silently dropping a path would falsify the record of what
 * actually happened. Equally: that is not licence to widen the select. Titles only.
 */
export async function readImpactMap(): Promise<ImpactMap> {
  const eventRows = await prisma.influenceEvent.findMany({
    orderBy: [{ detectedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      briefId: true,
      eventType: true,
      sourceTitle: true,
      sourceDocument: true,
      detectedAt: true,
      verified: true,
    },
  });

  if (eventRows.length === 0) {
    return { outcomes: [], briefs: [], evidence: [], links: [] };
  }

  const briefIds = [...new Set(eventRows.map((row) => row.briefId))];

  const [briefRows, linkRows] = await Promise.all([
    prisma.brief.findMany({
      where: { id: { in: briefIds } },
      select: {
        id: true,
        briefType: true,
        audience: true,
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { bodyText: true },
        },
      },
    }),
    prisma.briefEvidence.findMany({
      where: { briefId: { in: briefIds } },
      orderBy: { addedAt: "asc" },
      select: {
        briefId: true,
        evidenceItem: { select: { id: true, title: true, citationKey: true } },
      },
    }),
  ]);

  const evidence = new Map<string, ImpactMapEvidence>();

  for (const row of linkRows) {
    if (evidence.has(row.evidenceItem.id)) continue;

    evidence.set(row.evidenceItem.id, {
      id: row.evidenceItem.id,
      title: row.evidenceItem.title,
      citationKey: row.evidenceItem.citationKey,
    });
  }

  return {
    outcomes: eventRows.map((row) => ({
      id: row.id,
      briefId: row.briefId,
      eventType: row.eventType,
      sourceTitle: row.sourceTitle,
      sourceDocument: row.sourceDocument,
      detectedAt: row.detectedAt.toISOString(),
      verified: row.verified,
    })),
    briefs: briefRows.map((row) => ({
      id: row.id,
      title: firstLine(row.versions[0]?.bodyText ?? "") || "Untitled brief",
      briefType: row.briefType,
      audience: row.audience,
    })),
    evidence: [...evidence.values()],
    links: linkRows.map((row) => ({
      evidenceId: row.evidenceItem.id,
      briefId: row.briefId,
    })),
  };
}

/* ---------------------------------------------------------------------------
 * Writes a person makes
 * ------------------------------------------------------------------------- */

export type LogInfluenceEventInput = {
  briefId: string;
  eventType: InfluenceEventType;
  description: string;
  sourceDocument: string | null;
  sourceTitle: string | null;
  quotedText: string | null;
  detectedAt: Date;
  loggedById: string;
};

export type LogInfluenceEventResult =
  | { ok: true; id: string }
  | { ok: false; reason: "unknown_brief" | "duplicate_source" };

/**
 * Record that a brief reached something.
 *
 * `detectionMethod` is fixed to `logged_by_person` HERE rather than accepted as
 * an argument: a person's log and a job's detection are different claims with
 * different weight, and no caller may declare itself the other one.
 *
 * `verified` is NOT set true. A logged event is still a claim awaiting a
 * Programme Director's confirmation — one person asserting Tropenbos's own
 * impact into a donor report is exactly what the verification step exists to
 * check (§8, decision 2).
 */
export async function logInfluenceEvent(
  input: LogInfluenceEventInput,
): Promise<LogInfluenceEventResult> {
  const brief = await prisma.brief.findUnique({
    where: { id: input.briefId },
    select: { id: true },
  });

  if (!brief) return { ok: false, reason: "unknown_brief" };

  try {
    const created = await prisma.influenceEvent.create({
      data: {
        briefId: input.briefId,
        eventType: input.eventType,
        detectionMethod: InfluenceDetectionMethod.logged_by_person,
        sourceDocument: input.sourceDocument,
        sourceTitle: input.sourceTitle,
        sourceKey: influenceSourceKey(input.sourceDocument),
        detectedAt: input.detectedAt,
        description: input.description,
        quotedText: input.quotedText,
        verified: false,
        loggedById: input.loggedById,
      },
      select: { id: true },
    });

    return { ok: true, id: created.id };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    // The same source document is already recorded against this brief —
    // possibly by the weekly search. Told plainly rather than filed twice.
    return { ok: false, reason: "duplicate_source" };
  }
}

export type VerifyInfluenceEventResult =
  | { ok: true }
  | { ok: false; reason: "unknown_event" };

/**
 * A Programme Director confirms a claim.
 *
 * ACTOR AND TIMESTAMP ARE RECORDED, like every other status transition in this
 * schema (§8.3). A claim that goes into a donor report is not the place to start
 * making exceptions.
 *
 * The role check is NOT here — it is in the Server Action, server-side, before
 * this is reached (§10.1). This function does what it is told; it does not
 * decide who may tell it.
 */
export async function verifyInfluenceEvent({
  eventId,
  actorStaffUserId,
  verifiedAt,
}: {
  eventId: string;
  actorStaffUserId: string;
  verifiedAt: Date;
}): Promise<VerifyInfluenceEventResult> {
  const updated = await prisma.influenceEvent.updateMany({
    where: { id: eventId, verified: false },
    data: { verified: true, verifiedById: actorStaffUserId, verifiedAt },
  });

  if (updated.count === 0) {
    // Either it does not exist, or somebody else verified it first. Both are the
    // same thing to the caller: there is nothing left to do.
    const exists = await prisma.influenceEvent.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!exists) return { ok: false, reason: "unknown_event" };
  }

  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * The quarterly report
 * ------------------------------------------------------------------------- */

export type QuarterlyReportEvent = {
  id: string;
  eventType: InfluenceEventType;
  detectionMethod: InfluenceDetectionMethod;
  briefId: string;
  briefTitle: string;
  description: string;
  quotedText: string | null;
  sourceDocument: string | null;
  sourceTitle: string | null;
  detectedAt: string;
  verifiedByName: string | null;
  verifiedAt: string | null;
};

export type QuarterlyReportEvidence = {
  id: string;
  title: string;
  citationKey: string;
  /** How many of the quarter's verified events trace back through this item. */
  eventCount: number;
};

const COMPLETED_BRIEF_STATUSES = [
  BriefStatus.reviewed,
  BriefStatus.submitted,
  BriefStatus.published,
] as const;

export {
  calculateQuarterlyOperationalMetrics,
  type QuarterlyOperationalMetricInput,
  type QuarterlyOperationalMetrics,
};

export type QuarterlyImpactReport = {
  /** Verified events in the quarter, in the enum's declaration order by type. */
  events: QuarterlyReportEvent[];
  /**
   * Detected but not verified, in the same window. STATED SEPARATELY so a reader
   * knows the difference between a confirmed claim and a lead (decision 7).
   */
  unverifiedCount: number;
  /** Which evidence the briefs behind those events cited — ids and titles. */
  evidence: QuarterlyReportEvidence[];
  /** Stored operational data, calculated for the selected quarter only. */
  metrics: QuarterlyOperationalMetrics;
};

/**
 * Assemble the quarter. NO GEMINI CALL, and no room for one.
 *
 * Spec §3.5 asks for an "auto-drafted donor reporting section", and auto-ASSEMBLY
 * satisfies it. A model-written donor report is unsourced prose about the
 * organisation's own impact — the exact thing §9.8 forbids inside a brief, and
 * worse here, because there is no hallucination guard on this surface and no
 * citation chip to check. EVERY LINE OF THE REPORT TRACES TO A STORED ROW.
 *
 * VERIFIED EVENTS ONLY. An unverified lead cannot reach a donor by accident.
 */
export async function readQuarterlyImpactReport({
  start,
  end,
}: {
  start: Date;
  end: Date;
}): Promise<QuarterlyImpactReport> {
  const window = { gte: start, lt: end };

  const [rows, unverifiedCount, signals, briefs, evidenceReviews] = await Promise.all([
    prisma.influenceEvent.findMany({
      where: { verified: true, detectedAt: window },
      orderBy: [{ eventType: "asc" }, { detectedAt: "asc" }],
      select: {
        id: true,
        eventType: true,
        detectionMethod: true,
        briefId: true,
        description: true,
        quotedText: true,
        sourceDocument: true,
        sourceTitle: true,
        detectedAt: true,
        verifiedAt: true,
        verifiedBy: { select: { name: true } },
        brief: {
          select: {
            versions: {
              orderBy: { version: "desc" },
              take: 1,
              select: { bodyText: true },
            },
          },
        },
      },
    }),
    prisma.influenceEvent.count({
      where: { verified: false, detectedAt: window },
    }),
    prisma.policySignal.findMany({
      where: { detectedAt: window },
      select: {
        urgency: true,
        briefs: {
          where: { status: { in: [...COMPLETED_BRIEF_STATUSES] } },
          select: { id: true },
        },
      },
    }),
    prisma.brief.findMany({
      where: {
        OR: [
          { createdAt: window },
          { statusChanges: { some: { changedAt: window } } },
        ],
      },
      select: {
        status: true,
        audience: true,
        signal: { select: { detectedAt: true } },
        statusChanges: {
          where: {
            changedAt: window,
            newStatus: { in: [...COMPLETED_BRIEF_STATUSES] },
          },
          orderBy: { changedAt: "asc" },
          select: { changedAt: true },
        },
      },
    }),
    prisma.evidenceMatchReview.findMany({
      where: { reviewedAt: window },
      select: { assessment: true },
    }),
  ]);

  const events: QuarterlyReportEvent[] = rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    detectionMethod: row.detectionMethod,
    briefId: row.briefId,
    briefTitle:
      firstLine(row.brief.versions[0]?.bodyText ?? "") || "Untitled brief",
    description: row.description,
    quotedText: row.quotedText,
    sourceDocument: row.sourceDocument,
    sourceTitle: row.sourceTitle,
    detectedAt: row.detectedAt.toISOString(),
    verifiedByName: row.verifiedBy?.name ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  }));

  return {
    events,
    unverifiedCount,
    evidence: await readEvidenceBehind(events.map((event) => event.briefId)),
    metrics: calculateQuarterlyOperationalMetrics({
      signals: signals.map((signal) => ({
        urgency: signal.urgency,
        captured: signal.briefs.length > 0,
      })),
      briefs: briefs.map((brief) => ({
        status: brief.status,
        audience: brief.audience,
        signalDetectedAt: brief.signal?.detectedAt ?? null,
        completedAt: brief.statusChanges[0]?.changedAt ?? null,
      })),
      evidenceReviews,
    }),
  };
}

/**
 * Which evidence the briefs behind the quarter's verified events cited.
 *
 * This is spec §3.5's evidence-quality feedback, for free: an item appearing
 * across several verified events is evidence that has repeatedly reached policy.
 *
 * IDS, TITLES AND CITATION KEYS ONLY. `full_text` is not selected, no chunk is
 * read, and nothing here goes to a model or leaves the product (§7).
 */
async function readEvidenceBehind(
  briefIds: readonly string[],
): Promise<QuarterlyReportEvidence[]> {
  if (briefIds.length === 0) return [];

  const rows = await prisma.briefEvidence.findMany({
    where: { briefId: { in: [...new Set(briefIds)] } },
    select: {
      briefId: true,
      evidenceItem: { select: { id: true, title: true, citationKey: true } },
    },
  });

  // One event per (brief, item) pair rather than per row, counted here because
  // the same brief may sit behind several of the quarter's events.
  const eventsPerBrief = new Map<string, number>();

  for (const briefId of briefIds) {
    eventsPerBrief.set(briefId, (eventsPerBrief.get(briefId) ?? 0) + 1);
  }

  const totals = new Map<string, QuarterlyReportEvidence>();

  for (const row of rows) {
    const existing = totals.get(row.evidenceItem.id);
    const contribution = eventsPerBrief.get(row.briefId) ?? 0;

    if (existing) {
      existing.eventCount += contribution;
      continue;
    }

    totals.set(row.evidenceItem.id, {
      id: row.evidenceItem.id,
      title: row.evidenceItem.title,
      citationKey: row.evidenceItem.citationKey,
      eventCount: contribution,
    });
  }

  return [...totals.values()].sort(
    (left, right) =>
      right.eventCount - left.eventCount || left.title.localeCompare(right.title),
  );
}

/* ---------------------------------------------------------------------------
 * The digest's read
 * ------------------------------------------------------------------------- */

/** One new influence event, as the morning digest names it. */
export type DigestInfluenceEvent = {
  id: string;
  briefId: string;
  briefTitle: string;
  eventType: InfluenceEventType;
  detectionMethod: InfluenceDetectionMethod;
  verified: boolean;
};

/**
 * Influence events RECORDED in the digest's window.
 *
 * The window is on `createdAt`, not `detectedAt`, for exactly the reason the
 * digest's signal read gives: `detectedAt` may be a citing document's own date,
 * so a citation published last month and found this morning belongs in this
 * morning's digest.
 *
 * TITLES AND COUNTS ONLY — no description, and above all no quoted document
 * text. An email leaves Tropenbos-controlled infrastructure, and a verbatim line
 * from a third party's document is not something to put in one (§7.6).
 */
export async function listInfluenceEventsRecordedIn(
  start: Date,
  end: Date,
  limit: number,
): Promise<{ events: DigestInfluenceEvent[]; truncated: boolean }> {
  const rows = await prisma.influenceEvent.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      briefId: true,
      eventType: true,
      detectionMethod: true,
      verified: true,
      brief: {
        select: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { bodyText: true },
          },
        },
      },
    },
  });

  return {
    truncated: rows.length > limit,
    events: rows.slice(0, limit).map((row) => ({
      id: row.id,
      briefId: row.briefId,
      briefTitle:
        firstLine(row.brief.versions[0]?.bodyText ?? "") || "Untitled brief",
      eventType: row.eventType,
      detectionMethod: row.detectionMethod,
      verified: row.verified,
    })),
  };
}
