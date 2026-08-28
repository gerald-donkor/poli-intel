import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  canGenerateImpactReport,
  canLogInfluenceEvent,
  canVerifyInfluenceEvent,
} from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import {
  listBriefOptionsForInfluence,
  listInfluenceEvents,
  readImpactMap,
  readQuarterlyImpactReport,
} from "@/lib/db";
import {
  parseQuarterKey,
  previousQuarter,
  quarterFor,
  recentQuarters,
} from "@/lib/impact/config";

import { InfluenceEventRail } from "./event-rail";
import { ImpactMap } from "./impact-map";
import { LogInfluencePanel } from "./log-panel";
import { QuarterlyReport } from "./quarterly-report";

export const metadata = {
  title: "Impact · EviBrief",
};

/**
 * Where Tropenbos evidence has reached policy.
 *
 * WHO SEES THIS: `canLogInfluenceEvent` — Programme Director and Policy &
 * Advocacy Officer. `/impact` is the Director's screen in spec §5.2's table, but
 * the Policy & Advocacy Officer is who follows briefs into the world day to day.
 * A Research Officer and a Field Officer are refused (§10.4, §10.5).
 *
 * This gate is the RENDER path. Every action authorises its own caller
 * server-side regardless of what was rendered (§10.1).
 *
 * THE MAP DRAWS ONLY WHAT THE RECORD ALREADY HOLDS. `ImpactMap` renders the
 * evidence → brief → outcome lattice beside the rail; with nothing logged it does
 * not render at all and `EmptyImpactState` stands. Nothing on the canvas mutates —
 * confirming an event stays on the rail's `VerifyControl` (§8, §10.1).
 *
 * ONLY A SERVER COMPONENT FETCHES THIS PAGE'S DATA (§5.3). Nothing below polls,
 * and no client-side fetching library is involved.
 */
export default async function ImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ quarter?: string }>;
}) {
  const staffUser = await requireStaffUser();

  if (!canLogInfluenceEvent(staffUser.role)) return <ImpactNotForYourRole />;

  const showReport = canGenerateImpactReport(staffUser.role);
  const { quarter: requestedQuarter } = await searchParams;

  const now = new Date();
  // The previous quarter by default: that is the one a donor report is written
  // about. An unparseable or absent parameter falls back rather than guessing.
  const quarter =
    (requestedQuarter ? parseQuarterKey(requestedQuarter) : null) ??
    previousQuarter(quarterFor(now));

  const [events, briefs, report, map] = await Promise.all([
    listInfluenceEvents(),
    listBriefOptionsForInfluence(),
    showReport
      ? readQuarterlyImpactReport({ start: quarter.start, end: quarter.end })
      : Promise.resolve(null),
    readImpactMap(),
  ]);

  const confirmedCount =
    report !== null
      ? report.events.length
      : events.filter((e) => e.verified).length;

  const unconfirmedCount =
    report !== null
      ? report.unverifiedCount
      : events.filter((e) => !e.verified).length;

  return (
    <>
      <PageHeader
        title="Impact"
        subtitle="Where Tropenbos evidence has reached policy — records staff logged, leads the weekly search found, and the quarterly summary of what has been confirmed."
        breadcrumbs={[{ label: "Impact" }]}
      />

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-6 p-4 tablet:p-6 desktop:px-8">
        {/* Donor-facing summary strip with real data-derived counts */}
        <section
          aria-label="Impact overview summary"
          className="bg-card border-line rounded-card shadow-raised border p-4 tablet:p-5"
        >
          <div className="grid grid-cols-2 gap-4 tablet:grid-cols-4 tablet:gap-6 divide-y tablet:divide-y-0 tablet:divide-x divide-line">
            <div className="flex flex-col gap-1">
              <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                Confirmed records
              </span>
              <div className="text-primary font-mono text-[24px] tablet:text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                {confirmedCount}
              </div>
              <p className="text-ink-3 text-[12px] leading-snug">
                In {quarter.label}
              </p>
            </div>

            <div className="flex flex-col gap-1 pt-3 tablet:pt-0 tablet:pl-6">
              <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                Awaiting confirmation
              </span>
              <div className="text-ink font-mono text-[24px] tablet:text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                {unconfirmedCount}
              </div>
              <p className="text-ink-3 text-[12px] leading-snug">
                {unconfirmedCount === 1 ? "Record" : "Records"} waiting for review
              </p>
            </div>

            <div className="flex flex-col gap-1 pt-3 tablet:pt-0 tablet:pl-6">
              <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                Briefs in network
              </span>
              <div className="text-ink font-mono text-[24px] tablet:text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                {map.briefs.length}
              </div>
              <p className="text-ink-3 text-[12px] leading-snug">
                Represented in paths
              </p>
            </div>

            <div className="flex flex-col gap-1 pt-3 tablet:pt-0 tablet:pl-6">
              <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                Evidence cited
              </span>
              <div className="text-primary font-mono text-[24px] tablet:text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
                {map.evidence.length}
              </div>
              <p className="text-ink-3 text-[12px] leading-snug">
                Items reaching policy
              </p>
            </div>
          </div>
        </section>

        <LogInfluencePanel briefs={briefs} defaultOpen={events.length === 0} />

        {report !== null ? (
          <QuarterlyReport
            quarter={quarter}
            quarters={recentQuarters(now)}
            report={report}
          />
        ) : null}

        <section
          aria-labelledby="influence-record-heading"
          className="flex min-w-0 flex-col gap-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="influence-record-heading"
              className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
            >
              The record{" "}
              <span className="font-mono tabular-nums text-ink">({events.length})</span>
            </h2>
            <span className="text-ink-3 font-mono text-[11.5px]">
              Evidence → Brief → Outcome
            </span>
          </div>

          {events.length === 0 ? (
            <EmptyImpactState />
          ) : (
            // The handoff's grid for this screen: map left, rail right, stacking
            // to one column below `laptop`. The rail's panel border switches from
            // a top rule to a left one when it becomes a column.
            <div className="grid min-w-0 grid-cols-1 gap-6 laptop:grid-cols-[1fr_356px]">
              <ImpactMap map={map} />

              <div className="border-line min-w-0 border-t pt-6 laptop:border-t-0 laptop:border-l laptop:pt-0 laptop:pl-6">
                <InfluenceEventRail
                  events={events}
                  canVerify={canVerifyInfluenceEvent(staffUser.role)}
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * The honest steady state for a young record, with a real next step (§17.6).
 *
 * NOT AN ERROR AND NOT A BLANK PANEL. The step it names is already open above it,
 * so this explains rather than repeats.
 */
function EmptyImpactState() {
  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      {/* Concentric contour rings — abstract structural mark, no icon asset. */}
      <span
        aria-hidden="true"
        className="mx-4 mt-4 mb-5 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h3 className="text-ink text-[15px] font-semibold">Nothing logged yet</h3>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        When a brief is cited, quoted, or acted on, record it here — the panel
        above is open and takes a minute. Once a brief has been submitted or
        published, a weekly search also looks for documents citing it and files
        what it finds as unconfirmed leads for someone to read.
      </p>
    </div>
  );
}

/**
 * The calm refusal. A panel rather than a crash or a redirect loop: someone
 * following a colleague's link should be told plainly what this area is. The
 * actions refuse independently and server-side regardless (§10.1).
 */
function ImpactNotForYourRole() {
  return (
    <>
      <PageHeader
        title="Impact"
        subtitle="Where Tropenbos evidence has reached policy."
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-4 tablet:p-6">
        <div className="bg-card border-line rounded-card flex flex-col items-start gap-2 border p-6">
          <h2 className="text-ink text-[15px] font-semibold">
            This area is for the policy team
          </h2>
          <p className="text-ink-3 max-w-[62ch] text-[13px]">
            The impact record is kept by the Policy &amp; Advocacy Officer and the
            Programme Director.
          </p>
          <Link href="/briefs" className={buttonVariants({ variant: "outline" })}>
            Back to the briefs
          </Link>
        </div>
      </div>
    </>
  );
}
