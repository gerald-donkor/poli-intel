import { z } from "zod";

import { Urgency } from "@/lib/generated/prisma/enums";

/**
 * The board's input shape, shared by the drag control and the Server Action so
 * the rules exist once (AGENTS.md §10.10).
 *
 * SHAPE ONLY — this module ships to the browser. It says a reclassification
 * names a signal and one of the four urgency stages. It carries NO ROLE, no role
 * list, and no statement about who may move a card: `canReclassifySignal` lives
 * in `lib/auth/authorize.ts`, which is `server-only`.
 *
 * The urgency values come from the Prisma enum rather than being re-declared as
 * a string union here (§12.7) — one taxonomy, one definition.
 */
export const reclassifySignalSchema = z.object({
  signalId: z.uuid(),
  urgency: z.enum(Urgency),
});

export type ReclassifySignalInput = z.infer<typeof reclassifySignalSchema>;

export const requestRematchSchema = z.object({
  signalId: z.uuid(),
});

export type RequestRematchInput = z.infer<typeof requestRematchSchema>;
