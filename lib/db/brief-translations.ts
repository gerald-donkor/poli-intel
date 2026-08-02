import "server-only";

import { z } from "zod";

import type { BriefStatus } from "@/lib/generated/prisma/enums";

import { prisma } from "./client";

/**
 * The translation assist's reads and its one write (§16.6).
 *
 * WHAT IS STORED IS THE BRIEF'S OWN PROSE — the English key messages that were
 * sent, and the Twi that came back. No evidence body text is written here, and
 * none is read to produce it (§7.6).
 *
 * A translation belongs to a BriefVersion, so a new version simply has none. The
 * read below deliberately returns whichever version the newest translation sits
 * on, so the route can tell "translated" from "translated, but the brief has
 * moved on since" rather than showing stale Twi beside fresh English.
 */

/** One key message, as sent and as rendered. */
const storedMessageSchema = z.object({
  kind: z.enum(["executive_summary", "recommendation"]),
  heading: z.string(),
  english: z.string(),
  twi: z.string(),
});

const storedMessagesSchema = z.array(storedMessageSchema);

export type BriefTranslationMessage = z.infer<typeof storedMessageSchema>;

export type BriefTranslationView = {
  id: string;
  /** The version this translation renders — compared against the current one. */
  versionNumber: number;
  language: string;
  messages: BriefTranslationMessage[];
  generatingModel: string;
  promptVersion: string;
  translatedByName: string | null;
  translatedAt: string;
};

export type BriefForTranslation = {
  id: string;
  status: BriefStatus;
  /** The current version — what a translation would be written against. */
  versionId: string;
  versionNumber: number;
  bodyText: string;
  /** The brief's RECORDED evidence set. Ids only — the gate re-reads the rows. */
  evidenceItemIds: string[];
};

/**
 * Everything a translation run needs, read SERVER-SIDE from the brief's own
 * records.
 *
 * Nothing that becomes prompt content comes from the browser: the client sends a
 * brief id, and the key messages are extracted here from the stored `bodyText`.
 * Evidence is returned as IDS — `gateEvidenceForGeneration` does its own fresh
 * read, so an item downgraded since the brief was written is caught there rather
 * than carried past the gate by this one (§7.8).
 */
export async function findBriefForTranslation(
  briefId: string,
): Promise<BriefForTranslation | null> {
  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
    select: {
      id: true,
      status: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, version: true, bodyText: true },
      },
      evidenceSet: {
        orderBy: { addedAt: "asc" },
        select: { evidenceItemId: true },
      },
    },
  });

  const version = brief?.versions[0];

  if (!brief || !version) return null;

  return {
    id: brief.id,
    status: brief.status,
    versionId: version.id,
    versionNumber: version.version,
    bodyText: version.bodyText,
    evidenceItemIds: brief.evidenceSet.map((row) => row.evidenceItemId),
  };
}

/**
 * The newest translation anywhere on this brief, with the version it renders.
 *
 * NOT scoped to the current version, on purpose. A caller that asked only about
 * the current version could not tell "never translated" from "translated before
 * the last edit", and those are different things to say to someone about to hand
 * text to a community.
 */
export async function findLatestTranslationForBrief({
  briefId,
  language,
}: {
  briefId: string;
  language: string;
}): Promise<BriefTranslationView | null> {
  const row = await prisma.briefTranslation.findFirst({
    where: { language, briefVersion: { briefId } },
    orderBy: { briefVersion: { version: "desc" } },
    select: TRANSLATION_SELECT,
  });

  return row ? toView(row) : null;
}

export type SaveTranslationInput = {
  briefVersionId: string;
  language: string;
  messages: BriefTranslationMessage[];
  generatingModel: string;
  promptVersion: string;
  translatedById: string;
};

/**
 * Write this version's translation, REPLACING any it already had.
 *
 * An upsert rather than an insert: re-running the assist renders the same
 * version's same messages, so a second row would be an alternate take on
 * identical English with nothing to choose between them. The actor and the time
 * are overwritten with the run that produced what is now stored, which is what
 * makes "who took this Twi text, and when" answerable.
 *
 * NOTHING ABOUT THE BRIEF MOVES HERE. No status change, no new version, no flag
 * — the brief is exactly as it was (§8.3, §9.5).
 */
export async function saveTranslation(
  input: SaveTranslationInput,
): Promise<BriefTranslationView> {
  const values = {
    messagesJson: input.messages,
    generatingModel: input.generatingModel,
    promptVersion: input.promptVersion,
    translatedById: input.translatedById,
    translatedAt: new Date(),
  };

  const row = await prisma.briefTranslation.upsert({
    where: {
      briefVersionId_language: {
        briefVersionId: input.briefVersionId,
        language: input.language,
      },
    },
    create: {
      briefVersionId: input.briefVersionId,
      language: input.language,
      ...values,
    },
    update: values,
    select: TRANSLATION_SELECT,
  });

  return toView(row);
}

const TRANSLATION_SELECT = {
  id: true,
  language: true,
  messagesJson: true,
  generatingModel: true,
  promptVersion: true,
  translatedAt: true,
  translatedBy: { select: { name: true } },
  briefVersion: { select: { version: true } },
} as const;

type TranslationRow = {
  id: string;
  language: string;
  messagesJson: unknown;
  generatingModel: string;
  promptVersion: string;
  translatedAt: Date;
  translatedBy: { name: string } | null;
  briefVersion: { version: number };
};

/**
 * Re-validated on the way out, exactly as `parseStoredDraft` re-validates a
 * stored generation. A Json column is not a typed column, and a row that no
 * longer parses is reported as having no messages rather than rendered as
 * whatever it happens to hold.
 */
function toView(row: TranslationRow): BriefTranslationView {
  const parsed = storedMessagesSchema.safeParse(row.messagesJson);

  return {
    id: row.id,
    versionNumber: row.briefVersion.version,
    language: row.language,
    messages: parsed.success ? parsed.data : [],
    generatingModel: row.generatingModel,
    promptVersion: row.promptVersion,
    translatedByName: row.translatedBy?.name ?? null,
    translatedAt: row.translatedAt.toISOString(),
  };
}
