import Link from "next/link";

import { ClassificationPendingAlert } from "@/components/classification-pending-alert";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { canIngestEvidence } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { countPendingClassification, listEligibleEvidence } from "@/lib/db/evidence";

import { EvidenceTable } from "./evidence-table";

export const metadata = {
  title: "Evidence · EviBrief",
};

export default async function EvidencePage() {
  // The DAL call, not the layout, is the check that matters: layouts do not
  // re-render on navigation (AGENTS.md §10.1, Next's authentication guide).
  const staffUser = await requireStaffUser();

  const [items, pendingCount] = await Promise.all([
    listEligibleEvidence(),
    countPendingClassification(),
  ]);

  const mayIngest = canIngestEvidence(staffUser.role);

  return (
    <>
      <PageHeader
        title="Evidence"
        subtitle="The research corpus. Only evidence tagged as public and published is listed here — everything else is held at the classification queue."
      >
        {/* Presentation only. The action authorises server-side regardless. */}
        {mayIngest ? (
          <Button render={<Link href="/evidence/new" />}>Add evidence</Button>
        ) : null}
      </PageHeader>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        {/* Governance surface: above the fold at every width, never hidden. */}
        <ClassificationPendingAlert pendingCount={pendingCount} />

        {items.length > 0 ? (
          <EvidenceTable items={items} />
        ) : (
          <EmptyEvidenceState
            pendingCount={pendingCount}
            mayIngest={mayIngest}
          />
        )}
      </div>
    </>
  );
}

/**
 * The empty state carries a real next step rather than a blank panel
 * (AGENTS.md §17.6). Which step depends on whether the library is empty or
 * merely un-triaged — those are different problems.
 */
function EmptyEvidenceState({
  pendingCount,
  mayIngest,
}: {
  pendingCount: number;
  mayIngest: boolean;
}) {
  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      {/* Concentric contour rings — an abstract structural mark, no icon asset
          and no leaf (AGENTS.md §11.7). */}
      <span
        aria-hidden="true"
        className="mx-4 mt-4 mb-5 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h2 className="text-ink text-[15px] font-semibold">
        No evidence is eligible yet
      </h2>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        {pendingCount > 0
          ? "Every ingested item is still waiting for a classification. Tag an item as public and published in the queue and it becomes searchable here."
          : "Nothing has been ingested into the knowledge base yet. Upload a PDF or a plain-text document to get started."}
      </p>
      {pendingCount > 0 ? (
        <Button variant="outline" render={<Link href="/evidence/queue" />}>
          Open the classification queue
        </Button>
      ) : mayIngest ? (
        <Button render={<Link href="/evidence/new" />}>Add evidence</Button>
      ) : null}
    </div>
  );
}
