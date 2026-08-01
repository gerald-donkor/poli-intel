import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import {
  canApproveOrRejectBrief,
  canDismissFlag,
  canEditBrief,
  canExportBrief,
} from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { findBriefDetail, isEditableStatus } from "@/lib/db";
import { FlagStatus } from "@/lib/generated/prisma/enums";

import { BRIEF_STATUS_LABELS, formatGeneratedAt } from "../labels";
import { BriefBody } from "./brief-body";
import { CitationList } from "./citation-list";
import { FlagPanel } from "./flag-panel";
import { ReviewPanel } from "./review-panel";
import { StatusHistory } from "./status-history";

export const metadata = {
  title: "Brief · EviBrief",
};

/**
 * A generated draft, and the surface on which it is reviewed.
 *
 * PERMISSIONS ARE RESOLVED HERE, SERVER-SIDE, AND ARE PRESENTATION ONLY. Both
 * actions authorise their own caller — a control that is not rendered is not a
 * control that is enforced (§10.1). A role that may review sees the panel; a
 * role that may not sees no disabled ghost of it, and the brief reads as before.
 *
 * Governance surfaces come first in the rail: the flag panel, then the decision,
 * then the citations. At one column the rail already precedes the document, so
 * neither is ever what gets pushed below the fold (design-system, responsive).
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
  const staffUser = await requireStaffUser();

  const { id } = await params;
  const brief = await findBriefDetail(id);

  if (!brief) notFound();

  // Presentation only. The edit route authorises the caller itself, and so does
  // the save action — hiding a link is never the control (§10.1).
  const mayEdit = canEditBrief(staffUser.role) && isEditableStatus(brief.status);

  // The object-level half matters here: nobody closes a flag on a brief they
  // drafted, whatever their role. A brief whose author's row is gone has no
  // author anyone can be, and the empty string never matches a real id.
  const mayResolveFlags = canDismissFlag(
    staffUser.role,
    { createdById: brief.createdById ?? "" },
    staffUser.id,
  );

  const mayReview = canApproveOrRejectBrief(staffUser.role);

  // Presentation only, and NOT gated on flag state or status: an open flag
  // blocks approval and nothing else, and the exported file carries the notice
  // with it rather than the download being withheld (§16.8).
  const mayExport = canExportBrief(staffUser.role);

  const openFlagCount = brief.flags.filter(
    (flag) => flag.status === FlagStatus.open,
  ).length;

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
        {mayExport ? (
          <span className="flex flex-col items-start gap-1 tablet:items-end">
            {/* A plain anchor, not `Link`: this is a file response from a Route
                Handler, not a client-side navigation. Never disabled by flag
                state — the notice inside the file is the mechanism (§16.8). */}
            <a
              href={`/api/briefs/${brief.id}/export?format=docx`}
              className={buttonVariants({ variant: "outline" })}
            >
              Download Word
            </a>
            {openFlagCount > 0 ? (
              <span className="text-ink-3 max-w-[30ch] text-[12.5px] leading-snug tablet:text-right">
                The file carries a notice about{" "}
                {openFlagCount === 1
                  ? "the claim"
                  : `the ${openFlagCount} claims`}{" "}
                still being checked.
              </span>
            ) : null}
          </span>
        ) : null}
        {mayEdit ? (
          <Link
            href={`/briefs/${brief.id}/edit`}
            className={buttonVariants({ variant: "default" })}
          >
            Edit
          </Link>
        ) : null}
      </PageHeader>

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        {/* The flag panel promotes above the fold at small widths rather than
            being dropped — it is a governance surface, and at one column it
            comes FIRST (design-system.md, responsive rules; §9.7). At `laptop`
            it moves into the side rail beside the document. */}
        <div className="grid min-w-0 grid-cols-1 gap-4 laptop:grid-cols-[minmax(0,1fr)_minmax(0,340px)] laptop:items-start desktop:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex min-w-0 flex-col gap-4 laptop:order-2">
            <FlagPanel
              flags={brief.flags}
              evidence={brief.evidence}
              canResolve={mayResolveFlags}
            />
            {mayReview ? (
              <ReviewPanel
                briefId={brief.id}
                status={brief.status}
                openFlagCount={openFlagCount}
              />
            ) : null}
            <StatusHistory events={brief.statusHistory} />
            <CitationList evidence={brief.evidence} />
            <GenerationProvenance
              generatingModel={brief.generatingModel}
              promptVersion={brief.promptVersion}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4 laptop:order-1">
            <BriefBody bodyText={brief.bodyText} />
            <p className="text-ink-3 max-w-[70ch] text-[12.5px]">
              A downloaded copy carries this brief&rsquo;s status, its evidence
              set, and any claim still being checked. Audience switching arrives
              with its own screen. Every move this brief makes is a
              person&rsquo;s decision, recorded with their name and the time.
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
