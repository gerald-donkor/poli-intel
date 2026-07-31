import Link from "next/link";

import { GuardFlagIcon } from "@/components/guard-flag-icon";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import { canGenerateBrief } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { listBriefs, type BriefListItem } from "@/lib/db";
import { BriefStatus } from "@/lib/generated/prisma/enums";

import { BRIEF_STATUS_LABELS, formatGeneratedAt } from "./labels";

export const metadata = {
  title: "Briefs · EviBrief",
};

/**
 * Drafts by status.
 *
 * Only completed generations appear: a `Brief` row exists solely as the output
 * of the transaction that runs after the fact-check pass, so an attempt still
 * drafting or verifying is structurally absent from this list (§9.1).
 */
export default async function BriefsPage() {
  const staffUser = await requireStaffUser();
  const briefs = await listBriefs();

  const mayGenerate = canGenerateBrief(staffUser.role);

  return (
    <>
      <PageHeader
        title="Briefs"
        subtitle="Drafts, submissions, and position papers. Every draft is reviewed by a person before it leaves the building."
      >
        {/* Presentation only. The generation actions authorise server-side
            regardless of what is rendered here (§10.1). */}
        {mayGenerate ? (
          <Link href="/briefs/new" className={buttonVariants()}>
            Generate a brief
          </Link>
        ) : null}
      </PageHeader>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 tablet:p-6">
        {briefs.length === 0 ? (
          <EmptyBriefsState mayGenerate={mayGenerate} />
        ) : (
          STATUS_ORDER.map((status) => {
            const group = briefs.filter((brief) => brief.status === status);

            if (group.length === 0) return null;

            return (
              <section key={status} className="flex flex-col gap-3">
                <h2 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                  {BRIEF_STATUS_LABELS[status]}{" "}
                  <span className="font-mono tabular-nums">
                    ({group.length})
                  </span>
                </h2>
                <ul className="grid grid-cols-1 gap-3 laptop:grid-cols-2 desktop:grid-cols-3">
                  {group.map((brief) => (
                    <li key={brief.id}>
                      <BriefCard brief={brief} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}

/** Working order, not enum order: what is being worked on comes first. */
const STATUS_ORDER = [
  BriefStatus.draft,
  BriefStatus.reviewed,
  BriefStatus.submitted,
  BriefStatus.published,
] as const;

function BriefCard({ brief }: { brief: BriefListItem }) {
  return (
    <Link
      href={`/briefs/${brief.id}`}
      className="bg-card border-line rounded-card shadow-raised hover:border-sage flex h-full flex-col gap-2 border p-4 no-underline transition-colors duration-150 hover:no-underline"
    >
      <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
        {briefTypeLabel(brief.briefType)}
      </span>
      <span className="text-ink text-[15px] leading-snug font-semibold">
        {brief.title}
      </span>
      <span className="text-ink-3 text-[13px]">
        For {audienceLabel(brief.audience)}
      </span>

      {brief.openFlagCount > 0 ? (
        // A governance surface, so it is never what gets dropped at a smaller
        // width. Slate, never red, and it names what it means (§9.7).
        <span className="bg-watch-surface border-watch-border text-watch-ink mt-1 inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold">
          <GuardFlagIcon className="size-3.5" />
          {brief.openFlagCount}{" "}
          {brief.openFlagCount === 1 ? "claim needs" : "claims need"} checking
        </span>
      ) : null}

      <span className="text-ink-3 mt-auto pt-2 font-mono text-[11.5px]">
        {formatGeneratedAt(brief.generatedAt)}
        {brief.createdByName ? ` · ${brief.createdByName}` : ""}
      </span>
    </Link>
  );
}

function EmptyBriefsState({ mayGenerate }: { mayGenerate: boolean }) {
  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      {/* Concentric contour rings — abstract structural mark, no icon asset. */}
      <span
        aria-hidden="true"
        className="mx-4 mt-4 mb-5 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h2 className="text-ink text-[15px] font-semibold">No briefs yet</h2>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        {mayGenerate
          ? "Paste a policy document, choose an audience, and pick the evidence the brief should draw on. Every draft is fact-checked against that evidence before it is saved."
          : "Nothing has been drafted yet. Generating a brief is a Policy & Advocacy Officer or Programme Director task."}
      </p>
      {mayGenerate ? (
        <Link href="/briefs/new" className={buttonVariants()}>
          Generate a brief
        </Link>
      ) : null}
    </div>
  );
}
