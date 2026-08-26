import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { AUDIENCE_PROFILES, audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import { canGenerateBrief } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { findBriefForReframe, isEditableStatus } from "@/lib/db";
import { BriefAudience, BriefStatus } from "@/lib/generated/prisma/enums";

import { BRIEF_STATUS_LABELS } from "../../labels";
import { ReframeRunner } from "./reframe-run";

export const metadata = {
  title: "Reframe brief · EviBrief",
};

/**
 * The audience switch's own surface: the stepper while it runs, the diff when it
 * lands.
 *
 * AUTHORISES SERVER-SIDE, HERE AND AGAIN IN EVERY ACTION. The switcher on the
 * brief page offering no reframe for a `reviewed` brief is presentation; these
 * checks and the ones inside the actions are the control (§10.1). A role that
 * may not reframe gets a calm panel saying so — not a blank page and not an
 * error.
 *
 * A reframe IS a generation, so the authority is the generation matrix
 * (`canGenerateBrief`) and not the editing one. A Research Officer may resolve
 * the flags a reframe produces (§10.4) and may not produce them.
 *
 * Object-level: the brief must exist and must still be `draft`. Reframing a
 * `reviewed` brief would change the document after the Director approved it, so
 * a brief past `draft` is sent back first — the same line `isEditableStatus`
 * already draws for editing, drawn in the same place.
 *
 * THE AUDIENCE COMES FROM A SEARCH PARAMETER, so it is untrusted: it is narrowed
 * to the enum here and re-validated by the shared Zod schema inside the action.
 * Nothing else about the run comes from the browser — the policy text, the
 * evidence set and the brief type are read from the brief's own records.
 */
export default async function BriefReframePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ audience?: string | string[] }>;
}) {
  const staffUser = await requireStaffUser();
  const { id } = await params;

  if (!canGenerateBrief(staffUser.role)) {
    return (
      <NotAvailable
        title="Reframing is not part of your role"
        body="Reframing a brief for a different reader is a generation, so it is the Policy & Advocacy Officer's and the Programme Director's work. You can still read this brief in full."
        briefId={id}
      />
    );
  }

  const brief = await findBriefForReframe(id);

  if (!brief) notFound();

  if (!isEditableStatus(brief.status)) {
    return (
      <NotAvailable
        title={`This brief has been ${BRIEF_STATUS_LABELS[brief.status].toLowerCase()}`}
        body={
          brief.status === BriefStatus.reviewed
            ? "An approval attaches to a document, so an approved brief cannot be reframed — the Programme Director's approval would otherwise sit on text they never read. If it needs a different reader, ask the Director to send it back."
            : "A brief that has left the building is no longer reframed in place. Its full text and every version behind it stay on the brief's page."
        }
        briefId={id}
      />
    );
  }

  const requested = await searchParams;
  const audience = toAudience(requested.audience);

  if (audience === null || audience === brief.audience) {
    return (
      <NotAvailable
        title="Choose a different reader"
        body={
          audience === brief.audience
            ? `This brief is already written for ${audienceLabel(brief.audience)}. Pick another reader from the switcher on the brief.`
            : "Pick a reader from the switcher on the brief to see what reframing would change."
        }
        briefId={id}
      />
    );
  }

  const profile = AUDIENCE_PROFILES[audience];

  return (
    <>
      <PageHeader
        title={briefTypeLabel(brief.briefType)}
        breadcrumbs={[
          { label: "Briefs", href: "/briefs" },
          { label: briefTypeLabel(brief.briefType), href: `/briefs/${brief.id}` },
          { label: `Reframe (${profile.label})` },
        ]}
        subtitle={
          <>
            Reframing from {audienceLabel(brief.audience)} to {profile.label} ·
            version <span className="font-mono">{brief.version}</span>
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

      <ReframeRunner
        briefId={brief.id}
        audience={audience}
        fromAudienceLabel={audienceLabel(brief.audience)}
        toAudienceLabel={profile.label}
        toFramingEmphasis={profile.framingEmphasis}
        toTone={profile.tone}
        currentVersion={brief.version}
        evidenceCount={brief.evidenceItemIds.length}
        policyText={brief.policyText}
      />
    </>
  );
}

/** A query parameter as one of the five, or nothing. */
function toAudience(value: string | string[] | undefined): BriefAudience | null {
  const single = Array.isArray(value) ? value[0] : value;

  if (single === undefined) return null;

  return (Object.values(BriefAudience) as string[]).includes(single)
    ? (single as BriefAudience)
    : null;
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
    <PageHeader title={title} subtitle={body}>
      <Link
        href={`/briefs/${briefId}`}
        className={buttonVariants({ variant: "outline" })}
      >
        Back to the brief
      </Link>
    </PageHeader>
  );
}
