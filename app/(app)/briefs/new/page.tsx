import Link from "next/link";
import { z } from "zod";

import { ClassificationPendingAlert } from "@/components/classification-pending-alert";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { canGenerateBrief } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import {
  countPendingClassification,
  findSignalBriefPrefill,
  listEligibleEvidence,
  loadEvidenceListItems,
} from "@/lib/db";

import { GenerateBriefForm } from "./generate-form";
import type { SignalPrefill } from "./signal-context";

export const metadata = {
  title: "Generate a brief · EviBrief",
};

/**
 * The generation screen.
 *
 * The evidence offered here is `listEligibleEvidence` — the same gated listing
 * the library uses — so the picker cannot show an item the gate would refuse.
 * That is PRESENTATION, not the control: `startBriefGeneration` re-reads every
 * selected item at generation time and puts it through the gate itself (§7.1).
 *
 * `?signal=` OPENS THE SAME FORM WITH DEFAULTS, not a second generator. The
 * signal is a source of prefilled values; the three-stage sequence, the
 * rate-limit resume and the gate re-read behind it are one implementation.
 *
 * A MALFORMED OR UNKNOWN ID FALLS BACK TO THE PLAIN MANUAL FORM rather than
 * 404ing. The parameter is a convenience, not the identity of the page — a stale
 * link should still let an officer write the brief.
 */
export default async function NewBriefPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staffUser = await requireStaffUser();

  const requestedSignalId = readSignalId(await searchParams);

  const [evidence, pendingCount, prefill] = await Promise.all([
    listEligibleEvidence(),
    countPendingClassification(),
    requestedSignalId === null ? null : loadSignalPrefill(requestedSignalId),
  ]);

  // A rendered gate, never the enforcement boundary — the three actions refuse
  // server-side whatever this renders (§10.1).
  if (!canGenerateBrief(staffUser.role)) {
    return (
      <>
        <PageHeader title="Generate a brief" />
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-4 tablet:p-6">
          <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
            <h2 className="text-ink text-[15px] font-semibold">
              Not available for your role
            </h2>
            <p className="text-ink-3 max-w-[62ch] text-[13px]">
              Drafting a brief is a Policy &amp; Advocacy Officer or Programme
              Director task. You can still read every draft on the briefs screen.
            </p>
            <Link href="/briefs" className={buttonVariants({ variant: "outline" })}>
              Back to briefs
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Generate a brief"
        breadcrumbs={[
          { label: "Briefs", href: "/briefs" },
          { label: "New draft" },
        ]}
        subtitle="Paste the policy document, choose who it is for, and pick the evidence it should draw on. The draft is fact-checked against that evidence before it is saved."
      />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        {/* Governance surface: above the fold at every width, never hidden. */}
        <ClassificationPendingAlert pendingCount={pendingCount} />

        <GenerateBriefForm evidence={evidence.items} prefill={prefill} />
      </div>
    </>
  );
}

/** One `?signal=` value, or nothing. A malformed id is simply not a prefill. */
function readSignalId(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const raw = searchParams.signal;
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (typeof value !== "string") return null;

  // Parsed, never interpolated. It reaches the database as a bound parameter
  // through Prisma and reaches the form as a value the shared schema re-checks.
  return z.uuid().safeParse(value).success ? value : null;
}

/**
 * The signal's defaults, with its matched items hydrated for the picker.
 *
 * THE GATE RUNS TWICE ON THE WAY HERE, and deliberately: `findSignalBriefPrefill`
 * filters the stored matches by `ELIGIBLE_EVIDENCE_WHERE`, and
 * `loadEvidenceListItems` re-applies it to the ids that survived. Neither is the
 * control — `startBriefGeneration` re-reads and re-gates every submitted id
 * (§7.1) — but a downgraded item should never appear as a default in the first
 * place.
 *
 * `policyText` is the radar's TITLE AND SUMMARY, not the source document: the
 * radar stores no document body. The form says so above the field, with the
 * source link beside it, so an officer with the real text can paste it over.
 * A prefill shorter than the schema's minimum is not an error on arrival — the
 * field validates on submit, exactly as it does for a manual draft.
 */
async function loadSignalPrefill(
  signalId: string,
): Promise<SignalPrefill | null> {
  const signal = await findSignalBriefPrefill(signalId);

  if (!signal) return null;

  const items = await loadEvidenceListItems(
    signal.matches.map((match) => match.evidenceItemId),
  );
  const byId = new Map(items.map((item) => [item.id, item]));

  return {
    signalId: signal.id,
    title: signal.title,
    summaryText: signal.summaryText,
    sourceName: signal.sourceName,
    sourceUrl: signal.sourceUrl,
    urgency: signal.urgency,
    relevance: signal.relevance,
    latestMatchOutcome: signal.latestMatchOutcome,
    policyText: `${signal.title}\n\n${signal.summaryText}`,
    matched: signal.matches.flatMap((match) => {
      const item = byId.get(match.evidenceItemId);

      return item ? [{ item, rerankScore: match.rerankScore }] : [];
    }),
  };
}
