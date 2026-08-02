import { z } from "zod";

import { AudienceTarget } from "@/lib/generated/prisma/enums";

/**
 * The CRM's input shapes, shared by React Hook Form and the Server Actions so
 * the rules exist once (AGENTS.md §10.10).
 *
 * SHAPE ONLY. This module ships to the browser, so it carries no role list, no
 * predicate, and nothing imported from `lib/auth/authorize.ts` — who may manage
 * a contact is answered server-side by `canManageStakeholders`.
 *
 * No `.transform()` anywhere, matching the evidence form: the parsed output is
 * identical to the input, so React Hook Form's field types and the action's
 * argument type are the same object. Empty strings mean "not recorded" and the
 * actions turn them into nulls on the way to the database.
 *
 * `AudienceTarget` comes from the Prisma enum rather than a re-declared string
 * union (§12.7). It is the SIGNAL-side audience taxonomy and is never mapped on
 * to a brief's `BriefAudience` — see the note in `prisma/schema.prisma`.
 */

/**
 * The languages a contact is offered a brief in.
 *
 * A plain `String?` column and a small fixed list here rather than a Prisma
 * enum: the translation assist reads this field, and a migration for two values
 * is not warranted when a third language will inevitably appear.
 */
export const PREFERRED_LANGUAGES = ["English", "Twi"] as const;

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

const stakeholderFields = {
  name: z
    .string()
    .trim()
    .min(2, "Give the contact a name of at least 2 characters.")
    .max(160, "Names are capped at 160 characters."),

  organisation: optionalText(
    200,
    "Organisation names are capped at 200 characters.",
  ),

  role: optionalText(160, "Roles are capped at 160 characters."),

  audienceType: z
    .union([z.enum(AudienceTarget), z.literal("")])
    .optional(),

  preferredLanguage: z
    .union([z.enum(PREFERRED_LANGUAGES), z.literal("")])
    .optional(),
};

export const createStakeholderSchema = z.object(stakeholderFields);

export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>;

export const updateStakeholderSchema = z.object({
  id: z.uuid(),
  ...stakeholderFields,
});

export type UpdateStakeholderInput = z.infer<typeof updateStakeholderSchema>;

/**
 * Logging a share.
 *
 * `sharedById` is deliberately absent and must never be added: the person who
 * logged the share comes from the session, server-side, so the client cannot
 * name someone else.
 *
 * `sharedAt` is a plain `YYYY-MM-DD` because the control is a date input and a
 * share is remembered to the day, not the second. Future dates are rejected —
 * this is a record of something that happened, not a plan.
 */
export const logShareSchema = z.object({
  briefId: z.uuid(),
  stakeholderId: z.uuid({ error: "Choose who this went to." }),
  sharedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD.")
    .refine((value) => {
      const parsed = Date.parse(`${value}T00:00:00`);
      return Number.isFinite(parsed) && parsed <= Date.now();
    }, "Use today's date or a date in the past."),
  note: optionalText(500, "Keep the note under 500 characters."),
});

export type LogShareInput = z.infer<typeof logShareSchema>;
