import { z } from "zod";

import { InfluenceEventType } from "@/lib/generated/prisma/enums";

/**
 * The Impact Tracker's input shapes, shared by React Hook Form and the Server
 * Actions so the rules exist once (AGENTS.md §10.10).
 *
 * SHAPE ONLY. This module ships to the browser, so it carries no role list, no
 * predicate, and nothing imported from `lib/auth/authorize.ts` — who may log an
 * event, and who may confirm one, are answered server-side by
 * `canLogInfluenceEvent` and `canVerifyInfluenceEvent`.
 *
 * `InfluenceEventType` comes from the Prisma enum rather than a re-declared
 * string union (§12.7).
 *
 * No `.transform()` anywhere, matching the CRM form: the parsed output is
 * identical to the input, so React Hook Form's field types and the action's
 * argument type are the same object. Empty strings mean "not recorded" and the
 * action turns them into nulls on the way to the database.
 */

/** Caps, so an untrusted string cannot become an unbounded column. */
export const INFLUENCE_DESCRIPTION_MAX_CHARS = 600;
export const INFLUENCE_QUOTE_MAX_CHARS = 400;
export const INFLUENCE_SOURCE_TITLE_MAX_CHARS = 300;

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

export const logInfluenceEventSchema = z.object({
  briefId: z.uuid({ error: "Choose which brief this is about." }),

  eventType: z.enum(InfluenceEventType, {
    error: "Choose what kind of record this is.",
  }),

  description: z
    .string()
    .trim()
    .min(10, "Say what happened, in at least 10 characters.")
    .max(
      INFLUENCE_DESCRIPTION_MAX_CHARS,
      `Keep the description under ${INFLUENCE_DESCRIPTION_MAX_CHARS} characters.`,
    ),

  /**
   * The citing document's URL.
   *
   * Optional, because plenty of real influence has no link — a dialogue outcome
   * a person was in the room for is still a record. Where one is given it must
   * be an absolute http(s) URL: it is stored, rendered as a link, and used as
   * the deduplication key (§18).
   */
  sourceDocument: z
    .union([
      z.url({
        protocol: /^https?$/,
        error: "Use a full web address starting http:// or https://.",
      }),
      z.literal(""),
    ])
    .optional(),

  sourceTitle: optionalText(
    INFLUENCE_SOURCE_TITLE_MAX_CHARS,
    `Keep the document title under ${INFLUENCE_SOURCE_TITLE_MAX_CHARS} characters.`,
  ),

  /**
   * The verbatim line from the citing document.
   *
   * This is the string the screen sets in the serif, because it is material the
   * product did not author (§11.6). The description above is not.
   */
  quotedText: optionalText(
    INFLUENCE_QUOTE_MAX_CHARS,
    `Keep the quoted line under ${INFLUENCE_QUOTE_MAX_CHARS} characters.`,
  ),

  /**
   * When it happened, to the day.
   *
   * A record of something that happened, not a plan, so a future date is
   * rejected — the same rule the share log applies.
   */
  detectedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD.")
    .refine((value) => {
      const parsed = Date.parse(`${value}T00:00:00Z`);
      return Number.isFinite(parsed) && parsed <= Date.now();
    }, "Use today's date or a date in the past."),
});

export type LogInfluenceEventInput = z.infer<typeof logInfluenceEventSchema>;

/**
 * Confirming an event.
 *
 * The id and nothing else. `verifiedById` is deliberately absent and must never
 * be added: who confirmed it comes from the session, server-side, so the client
 * cannot name someone else as the person who vouched for a donor-facing claim.
 */
export const verifyInfluenceEventSchema = z.object({ eventId: z.uuid() });

export type VerifyInfluenceEventInput = z.infer<
  typeof verifyInfluenceEventSchema
>;

export const QUARTERLY_NARRATIVE_MAX_CHARS = 3000;

const narrativeField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(
      QUARTERLY_NARRATIVE_MAX_CHARS,
      `Keep ${label.toLowerCase()} under ${QUARTERLY_NARRATIVE_MAX_CHARS} characters.`,
    );

/** Shape only; role permissions remain in the server-only action. */
export const quarterlyNarrativeSchema = z.object({
  quarterKey: z
    .string()
    .regex(/^\d{4}-Q[1-4]$/, "Use a quarter in the form YYYY-Q1 through YYYY-Q4."),
  wins: narrativeField("Policy wins and influence"),
  missedWindows: narrativeField("Missed windows"),
  evidenceGaps: narrativeField("Evidence gaps"),
  systemImprovement: narrativeField("System and workflow improvement"),
});

export type QuarterlyNarrativeInput = z.infer<typeof quarterlyNarrativeSchema>;
