import Link from "next/link";

import type { AnnualStrategicReport } from "@/lib/db";
import { TBI_PARTNER_COUNTRIES } from "@/lib/impact/network-partners";

import { ExportAnnualReport } from "./export-annual-report";

const HECTARE_TARGET = 20_000_000;
const PEOPLE_TARGET = 5_000_000;

export function AnnualReport({ report, years }: { report: AnnualStrategicReport; years: number[] }) {
  const { metrics } = report;
  return <section className="bg-card border-line rounded-card flex min-w-0 flex-col gap-6 border p-4 shadow-raised tablet:p-6" aria-labelledby="annual-impact-heading">
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3"><div><h2 id="annual-impact-heading" className="text-ink text-[16px] font-semibold">Annual strategic evaluation · {metrics.year}</h2><p className="text-ink-3 mt-1 max-w-[72ch] text-[13px] leading-relaxed">Confirmed records only. These indicators describe contribution and knowledge exchange; they do not establish causal attribution.</p></div><ExportAnnualReport report={report} /></div>
      <nav aria-label="Choose an annual reporting year"><ul className="flex flex-wrap gap-2 p-0">{years.map((year) => <li key={year}><Link href={`/impact?view=annual&year=${year}`} aria-current={year === metrics.year ? "page" : undefined} className={year === metrics.year ? "border-primary bg-surface-tint text-primary-ink rounded-card cursor-pointer border px-3 py-1.5 font-mono text-[12px] font-medium no-underline" : "border-line text-ink-3 hover:border-sage hover:text-ink rounded-card cursor-pointer border px-3 py-1.5 font-mono text-[12px] no-underline"}>{year}</Link></li>)}</ul></nav>
    </div>
    <div className="grid min-w-0 grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-4">
      <Metric label="Annual policy window capture" value={metrics.annualCaptureRate === null ? "—" : `${metrics.annualCaptureRate}%`} detail={`${metrics.immediateSignalsCaptured} of ${metrics.immediateSignalsCount} Immediate signals`} />
      <Metric label="2030 landscape contribution" value={`${formatNumber(metrics.totalHectaresInfluenced)} ha`} detail={`${formatPercent(metrics.totalHectaresInfluenced, HECTARE_TARGET)} of 20M ha benchmark`} progress={metrics.totalHectaresInfluenced / HECTARE_TARGET} />
      <Metric label="2030 livelihood contribution" value={`${formatNumber(metrics.totalPeopleBenefited)} people`} detail={`${formatPercent(metrics.totalPeopleBenefited, PEOPLE_TARGET)} of 5M people benchmark`} progress={metrics.totalPeopleBenefited / PEOPLE_TARGET} />
      <Metric label="TBI network leverage" value={`${metrics.networkPartnerAdoptionsCount} of 9`} detail="Partner programmes with recorded exchanges" />
    </div>
    <section className="border-line flex flex-col gap-3 border-t pt-5"><div><h3 className="text-ink text-[15px] font-semibold">TBI Network Leverage</h3><p className="text-ink-3 mt-1 text-[13px]">Recorded adaptations, pilots, or references to Ghana-developed policy approaches.</p></div><ul className="grid grid-cols-1 gap-2 p-0 tablet:grid-cols-2 laptop:grid-cols-3">{metrics.partnerCountryCoverage.map((partner) => <li key={partner.code} className="border-line rounded-card flex min-h-20 items-center justify-between gap-3 border p-3"><div><p className="text-ink text-[13px] font-semibold">{partner.name}</p><p className="text-ink-3 text-[12px]">{TBI_PARTNER_COUNTRIES.find((item) => item.code === partner.code)?.region}</p></div><span className={partner.count > 0 ? "border-surface-tint-border bg-surface-tint text-primary-ink rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold" : "border-line bg-stone text-ink-2 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold"}>{partner.count > 0 ? `${partner.count} active` : "No exchanges yet"}</span></li>)}</ul></section>
    <section className="border-line flex flex-col gap-3 border-t pt-5"><h3 className="text-ink text-[15px] font-semibold">Confirmed influence portfolio</h3>{report.events.length ? <ul className="flex list-none flex-col gap-3 p-0">{report.events.map((event) => <li key={event.id} className="border-line rounded-card border p-3.5"><Link href={`/briefs/${event.briefId}`} className="text-ink hover:text-primary cursor-pointer text-[14px] font-semibold no-underline hover:underline">{event.briefTitle}</Link><p className="text-ink-2 mt-1 text-[13px] leading-relaxed">{event.description}</p><p className="text-ink-3 mt-2 font-mono text-[11.5px]">{event.hectaresImpacted !== null ? `${formatNumber(event.hectaresImpacted)} ha` : "No landscape estimate"} · {event.peopleImpacted !== null ? `${formatNumber(event.peopleImpacted)} people` : "No livelihood estimate"}</p></li>)}</ul> : <p className="text-ink-3 text-[13px]">No confirmed influence records were verified in this reporting year.</p>}</section>
  </section>;
}

function Metric({ label, value, detail, progress }: { label: string; value: string; detail: string; progress?: number }) { const width = `${Math.min(100, Math.max(0, (progress ?? 0) * 100))}%`; return <article className="border-line rounded-card flex min-w-0 flex-col gap-2 border p-4"><p className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">{label}</p><p className="text-primary font-mono text-[22px] font-semibold tabular-nums">{value}</p>{progress !== undefined ? <div className="bg-stone h-1.5 overflow-hidden rounded-full" aria-label={`${label}: ${detail}`}><div className="bg-primary h-full rounded-full" style={{ width }} /></div> : null}<p className="text-ink-3 text-[12px] leading-snug">{detail}</p></article>; }
function formatNumber(value: number) { return value.toLocaleString("en-GB", { maximumFractionDigits: 0 }); }
function formatPercent(value: number, target: number) { return `${((value / target) * 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}%`; }
