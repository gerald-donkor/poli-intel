import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { listPendingClassification } from "@/lib/db/evidence";
import { StaffRole } from "@/lib/generated/prisma/enums";

import { ClassifyQueue } from "./classify-panel";

export const metadata = {
  title: "Classification queue · EviBrief",
};

export default async function EvidenceQueuePage() {
  // A render-path gate only. The classify Server Action re-checks the role
  // server-side, so this decides what is shown, never what is permitted
  // (AGENTS.md §10.1).
  const staffUser = await requireRole(
    StaffRole.research_officer,
    StaffRole.programme_director,
  );

  if (!staffUser) {
    return (
      <>
        <PageHeader
          title="Classification queue"
          subtitle="Evidence awaiting a classification decision."
        />
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-4 tablet:p-6">
          <div className="bg-card border-line rounded-card flex flex-col items-start gap-2 border p-6">
            <h2 className="text-ink text-[15px] font-semibold">
              Not available for your role
            </h2>
            <p className="text-ink-3 max-w-[62ch] text-[13px]">
              Setting an evidence classification is restricted to Research
              Officers and the Programme Director. Ask a Research Officer to
              triage the queue.
            </p>
            <Link
              href="/evidence"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to the evidence library
            </Link>
          </div>
        </div>
      </>
    );
  }

  const items = await listPendingClassification();

  return (
    <>
      <PageHeader
        title="Classification queue"
        breadcrumbs={[
          { label: "Evidence", href: "/evidence" },
          { label: "Classification Queue" },
        ]}
        subtitle="Newly ingested evidence is held here. Nothing is searchable, and nothing reaches the AI pipeline, until it is tagged."
      >
        <Link
          href="/evidence"
          className={buttonVariants({ variant: "outline" })}
        >
          Evidence library
        </Link>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-4 tablet:p-6">
        <ClassifyQueue items={items} />
      </div>
    </>
  );
}
