"use server";

import { revalidatePath } from "next/cache";

import { canLogResearchGap, canManageResearchGaps, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { createResearchGap, updateResearchGap } from "@/lib/db";

import { logResearchGapSchema, updateResearchGapSchema, type LogResearchGapInput, type UpdateResearchGapInput } from "./schema";

export type ResearchGapActionResult =
  | { ok: true; id: string }
  | { ok: false; refusal: ActionRefusal };

export async function logResearchGapAction(input: LogResearchGapInput): Promise<ResearchGapActionResult> {
  const staffUser = await getCurrentStaffUser();
  if (!staffUser) return { ok: false, refusal: unauthorised("Sign in to log a research gap.") };
  if (!canLogResearchGap(staffUser.role)) return { ok: false, refusal: unauthorised("Logging research gaps is available to Policy & Advocacy, Research, and Programme Director roles.") };
  const parsed = logResearchGapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, refusal: { kind: "invalid", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> } };
  const gap = await createResearchGap({ ...parsed.data, loggedById: staffUser.id });
  revalidatePath("/evidence"); revalidatePath("/evidence/gaps");
  if (gap.signalId) revalidatePath(`/signals/${gap.signalId}`);
  return { ok: true, id: gap.id };
}

export async function updateResearchGapAction(input: UpdateResearchGapInput): Promise<ResearchGapActionResult> {
  const staffUser = await getCurrentStaffUser();
  if (!staffUser) return { ok: false, refusal: unauthorised("Sign in to update a research gap.") };
  if (!canManageResearchGaps(staffUser.role)) return { ok: false, refusal: unauthorised("Only Research Officers and the Programme Director can manage research gaps.") };
  const parsed = updateResearchGapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, refusal: { kind: "invalid", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> } };
  const result = await updateResearchGap({ ...parsed.data, actorId: staffUser.id });
  if (!result.ok) return { ok: false, refusal: { kind: "invalid", fieldErrors: { form: [result.reason === "unknown_gap" ? "That research gap no longer exists." : "That evidence item no longer exists."] } } };
  revalidatePath("/evidence"); revalidatePath("/evidence/gaps");
  if (result.gap.signalId) revalidatePath(`/signals/${result.gap.signalId}`);
  return { ok: true, id: result.gap.id };
}
