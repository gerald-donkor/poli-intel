"use client";

import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toast";
import type { AnnualStrategicReport } from "@/lib/db";
import { TBI_PARTNER_COUNTRIES, getPartnerByCode } from "@/lib/impact/network-partners";

export function annualReportMarkdown(report: AnnualStrategicReport): string {
  const { metrics } = report;
  const lines = [
    "# Tropenbos Ghana · Annual Strategic Impact Brief",
    "", `## Reporting year`, "", `**${metrics.year}**`, "",
    "## Strategic metrics", "",
    `- **Policy windows captured:** ${percent(metrics.annualCaptureRate)} (${metrics.immediateSignalsCaptured} of ${metrics.immediateSignalsCount} Immediate signals)`,
    `- **Briefs produced:** ${metrics.totalBriefs}`,
    `- **Confirmed influence records:** ${metrics.verifiedEventsCount}`,
    `- **Evidence match quality:** ${percent(metrics.overallMatchQualityPercentage)}`,
    "", "## 2030 target contribution", "",
    `- **Sustainably managed landscapes:** ${number(metrics.totalHectaresInfluenced)} ha of the 20,000,000 ha Tropenbos International benchmark.`,
    `- **Climate-resilient livelihoods:** ${number(metrics.totalPeopleBenefited)} people of the 5,000,000 people benchmark.`,
    "", "## TBI Network leverage", "",
    `- **Partner country coverage:** ${metrics.networkPartnerAdoptionsCount} of ${TBI_PARTNER_COUNTRIES.length} partner programmes recorded an adoption, pilot, or reference.`,
    ...metrics.partnerCountryCoverage.filter((partner) => partner.count > 0).map((partner) => `- **${partner.name}:** ${partner.count} confirmed exchange${partner.count === 1 ? "" : "s"}.`),
    "", "## Confirmed influence portfolio", "",
    ...(report.events.length ? report.events.flatMap((event) => [
      `### ${event.briefTitle}`,
      event.description,
      `- Outcome recorded: ${event.detectedAt.slice(0, 10)}`,
      ...(event.sourceDocument ? [`- Source: [${event.sourceTitle ?? "Source document"}](${event.sourceDocument})`] : []),
      ...(event.hectaresImpacted !== null ? [`- Landscape estimate: ${number(event.hectaresImpacted)} ha`] : []),
      ...(event.peopleImpacted !== null ? [`- Livelihood estimate: ${number(event.peopleImpacted)} people`] : []),
      ...(event.adaptedCountries.length ? [`- Network exchange: ${event.adaptedCountries.map((code) => getPartnerByCode(code)?.country ?? code).join(", ")}`] : []), "",
    ]) : ["No confirmed influence records were verified in this reporting year.", ""]),
    "---", "This brief is assembled from confirmed EviBrief records. Estimates are included only after a Programme Director confirms the associated influence event.",
  ];
  return lines.join("\n");
}

export function ExportAnnualReport({ report }: { report: AnnualStrategicReport }) {
  async function copy() {
    try { await navigator.clipboard.writeText(annualReportMarkdown(report)); notify.success("Annual brief copied", "The Markdown brief is ready for a network assembly or donor update."); }
    catch { notify.warning("Copy unavailable", "Your browser did not allow clipboard access. Use a supported browser to copy the brief."); }
  }
  return <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={copy}><CopyIcon data-icon="inline-start" aria-hidden="true" />Copy annual strategic brief</Button>;
}

function number(value: number) { return value.toLocaleString("en-GB", { maximumFractionDigits: 0 }); }
function percent(value: number | null) { return value === null ? "Not yet available" : `${value}%`; }
