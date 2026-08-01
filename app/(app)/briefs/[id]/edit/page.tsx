import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import { canEditBrief } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import {
  applyFlagMarks,
  buildDocumentFromBodyText,
  parseStoredDocument,
} from "@/lib/briefs/document";
import { findBriefForEdit, isEditableStatus } from "@/lib/db";
import { BriefStatus, FlagStatus } from "@/lib/generated/prisma/enums";

import { BRIEF_STATUS_LABELS } from "../../labels";
import { BriefEditor } from "./brief-editor";

export const metadata = {
  title: "Edit brief · EviBrief",
};

/**
 * The editor route.
 *
 * AUTHORISES SERVER-SIDE, HERE AND AGAIN IN THE ACTION. The Edit link on the
 * read-only page being hidden from roles that may not edit is presentation and
 * is not the control (§10.1). A role that may not edit gets a calm panel saying
 * so — not a blank page and not an error.
 *
 * Object-level, not role-only: the brief must exist, and a `submitted` or
 * `published` brief is not editable by anyone. The save transaction re-checks
 * that, because between this render and a save is exactly where it could change.
 *
 * THE DOCUMENT IS BUILT HERE, server-side (§5.3). Briefs generated before the
 * editor existed carry `documentJson = null` and are built from `bodyText`
 * through the block contract — they open, edit and save correctly; they simply
 * have no citation chips until someone inserts one. No backfill, no migration.
 */
export default async function BriefEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staffUser = await requireStaffUser();
  const { id } = await params;

  if (!canEditBrief(staffUser.role)) {
    return (
      <NotAvailable
        title="Editing is not part of your role"
        body="Refining a brief is the Policy & Advocacy Officer's and the Programme Director's work. You can still read this brief in full."
        briefId={id}
      />
    );
  }

  const brief = await findBriefForEdit(id);

  if (!brief) notFound();

  if (!isEditableStatus(brief.status)) {
    return (
      <NotAvailable
        title={`This brief has been ${BRIEF_STATUS_LABELS[brief.status].toLowerCase()}`}
        body={
          brief.status === BriefStatus.reviewed
            ? "An approval attaches to a document, so an approved brief is no longer editable — otherwise the Programme Director's approval would sit on text they never read. If it needs changes, ask the Director to send it back."
            : "A brief that has left the building is no longer editable. Its full text and every version behind it stay on the brief's page."
        }
        briefId={id}
      />
    );
  }

  const stored = parseStoredDocument(brief.documentJson);

  // Open flags only. A resolved flag is recorded and still readable in the
  // panel; underlining it in the document would say a settled question is still
  // open. Nothing here decides what is flagged — it renders stored records (§9.3).
  const initialDocument = applyFlagMarks(
    stored ?? buildDocumentFromBodyText(brief.bodyText),
    brief.flags
      .filter((flag) => flag.status === FlagStatus.open)
      .map((flag) => ({
        id: flag.id,
        reason: flag.reason,
        anchorFrom: flag.anchorFrom,
        anchorTo: flag.anchorTo,
      })),
  );

  return (
    <>
      <PageHeader
        title={briefTypeLabel(brief.briefType)}
        subtitle={
          <>
            Editing · for {audienceLabel(brief.audience)} ·{" "}
            {BRIEF_STATUS_LABELS[brief.status]} · from version{" "}
            <span className="font-mono">{brief.version}</span>
          </>
        }
      >
        <Link
          href={`/briefs/${brief.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to the brief
        </Link>
      </PageHeader>

      <BriefEditor
        briefId={brief.id}
        version={brief.version}
        initialDocument={initialDocument}
        evidence={brief.evidence}
        flags={brief.flags}
      />
    </>
  );
}

/** A refusal a person can read, with the way onward — never a blank page. */
function NotAvailable({
  title,
  body,
  briefId,
}: {
  title: string;
  body: string;
  briefId: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={body}>
        <Link
          href={`/briefs/${briefId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to the brief
        </Link>
      </PageHeader>
    </>
  );
}
