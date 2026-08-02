import "server-only";

import { createElement } from "react";

import { cron } from "inngest";

import MorningDigest from "@/emails/morning-digest";
import { listDigestRecipients, readDigestWindow } from "@/lib/db";
import { buildMorningDigest } from "@/lib/digest/build";
import {
  DIGEST_CRON,
  DIGEST_RECIPIENT_ROLES,
  appBaseUrl,
  digestDate,
  digestIdempotencyKey,
  digestWindowFor,
} from "@/lib/digest/config";
import { emailConfig } from "@/lib/email/client";
import { sendTransactionalEmail } from "@/lib/email/send";

import { inngest } from "../client";

/**
 * The morning digest — the board coming to the reader.
 *
 * Phase 2's goal is not the kanban, it is the behaviour change the kanban
 * enables: staff shift from hunting for signals to reviewing a curated digest
 * (spec §7). Without this, everything the radar classifies at 05:00 waits for
 * somebody to remember to open `/signals`.
 *
 * ONE DAILY CRON, AND NO CADENCE LITERAL APPEARS HERE. `DIGEST_CRON` is when the
 * digest is DELIVERED; per-source cadences live in `lib/radar/sources.ts` and
 * are not this job's business (§14.2).
 *
 * IT SENDS PER RECIPIENT, NOT AS A BATCH. Resend's batch endpoint is atomic —
 * one malformed address fails the whole morning for everyone. One `step.run` per
 * recipient is the same failure isolation `inngest-jobs` rule 5 applies to
 * sources, at a staff-list size where the job-budget argument for batching does
 * not bite (§14.6).
 *
 * IT LINKS AND NEVER ACTS. No event is emitted, no status is advanced, no brief
 * is approved, nothing is written to the database at all. Acting on a signal is
 * always a human decision (§8.5), and the Brief Generator is not reachable from
 * here (§8.4).
 */
export const sendMorningDigest = inngest.createFunction(
  {
    id: "send-morning-digest",
    name: "Send the morning digest",
    triggers: [cron(DIGEST_CRON)],
    // One run at a time: a retry overlapping the next day's run would send two
    // windows to the same inbox within a minute.
    concurrency: 1,
    retries: 2,
  },
  async ({ step, logger }) => {
    const window = digestWindowFor(new Date());
    const isoDate = digestDate(window.end);

    if (emailConfig() === null) {
      // A HANDLED, NAMED OUTCOME, NOT A CRASH (§13.4's shape). A deployment with
      // no Resend key must not produce a red failed run every morning.
      logger.info("[digest] not configured on this deployment", { isoDate });

      return { outcome: "not_configured" as const, isoDate };
    }

    const reads = await step.run("read-digest-window", () =>
      readDigestWindow(window.start, window.end),
    );

    // A QUIET MORNING SENDS NOTHING, AND IT IS RECORDED RATHER THAN INFERRED. A
    // daily "nothing happened" trains people to stop opening it. The three
    // counts and the window go into the run log, so a quiet day and a broken job
    // are told apart by the run history rather than by the reader's inbox.
    if (
      reads.signals.length === 0 &&
      reads.briefs.length === 0 &&
      reads.pendingClassificationCount === 0
    ) {
      logger.info("[digest] nothing to report; no email sent", {
        isoDate,
        windowStart: window.start.toISOString(),
        windowEnd: window.end.toISOString(),
        signals: 0,
        briefsAwaitingDecision: 0,
        pendingClassification: 0,
        sourcesChecked: reads.radar.sourcesChecked,
        sourcesFailed: reads.radar.sourcesFailed,
      });

      return { outcome: "quiet" as const, isoDate };
    }

    const recipients = await step.run("resolve-recipients", () =>
      listDigestRecipients(DIGEST_RECIPIENT_ROLES),
    );

    const appUrl = appBaseUrl();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const recipient of recipients) {
      // Sequential, one step each: Resend's default is 2 requests per second,
      // and a staff list this size has no reason to race it.
      const outcome = await step.run(
        `send-digest-${recipient.id}`,
        async () => {
          const props = buildMorningDigest({
            recipient,
            reads,
            window,
            appUrl,
          });

          // Nothing in this person's sections — see `buildMorningDigest`.
          if (props === null) return { outcome: "skipped" as const };

          const result = await sendTransactionalEmail({
            to: recipient.email,
            subject: `EviBrief morning digest — ${isoDate}`,
            // `createElement` rather than JSX so this file stays a `.ts` job
            // alongside its siblings. Resend renders it to HTML and plain text.
            react: createElement(MorningDigest, props),
            idempotencyKey: digestIdempotencyKey(recipient.id, isoDate),
          });

          if (result.ok) return { outcome: "sent" as const };

          // REPORTED, NOT SWALLOWED, AND NOT THROWN: throwing would retry the
          // whole function and re-send everyone who already received theirs.
          // An id, a role and a machine reason — never the address, never the
          // person's name, never the subject's contents (§7.6, §13.9).
          logger.warn("[digest] send failed for one recipient", {
            staffUserId: recipient.id,
            role: recipient.role,
            reason: result.reason,
            statusCode: result.statusCode,
          });

          return { outcome: "failed" as const, reason: result.reason };
        },
      );

      if (outcome.outcome === "sent") sent += 1;
      else if (outcome.outcome === "skipped") skipped += 1;
      else failed += 1;
    }

    logger.info("[digest] morning digest run complete", {
      isoDate,
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
      signals: reads.signals.length,
      briefsAwaitingDecision: reads.briefs.length,
      pendingClassification: reads.pendingClassificationCount,
      sourcesChecked: reads.radar.sourcesChecked,
      sourcesFailed: reads.radar.sourcesFailed,
      recipients: recipients.length,
      sent,
      skipped,
      failed,
    });

    return {
      outcome: "sent" as const,
      isoDate,
      recipients: recipients.length,
      sent,
      skipped,
      failed,
    };
  },
);
