import { z } from "zod";

/**
 * The review surface's input shapes, shared by the client controls and the
 * Server Actions so the rules exist once (AGENTS.md §10.10).
 *
 * SHAPE ONLY — this module ships to the browser. It describes ids, reason
 * bounds, and the names of the four transitions. It carries NO ROLE, no role
 * list, no transition-permission table, and no flag-blocking rule: who may
 * approve, who may clear a flag, and whether open flags block an approval are
 * answered in `lib/auth/authorize.ts` and inside the write transactions, both
 * of which are `server-only`.
 *
 * That a send-back needs a reason IS shape — it is the same rule the form and
 * the action both enforce, and it says nothing about who may send anything back.
 */

/** Reasons are staff-authored free text, rendered back to staff as text. */
const reason = z.string().trim().min(3, "Say briefly why.").max(500);

export const resolveFlagSchema = z.object({
  flagId: z.uuid(),
  /**
   * Two different outcomes, deliberately not collapsed into one "clear".
   * Resolved: a person checked the claim against a source and it holds.
   * Dismissed: the claim is being let through without that check.
   */
  outcome: z.enum(["resolved", "dismissed"]),
  reason,
});

export type ResolveFlagInput = z.infer<typeof resolveFlagSchema>;

export const reopenFlagSchema = z.object({
  flagId: z.uuid(),
  reason,
});

export type ReopenFlagInput = z.infer<typeof reopenFlagSchema>;

export const BRIEF_TRANSITIONS = [
  "approve",
  "send_back",
  "submit",
  "publish",
] as const;

/** Parsed on its own before authorisation, to pick the predicate to check. */
export const briefTransitionNameSchema = z.enum(BRIEF_TRANSITIONS);

export const changeBriefStatusSchema = z
  .object({
    briefId: z.uuid(),
    transition: briefTransitionNameSchema,
    reason: reason.optional(),
  })
  .refine(
    (value) => value.transition !== "send_back" || value.reason !== undefined,
    {
      path: ["reason"],
      message: "Say what needs changing before sending this back.",
    },
  );

export type ChangeBriefStatusInput = z.infer<typeof changeBriefStatusSchema>;
