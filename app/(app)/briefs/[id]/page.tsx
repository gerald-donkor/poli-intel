import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import { requireStaffUser } from "@/lib/auth/session";
import { findBriefDetail } from "@/lib/db";

import { BRIEF_STATUS_LABELS, formatGeneratedAt } from "../labels";
import { BriefBody } from "./brief-body";
import { CitationList } from "./citation-list";
import { FlagPanel } from "./flag-panel";

export const metadata = {
  title: "Brief · EviBrief",
};

/**
 * A generated draft, read-only.
 *
 * Editing is the Tiptap prompt; approval, status transitions and flag
 * resolution are the review work. NEITHER IS STUBBED HERE. A disabled control
 * with no action behind it would imply the capability exists and is merely
 * switched off, so the screen says in words what is coming instead (§8.8).
 *
 * Only completed generations resolve. An attempt still drafting or verifying has
 * no `Brief` row, so it 404s rather than rendering a half-checked document —
 * which is §9.1 showing up in the router.
 */
export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffUser();

  const { id } = await params;
  const brief = await findBriefDetail(id);

  if (!brief) notFound();

  return (
    <>
      <PageHeader
        title={briefTypeLabel(brief.briefType)}
        subtitle={
          <>
            For {audienceLabel(brief.audience)} ·{" "}
            {BRIEF_STATUS_LABELS[brief.status]} · version{" "}
            <span className="font-mono">{brief.version}</span> ·{" "}
            {formatGeneratedAt(brief.generatedAt)}
            {brief.createdByName ? ` · ${brief.createdByName}` : ""}
          </>
        }
      >
        <Link href="/briefs" className={buttonVariants({ variant: "outline" })}>
          All briefs
        </Link>
      </PageHeader>

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        {/* The flag panel promotes above the fold at small widths rather than
            being dropped — it is a governance surface, and at one column it
            comes FIRST (design-system.md, responsive rules; §9.7). At `laptop`
            it moves into the side rail beside the document. */}
        <div className="grid min-w-0 grid-cols-1 gap-4 laptop:grid-cols-[minmax(0,1fr)_minmax(0,340px)] laptop:items-start desktop:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex min-w-0 flex-col gap-4 laptop:order-2">
            <FlagPanel flags={brief.flags} evidence={brief.evidence} />
            <CitationList evidence={brief.evidence} />
            <GenerationProvenance
              generatingModel={brief.generatingModel}
              promptVersion={brief.promptVersion}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4 laptop:order-1">
            <BriefBody bodyText={brief.bodyText} />
            <p className="text-ink-3 max-w-[70ch] text-[12.5px]">
              This is a draft. Editing, audience switching, export, and the
              review that clears a flag and lets the Programme Director approve
              it arrive with the editor and review screens. Nothing here has been
              approved, submitted, or published.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * What produced this version. Recorded because a brief has to stay reproducible:
 * a model or a prompt that changed under a stored document is otherwise
 * invisible (§16.5, `gemini-integration`).
 */
function GenerationProvenance({
  generatingModel,
  promptVersion,
}: {
  generatingModel: string | null;
  promptVersion: string | null;
}) {
  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-1.5 border p-4">
      <h2 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
        Drafted by
      </h2>
      <p className="text-ink-3 font-mono text-[11.5px]">
        {generatingModel ?? "model not recorded"}
        {promptVersion ? ` · ${promptVersion}` : ""}
      </p>
      <p className="text-ink-3 text-[12.5px]">
        A draft assembled from the evidence set above. It has not been checked by
        a person yet.
      </p>
    </section>
  );
}
