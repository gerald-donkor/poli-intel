import "server-only";

import type {
  BriefAudience,
  BriefStatus,
  BriefType,
  Geography,
  ImpactArea,
  Urgency,
} from "@/lib/generated/prisma/enums";
import { SignalStatus as SignalStatusEnum } from "@/lib/generated/prisma/enums";

import { prisma } from "./client";

/**
 * The submission tracker's data layer: which policy windows close when, and
 * whether a brief exists for each.
 *
 * A READ OVER EXISTING ROWS PLUS ONE DATE. There is no submission entity and no
 * planning state — a window's brief status IS `brief.status` on the briefs
 * already linked to that signal. Nothing here writes to a brief (§8.3: a status
 * moves only through the explicit human action on the brief itself).
 *
 * NOTHING IS DERIVED. A signal with no `windowClosesAt` is undated, at every
 * layer. No date is synthesised from urgency here, in the action, or in the UI.
 *
 * NO EVIDENCE PATH. Briefs are read for id, type, audience and status only —
 * never `bodyText`, never a join through `BriefEvidence` to an evidence body. A
 * calendar has no reason to load classified material (§7.6).
 *
 * Everything returned is serialisable: dates are ISO strings, no Prisma model
 * instance escapes.
 */

/**
 * How far back the tracker looks. A window that closed last month is exactly
 * what a Director wants to see — "did we answer that one?" — so recently closed
 * windows stay on the screen rather than vanishing at midnight.
 */
export const TRACKER_LOOKBACK_DAYS = 90;

/** How far ahead. Beyond a year a recorded date is a note, not a plan. */
export const TRACKER_LOOKAHEAD_DAYS = 365;

/**
 * The undated list's ceiling. Undated signals are the backlog, not the view —
 * an unbounded list would make the page's cost grow with the radar's whole
 * history.
 */
export const TRACKER_UNDATED_LIMIT = 40;

/** A brief answering a window, identified without touching its prose. */
export type TrackerBrief = {
  id: string;
  briefType: BriefType;
  audience: BriefAudience;
  status: BriefStatus;
};

export type TrackerSignal = {
  id: string;
  title: string;
  urgency: Urgency;
  geography: Geography;
  impactArea: ImpactArea;
  /** ISO, or null where nobody has recorded a date. Never inferred. */
  windowClosesAt: string | null;
  detectedAt: string;
  briefs: TrackerBrief[];
};

/** A signal whose window date someone has actually recorded. */
export type TrackerDatedWindow = TrackerSignal & { windowClosesAt: string };

export type TrackerWindows = {
  dated: TrackerDatedWindow[];
  undated: TrackerSignal[];
};

/** The columns both halves read, so the two lists cannot drift apart. */
const TRACKER_SIGNAL_SELECT = {
  id: true,
  title: true,
  urgency: true,
  geography: true,
  impactArea: true,
  windowClosesAt: true,
  detectedAt: true,
  briefs: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      briefType: true,
      audience: true,
      status: true,
    },
  },
} as const;

type TrackerSignalRow = {
  id: string;
  title: string;
  urgency: Urgency;
  geography: Geography;
  impactArea: ImpactArea;
  windowClosesAt: Date | null;
  detectedAt: Date;
  briefs: {
    id: string;
    briefType: BriefType;
    audience: BriefAudience;
    status: BriefStatus;
  }[];
};

function toTrackerSignal(row: TrackerSignalRow): TrackerSignal {
  return {
    id: row.id,
    title: row.title,
    urgency: row.urgency,
    geography: row.geography,
    impactArea: row.impactArea,
    windowClosesAt: row.windowClosesAt?.toISOString() ?? null,
    detectedAt: row.detectedAt.toISOString(),
    briefs: row.briefs,
  };
}

/**
 * Every window closing in the range, plus the signals nobody has dated.
 *
 * `archived` is excluded from BOTH halves, matching the board (`listSignalBoard`):
 * nothing in the product archives a signal today, but a tracker that would
 * silently start listing archived ones the day something does is a defect
 * waiting for its trigger.
 *
 * The dated half is ordered by the date itself — the soonest to close first,
 * which is the order the question is asked in. The undated half is newest-first,
 * because the most recently detected signal is the one someone is most likely to
 * know the deadline for.
 */
export async function getTrackerWindows({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): Promise<TrackerWindows> {
  const [datedRows, undatedRows] = await Promise.all([
    prisma.policySignal.findMany({
      where: {
        status: { not: SignalStatusEnum.archived },
        windowClosesAt: { gte: from, lte: to },
      },
      orderBy: { windowClosesAt: "asc" },
      select: TRACKER_SIGNAL_SELECT,
    }),
    prisma.policySignal.findMany({
      where: {
        status: { not: SignalStatusEnum.archived },
        windowClosesAt: null,
      },
      orderBy: { detectedAt: "desc" },
      take: TRACKER_UNDATED_LIMIT,
      select: TRACKER_SIGNAL_SELECT,
    }),
  ]);

  return {
    dated: datedRows.map((row) => {
      const signal = toTrackerSignal(row);

      // The `where` guarantees it, but the type does not: narrow rather than
      // assert, so a future query change cannot quietly produce a dated window
      // with no date.
      return {
        ...signal,
        windowClosesAt: signal.windowClosesAt ?? row.detectedAt.toISOString(),
      };
    }),
    undated: undatedRows.map(toTrackerSignal),
  };
}

export type SetSignalWindowResult =
  | { ok: true; windowClosesAt: string | null }
  | { ok: false; reason: "not_found" };

/**
 * Record or clear the date a window closes. One update, one column.
 *
 * NO AUDIT ROW, and that is a recorded decision rather than an omission:
 * `BriefStatusChange`, `SignalReclassification` and `EvidenceClassificationChange`
 * exist because §8.3, §8.6 and §10.8 name those three transitions specifically. A
 * scheduling annotation is none of them, so it does not earn a fourth table
 * against the 500MB budget (§12.5). `updatedAt` moves; that is the record.
 *
 * `updateMany` rather than `update` so a signal deleted between render and
 * submit is an ordinary "not found" result instead of a thrown P2025 crossing
 * the action boundary.
 */
export async function setSignalWindowClosesAt({
  signalId,
  windowClosesAt,
}: {
  signalId: string;
  windowClosesAt: Date | null;
}): Promise<SetSignalWindowResult> {
  const result = await prisma.policySignal.updateMany({
    where: { id: signalId },
    data: { windowClosesAt },
  });

  if (result.count === 0) return { ok: false, reason: "not_found" };

  return { ok: true, windowClosesAt: windowClosesAt?.toISOString() ?? null };
}
