import { PageHeader } from "@/components/page-header";
import { requireStaffUser } from "@/lib/auth/session";
import { readExecutiveDashboardData } from "@/lib/db";

import { ApprovalQueue } from "./approval-queue";
import { ClosingWindows } from "./closing-windows";
import { ExecutiveMetrics } from "./executive-metrics";
import { InfluenceHighlights } from "./influence-highlights";
import { UrgentSignals } from "./urgent-signals";

export const metadata = { title: "Dashboard · EviBrief" };

export default async function DashboardPage() {
  await requireStaffUser();
  const dashboard = await readExecutiveDashboardData();

  return <><PageHeader title="Dashboard" subtitle="Executive overview of policy windows, approval queue, and recorded influence." /><div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-6 p-4 tablet:gap-8 tablet:p-6"><ExecutiveMetrics metrics={dashboard.metrics} /><div className="grid min-w-0 grid-cols-1 gap-6 laptop:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.85fr)] laptop:gap-8"><div className="flex min-w-0 flex-col gap-8"><ApprovalQueue items={dashboard.approvalQueue} /><ClosingWindows items={dashboard.closingWindows} /></div><aside className="flex min-w-0 flex-col gap-8"><UrgentSignals items={dashboard.urgentSignals} /><InfluenceHighlights items={dashboard.recentInfluence} /></aside></div></div></>;
}
