import "server-only";

import { cron } from "inngest";

import { listWhatsappRecipients, readFieldDigest } from "@/lib/db";
import { plainDate } from "@/lib/field/plain-language";
import { whatsappConfig } from "@/lib/whatsapp/client";
import {
  WHATSAPP_DIGEST_CRON,
  WHATSAPP_RECIPIENT_ROLES,
  whatsappDigestWeek,
  whatsappIdempotencyKey,
  whatsappWeekKey,
} from "@/lib/whatsapp/config";
import { sendWhatsAppDigestTemplate } from "@/lib/whatsapp/send";

import { inngest } from "../client";

/**
 * The weekly WhatsApp notification — the outbound half of the Field Officer's
 * digest (spec §3.2's Field Officer row, §5.2 step 6).
 *
 * IT SENDS A NOTIFICATION, NOT THE DIGEST, and that is a platform rule rather
 * than an interaction anybody invented: a business-initiated WhatsApp message
 * outside the 24-hour customer service window must use a provider-approved
 * template, and free-form text is only permitted in reply. So Monday's message
 * says an update is ready; the officer replies; `app/api/whatsapp/webhook`
 * answers with the digest itself. See `lib/whatsapp/config.ts`.
 *
 * ONE WEEKLY CRON, AND NO CADENCE LITERAL APPEARS HERE. `WHATSAPP_DIGEST_CRON`
 * is when this is DELIVERED; per-source cadences live in `lib/radar/sources.ts`
 * and are not this job's business (§14.2).
 *
 * IT SENDS PER RECIPIENT, NOT AS A BATCH — the same failure isolation the
 * morning digest has. One bad number is one `ok: false` and the rest still get
 * theirs (`inngest-jobs` rule 5, applied per recipient).
 *
 * IT READS AND NEVER ACTS. No event is emitted, no status is advanced, nothing
 * is written to the database at all. Acting on a signal is always a human
 * decision (§8.5), and the Brief Generator is not reachable from here (§8.4).
 *
 * NO GEMINI CALL FIRES ON THIS PATH. Nothing here imports `lib/ai/`, and the
 * message is assembled from stored rows by a pure function.
 */
export const sendWhatsappDigest = inngest.createFunction(
  {
    id: "send-whatsapp-digest",
    name: "Send the weekly WhatsApp policy digest",
    triggers: [cron(WHATSAPP_DIGEST_CRON)],
    // One run at a time: a retry overlapping the next week's run would put two
    // notifications on the same handset.
    concurrency: 1,
    retries: 2,
  },
  async ({ step, logger }) => {
    const week = whatsappDigestWeek(new Date());
    const weekKey = whatsappWeekKey(week);

    if (whatsappConfig() === null) {
      // A HANDLED, NAMED OUTCOME, NOT A CRASH (§13.4's shape). A deployment with
      // no WhatsApp credentials must not produce a red failed run every Monday,
      // and this is what makes the feature reviewable before Tropenbos has
      // provisioned an account.
      logger.info("[whatsapp] not configured on this deployment", { weekKey });

      return { outcome: "not_configured" as const, weekKey };
    }

    // The same read `/field` and `/api/field/cache` use, so an officer never
    // gets two different answers to "what happened this week" depending on which
    // surface they looked at. It is read here only to decide whether there is
    // anything worth notifying about — the message itself is composed on reply.
    const digest = await step.run("read-field-digest", () => readFieldDigest());

    // A QUIET WEEK SENDS NOTHING, AND IT IS RECORDED RATHER THAN INFERRED. A
    // weekly "nothing happened" trains people to ignore the channel, and this is
    // the one channel where being ignored means an officer misses the one that
    // mattered. The counts go into the run log, so a quiet week and a broken job
    // are told apart by the run history rather than by anybody's handset.
    if (digest.signals.length === 0 && digest.briefs.length === 0) {
      logger.info("[whatsapp] nothing to report; no notification sent", {
        weekKey,
        signals: 0,
        briefs: 0,
      });

      return { outcome: "quiet" as const, weekKey };
    }

    const recipients = await step.run("resolve-recipients", () =>
      listWhatsappRecipients(WHATSAPP_RECIPIENT_ROLES),
    );

    const weekLabel = plainDate(week.toISOString());
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      // Sequential, one step each. THE STEP ID IS THE IDEMPOTENCY KEY: it
      // carries the week, so re-running the same week replays the memoised step
      // and sends nothing a second time. That is where this job's idempotency
      // has to live — unlike Resend, the Cloud API has no idempotency-key header
      // to lean on, so the key's shape is stated once in
      // `whatsappIdempotencyKey` rather than spelled out at this call site.
      const outcome = await step.run(
        whatsappIdempotencyKey(recipient.id, weekKey),
        async () => {
          const result = await sendWhatsAppDigestTemplate({
            to: recipient.whatsappNumber,
            weekLabel,
          });

          if (result.ok) return { outcome: "sent" as const };

          // REPORTED, NOT SWALLOWED, AND NOT THROWN: throwing would retry the
          // whole function and re-notify everyone who already received theirs.
          // An id, a role and a machine reason — never the number, never the
          // person's name (§7.6, §18: a phone number is personal data).
          logger.warn("[whatsapp] notification failed for one recipient", {
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

    logger.info("[whatsapp] weekly digest run complete", {
      weekKey,
      signals: digest.signals.length,
      briefs: digest.briefs.length,
      recipients: recipients.length,
      sent,
      failed,
    });

    return {
      outcome: "sent" as const,
      weekKey,
      recipients: recipients.length,
      sent,
      failed,
    };
  },
);
