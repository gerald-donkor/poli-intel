import "server-only";

import type {
  AudienceTarget,
  BriefAudience,
  BriefStatus,
  BriefType,
} from "@/lib/generated/prisma/enums";

import { firstLine } from "./briefs";
import { prisma } from "./client";

/**
 * The stakeholder CRM's reads and writes.
 *
 * Nothing outside this module touches `stakeholder` or `stakeholder_brief`
 * (AGENTS.md §5.2). Every function returns a plain DTO with dates already
 * serialised, so a Server Component can hand a row straight to a client
 * component without dragging a Prisma model across the boundary.
 *
 * A brief's display title is its current version's first line, exactly as
 * `listBriefs` derives it — there is no title column, and a second derivation
 * here would drift from the one on the briefs list.
 */

export type StakeholderListItem = {
  id: string;
  name: string;
  organisation: string | null;
  role: string | null;
  audienceType: AudienceTarget | null;
  preferredLanguage: string | null;
  shareCount: number;
};

/**
 * The list, with a share count per contact from one grouped read rather than a
 * count query per row.
 */
export async function listStakeholders(): Promise<StakeholderListItem[]> {
  const rows = await prisma.stakeholder.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      organisation: true,
      role: true,
      audienceType: true,
      preferredLanguage: true,
      _count: { select: { briefHistory: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    organisation: row.organisation,
    role: row.role,
    audienceType: row.audienceType,
    preferredLanguage: row.preferredLanguage,
    shareCount: row._count.briefHistory,
  }));
}

export type StakeholderShare = {
  briefId: string;
  briefTitle: string;
  briefType: BriefType;
  /**
   * The brief's own generation audience, which is NOT the contact's
   * `audienceType`. The two enums are deliberately never collapsed or mapped
   * (schema.prisma, `AudienceTarget`): whether a framing suits a reader is a
   * person's judgment and the product says nothing about it.
   */
  briefAudience: BriefAudience;
  briefStatus: BriefStatus;
  sharedAt: string;
  note: string | null;
  sharedByName: string | null;
};

export type StakeholderDetail = {
  id: string;
  name: string;
  organisation: string | null;
  role: string | null;
  audienceType: AudienceTarget | null;
  preferredLanguage: string | null;
  shares: StakeholderShare[];
};

/** The columns every share read needs, so the two reads cannot drift apart. */
const SHARE_SELECT = {
  sharedAt: true,
  note: true,
  sharedBy: { select: { name: true } },
  brief: {
    select: {
      id: true,
      briefType: true,
      audience: true,
      status: true,
      versions: {
        orderBy: { version: "desc" as const },
        take: 1,
        select: { bodyText: true },
      },
    },
  },
} as const;

type ShareRow = {
  sharedAt: Date;
  note: string | null;
  sharedBy: { name: string } | null;
  brief: {
    id: string;
    briefType: BriefType;
    audience: BriefAudience;
    status: BriefStatus;
    versions: { bodyText: string }[];
  };
};

function toShare(row: ShareRow): StakeholderShare {
  return {
    briefId: row.brief.id,
    briefTitle: firstLine(row.brief.versions[0]?.bodyText ?? "") || "Untitled draft",
    briefType: row.brief.briefType,
    briefAudience: row.brief.audience,
    briefStatus: row.brief.status,
    sharedAt: row.sharedAt.toISOString(),
    note: row.note,
    sharedByName: row.sharedBy?.name ?? null,
  };
}

export async function findStakeholderDetail(
  id: string,
): Promise<StakeholderDetail | null> {
  const row = await prisma.stakeholder.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      organisation: true,
      role: true,
      audienceType: true,
      preferredLanguage: true,
      briefHistory: {
        orderBy: { sharedAt: "desc" },
        select: SHARE_SELECT,
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    organisation: row.organisation,
    role: row.role,
    audienceType: row.audienceType,
    preferredLanguage: row.preferredLanguage,
    shares: row.briefHistory.map(toShare),
  };
}

export type BriefShare = {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderOrganisation: string | null;
  audienceType: AudienceTarget | null;
  sharedAt: string;
  note: string | null;
  sharedByName: string | null;
};

/** The panel on a brief: who this brief has been logged as going to. */
export async function listSharesForBrief(
  briefId: string,
): Promise<BriefShare[]> {
  const rows = await prisma.stakeholderBrief.findMany({
    where: { briefId },
    orderBy: { sharedAt: "desc" },
    select: {
      sharedAt: true,
      note: true,
      sharedBy: { select: { name: true } },
      stakeholder: {
        select: {
          id: true,
          name: true,
          organisation: true,
          audienceType: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    stakeholderId: row.stakeholder.id,
    stakeholderName: row.stakeholder.name,
    stakeholderOrganisation: row.stakeholder.organisation,
    audienceType: row.stakeholder.audienceType,
    sharedAt: row.sharedAt.toISOString(),
    note: row.note,
    sharedByName: row.sharedBy?.name ?? null,
  }));
}

/** Contacts to pick from when logging a share. Deliberately just the labels. */
export type StakeholderOption = {
  id: string;
  name: string;
  organisation: string | null;
};

export async function listStakeholderOptions(): Promise<StakeholderOption[]> {
  return prisma.stakeholder.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, organisation: true },
  });
}

export type StakeholderInput = {
  name: string;
  organisation: string | null;
  role: string | null;
  audienceType: AudienceTarget | null;
  preferredLanguage: string | null;
};

export async function createStakeholder(
  input: StakeholderInput,
): Promise<string> {
  const row = await prisma.stakeholder.create({
    data: input,
    select: { id: true },
  });

  return row.id;
}

export type UpdateStakeholderResult =
  | { ok: true }
  | { ok: false; reason: "not_found" };

export async function updateStakeholder(
  id: string,
  input: StakeholderInput,
): Promise<UpdateStakeholderResult> {
  const updated = await prisma.stakeholder.updateMany({
    where: { id },
    data: input,
  });

  return updated.count === 1 ? { ok: true } : { ok: false, reason: "not_found" };
}

export type RecordBriefShareInput = {
  stakeholderId: string;
  briefId: string;
  /** From the session, server-side. Never from the client. */
  sharedById: string;
  sharedAt: Date;
  note: string | null;
};

export type RecordBriefShareResult =
  | { ok: true; outcome: "created" | "updated" }
  | { ok: false; reason: "stakeholder_not_found" | "brief_not_found" };

/**
 * Log that a person sent a brief to a contact.
 *
 * NOT A STATUS TRANSITION. This writes one `stakeholder_brief` row and nothing
 * else: `Brief.status` is untouched, no audit row is written, and no job is
 * enqueued. Moving a brief to `submitted` or `published` is an explicit
 * Programme Director action and stays that way (AGENTS.md §8.2–8.3).
 *
 * The composite primary key `(stakeholderId, briefId)` means logging the same
 * pair twice is an UPDATE, not a duplicate and not a swallowed constraint
 * error — and the caller is told which happened, so the UI can say "updated"
 * rather than pretending a correction was a new share.
 */
export async function recordBriefShare(
  input: RecordBriefShareInput,
): Promise<RecordBriefShareResult> {
  const [stakeholder, brief] = await Promise.all([
    prisma.stakeholder.findUnique({
      where: { id: input.stakeholderId },
      select: { id: true },
    }),
    prisma.brief.findUnique({
      where: { id: input.briefId },
      select: { id: true },
    }),
  ]);

  if (!stakeholder) return { ok: false, reason: "stakeholder_not_found" };
  if (!brief) return { ok: false, reason: "brief_not_found" };

  const existing = await prisma.stakeholderBrief.findUnique({
    where: {
      stakeholderId_briefId: {
        stakeholderId: input.stakeholderId,
        briefId: input.briefId,
      },
    },
    select: { stakeholderId: true },
  });

  await prisma.stakeholderBrief.upsert({
    where: {
      stakeholderId_briefId: {
        stakeholderId: input.stakeholderId,
        briefId: input.briefId,
      },
    },
    create: {
      stakeholderId: input.stakeholderId,
      briefId: input.briefId,
      sharedById: input.sharedById,
      sharedAt: input.sharedAt,
      note: input.note,
    },
    update: {
      sharedById: input.sharedById,
      sharedAt: input.sharedAt,
      note: input.note,
    },
  });

  return { ok: true, outcome: existing ? "updated" : "created" };
}
