import Link from "next/link";

import type { ExecutiveDashboardData } from "@/lib/db";
import { INFLUENCE_EVENT_TYPE_LABELS } from "../impact/labels";
import { EmptyState } from "./approval-queue";

export function InfluenceHighlights({ items }: { items: ExecutiveDashboardData["recentInfluence"] }) {
  return <section aria-labelledby="influence-highlights-heading"><div className="flex items-center justify-between gap-3"><h2 id="influence-highlights-heading" className="text-h2 text-ink font-semibold">Recent policy influence</h2><Link href="/impact" className="text-primary text-[12.5px] font-medium no-underline hover:underline cursor-pointer">Impact tracker</Link></div>{items.length === 0 ? <EmptyState copy="No influence events have been confirmed by a Programme Director yet." /> : <ul className="mt-3 flex flex-col gap-2.5">{items.map((event) => <li key={event.id} className="bg-card border-line rounded-card border p-4"><span className="bg-surface-tint border-surface-tint-border text-primary-ink inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium">{INFLUENCE_EVENT_TYPE_LABELS[event.eventType]}</span><h3 className="text-ink mt-2 text-[14px] font-semibold">{event.policyDocument}</h3><p className="text-ink-3 mt-1 text-[12.5px] leading-relaxed">{event.description}</p><Link href={`/briefs/${event.briefId}`} className="text-primary mt-2 inline-block text-[12px] font-medium no-underline hover:underline cursor-pointer">Connected brief: {event.briefTitle}</Link></li>)}</ul>}</section>;
}
