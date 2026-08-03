import "server-only";

import { FIELD_CACHE_MAX_BRIEFS, FIELD_CACHE_MAX_SIGNALS } from "@/lib/field/config";
import type { BriefStatus, Urgency } from "@/lib/generated/prisma/enums";
import {
  BriefStatus as BriefStatusEnum,
  SignalStatus as SignalStatusEnum,
} from "@/lib/generated/prisma/enums";

import { firstLine } from "./briefs";
import { prisma } from "./client";

/**
 * What the Field Officer digest reads — the last 30 signals and 10 briefs
 * (AGENTS.md §17.4).
 *
 * ITS OWN READ SURFACE, not the morning digest's with a different cap. The two
 * answer different questions for different readers: the morning digest is "what
 * the night produced, for the office", this is "what is worth knowing, in plain
 * language, on a phone". Sharing a query would mean one of them silently
 * inheriting the other's window or vocabulary.
 *
 * NOT ONE COLUMN OF `evidence_item` OR `evidence_chunk` IS SELECTED HERE, and
 * that is deliberate for the same structural reason the morning digest's reads
 * are shaped that way (§7.6): this payload is written to the browser's cache
 * storage on a phone that may be shared, borrowed, or lost, so there is no field
 * on any type below through which an evidence title, excerpt or body could
 * arrive.
 *
 * NO BRIEF BODY EITHER. A title and its type are enough to say a brief exists;
 * the document is read in the app, behind auth. Nothing here renders a flag
 * mark, so no claim text is selected.
 *
 * Everything returned is serialisable — this crosses into a JSON response the
 * service worker stores, so dates are ISO strings and no Prisma model escapes.
 */

/** One thing worth knowing. Plain-language labelling happens at render. */
export type FieldSignalCard = {
  id: string;
  title: string;
  /** Generated prose from the classification call — the sans, never the serif. */
  summaryText: string;
  sourceName: string;
  detectedAt: string;
  /** Rendered through `lib/field/plain-language.ts`, never shown raw. */
  urgency: Urgency;
};

export type FieldBriefCard = {
  id: string;
  title: string;
  status: BriefStatus;
  updatedAt: string;
};

export type FieldDigestPayload = {
  signals: FieldSignalCard[];
  briefs: FieldBriefCard[];
  /** When this snapshot was taken — the "saved at" the offline banner states. */
  generatedAt: string;
};

/**
 * The last signals the radar recorded.
 *
 * `archived` is excluded for the same reason the board excludes it: it is
 * finished work, and a field officer's screen is the last place to spend a card
 * on it.
 */
async function listFieldSignals(): Promise<FieldSignalCard[]> {
  const rows = await prisma.policySignal.findMany({
    where: { status: { not: SignalStatusEnum.archived } },
    orderBy: { detectedAt: "desc" },
    take: FIELD_CACHE_MAX_SIGNALS,
    select: {
      id: true,
      title: true,
      summaryText: true,
      sourceName: true,
      detectedAt: true,
      urgency: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summaryText: row.summaryText,
    sourceName: row.sourceName,
    detectedAt: row.detectedAt.toISOString(),
    urgency: row.urgency,
  }));
}

/**
 * Briefs that have actually left the building.
 *
 * `submitted` and `published` ONLY. A draft is unreviewed work in progress, and
 * putting one on a cached phone screen would be the product implying a position
 * Tropenbos has not taken (§8.8) — to a reader who has no way of seeing it was
 * later changed. A brief a person approved and sent is a fact.
 */
async function listFieldBriefs(): Promise<FieldBriefCard[]> {
  const rows = await prisma.brief.findMany({
    where: {
      status: { in: [BriefStatusEnum.submitted, BriefStatusEnum.published] },
    },
    orderBy: { updatedAt: "desc" },
    take: FIELD_CACHE_MAX_BRIEFS,
    select: {
      id: true,
      status: true,
      updatedAt: true,
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
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/**
 * What the Research Officer's notification needs, and nothing more.
 *
 * `fullText` IS NOT SELECTED, and that is the governance answer for the
 * notification path (§7.6). The email is an egress path, so the enforcement is
 * structural: there is no field on this type through which the observation could
 * travel into an inbox. The title is a label the officer chose, not the body.
 */
export type FieldSubmissionNotice = {
  id: string;
  title: string;
  locationNote: string | null;
  observedAt: string | null;
  submittedAt: string;
  submitterName: string | null;
};

export async function findFieldSubmissionForNotice(
  evidenceItemId: string,
): Promise<FieldSubmissionNotice | null> {
  const row = await prisma.evidenceItem.findUnique({
    where: { id: evidenceItemId },
    select: {
      id: true,
      title: true,
      locationNote: true,
      observedAt: true,
      ingestedAt: true,
      ingestedBy: { select: { name: true } },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    locationNote: row.locationNote,
    observedAt: row.observedAt?.toISOString() ?? null,
    submittedAt: row.ingestedAt.toISOString(),
    submitterName: row.ingestedBy?.name ?? null,
  };
}

export async function readFieldDigest(): Promise<FieldDigestPayload> {
  const [signals, briefs] = await Promise.all([
    listFieldSignals(),
    listFieldBriefs(),
  ]);

  return { signals, briefs, generatedAt: new Date().toISOString() };
}
