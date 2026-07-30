import { serve } from "inngest/next";

import { inngest, inngestFunctions } from "@/lib/jobs";

/**
 * Inngest's endpoint — an external caller's route, and thin by rule
 * (AGENTS.md §5.2). Every line of business logic lives in `lib/jobs/`.
 *
 * There is no login on this path, which is deliberate: Inngest is a machine
 * caller, not a staff member. The control is signature verification against
 * `INNGEST_SIGNING_KEY`, which the SDK performs on every request in Cloud mode
 * (§18, security requirements). No login does not mean no verification.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
