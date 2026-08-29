import { z } from "zod";

import { EvidenceMatchAssessment } from "@/lib/generated/prisma/enums";

/**
 * Shape-only shared Zod schema for recording an Evidence Match review.
 *
 * Client-visible: carries no roles or authorization logic (AGENTS.md §10.10).
 * Authorisation is enforced inside the Server Action via `canReviewEvidenceMatch`.
 */
export const reviewEvidenceMatchSchema = z.object({
  signalId: z.string().uuid(),
  evidenceItemId: z.string().uuid(),
  assessment: z.enum(EvidenceMatchAssessment),
  note: z
    .string()
    .trim()
    .max(500, "Review note must be 500 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export type ReviewEvidenceMatchInput = z.infer<
  typeof reviewEvidenceMatchSchema
>;
