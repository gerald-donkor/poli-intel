"use server";

import { canSubmitFieldObservation, unauthorised } from "@/lib/auth/authorize";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { createFieldSubmission } from "@/lib/db/evidence";
import { recordIngestionSuccess } from "@/lib/db/ingestion-log";
import { EvidenceSourceType } from "@/lib/generated/prisma/enums";
import { sendEvidenceFieldSubmitted } from "@/lib/jobs/client";
import { USAGE_EVENTS } from "@/lib/observability/events";
import { captureUsage } from "@/lib/observability/posthog-server";

import { fieldObservationSchema, type FieldObservationInput } from "./schema";

/**
 * The field observation write path, colocated with the route that uses it.
 *
 * Order, exactly: resolve the session → authorise the role → validate with the
 * shared schema → create or return the existing row → log the ingestion → send
 * the notification event → return a typed result. Authorisation comes before
 * validation so an unauthorised caller learns nothing from validation messages
 * (`server-actions`).
 *
 * IT MAKES NO GEMINI CALL, AND NOTHING IT TOUCHES DOES. No embedding, no
 * summarisation, no classification — the row lands at the schema default
 * `unpublished_internal` and the AI layer is not reachable from here. There is
 * no import from `lib/ai/` in this file, and adding one would be the defect
 * §7 exists to prevent.
 *
 * IT IS SHORT ON PURPOSE. Chunking and the row's shape live in the data layer;
 * the notification lives in an Inngest function. An action that grew either
 * would have absorbed a layer that is not its own.
 */

export type SubmitFieldObservationResult =
  | {
      ok: true;
      evidenceItemId: string;
      /** True when this submission had already landed — a replay, not a second item. */
      deduped: boolean;
      /**
       * False when the Research Officer notice could not be queued. The
       * observation is saved either way; this says whether anybody was told, so
       * the screen can be honest rather than showing a confirmation for work
       * that will never run.
       */
      notified: boolean;
    }
  | { ok: false; refusal: ActionRefusal };

export async function submitFieldObservationAction(
  input: FieldObservationInput,
): Promise<SubmitFieldObservationResult> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return {
      ok: false,
      refusal: unauthorised("Sign in again to send this update."),
    };
  }

  if (!canSubmitFieldObservation(staffUser.role)) {
    return {
      ok: false,
      refusal: unauthorised("Your account cannot send field updates."),
    };
  }

  const parsed = fieldObservationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      refusal: {
        kind: "invalid",
        fieldErrors: toFieldErrors(parsed.error.issues),
      },
    };
  }

  const values = parsed.data;

  const submission = await createFieldSubmission({
    submissionKey: values.submissionKey,
    title: values.title,
    observation: values.observation,
    locationNote: values.locationNote || null,
    // Parsed as a plain date; midday UTC so the stored instant lands on the
    // day the officer chose regardless of which side of UTC they are on.
    observedAt: values.observedAt
      ? new Date(`${values.observedAt}T12:00:00.000Z`)
      : null,
    ingestedById: staffUser.id,
    // No `classification`. The schema default holds it at
    // `unpublished_internal`, and this action never accepts one (§7.3).
  });

  // A replay has already been logged and already been announced. Logging it
  // again would put two ingestion rows behind one observation, and re-sending
  // the event is what the job's idempotency key exists to absorb — but not
  // sending it at all is cheaper and just as correct.
  if (submission.deduped) {
    await captureUsage(
      USAGE_EVENTS.fieldSubmissionCreated,
      {
        evidenceItemId: submission.evidenceItemId,
        deduped: true,
        notified: true,
        chunkCount: submission.chunkCount,
      },
      staffUser,
    );

    return {
      ok: true,
      evidenceItemId: submission.evidenceItemId,
      deduped: true,
      notified: true,
    };
  }

  // The ingestion log is what §12.8's notification reads from, and it is ids,
  // counts and a source name only — never the observation (§7.6). The source
  // name is the title the officer gave it, which is the label they chose.
  await recordIngestionSuccess({
    evidenceItemId: submission.evidenceItemId,
    sourceName: values.title,
    sourceType: EvidenceSourceType.field_data,
    extractedChars: values.observation.length,
    chunkCount: submission.chunkCount,
  });

  const notified = await sendEvidenceFieldSubmitted(submission.evidenceItemId);
  await captureUsage(
    USAGE_EVENTS.fieldSubmissionCreated,
    {
      evidenceItemId: submission.evidenceItemId,
      deduped: false,
      notified,
      chunkCount: submission.chunkCount,
      extractedChars: values.observation.length,
    },
    staffUser,
  );

  return {
    ok: true,
    evidenceItemId: submission.evidenceItemId,
    deduped: false,
    notified,
  };
}

/** Field-mapped Zod issues, in the shape `ActionRefusal["invalid"]` expects. */
function toFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    (fieldErrors[field] ??= []).push(issue.message);
  }

  return fieldErrors;
}
