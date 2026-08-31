import Link from "next/link";

import { ClassificationPendingAlert } from "@/components/classification-pending-alert";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { countPendingClassification } from "@/lib/db/evidence";
import { findResearchGap } from "@/lib/db";
import { StaffRole } from "@/lib/generated/prisma/enums";

import { EvidenceUploadForm } from "./upload-form";

export const metadata = {
  title: "Add evidence · EviBrief",
};

export default async function NewEvidencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Render-path gate. The metadata action and the upload router's middleware
  // both re-authorise server-side (AGENTS.md §10.1).
  const staffUser = await requireRole(
    StaffRole.research_officer,
    StaffRole.programme_director,
  );

  if (!staffUser) {
    return (
      <>
        <PageHeader
          title="Add evidence"
          subtitle="Upload a document into the knowledge base."
        />
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-4 tablet:p-6">
          <div className="bg-card border-line rounded-card flex flex-col items-start gap-2 border p-6">
            <h2 className="text-ink text-[15px] font-semibold">
              Not available for your role
            </h2>
            <p className="text-ink-3 max-w-[62ch] text-[13px]">
              Ingesting evidence is restricted to Research Officers and the
              Programme Director.
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

  const rawParams = await searchParams;
  const gapId = typeof rawParams.gapId === "string" ? rawParams.gapId : null;
  const gap = gapId ? await findResearchGap(gapId) : null;
  const pendingCount = await countPendingClassification();

  return (
    <>
      <PageHeader
        title="Add evidence"
        breadcrumbs={[
          { label: "Evidence", href: "/evidence" },
          { label: "Add Evidence" },
        ]}
        subtitle="The text is extracted and chunked on upload. The item is then held for classification before it becomes searchable."
      >
        <Link
          href="/evidence"
          className={buttonVariants({ variant: "outline" })}
        >
          Evidence library
        </Link>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        <ClassificationPendingAlert pendingCount={pendingCount} />
        {gap ? <div className="bg-surface-tint border-surface-tint-border rounded-card border p-3 text-[13px]"><strong className="text-primary-ink">Research gap context:</strong> {gap.topic}. This upload will be linked to the priority and held for classification as usual.</div> : null}
        <EvidenceUploadForm initialGap={gap ? { id: gap.id, topic: gap.topic, impactArea: gap.impactArea } : null} />
      </div>
    </>
  );
}
