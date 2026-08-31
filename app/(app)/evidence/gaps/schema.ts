import { z } from "zod";

import {
  ImpactArea,
  ResearchGapPriority,
  ResearchGapStatus,
} from "@/lib/generated/prisma/enums";

/** Shape-only schemas shared by gap dialogs and their Server Actions. */
export const logResearchGapSchema = z.object({
  signalId: z.string().uuid().optional().nullable(),
  impactArea: z.enum(ImpactArea),
  topic: z.string().trim().min(3, "Give the gap a topic of at least 3 characters.").max(300),
  description: z.string().trim().min(10, "Add enough context for a Research Officer to act.").max(3000),
  priority: z.enum(ResearchGapPriority).default(ResearchGapPriority.medium),
});

export const updateResearchGapSchema = z.object({
  id: z.string().uuid(),
  priority: z.enum(ResearchGapPriority).optional(),
  status: z.enum(ResearchGapStatus).optional(),
  resolutionNotes: z.string().trim().max(3000).optional().nullable(),
  resolvedEvidenceItemId: z.string().uuid().optional().nullable(),
}).refine((input) => input.priority || input.status || input.resolutionNotes !== undefined || input.resolvedEvidenceItemId !== undefined, {
  message: "Choose a change to save.", path: ["form"],
});

export type LogResearchGapInput = z.infer<typeof logResearchGapSchema>;
export type UpdateResearchGapInput = z.infer<typeof updateResearchGapSchema>;
