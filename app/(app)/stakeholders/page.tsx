import Link from "next/link";

import { AudienceTypeBadge } from "@/components/audience-type-badge";
import { PageHeader } from "@/components/page-header";
import { canManageStakeholders } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import {
  listStakeholders,
  type StakeholderListItem,
} from "@/lib/db/stakeholders";
import type { AudienceTarget } from "@/lib/generated/prisma/enums";

import { CreateStakeholderPanel } from "./create-panel";
import {
  AUDIENCE_TARGET_LABELS,
  AUDIENCE_TARGET_ORDER,
  UNGROUPED_LABEL,
} from "./labels";
import { CrmNotForYourRole } from "./role-panel";

export const metadata = {
  title: "Stakeholders · EviBrief",
};

/**
 * The contact list, grouped by audience type.
 *
 * WHO SEES THIS: `canManageStakeholders` — Programme Director and Policy &
 * Advocacy Officer (§10.3). A Field Officer has no CRM access at all (§10.5),
 * and a Research Officer is refused too: §10.4 describes evidence and accuracy
 * work with no CRM component, and §10.3 assigns stakeholder relationships to
 * the Policy & Advocacy Officer. That reading is recorded here so the next
 * person can disagree with it deliberately rather than re-derive it.
 *
 * This gate is the RENDER path. Every action authorises its own caller
 * server-side regardless of what was rendered (§10.1).
 */
export default async function StakeholdersPage() {
  const staffUser = await requireStaffUser();

  if (!canManageStakeholders(staffUser.role)) return <CrmNotForYourRole />;

  const stakeholders = await listStakeholders();

  const grouped = groupByAudience(stakeholders);

  return (
    <>
      <PageHeader
        title="Stakeholders"
        subtitle="Who the briefs are written for, and which briefs have reached them. Every share on this page was logged by a person."
      />

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-6 p-4 tablet:p-6">
        <CreateStakeholderPanel defaultOpen={stakeholders.length === 0} />

        {stakeholders.length === 0 ? (
          <EmptyStakeholdersState />
        ) : (
          grouped.map((group) => (
            <section key={group.key} className="flex min-w-0 flex-col gap-3">
              <h2 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                {group.label}{" "}
                <span className="font-mono tabular-nums">
                  ({group.items.length})
                </span>
              </h2>
              <ul className="grid min-w-0 grid-cols-1 gap-3 laptop:grid-cols-2 desktop:grid-cols-3">
                {group.items.map((stakeholder) => (
                  <li key={stakeholder.id} className="min-w-0">
                    <StakeholderCard stakeholder={stakeholder} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}

type Group = {
  key: string;
  label: string;
  items: StakeholderListItem[];
};

/**
 * Enum order, which is the spec's order, and nothing re-sorts it by count.
 * Contacts with no audience type recorded are last and say so plainly rather
 * than being filed under a guess.
 */
function groupByAudience(stakeholders: StakeholderListItem[]): Group[] {
  const groups: Group[] = AUDIENCE_TARGET_ORDER.map((value) => ({
    key: value,
    label: AUDIENCE_TARGET_LABELS[value as AudienceTarget],
    items: stakeholders.filter((item) => item.audienceType === value),
  })).filter((group) => group.items.length > 0);

  const ungrouped = stakeholders.filter((item) => item.audienceType === null);

  if (ungrouped.length > 0) {
    groups.push({ key: "none", label: UNGROUPED_LABEL, items: ungrouped });
  }

  return groups;
}

function StakeholderCard({
  stakeholder,
}: {
  stakeholder: StakeholderListItem;
}) {
  return (
    <Link
      href={`/stakeholders/${stakeholder.id}`}
      className="bg-card border-line rounded-card shadow-raised hover:border-sage focus-visible:ring-accent group flex h-full min-w-0 cursor-pointer flex-col gap-2.5 border p-4 no-underline transition-colors duration-150 hover:no-underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-ink group-hover:text-primary text-[15px] leading-snug font-semibold break-words">
          {stakeholder.name}
        </span>
        <span className="text-ink-3 text-[13px] leading-snug break-words">
          {[stakeholder.role, stakeholder.organisation]
            .filter(Boolean)
            .join(" · ") || "No organisation recorded"}
        </span>
      </div>

      {stakeholder.audienceType ? (
        <div className="mt-1">
          <AudienceTypeBadge audienceType={stakeholder.audienceType} />
        </div>
      ) : null}

      <div className="border-line text-ink-3 mt-auto flex items-center justify-between border-t pt-2.5 font-mono text-[11.5px] tabular-nums">
        <span>
          {stakeholder.shareCount}{" "}
          {stakeholder.shareCount === 1 ? "brief logged" : "briefs logged"}
        </span>
        {stakeholder.preferredLanguage ? (
          <span className="text-ink-2 bg-stone rounded px-1.5 py-0.5 text-[11px] font-medium">
            {stakeholder.preferredLanguage}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * The empty state carries a real next step rather than a blank panel
 * (§17.6) — and the step is already open above it, so this explains rather
 * than repeats.
 */
function EmptyStakeholdersState() {
  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      {/* Concentric contour rings — abstract structural mark, no icon asset. */}
      <span
        aria-hidden="true"
        className="mx-4 mt-4 mb-5 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h2 className="text-ink text-[15px] font-semibold">No contacts yet</h2>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        Add the people and institutions the briefs are written for. Once a
        contact exists, a brief&rsquo;s page gains a control for logging that
        someone sent it to them — which is how a brief&rsquo;s history of who it
        reached gets built.
      </p>
    </div>
  );
}
