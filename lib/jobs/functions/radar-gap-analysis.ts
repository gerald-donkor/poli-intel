import "server-only";

import { createElement } from "react";

import { cron } from "inngest";

import RadarGapAnalysisEmail from "@/emails/radar-gap-analysis";
import { listDigestRecipients } from "@/lib/db";
import { appBaseUrl } from "@/lib/digest/config";
import { emailConfig } from "@/lib/email/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  radarGapIdempotencyKey,
  RADAR_GAP_CRON,
  RADAR_GAP_RECIPIENT_ROLES,
  radarGapWeekKey,
  radarGapWindowFor,
} from "@/lib/radar/gap-config";
import { readRadarGapReport } from "@/lib/radar/gap-analysis";

import { inngest } from "../client";

/**
 * The weekly Policy Radar gap analysis.
 *
 * This is a source-health email, not a product workflow. It reads RadarRun
 * counts, sends a compact report to the internal digest roles, and stops. No
 * signal status changes, no matcher reruns, and no draft generation happen on
 * this path.
 */
export const sendRadarGapAnalysis = inngest.createFunction(
  {
    id: "send-radar-gap-analysis",
    name: "Send the weekly radar gap analysis",
    triggers: [cron(RADAR_GAP_CRON)],
    concurrency: 1,
    retries: 2,
  },
  async ({ step, logger }) => {
    const window = radarGapWindowFor(new Date());
    const weekKey = radarGapWeekKey(window.end);

    const report = await step.run("build-radar-gap-report", () =>
      readRadarGapReport(window),
    );

    if (emailConfig() === null) {
      logger.info("[radar-gap] not configured on this deployment", {
        weekKey,
        sources: report.totals.sources,
        runs: report.totals.runs,
        failed: report.totals.failed,
        notChecked: report.totals.notChecked,
      });

      return { outcome: "not_configured" as const, weekKey };
    }

    const recipients = await step.run("resolve-recipients", () =>
      listDigestRecipients(RADAR_GAP_RECIPIENT_ROLES),
    );

    if (recipients.length === 0) {
      logger.info("[radar-gap] no recipients found", {
        weekKey,
        sources: report.totals.sources,
        runs: report.totals.runs,
        failed: report.totals.failed,
        notChecked: report.totals.notChecked,
      });

      return { outcome: "no_recipients" as const, weekKey };
    }

    const appUrl = appBaseUrl();
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const outcome = await step.run(
        `send-radar-gap-${recipient.id}`,
        async () => {
          const result = await sendTransactionalEmail({
            to: recipient.email,
            subject: `EviBrief weekly radar gap analysis — ${weekKey}`,
            react: createElement(RadarGapAnalysisEmail, {
              recipientName: recipient.name,
              appUrl,
              report,
            }),
            idempotencyKey: radarGapIdempotencyKey(recipient.id, weekKey),
          });

          if (result.ok) return { outcome: "sent" as const };

          logger.warn("[radar-gap] send failed for one recipient", {
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

    logger.info("[radar-gap] weekly gap analysis run complete", {
      weekKey,
      sources: report.totals.sources,
      runs: report.totals.runs,
      signalsCreated: report.totals.signalsCreated,
      failedSources: report.totals.failed,
      notCheckedSources: report.totals.notChecked,
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
