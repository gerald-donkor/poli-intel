import Link from "next/link";
import { ArrowRightIcon, FileTextIcon, LibraryIcon, TimerIcon } from "lucide-react";

import type { ExecutiveDashboardData } from "@/lib/db";

type Metric = {
  label: string;
  value: number;
  detail: string;
  href: string;
  icon: typeof FileTextIcon;
};

export function ExecutiveMetrics({ metrics }: { metrics: ExecutiveDashboardData["metrics"] }) {
  const cards: Metric[] = [
    {
      label: "Briefs for approval",
      value: metrics.pendingApprovalCount,
      detail: metrics.blockedByFlagsCount > 0
        ? `${metrics.blockedByFlagsCount} held for claim review`
        : "No open claim-review holds",
      href: "#approval-queue",
      icon: FileTextIcon,
    },
    {
      label: "Active urgent signals",
      value: metrics.immediateSignalsCount + metrics.nearTermSignalsCount,
      detail: `${metrics.immediateSignalsCount} immediate · ${metrics.nearTermSignalsCount} near-term`,
      href: "/signals",
      icon: ArrowRightIcon,
    },
    {
      label: "Closing windows",
      value: metrics.closingSoonWindowsCount,
      detail: "Recorded dates within 14 days",
      href: "/tracker",
      icon: TimerIcon,
    },
    {
      label: "Unclassified evidence",
      value: metrics.unclassifiedEvidenceCount,
      detail: "Held from search and AI use",
      href: "/evidence/queue",
      icon: LibraryIcon,
    },
  ];

  return (
    <section aria-label="Executive metrics" className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-4">
      {cards.map((metric) => {
        const Icon = metric.icon;
        return (
          <Link key={metric.label} href={metric.href} className="bg-card border-line rounded-card shadow-raised hover:border-sage flex min-w-0 flex-col gap-3 border p-4 no-underline transition-colors duration-150 hover:no-underline cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">{metric.label}</span>
              <Icon aria-hidden="true" className="text-primary size-4 shrink-0" />
            </div>
            <span className="text-ink font-mono text-[28px] leading-none font-medium tabular-nums">{metric.value}</span>
            <span className="text-ink-3 text-[12.5px] leading-relaxed">{metric.detail}</span>
          </Link>
        );
      })}
    </section>
  );
}
