import Link from "next/link";

import type { ExecutiveDashboardData } from "@/lib/db";
import { BRIEF_STATUS_LABELS } from "../briefs/labels";
import { EmptyState } from "./approval-queue";

function countdown(days: number) { if (days === 0) return "Closing today"; if (days === 1) return "1 day left"; return `${days} days left`; }

export function ClosingWindows({ items }: { items: ExecutiveDashboardData["closingWindows"] }) {
  return <section aria-labelledby="closing-windows-heading"><div className="flex items-center justify-between gap-3"><h2 id="closing-windows-heading" className="text-h2 text-ink font-semibold">Closing policy windows</h2><Link href="/tracker" className="text-primary text-[12.5px] font-medium no-underline hover:underline cursor-pointer">Open tracker</Link></div>{items.length === 0 ? <EmptyState copy="No policy-window close dates are recorded for the next 30 days." /> : <ul className="bg-card border-line rounded-card divide-line mt-3 divide-y border">{items.map((window) => <li key={window.signalId} className="flex min-w-0 flex-col gap-2 p-4 tablet:flex-row tablet:items-center"><div className="min-w-0 flex-1"><Link href={`/signals/${window.signalId}`} className="text-ink text-[14px] leading-snug font-semibold no-underline hover:text-primary hover:underline cursor-pointer">{window.signalTitle}</Link><p className="text-ink-3 mt-1 text-[12px]">{window.windowClosesAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div><div className="flex flex-wrap items-center gap-2"><span className="bg-immediate-surface border-immediate-border text-immediate-ink rounded-full border px-2 py-0.5 text-[11px] font-semibold">{countdown(window.daysRemaining)}</span>{window.briefId ? <Link href={`/briefs/${window.briefId}`} className="bg-stone border-line text-ink-2 rounded-full border px-2 py-0.5 text-[11px] font-medium no-underline hover:text-primary hover:underline cursor-pointer">{BRIEF_STATUS_LABELS[window.briefStatus!]}</Link> : <span className="border-line text-ink-3 rounded-full border px-2 py-0.5 text-[11px] font-medium">No brief recorded</span>}</div></li>)}</ul>}</section>;
}
