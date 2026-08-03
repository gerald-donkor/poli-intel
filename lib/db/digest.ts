import "server-only";

import {
  DIGEST_MAX_BRIEFS,
  DIGEST_MAX_INFLUENCE_EVENTS,
  DIGEST_MAX_SIGNALS,
} from "@/lib/digest/config";
import type {
  BriefAudience,
  BriefStatus,
  BriefType,
  Relevance,
  StaffRole,
  Urgency,
} from "@/lib/generated/prisma/enums";
import {
  BriefStatus as BriefStatusEnum,
  FlagStatus,
  RadarOutcome,
  SignalStatus as SignalStatusEnum,
} from "@/lib/generated/prisma/enums";

import { firstLine } from "./briefs";
import { prisma } from "./client";
import { countPendingClassification } from "./evidence";
import {
  listInfluenceEventsRecordedIn,
  type DigestInfluenceEvent,
} from "./influence";

/**
 * The morning digest's windowed reads.
 *
 * ITS OWN READ SURFACE, not a date parameter bolted onto `listSignalBoard`. The
 * board is "everything live, capped"; the digest is "what the night produced",
 * and a shared query with a nullable window would make both harder to reason
 * about than either is alone.
 *
 * NOT ONE COLUMN OF `evidence_item` OR `evidence_chunk` IS SELECTED HERE, and
 * that is the whole governance answer for this feature (§7.6). An email leaves
 * Tropenbos-controlled infrastructure, so the enforcement is structural rather
 * than editorial: there is no field on any type below through which an evidence
 * title, excerpt or body could arrive. The classification backlog travels as an
 * INTEGER and nothing else.
 *
 * Everything returned is serialisable — these values cross an Inngest step
 * boundary, so dates are ISO strings and no Prisma model instance escapes.
 */

/** One signal in the digest. Titles and generated summary prose only. */
export type DigestSignal = {
  id: string;
  title: string;
  /** Written by the classification call — generated prose, so never the serif. */
  summaryText: string;
  sourceName: string;
  detectedAt: string;
  urgency: Urgency;
  relevance: Relevance;
};

/** One brief waiting on a decision. Metadata and a flag COUNT, never claim text. */
export type DigestBrief = {
  id: string;
  title: string;
  briefType: BriefType;
  audience: BriefAudience;
  status: BriefStatus;
  openFlagCount: number;
};

export type DigestRecipient = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
};

/**
 * What the radar did overnight — the figure that lets a reader tell "quiet" from
 * "broken" without leaving the email (§14.7: silence is reported, not assumed).
 */
export type DigestRadarSummary = {
  sourcesChecked: number;
  sourcesFailed: number;
};

export type DigestWindowReads = {
  signals: DigestSignal[];
  /** True when `DIGEST_MAX_SIGNALS` cut the list short — stated, not hidden. */
  signalsTruncated: boolean;
  briefs: DigestBrief[];
  briefsTruncated: boolean;
  pendingClassificationCount: number;
  radar: DigestRadarSummary;
  /**
   * Influence events recorded overnight — brief titles, kind, and whether a
   * person has confirmed them. NO DESCRIPTION AND NO QUOTED DOCUMENT TEXT: an
   * email leaves Tropenbos-controlled infrastructure, and a verbatim line from a
   * third party's document is not something to put in one (§7.6).
   */
  influence: DigestInfluenceEvent[];
  influenceTruncated: boolean;
};

/**
 * Signals the radar RECORDED in the window.
 *
 * THE WINDOW IS ON `createdAt`, NOT `detectedAt`, and the distinction is not
 * pedantry: `detectedAt` is the source document's own publication date where the
 * feed supplied one (`radar-fetch.ts`), so a Gazette notice dated last month and
 * picked up this morning would be filtered straight out of the digest it belongs
 * in. `createdAt` is when this system first knew about it, which is exactly what
 * "the night produced" means. `detectedAt` is what the email DISPLAYS.
 *
 * It also gets the deduplication rule right for free: a near-duplicate only
 * touches `detectedAt` on the existing row, so a re-detected signal cannot
 * reappear in a second morning's digest. A repeat alert on the same event is a
 * defect (§14.4).
 *
 * `archived` is excluded for the same reason the board excludes it.
 */
async function listSignalsRecordedIn(
  start: Date,
  end: Date,
): Promise<{ signals: DigestSignal[]; truncated: boolean }> {
  const rows = await prisma.policySignal.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      status: { not: SignalStatusEnum.archived },
    },
    orderBy: { createdAt: "desc" },
    // One extra row purely to tell "exactly the cap" from "more than the cap".
    take: DIGEST_MAX_SIGNALS + 1,
    select: {
      id: true,
      title: true,
      summaryText: true,
      sourceName: true,
      detectedAt: true,
      urgency: true,
      relevance: true,
    },
  });

  return {
    truncated: rows.length > DIGEST_MAX_SIGNALS,
    signals: rows.slice(0, DIGEST_MAX_SIGNALS).map((row) => ({
      id: row.id,
      title: row.title,
      summaryText: row.summaryText,
      sourceName: row.sourceName,
      detectedAt: row.detectedAt.toISOString(),
      urgency: row.urgency,
      relevance: row.relevance,
    })),
  };
}

/**
 * Briefs waiting on a Programme Director's decision.
 *
 * BOTH `draft` AND `reviewed`, because both await the same person: a draft
 * awaits approval, and a reviewed brief awaits being marked submitted or
 * published (§8.3). `submitted` and `published` are finished and are not
 * anybody's outstanding decision.
 *
 * The open-flag count is read from the CURRENT version, exactly as the approval
 * action reads it, so the email cannot say a brief is clear when the server
 * would refuse to approve it (§9.5). NOT ONE FLAG'S CLAIM TEXT IS SELECTED — a
 * count is enough to say "waiting on checks", and claim text is document content
 * (§7.6).
 */
async function listBriefsAwaitingDecision(): Promise<{
  briefs: DigestBrief[];
  truncated: boolean;
}> {
  const rows = await prisma.brief.findMany({
    where: {
      status: { in: [BriefStatusEnum.draft, BriefStatusEnum.reviewed] },
    },
    orderBy: { updatedAt: "desc" },
    take: DIGEST_MAX_BRIEFS + 1,
    select: {
      id: true,
      briefType: true,
      audience: true,
      status: true,
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

  return {
    truncated: rows.length > DIGEST_MAX_BRIEFS,
    briefs: rows.slice(0, DIGEST_MAX_BRIEFS).map((row) => ({
      id: row.id,
      title: firstLine(row.versions[0]?.bodyText ?? "") || "Untitled draft",
      briefType: row.briefType,
      audience: row.audience,
      status: row.status,
      openFlagCount: row.versions[0]?._count.flags ?? 0,
    })),
  };
}

/**
 * How many distinct sources the radar reached in the window, and how many of
 * those attempts failed.
 *
 * `distinct` on `sourceId` because a source with two attempts in one window is
 * one source checked, not two. `not_implemented` is counted as neither: a source
 * whose retrieval method has no implementation was never checked, and reporting
 * it as checked would manufacture exactly the false reassurance §14.7 exists to
 * prevent.
 */
async function summariseRadar(
  start: Date,
  end: Date,
): Promise<DigestRadarSummary> {
  const runs = await prisma.radarRun.findMany({
    where: {
      startedAt: { gte: start, lt: end },
      outcome: {
        in: [RadarOutcome.found, RadarOutcome.empty, RadarOutcome.failed],
      },
    },
    orderBy: { startedAt: "desc" },
    distinct: ["sourceId"],
    select: { outcome: true },
  });

  return {
    sourcesChecked: runs.length,
    sourcesFailed: runs.filter((run) => run.outcome === RadarOutcome.failed)
      .length,
  };
}

/** Everything the digest reads, for one window. */
export async function readDigestWindow(
  start: Date,
  end: Date,
): Promise<DigestWindowReads> {
  const [signals, briefs, pendingClassificationCount, radar, influence] =
    await Promise.all([
      listSignalsRecordedIn(start, end),
      listBriefsAwaitingDecision(),
      countPendingClassification(),
      summariseRadar(start, end),
      listInfluenceEventsRecordedIn(start, end, DIGEST_MAX_INFLUENCE_EVENTS),
    ]);

  return {
    signals: signals.signals,
    signalsTruncated: signals.truncated,
    briefs: briefs.briefs,
    briefsTruncated: briefs.truncated,
    pendingClassificationCount,
    radar,
    influence: influence.events,
    influenceTruncated: influence.truncated,
  };
}

/**
 * Who the digest goes to, resolved server-side from `StaffUser` by role.
 *
 * NO ADDRESS EVER COMES FROM INPUT, a query parameter, or an event payload.
 * `StaffUser` carries no preference or active column and this change adds
 * neither: four staff at one organisation who all asked for this is not a
 * subscription-management problem.
 */
export function listDigestRecipients(
  roles: readonly StaffRole[],
): Promise<DigestRecipient[]> {
  return prisma.staffUser.findMany({
    where: { role: { in: [...roles] } },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });
}
