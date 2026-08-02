"use server";

import { canRequestEvidenceRematch, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { sendSignalRematchRequested } from "@/lib/jobs/client";

import { requestRematchSchema, type RequestRematchInput } from "../schema";

/**
 * Asking the Evidence Matcher to run again on this signal.
 *
 * IT QUEUES A JOB AND RETURNS. No retrieval, no rerank, and NO GEMINI CALL runs
 * inline: a Server Action that held a request open across a model call would
 * have absorbed the job layer, and a rate limit mid-call would surface as a
 * hung form (AGENTS.md §5.3, §14.1, `server-actions`).
 *
 * The event carries the signal id and nothing else. The job re-reads the signal,
 * re-runs the query, and re-judges every candidate's classification through the
 * gate — nothing about eligibility is decided here or carried in the payload
 * (§7.6, `evidence-governance`).
 *
 * IT PROMISES ONLY WHAT IT DID. The result says "queued", the panel says
 * "queued", and neither pretends to have a match set it does not have. A send
 * that failed is reported as a failure, because unlike the classification event
 * there is no sweep behind this one to quietly put it right.
 */

export type RequestRematchResult =
  | { ok: true }
  | { ok: false; refusal: ActionRefusal };

export async function requestEvidenceRematchAction(
  input: RequestRematchInput,
): Promise<RequestRematchResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return { ok: false, refusal: unauthorised("Sign in to re-match a signal.") };
  }

  if (!canRequestEvidenceRematch(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised(
        "Re-matching evidence is restricted to Research, Policy & Advocacy Officers and the Programme Director.",
      ),
    };
  }

  const parsed = requestRematchSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: { form: ["That signal could not be identified."] },
      },
    };
  }

  const queued = await sendSignalRematchRequested(parsed.data.signalId);

  if (!queued) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: {
          form: ["The re-match could not be queued. Try again in a moment."],
        },
      },
    };
  }

  return { ok: true };
}
