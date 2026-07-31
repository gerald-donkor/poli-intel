import { z } from "zod";

import {
  BRIEF_POLICY_TEXT_MAX_CHARS,
  GENERATION_EVIDENCE_CONTEXT_SIZE,
} from "@/lib/briefs/generation-limits";
import { BriefAudience, BriefType } from "@/lib/generated/prisma/enums";

/**
 * The generation request's shape, shared by the form and `startBriefGeneration`
 * (AGENTS.md §10.10).
 *
 * SHAPE ONLY. Who may generate is answered server-side by `canGenerateBrief`,
 * and which evidence may reach the model is answered server-side by the
 * classification gate, against rows re-read from the database. Neither question
 * is answerable here, and neither may be encoded here — this module ships to the
 * browser.
 *
 * The two enums come from the Prisma enums rather than re-declared string unions
 * (§12.7), so the form can never offer a value the database cannot hold.
 */
export const generateBriefSchema = z.object({
  policyText: z
    .string()
    .trim()
    .min(200, "Paste the policy text the brief should respond to.")
    .max(
      BRIEF_POLICY_TEXT_MAX_CHARS,
      `Keep the policy text under ${BRIEF_POLICY_TEXT_MAX_CHARS.toLocaleString()} characters.`,
    ),
  briefType: z.enum(BriefType, { error: "Choose a brief type." }),
  audience: z.enum(BriefAudience, { error: "Choose an audience." }),
  evidenceItemIds: z
    .array(z.uuid())
    .min(1, "Select at least one evidence item.")
    .max(
      GENERATION_EVIDENCE_CONTEXT_SIZE,
      `Select at most ${GENERATION_EVIDENCE_CONTEXT_SIZE} evidence items.`,
    ),
});

export type GenerateBriefInput = z.infer<typeof generateBriefSchema>;
