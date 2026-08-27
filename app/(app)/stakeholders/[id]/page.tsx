import Link from "next/link";
import { notFound } from "next/navigation";

import { AudienceTypeBadge } from "@/components/audience-type-badge";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import { canManageStakeholders } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import {
  findStakeholderDetail,
  type StakeholderShare,
} from "@/lib/db/stakeholders";

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
        breadcrumbs={[
          { label: "Stakeholders", href: "/stakeholders" },
          { label: stakeholder.name },
        ]}
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

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-6 p-4 tablet:p-6 desktop:px-10">
        {/* Brief history left (primary), the record itself right (secondary).
            The panel's border flips from left to top when the column stacks below `laptop`
            (design-system.md, responsive rules). */}
        <div className="grid min-w-0 grid-cols-1 gap-6 laptop:grid-cols-[minmax(0,1fr)_minmax(0,340px)] laptop:items-start">
          <ShareHistory shares={stakeholder.shares} />

          {/* Contact record edit rail */}
          <section
            aria-labelledby="contact-record-heading"
            className="bg-card border-line rounded-card flex min-w-0 flex-col gap-4 border p-4 shadow-raised tablet:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="contact-record-heading"
                className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
              >
                Contact record
              </h2>
              {stakeholder.audienceType ? (
                <AudienceTypeBadge audienceType={stakeholder.audienceType} />
              ) : null}
            </div>

            {!stakeholder.audienceType ? (
              <p className="text-ink-3 text-[12.5px]">
                No audience type recorded.
              </p>
            ) : null}

            <div className="border-line border-t pt-3">
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
            </div>

            {stakeholder.preferredLanguage !== null &&
            stakeholder.preferredLanguage !== "English" &&
            stakeholder.preferredLanguage !== "Twi" ? (
              <p className="text-ink-3 bg-stone/40 border-line rounded-card border p-2.5 text-[12px]">
                A language was recorded that the form does not offer:{" "}
                <span className="text-ink font-medium">
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
      className="bg-card border-line rounded-card flex min-w-0 flex-col gap-4 border p-4 shadow-raised tablet:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="share-history-heading"
          className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
        >
          Briefs logged as shared{" "}
          <span className="font-mono tabular-nums">({shares.length})</span>
        </h2>
      </div>

      {shares.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-3">
          <p className="text-ink-3 max-w-[62ch] text-[13px] leading-relaxed">
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
        <ol className="flex min-w-0 flex-col gap-4">
          {shares.map((share) => (
            <li
              key={share.briefId}
              className="border-line flex min-w-0 flex-col gap-2 border-t pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/briefs/${share.briefId}`}
                  className="text-primary-ink focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] text-[14.5px] leading-snug font-semibold break-words underline underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {share.briefTitle}
                </Link>

                <span
                  className="bg-surface-tint text-primary-ink border-surface-tint-border rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] uppercase"
                  aria-label={`Brief status: ${BRIEF_STATUS_LABELS[share.briefStatus]}`}
                >
                  {BRIEF_STATUS_LABELS[share.briefStatus]}
                </span>
              </div>

              <p className="text-ink-3 text-[12.5px]">
                {briefTypeLabel(share.briefType)} · written for{" "}
                {audienceLabel(share.briefAudience)}
              </p>

              <p className="text-ink-3 font-mono text-[11.5px] tabular-nums">
                Logged by {share.sharedByName ?? "a member of staff"} on{" "}
                {formatSharedAt(share.sharedAt)}
              </p>

              {share.note ? (
                <div className="bg-stone/30 border-line rounded-card mt-1 border p-3">
                  <p className="text-ink text-[13px] leading-relaxed break-words">
                    {share.note}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
