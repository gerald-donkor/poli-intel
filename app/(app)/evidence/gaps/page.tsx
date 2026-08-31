import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { canManageResearchGaps } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { listResearchGaps } from "@/lib/db";

import { GapList } from "./gap-list";

export const metadata = { title: "Research gaps · EviBrief" };

export default async function ResearchGapsPage() {
  const staffUser = await requireStaffUser();
  const gaps = await listResearchGaps();
  return <><PageHeader title="Research gaps" breadcrumbs={[{ label: "Evidence", href: "/evidence" }, { label: "Research gaps" }]} subtitle="Missing evidence recorded from policy signals and staff review, ready for the ingestion agenda."><Link href="/evidence" className={buttonVariants({ variant: "outline" })}>Evidence library</Link></PageHeader><div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6"><div className="bg-surface-tint border-surface-tint-border rounded-card border p-4"><p className="text-primary-ink text-[13px] leading-relaxed">A research gap is a human-recorded priority. It is not a claim about evidence quality, and it does not send evidence to an AI service.</p></div><GapList gaps={gaps} canManage={canManageResearchGaps(staffUser.role)} /></div></>;
}
