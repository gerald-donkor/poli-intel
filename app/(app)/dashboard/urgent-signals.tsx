import Link from "next/link";

import { EmptyState } from "./approval-queue";
import type { ExecutiveDashboardData } from "@/lib/db";
import { URGENCY_LABELS, URGENCY_RAMP } from "../signals/labels";

export function UrgentSignals({ items }: { items: ExecutiveDashboardData["urgentSignals"] }) {
  return <section aria-labelledby="urgent-signals-heading"><div className="flex items-center justify-between gap-3"><h2 id="urgent-signals-heading" className="text-h2 text-ink font-semibold">High-urgency signal digest</h2><Link href="/signals" className="text-primary text-[12.5px] font-medium no-underline hover:underline cursor-pointer">All signals</Link></div>{items.length === 0 ? <EmptyState copy="No immediate or near-term policy windows are recorded at present." /> : <ul className="mt-3 flex flex-col gap-2.5">{items.map((signal) => <li key={signal.id}><Link href={`/signals/${signal.id}`} className={`bg-card ${URGENCY_RAMP[signal.urgency].card} rounded-card shadow-raised hover:border-sage flex min-w-0 flex-col gap-2 border border-l-[3px] p-4 no-underline transition-colors duration-150 hover:no-underline cursor-pointer`}><span className={`${URGENCY_RAMP[signal.urgency].eyebrow} text-meta font-semibold tracking-[0.06em] uppercase`}>{URGENCY_LABELS[signal.urgency]} · {signal.sourceName}</span><span className="text-ink text-[14px] leading-snug font-semibold">{signal.title}</span><span className="text-ink-3 font-mono text-[11.5px]">{signal.matchedEvidenceCount} matched {signal.matchedEvidenceCount === 1 ? "source" : "sources"} · {signal.briefCount === 0 ? "No brief drafted" : `${signal.briefCount} ${signal.briefCount === 1 ? "brief" : "briefs"}`}</span></Link></li>)}</ul>}</section>;
}
