import Link from "next/link";

import { ClassificationPendingAlert } from "@/components/classification-pending-alert";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { canGenerateBrief } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { countPendingClassification, listEligibleEvidence } from "@/lib/db";

import { GenerateBriefForm } from "./generate-form";

export const metadata = {
  title: "Generate a brief · EviBrief",
};

/**
 * The generation screen.
 *
 * The evidence offered here is `listEligibleEvidence` — the same gated listing
 * the library uses — so the picker cannot show an item the gate would refuse.
 * That is PRESENTATION, not the control: `startBriefGeneration` re-reads every
 * selected item at generation time and puts it through the gate itself (§7.1).
 */
export default async function NewBriefPage() {
  const staffUser = await requireStaffUser();

  const [evidence, pendingCount] = await Promise.all([
    listEligibleEvidence(),
    countPendingClassification(),
  ]);

  // A rendered gate, never the enforcement boundary — the three actions refuse
  // server-side whatever this renders (§10.1).
  if (!canGenerateBrief(staffUser.role)) {
    return (
      <>
        <PageHeader title="Generate a brief" />
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-4 tablet:p-6">
          <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
            <h2 className="text-ink text-[15px] font-semibold">
              Not available for your role
            </h2>
            <p className="text-ink-3 max-w-[62ch] text-[13px]">
              Drafting a brief is a Policy &amp; Advocacy Officer or Programme
              Director task. You can still read every draft on the briefs screen.
            </p>
            <Link href="/briefs" className={buttonVariants({ variant: "outline" })}>
              Back to briefs
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Generate a brief"
        subtitle="Paste the policy document, choose who it is for, and pick the evidence it should draw on. The draft is fact-checked against that evidence before it is saved."
      />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        {/* Governance surface: above the fold at every width, never hidden. */}
        <ClassificationPendingAlert pendingCount={pendingCount} />

        <GenerateBriefForm evidence={evidence.items} />
      </div>
    </>
  );
}
