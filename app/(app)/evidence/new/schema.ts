import { z } from "zod";

import {
  EvidenceSourceType,
  ImpactArea,
} from "@/lib/generated/prisma/enums";

/**
 * The upload form's shape, shared by the Server Action and React Hook Form so
 * the rules exist once (AGENTS.md §10.10).
 *
 * SHAPE ONLY. This module ships to the browser, so it carries no role list, no
 * predicate, and no authorisation logic — those live in `lib/auth/authorize.ts`,
 * which is server-only.
 *
 * `classification` is deliberately absent and must never be added. The schema
 * default in `prisma/schema.prisma` is the only way an item's classification is
 * first set (§7.3); a field here would be a client-supplied path around the
 * governance gate.
 *
 * No `.transform()` anywhere: keeping the parsed output identical to the input
 * means React Hook Form's field types and the action's argument type are the
 * same object. `authors` is therefore a comma-separated string here and is
 * split into an array inside the action.
 */

const currentYear = new Date().getFullYear();

export const evidenceMetadataSchema = z.object({
  researchGapId: z.string().uuid().optional(),
  title: z
    .string()
    .trim()
    .min(3, "Give the document a title of at least 3 characters.")
    .max(300, "Titles are capped at 300 characters."),

  authors: z
    .string()
    .trim()
    .max(500, "Author lists are capped at 500 characters.")
    .optional(),

  year: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d{4}$/.test(value) &&
          Number(value) >= 1900 &&
          Number(value) <= currentYear + 1),
      `Use a four-digit year between 1900 and ${currentYear + 1}.`,
    )
    .optional(),

  sourceType: z.enum(EvidenceSourceType, {
    error: "Choose what kind of source this is.",
  }),

  country: z
    .string()
    .trim()
    .max(100, "Country names are capped at 100 characters.")
    .optional(),

  impactArea: z.union([z.enum(ImpactArea), z.literal("")]).optional(),

  citationKey: z
    .string()
    .trim()
    .min(3, "Give the item a citation key of at least 3 characters.")
    .max(80, "Citation keys are capped at 80 characters.")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
      "Use letters, digits, dots, hyphens, and underscores only.",
    ),

  sourceUrl: z
    .union([z.url("Enter a full URL, including https://"), z.literal("")])
    .optional(),

  sourceFileName: z
    .string()
    .trim()
    .min(1, "Choose a document to upload.")
    .max(300),
});

export type EvidenceMetadataInput = z.infer<typeof evidenceMetadataSchema>;
