import "server-only";

import { createElement } from "react";

import FieldSubmissionNotice from "@/emails/field-submission-notice";
import {
  countPendingClassification,
  findFieldSubmissionForNotice,
  listDigestRecipients,
} from "@/lib/db";
import { appBaseUrl } from "@/lib/digest/config";
import { emailConfig } from "@/lib/email/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { plainDate } from "@/lib/field/plain-language";
import { StaffRole } from "@/lib/generated/prisma/enums";

import { evidenceFieldSubmitted, inngest } from "../client";

/**
 * "A Research Officer is notified of each new submission" (AGENTS.md §17.3),
 * which is §12.8's ingestion notification applied to the one ingestion path that
 * starts with a person in a cocoa plot rather than a person at a desk.
 *
 * A JOB, NOT A SEND INSIDE THE ACTION. The officer may be on a two-bar
 * connection about to lose signal, and an inline Resend round-trip would put an
 * email provider's latency between them and the confirmation that their
 * observation is safe. The submission commits, the event goes out, and this runs
 * on its own retries.
 *
 * WHO IT GOES TO: Research Officers, who set classification (§10.4), and the
 * Programme Director, who holds full access and is the person accountable for a
 * governance backlog (§7.5). Not the submitting officer — they already know, and
 * `/field/sent` is where they watch it.
 *
 * IT CARRIES NO OBSERVATION TEXT. The template says so at greater length; the
 * read it is built from (`findFieldSubmissionForNotice`) does not select
 * `fullText`, so there is nothing here to leak (§7.6).
 *
 * IT LINKS AND NEVER ACTS. No classification is set, no status advances,
 * nothing is written to the database at all.
 */
const NOTICE_ROLES: readonly StaffRole[] = [
  StaffRole.research_officer,
  StaffRole.programme_director,
];

export const notifyFieldSubmission = inngest.createFunction(
  {
    id: "notify-field-submission",
    name: "Notify Research Officers of a field submission",
    triggers: [evidenceFieldSubmitted],
    // One run per submission, and a replayed event within the day is the same
    // submission — the id is the whole idempotency story here.
    idempotency: "event.data.evidenceItemId",
    concurrency: 4,
    retries: 2,
  },
  async ({ event, step, logger }) => {
    const { evidenceItemId } = event.data;

    if (emailConfig() === null) {
      // A handled, named outcome, not a crash: a deployment with no Resend key
      // must not produce a red failed run for every field submission. The
      // submission is already in the queue on `/evidence/queue` either way.
      logger.info("[field] email not configured on this deployment", {
        evidenceItemId,
      });

      return { outcome: "not_configured" as const, evidenceItemId };
    }

    const submission = await step.run("read-submission", () =>
      findFieldSubmissionForNotice(evidenceItemId),
    );

    if (!submission) {
      // Deleted between the send and this run. Recorded, not retried into a
      // failure — there is nothing to notify anybody about.
      logger.warn("[field] submission no longer exists; nothing sent", {
        evidenceItemId,
      });

      return { outcome: "not_found" as const, evidenceItemId };
    }

    const pendingClassificationCount = await step.run("count-queue", () =>
      countPendingClassification(),
    );

    // `listDigestRecipients` is "staff users with these roles" and is reused
    // rather than forked: a second query for the same idea is exactly what
    // §12.1 rules out, and its name is the only thing about it that is
    // digest-specific.
    const recipients = await step.run("resolve-recipients", () =>
      listDigestRecipients(NOTICE_ROLES),
    );

    const appUrl = appBaseUrl();
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      // One step each, sequential: Resend's default is 2 requests per second,
      // and the same per-recipient failure isolation the morning digest has —
      // one bad address must not cost the rest their notice.
      const outcome = await step.run(
        `notify-${recipient.id}`,
        async () => {
          const result = await sendTransactionalEmail({
            to: recipient.email,
            subject: `Field update waiting for review — ${submission.title}`,
            react: createElement(FieldSubmissionNotice, {
              recipientName: recipient.name,
              submissionTitle: submission.title,
              submitterName: submission.submitterName ?? "A field officer",
              locationNote: submission.locationNote,
              observedAtLabel: submission.observedAt
                ? plainDate(submission.observedAt)
                : null,
              submittedAtLabel: plainDate(submission.submittedAt),
              pendingClassificationCount,
              appUrl,
            }),
            idempotencyKey: `field-submission/${evidenceItemId}/${recipient.id}`,
          });

          if (result.ok) return { outcome: "sent" as const };

          // Reported, not thrown: throwing would retry the function and
          // re-send everyone who already received theirs. An id, a role and a
          // machine reason — never the address, never the title (§7.6).
          logger.warn("[field] notice failed for one recipient", {
            staffUserId: recipient.id,
            role: recipient.role,
            reason: result.reason,
            statusCode: result.statusCode,
          });

          return { outcome: "failed" as const };
        },
      );

      if (outcome.outcome === "sent") sent += 1;
      else failed += 1;
    }

    logger.info("[field] submission notice run complete", {
      evidenceItemId,
      pendingClassificationCount,
      recipients: recipients.length,
      sent,
      failed,
    });

    return {
      outcome: "sent" as const,
      evidenceItemId,
      recipients: recipients.length,
      sent,
      failed,
    };
  },
);
