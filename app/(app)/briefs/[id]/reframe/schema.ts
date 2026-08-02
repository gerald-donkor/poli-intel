import { z } from "zod";

import { BriefAudience } from "@/lib/generated/prisma/enums";

/**
 * An audience switch's request shape (AGENTS.md §10.10).
 *
 * SHAPE ONLY, and there is very little of it — which is the security property,
 * not an omission. The client sends a brief id and an audience and nothing else:
 * the policy text, the evidence set, the brief type and the version being
 * reframed are all read server-side from the brief's own records, so nothing
 * that reaches the model comes from the browser.
 *
 * Who may reframe is answered server-side by `canGenerateBrief`; whether the
 * brief is still `draft` is answered by `isEditableStatus` inside the action and
 * again inside the commit transaction; which evidence may reach the model is
 * answered by the classification gate against rows re-read from the database.
 * None of those questions is answerable here, and none may be encoded here —
 * this module ships to the browser.
 */
export const reframeBriefSchema = z.object({
  briefId: z.uuid(),
  audience: z.enum(BriefAudience, { error: "Choose an audience." }),
});

export type ReframeBriefInput = z.infer<typeof reframeBriefSchema>;
