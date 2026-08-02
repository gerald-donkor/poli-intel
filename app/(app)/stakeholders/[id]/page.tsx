import Link from "next/link";
import { notFound } from "next/navigation";

import { AudienceTypeBadge } from "@/components/audience-type-badge";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import { canManageStakeholders } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { findStakeholderDetail, type StakeholderShare } from "@/lib/db";

import { BRIEF_STATUS_LABELS } from "../../briefs/labels";
import { formatSharedAt } from "../labels";
import { CrmNotForYourRole } from "../role-panel";
import { StakeholderForm } from "../stakeholder-form";

export const metadata = {
  title: "Contact · EviBrief",
};

/**
 * One contact: their details, a form for correcting them, and the briefs they
 * have been sent.
 *
 * The same role reading as the list — see the comment on `/stakeholders`. The
 * render gate here is presentation; the update action authorises its own caller
 * (§10.1).
 *
 * There is no delete control, deliberately: a CRM whose history can be quietly
 * removed is a worse audit surface than one that cannot, and the Impact Tracker
 * reads these rows.
 */
export default async function StakeholderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staffUser = await requireStaffUser();

  if (!canManageStakeholders(staffUser.role)) return <CrmNotForYourRole />;

  const { id } = await params;
  const stakeholder = await findStakeholderDetail(id);

  if (!stakeholder) notFound();

  return (
    <>
      <PageHeader
        title={stakeholder.name}
        subtitle={
          [stakeholder.role, stakeholder.organisation]
            .filter(Boolean)
            .join(" · ") || "No organisation recorded"
        }
      >
        <Link
          href="/stakeholders"
          className={buttonVariants({ variant: "outline" })}
        >
          All contacts
        </Link>
      </PageHeader>

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        {/* Brief history left, the record itself right. The panel's border flips
            from left to top when the column stacks below `laptop`
            (design-system.md, responsive rules). */}
        <div className="grid min-w-0 grid-cols-1 gap-4 laptop:grid-cols-[minmax(0,1fr)_minmax(0,320px)] laptop:items-start">
          <ShareHistory shares={stakeholder.shares} />

          {/* The handoff's side-panel rule: the border flips from left to top
              when the column becomes a stacked row below `laptop`. */}
          <section
            aria-labelledby="contact-record-heading"
            className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border-t p-4 laptop:border-t-0 laptop:border-l"
          >
            <h2
              id="contact-record-heading"
              className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
            >
              Record
            </h2>

            {stakeholder.audienceType ? (
              <AudienceTypeBadge audienceType={stakeholder.audienceType} />
            ) : (
              <p className="text-ink-3 text-[12.5px]">
                No audience type recorded.
              </p>
            )}

            <StakeholderForm
              existing={{
                id: stakeholder.id,
                name: stakeholder.name,
                organisation: stakeholder.organisation,
                role: stakeholder.role,
                audienceType: stakeholder.audienceType ?? "",
                preferredLanguage:
                  stakeholder.preferredLanguage === "English" ||
                  stakeholder.preferredLanguage === "Twi"
                    ? stakeholder.preferredLanguage
                    : "",
              }}
            />

            {stakeholder.preferredLanguage !== null &&
            stakeholder.preferredLanguage !== "English" &&
            stakeholder.preferredLanguage !== "Twi" ? (
              <p className="text-ink-3 text-[12.5px]">
                A language was recorded that the form does not offer:{" "}
                <span className="text-ink-2">
                  {stakeholder.preferredLanguage}
                </span>
                . Saving this form replaces it.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}

/**
 * What this contact has been sent, newest first.
 *
 * A real list, so it is navigable as one. Each row names the brief, what kind
 * of brief it is, the audience it was WRITTEN for — which is a different
 * taxonomy from the contact's own audience type and is never mapped on to it —
 * its status at the time of reading, and who logged the share.
 *
 * The note is a staff member's own words, so it is Inter and not the serif: the
 * serif is reserved for quoted source material, and that distinction is how a
 * reader tells the two apart everywhere else in the product (§11.6).
 */
function ShareHistory({ shares }: { shares: StakeholderShare[] }) {
  return (
    <section
      aria-labelledby="share-history-heading"
      className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border p-4"
    >
      <h2
        id="share-history-heading"
        className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
      >
        Briefs logged as shared{" "}
        <span className="font-mono tabular-nums">({shares.length})</span>
      </h2>

      {shares.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-ink-3 max-w-[62ch] text-[13px]">
            Nothing has been logged as shared with this contact yet. A share is
            recorded from a brief&rsquo;s own page, by the person who sent it.
          </p>
          <Link
            href="/briefs"
            className={buttonVariants({ variant: "outline" })}
          >
            Open the briefs
          </Link>
        </div>
      ) : (
        <ol className="flex min-w-0 flex-col gap-3">
          {shares.map((share) => (
            <li
              key={share.briefId}
              className="border-line flex min-w-0 flex-col gap-1 border-t pt-3 first:border-t-0 first:pt-0"
            >
              <Link
                href={`/briefs/${share.briefId}`}
                className="text-primary-ink focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] text-[14px] leading-snug font-medium break-words underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {share.briefTitle}
              </Link>
              <p className="text-ink-3 text-[12.5px]">
                {briefTypeLabel(share.briefType)} · written for{" "}
                {audienceLabel(share.briefAudience)} ·{" "}
                {BRIEF_STATUS_LABELS[share.briefStatus].toLowerCase()}
              </p>
              <p className="text-ink-3 font-mono text-[11.5px]">
                Logged by {share.sharedByName ?? "a member of staff"} on{" "}
                {formatSharedAt(share.sharedAt)}
              </p>
              {share.note ? (
                <p className="text-ink-2 mt-1 text-[12.5px] break-words">
                  {share.note}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
