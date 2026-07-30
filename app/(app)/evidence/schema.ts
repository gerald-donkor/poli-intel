import { z } from "zod";

import { Classification } from "@/lib/generated/prisma/enums";

/**
 * The classification form's shape, shared by the queue panel and the classify
 * Server Action (AGENTS.md §10.10).
 *
 * SHAPE ONLY — which roles may classify is a server-only question and is
 * answered by `canChangeEvidenceClassification`, never here. This module ships
 * to the browser.
 *
 * The three values come from the Prisma enum rather than a re-declared string
 * union, so a badge can never render a state the database cannot hold (§12.7).
 */
export const classifyEvidenceSchema = z.object({
  evidenceItemId: z.uuid(),
  classification: z.enum(Classification, {
    error: "Choose a classification.",
  }),
  reason: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters.")
    .optional(),
});

export type ClassifyEvidenceInput = z.infer<typeof classifyEvidenceSchema>;
