import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import {
  canGenerateBrief,
  canRequestEvidenceRematch,
} from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { GENERATION_EVIDENCE_CONTEXT_SIZE } from "@/lib/briefs/generation-limits";
import { findSignalDetail, type SignalDetail } from "@/lib/db";
import { findRadarSourceByName } from "@/lib/radar/sources";
import { cn } from "@/lib/utils";

import { BRIEF_STATUS_LABELS, formatGeneratedAt } from "../../briefs/labels";
import {
  AUDIENCE_TARGET_LABELS,
  describeSignalPrefill,
  formatSignalDate,
  formatSignalDateTime,
  GEOGRAPHY_LABELS,
  IMPACT_AREA_LABELS,
  MATCH_OUTCOME_LABELS,
  RELEVANCE_BADGE,
  RELEVANCE_LABELS,
  URGENCY_LABELS,
  URGENCY_RAMP,
} from "../labels";
import { MatchedEvidence } from "./matched-evidence";

export const metadata = {
  title: "Signal · EviBrief",
};

/**
 * One signal: what was picked up, how it was classified, what evidence the
 * Matcher found, and who has moved it since.
 *
 * NOTHING ON THIS PAGE IMPLIES THE SYSTEM DECIDED ANYTHING (§8.8). The
 * classification is a suggestion from a model pass; the match set is what
 * retrieval returned; the reclassification history is a record of people.
 *
 * THE GENERATE CONTROL IS A LINK A PERSON PRESSES. Detection triggers the
 * Evidence Matcher and stops there (§8.4); nothing on this path generates
 * anything automatically, and no urgency makes it happen by itself. It is
 * offered whatever the matcher found — a gap does not block generation, because
 * blocking would be the system deciding — and its supporting line says plainly
 * what the officer will be starting from.
 *
 * The DAL call, not the layout, is the check that matters (§10.1).
 */
export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staffUser = await requireStaffUser();

  const { id } = await params;
  const signal = await findSignalDetail(id);

  if (!signal) notFound();

  // Presentation only. The action authorises its own caller server-side (§10.1).
  const mayRematch = canRequestEvidenceRematch(staffUser.role);

  // Also presentation only: the generation surface refuses a role that may not
  // generate, and all three generation actions refuse again server-side.
  const mayGenerate = canGenerateBrief(staffUser.role);

  // What would actually be preselected — the generator's context size is the
  // ceiling, so the line cannot promise more than the form will offer.
  const preselectableCount = Math.min(
    signal.matches.length,
    GENERATION_EVIDENCE_CONTEXT_SIZE,
  );

  const ramp = URGENCY_RAMP[signal.urgency];

  // HOW this signal was found, from the registry that decides it. A grounded
  // source has no feed and no page: a model searched, and what it reported is
  // what the classification pass then read. That provenance has to be on the
  // page, because the summary looks identical to one derived from a notice the
  // radar fetched in full, and it is not the same thing (§8.8).
  const foundBySearch =
    findRadarSourceByName(signal.sourceName)?.method === "grounded";

  return (
    <>
      <PageHeader
        title={signal.title}
        subtitle={
          <>
            {signal.sourceName} · picked up {formatSignalDate(signal.detectedAt)}
          </>
        }
      >
        <Link href="/signals" className={buttonVariants({ variant: "outline" })}>
          Back to the board
        </Link>
        {mayGenerate ? (
          <span className="flex flex-col items-start gap-1 tablet:items-end">
            <Link
              href={`/briefs/new?signal=${signal.id}`}
              className={buttonVariants({ variant: "default" })}
            >
              Draft a brief from this signal
            </Link>
            <span className="text-ink-3 max-w-[38ch] text-[12.5px] leading-snug tablet:text-right">
              {describeSignalPrefill({
                outcome: signal.matchRuns[0]?.outcome ?? null,
                matchedCount: preselectableCount,
              })}
            </span>
          </span>
        ) : null}
      </PageHeader>

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        <div className="grid min-w-0 grid-cols-1 gap-4 laptop:grid-cols-[minmax(0,1fr)_minmax(0,340px)] laptop:items-start desktop:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex min-w-0 flex-col gap-4">
            <section
              className={cn(
                "bg-card rounded-card shadow-raised flex flex-col gap-3 border border-l-[3px] p-4 tablet:p-5",
                ramp.card,
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={cn(
                    "text-[10.5px] font-semibold tracking-[0.06em] uppercase",
                    ramp.eyebrow,
                  )}
                >
                  {URGENCY_LABELS[signal.urgency]}
                  <span className="sr-only"> urgency</span>
                </p>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
                    RELEVANCE_BADGE[signal.relevance],
                  )}
                >
                  {RELEVANCE_LABELS[signal.relevance]}
                  <span className="sr-only"> relevance</span>
                </span>
              </div>

              {/* Generated prose — the classification pass wrote it — so the sans,
                  never the serif (§11.6). */}
              <p className="text-ink max-w-[70ch] text-[14px] leading-[1.55]">
                {signal.summaryText}
              </p>

              {/* Also generated prose, and also the sans. The serif is for
                  material a source actually wrote (§11.6) — there is none here,
                  which is exactly what this line says. */}
              {foundBySearch ? (
                <p className="text-ink-3 max-w-[70ch] text-[12.5px] leading-[1.5]">
                  This source is monitored by search rather than read from a feed
                  or a page. The summary above was written from search results,
                  not quoted from the publication — open the source to read what
                  it says.
                </p>
              ) : null}

              <p className="text-ink-3 text-[12.5px]">
                Urgency and relevance were suggested by the classification pass.
                Anyone who monitors signals can move this on the board; the change
                is recorded with their name and the time.
              </p>
            </section>

            <MatchedEvidence
              signalId={signal.id}
              impactArea={signal.impactArea}
              matches={signal.matches}
              ineligibleMatchCount={signal.ineligibleMatchCount}
              runs={signal.matchRuns}
              canRematch={mayRematch}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Classification signal={signal} />
            <DraftedBriefs signal={signal} />
            <ReclassificationHistory signal={signal} />
            <MatchRunHistory signal={signal} />
          </div>
        </div>
      </div>
    </>
  );
}

function Classification({ signal }: { signal: SignalDetail }) {
  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-3 border p-4">
      <h2 className="text-ink-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase">
        Classification
      </h2>
      <dl className="flex flex-col gap-2 text-[13px]">
        <Row label="Impact area" value={IMPACT_AREA_LABELS[signal.impactArea]} />
        <Row label="Geography" value={GEOGRAPHY_LABELS[signal.geography]} />
        <Row
          label="Audience"
          value={
            signal.audienceTarget
              ? AUDIENCE_TARGET_LABELS[signal.audienceTarget]
              : "Not recorded"
          }
        />
      </dl>
      {/* External and untrusted: a link, never fetched, never embedded (§18). */}
      <a
        href={signal.sourceUrl}
        rel="noreferrer"
        target="_blank"
        className="text-primary-ink focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] text-[12.5px] break-words underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Open the source at {signal.sourceName}
      </a>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-3 shrink-0 text-[12px]">{label}</dt>
      <dd className="text-ink-2 text-right">{value}</dd>
    </div>
  );
}

/**
 * What people have drafted from this signal.
 *
 * The evidence → brief half of the trail the Impact Tracker will read, rendered
 * now rather than left as a stored relation nobody can see. Status is the
 * brief's own, unchanged by anything here — a draft listed here is a draft, and
 * nothing on this page moves it (§8.3).
 */
function DraftedBriefs({ signal }: { signal: SignalDetail }) {
  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-3 border p-4">
      <h2 className="text-ink-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase">
        Briefs from this signal
      </h2>
      {signal.briefs.length === 0 ? (
        <p className="text-ink-3 text-[12.5px]">
          Nothing has been drafted from this signal yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {signal.briefs.map((brief) => (
            <li key={brief.id} className="flex flex-col gap-0.5 text-[12.5px]">
              <Link
                href={`/briefs/${brief.id}`}
                className="text-primary-ink focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] font-medium underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {briefTypeLabel(brief.briefType)}
              </Link>
              <span className="text-ink-3 text-[11.5px]">
                For {audienceLabel(brief.audience)} ·{" "}
                {BRIEF_STATUS_LABELS[brief.status]} · version{" "}
                <span className="font-mono">{brief.version}</span> ·{" "}
                {formatGeneratedAt(brief.generatedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Who moved this signal, and when. The audit half of §8.6 — the rule is only
 * worth having if the record is somewhere a person can read it.
 */
function ReclassificationHistory({ signal }: { signal: SignalDetail }) {
  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-3 border p-4">
      <h2 className="text-ink-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase">
        Urgency history
      </h2>
      {signal.reclassifications.length === 0 ? (
        <p className="text-ink-3 text-[12.5px]">
          Nobody has moved this signal since it was picked up.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {signal.reclassifications.map((change) => (
            <li key={change.id} className="flex flex-col gap-0.5 text-[12.5px]">
              <span className="text-ink-2">
                {URGENCY_LABELS[change.previousUrgency]} →{" "}
                <span className="font-semibold">
                  {URGENCY_LABELS[change.newUrgency]}
                </span>
              </span>
              <span className="text-ink-3 text-[11.5px]">
                {change.actorName} · {formatSignalDateTime(change.changedAt)}
              </span>
              {change.reason ? (
                <span className="text-ink-3 text-[11.5px]">{change.reason}</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Every attempt the Matcher made, including the ones that found nothing.
 *
 * This is the run row doing the job it was written for: a gap and a matcher that
 * never ran are different facts, and so are a quiet corpus and a broken rerank
 * (`evidence-matcher` rule 4). Counts only — never a candidate's title, never an
 * excerpt (§7.6).
 */
function MatchRunHistory({ signal }: { signal: SignalDetail }) {
  if (signal.matchRuns.length === 0) return null;

  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-3 border p-4">
      <h2 className="text-ink-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase">
        Match runs
      </h2>
      <ol className="flex flex-col gap-2.5">
        {signal.matchRuns.map((run) => (
          <li key={run.id} className="flex flex-col gap-0.5 text-[12.5px]">
            <span className="text-ink-2">{MATCH_OUTCOME_LABELS[run.outcome]}</span>
            <span className="text-ink-3 font-mono text-[11px]">
              {formatSignalDateTime(run.startedAt)} · {run.candidateCount}{" "}
              considered · {run.matchedCount} kept
              {run.refusedCount > 0 ? ` · ${run.refusedCount} held back` : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
