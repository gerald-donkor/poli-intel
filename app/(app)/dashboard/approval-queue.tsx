import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { GuardFlagIcon } from "@/components/guard-flag-icon";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import type { ExecutiveDashboardData } from "@/lib/db";

import { BRIEF_STATUS_LABELS } from "../briefs/labels";

export function ApprovalQueue({ items }: { items: ExecutiveDashboardData["approvalQueue"] }) {
  return (
    <section id="approval-queue" aria-labelledby="approval-queue-heading" className="scroll-mt-20">
      <SectionHeading title="Brief review & approval queue" href="/briefs" action="All briefs" />
      {items.length === 0 ? <EmptyState copy="There are no draft or reviewed briefs awaiting a person's next step." /> : (
        <ul className="bg-card border-line rounded-card divide-line mt-3 divide-y border">
          {items.map((brief) => (
            <li key={brief.id} className="flex min-w-0 flex-col gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">{briefTypeLabel(brief.briefType)}</span>
                  <span className="border-line bg-stone text-ink-2 rounded-full border px-2 py-0.5 text-[11px] font-medium">{BRIEF_STATUS_LABELS[brief.status]}</span>
                </div>
                <h3 className="text-ink text-[15px] leading-snug font-semibold">{brief.title}</h3>
                <p className="text-ink-3 text-[12.5px]">For {audienceLabel(brief.targetAudience)} · {brief.authorName ?? brief.authorEmail}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {brief.openFlagsCount > 0 ? (
                  <span className="bg-watch-surface border-watch-border text-watch-ink motion-safe:animate-flag-pulse inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold">
                    <GuardFlagIcon className="size-3.5" />
                    {brief.openFlagsCount} {brief.openFlagsCount === 1 ? "flag" : "flags"} open — blocks approval
                  </span>
                ) : (
                  <span className="bg-surface-tint border-surface-tint-border text-primary-ink inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold">Citations reviewed</span>
                )}
                <span className="text-ink-3 font-mono text-[11.5px]">{brief.citationsCount} {brief.citationsCount === 1 ? "source" : "sources"}</span>
                {brief.canBeApproved ? <span className="text-primary text-[11.5px] font-medium">Ready for Director review</span> : null}
                <Link href={`/briefs/${brief.id}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto`}>
                  Review brief <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SectionHeading({ title, href, action }: { title: string; href: string; action: string }) {
  return <div className="flex items-center justify-between gap-3"><h2 id="approval-queue-heading" className="text-h2 text-ink font-semibold">{title}</h2><Link href={href} className="text-primary text-[12.5px] font-medium no-underline hover:underline cursor-pointer">{action}</Link></div>;
}

export function EmptyState({ copy }: { copy: string }) {
  return <div className="bg-card border-line rounded-card mt-3 border p-4"><p className="text-ink-3 text-[13px]">{copy}</p></div>;
}
