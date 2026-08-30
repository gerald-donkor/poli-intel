"use client";

import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { notify } from "@/components/ui/toast";
import type {
  QuarterlyImpactReport,
  QuarterlyNarrativeView,
} from "@/lib/db";
import type { Quarter } from "@/lib/impact/config";

import {
  DETECTION_METHOD_LABELS,
  formatInfluenceDate,
  INFLUENCE_EVENT_TYPE_LABELS,
} from "./labels";
import {
  BRIEF_AUDIENCE_LABELS,
} from "./scorecard-labels";

export function donorReportMarkdown({
  quarter,
  report,
  narrative,
}: {
  quarter: Quarter;
  report: QuarterlyImpactReport;
  narrative: QuarterlyNarrativeView | null;
}): string {
  const { metrics } = report;
  const lines = [
    "# Tropenbos Ghana · EviBrief Quarterly Impact Report",
    "",
    "## Reporting period",
    "",
    `**${quarter.label}** · ${formatReportDate(quarter.start)}–${formatReportDate(new Date(quarter.end.getTime() - 1))}`,
    "",
    "## Operational & strategic scorecard",
    "",
    `- **Policy signals monitored:** ${metrics.signalsCount} (Immediate: ${metrics.urgencyCounts.immediate}; Near-term: ${metrics.urgencyCounts.near_term}; Horizon: ${metrics.urgencyCounts.horizon}; Watch: ${metrics.urgencyCounts.watch})`,
    `- **Median brief turnaround:** ${formatHours(metrics.turnaroundHoursMedian)} (institutional target: under 4 hours)`,
    `- **Evidence match quality:** ${formatPercent(metrics.evidenceMatchQuality)} (${metrics.evidenceReviewsRelevant} relevant assessments of ${metrics.evidenceReviewsTotal}; benchmark: above 80%)`,
    `- **Immediate policy-window capture:** ${formatPercent(metrics.policyWindowCaptureRate)} (${metrics.immediateSignalsCaptured} of ${metrics.immediateSignalsTotal} Immediate signals associated with a reviewed, submitted, or published brief)`,
    `- **Brief workflow:** ${metrics.briefsCount} active brief${metrics.briefsCount === 1 ? "" : "s"} (Draft: ${metrics.briefStatusCounts.draft}; Reviewed: ${metrics.briefStatusCounts.reviewed}; Submitted: ${metrics.briefStatusCounts.submitted}; Published: ${metrics.briefStatusCounts.published})`,
    "",
    "### Audience coverage",
    "",
    ...Object.entries(metrics.audienceDistribution).map(
      ([audience, count]) => `- **${BRIEF_AUDIENCE_LABELS[audience as keyof typeof BRIEF_AUDIENCE_LABELS]}:** ${count}`,
    ),
    "",
    "## Staff qualitative reflection",
    "",
    ...(narrative
      ? [
          `### Policy wins & influence\n${narrative.wins}`,
          `### Missed windows\n${narrative.missedWindows}`,
          `### Evidence gaps (ingestion priorities)\n${narrative.evidenceGaps}`,
          `### System & workflow improvements\n${narrative.systemImprovement}`,
        ]
      : ["No staff-authored quarterly evaluation has been recorded for this period."]),
    "",
    "## Confirmed influence records",
    "",
    ...(report.events.length > 0
      ? report.events.flatMap((event) => [
          `### ${INFLUENCE_EVENT_TYPE_LABELS[event.eventType]} · ${event.briefTitle}`,
          event.description,
          ...(event.quotedText ? [`> ${event.quotedText}`] : []),
          `- Recorded: ${formatInfluenceDate(event.detectedAt)} · ${DETECTION_METHOD_LABELS[event.detectionMethod]}${event.verifiedByName ? ` · confirmed by ${event.verifiedByName}` : ""}`,
          ...(event.sourceDocument
            ? [`- Source: [${event.sourceTitle ?? "Source document"}](${event.sourceDocument})`]
            : []),
          "",
        ])
      : ["No confirmed influence records were recorded for this period.", ""]),
    "## Cited evidence knowledge-base items",
    "",
    ...(report.evidence.length > 0
      ? report.evidence.map(
          (item) =>
            `- **${item.citationKey}** — ${item.title} (${item.eventCount} confirmed record${item.eventCount === 1 ? "" : "s"})`,
        )
      : ["No evidence items are linked to the confirmed influence records for this period."]),
    "",
    "---",
    "This report is assembled from stored EviBrief records. Confirmed influence records are included; unconfirmed leads are excluded.",
  ];

  return lines.join("\n");
}

export function ExportDonorReport(props: {
  quarter: Quarter;
  report: QuarterlyImpactReport;
  narrative: QuarterlyNarrativeView | null;
}) {
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(donorReportMarkdown(props));
      notify.success("Donor summary copied", "The Markdown report is ready to paste into your progress update.");
    } catch {
      notify.warning("Copy unavailable", "Your browser did not allow clipboard access. Select and copy the report from a supported browser.");
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button type="button" variant="outline" size="sm" onClick={copyReport}>
          <CopyIcon aria-hidden="true" />
          Copy donor report
          </Button>
        }
      />
      <TooltipContent>Copy an institutional Markdown summary to the clipboard.</TooltipContent>
    </Tooltip>
  );
}

function formatHours(value: number | null) {
  if (value === null) return "Not yet available";
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })} hours`;
}

function formatPercent(value: number | null) {
  return value === null ? "Not yet available" : `${value}%`;
}

function formatReportDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
