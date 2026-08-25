import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import {
  canApproveOrRejectBrief,
  canDismissFlag,
  canEditBrief,
  canExportBrief,
  canGenerateBrief,
  canManageStakeholders,
} from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { extractKeyMessages } from "@/lib/briefs/key-messages";
import { TRANSLATION_LANGUAGE } from "@/lib/briefs/translation-limits";
import {
  findBriefDetail,
  findLatestTranslationForBrief,
  isEditableStatus,
  listSharesForBrief,
  listStakeholderOptions,
} from "@/lib/db";
import { isPdfExportConfigured } from "@/lib/export/pandoc";
import { FlagStatus } from "@/lib/generated/prisma/enums";
import { isDriveExportConfigured } from "@/lib/google/drive-client";

import { BRIEF_STATUS_LABELS, formatGeneratedAt } from "../labels";
import { AudienceSwitcher } from "./audience-switcher";
import { BriefBody } from "./brief-body";
import { CitationList } from "./citation-list";
import { FlagPanel } from "./flag-panel";
import { ReviewPanel } from "./review-panel";
import { SharePanel } from "./share-panel";
import { StatusHistory } from "./status-history";
import { TranslationPanel } from "./translation-panel";

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

  // A reframe IS a generation, so it is the generation matrix — not the editing
  // one (decision 8). Presentation only, twice over: the route authorises and so
  // does every stage of the run.
  const mayReframe =
    canGenerateBrief(staffUser.role) && isEditableStatus(brief.status);

  // Presentation only, and NOT gated on flag state or status: an open flag
  // blocks approval and nothing else, and the exported file carries the notice
  // with it rather than the download being withheld (§16.8).
  const mayExport = canExportBrief(staffUser.role);

  // Deployment capability, not a permission: a deployment with no Drive
  // credentials cannot offer the destination at all. The route refuses it too —
  // this only keeps the page from offering a control that would 400 (§17.6).
  const driveExportAvailable = isDriveExportConfigured();

  // Also a deployment capability: PDF needs a Pandoc binary on the host, which
  // the hosting target does not ship. Unset means the control is not offered
  // and Word is unaffected (§17.6).
  const pdfExportAvailable = isPdfExportConfigured();

  const openFlagCount = brief.flags.filter(
    (flag) => flag.status === FlagStatus.open,
  ).length;

  // The CRM's own role reading (§10.3, §10.5): reading who a brief reached and
  // logging another share are the same right, so a role that cannot keep the
  // contact records does not see the panel and its rows are not fetched at all.
  // The action authorises independently regardless (§10.1).
  const mayLogShare = canManageStakeholders(staffUser.role);

  const [shares, contacts] = mayLogShare
    ? await Promise.all([listSharesForBrief(brief.id), listStakeholderOptions()])
    : [[], []];

  // A translation IS a generation — it spends a free-tier request and produces
  // model prose — so it is the generation matrix, not the export one. Reading an
  // existing translation is open to anyone who can already read the brief: it is
  // the brief's own content. Presentation only; the action authorises (§10.1).
  const mayTranslate = canGenerateBrief(staffUser.role);

  // The key messages of the CURRENT version, extracted from the stored body. The
  // stored translation may render an older one — the panel compares the two and
  // never shows stale Twi beside fresh English.
  const keyMessages = extractKeyMessages(brief.bodyText);

  const translation = await findLatestTranslationForBrief({
    briefId: brief.id,
    language: TRANSLATION_LANGUAGE,
  });

  return (
    <>
      <PageHeader
        title={briefTypeLabel(brief.briefType)}
        breadcrumbs={[
          { label: "Briefs", href: "/briefs" },
          { label: briefTypeLabel(brief.briefType) },
        ]}
        subtitle={
          // The audience has moved out of this line and into the switcher
          // below — it is a control now, not a label.
          <>
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
            <span className="flex flex-wrap items-center gap-2">
              {/* Plain anchors, not `Link`: these are Route Handler responses —
                  a file and a redirect — not client-side navigations. Neither
                  is disabled by flag state; the notice inside the document is
                  the mechanism (§16.8). */}
              <a
                href={`/api/briefs/${brief.id}/export?format=docx`}
                className={buttonVariants({ variant: "outline" })}
              >
                Download Word
              </a>
              {/* The two downloads sit together, then the destination that
                  leaves the app. Absent, not disabled, on a host with no Pandoc
                  binary — the same rule as the Drive control below, for the
                  same reason. */}
              {pdfExportAvailable ? (
                <a
                  href={`/api/briefs/${brief.id}/export?format=pdf`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Download PDF
                </a>
              ) : null}
              {/* Absent, not disabled, on a deployment with no Drive
                  credentials: a control that cannot work is not a control, and
                  the route refuses the direct URL regardless (§10.1). */}
              {driveExportAvailable ? (
                <a
                  href={`/api/briefs/${brief.id}/export?format=gdoc`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Send to Google Docs
                </a>
              ) : null}
            </span>
            {/* The watch ramp, not the ambient secondary ink: this line is about
                open flag state, and watch is the guard's ramp (design-system,
                §11.4). 9.1:1 on `card`. It covers both destinations — the Doc is
                the same rendered document as the file. */}
            {openFlagCount > 0 ? (
              <span className="text-watch-ink max-w-[30ch] text-[12.5px] leading-snug tablet:text-right">
                The document carries a notice about{" "}
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
            {mayLogShare ? (
              <SharePanel
                briefId={brief.id}
                shares={shares}
                contacts={contacts}
                canLog
              />
            ) : null}
            {/* After the share panel and never above a governance surface: this
                is an assist, not a control on the brief's state. */}
            <TranslationPanel
              briefId={brief.id}
              currentVersion={brief.version}
              statusLabel={BRIEF_STATUS_LABELS[brief.status]}
              messages={keyMessages.messages}
              omitted={keyMessages.omitted}
              translation={translation}
              openFlagCount={openFlagCount}
              canTranslate={mayTranslate}
              unavailableReason="Running the translation assist is the Policy & Advocacy Officer's and the Programme Director's work."
            />
            <Origin signal={brief.signal} />
            <CitationList evidence={brief.evidence} />
            <GenerationProvenance
              generatingModel={brief.generatingModel}
              promptVersion={brief.promptVersion}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4 laptop:order-1">
            <AudienceSwitcher
              briefId={brief.id}
              audience={brief.audience}
              evidence={brief.evidence.map((item) => ({
                id: item.id,
                citationKey: item.citationKey,
              }))}
              canReframe={mayReframe}
              unavailableReason={
                canGenerateBrief(staffUser.role)
                  ? `This brief has been ${BRIEF_STATUS_LABELS[brief.status].toLowerCase()}, so it is no longer reframed in place. Ask the Programme Director to send it back if it needs a different reader.`
                  : "Reframing a brief for a different reader is the Policy & Advocacy Officer's and the Programme Director's work."
              }
            />
            <BriefBody bodyText={brief.bodyText} />
            <p className="text-ink-3 max-w-[70ch] text-[12.5px]">
              A downloaded copy carries this brief&rsquo;s status, its evidence
              set, and any claim still being checked. Every move this brief makes
              is a person&rsquo;s decision, recorded with their name and the
              time.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Where this brief came from.
 *
 * A manual draft says so IN WORDS rather than rendering an empty row: "no signal
 * recorded" beside a blank field would read as missing data, and the two are
 * different facts. The link back is the other half of the pair the Impact
 * Tracker will follow — signal → brief → outcome.
 */
function Origin({
  signal,
}: {
  signal: { id: string; title: string; sourceName: string } | null;
}) {
  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-1.5 border p-4">
      <h2 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
        Drafted from
      </h2>
      {signal === null ? (
        <p className="text-ink-3 text-[12.5px]">
          No signal — this brief was drafted manually from a pasted policy
          document.
        </p>
      ) : (
        <>
          <Link
            href={`/signals/${signal.id}`}
            className="text-primary-ink focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] text-[13px] leading-snug font-medium underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {signal.title}
          </Link>
          <p className="text-ink-3 text-[12.5px]">
            Picked up from {signal.sourceName} by the Policy Radar.
          </p>
        </>
      )}
    </section>
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
