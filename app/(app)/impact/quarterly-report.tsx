import Link from "next/link";

import type { QuarterlyImpactReport } from "@/lib/db";
import type { QuarterlyNarrativeView } from "@/lib/db";
import type { Quarter } from "@/lib/impact/config";
import { BriefAudience, BriefStatus, Urgency } from "@/lib/generated/prisma/enums";

import {
  DETECTION_METHOD_LABELS,
  formatInfluenceDate,
  INFLUENCE_EVENT_TYPE_LABELS,
  INFLUENCE_EVENT_TYPE_ORDER,
} from "./labels";
import { NarrativeDialog } from "./narrative-dialog";
import { ExportDonorReport } from "./export-donor-report";
import {
  BRIEF_AUDIENCE_LABELS,
  BRIEF_STATUS_LABELS,
  URGENCY_LABELS,
} from "./scorecard-labels";

/**
 * The quarterly report — ASSEMBLED, NOT GENERATED.
 *
 * There is no Gemini call anywhere behind this component. Spec §3.5 asks for an
 * "auto-drafted donor reporting section", and auto-ASSEMBLY satisfies it: a
 * model-written donor report is unsourced prose about the organisation's own
 * impact, which is the thing §9.8 forbids inside a brief and is worse here, where
 * there is no hallucination guard and no citation chip to check it against.
 * EVERY LINE BELOW TRACES TO A STORED ROW.
 *
 * VERIFIED EVENTS ONLY, and the unconfirmed count is stated SEPARATELY so a
 * reader knows the difference between a confirmed claim and a lead (decision 7).
 *
 * NOT EXPORTED TO WORD IN THIS CHANGE. `lib/export/docx.ts` builds a Tiptap brief
 * document, and this is a different shape entirely — bending it would produce
 * something worse than the screen. Stated as not done rather than half-done; the
 * screen is printable and that is the honest scope of this prompt.
 */
export function QuarterlyReport({
  quarter,
  quarters,
  report,
  narrative,
  canAuthorNarrative,
}: {
  quarter: Quarter;
  quarters: Quarter[];
  report: QuarterlyImpactReport;
  narrative: QuarterlyNarrativeView | null;
  canAuthorNarrative: boolean;
}) {
  const grouped = INFLUENCE_EVENT_TYPE_ORDER.map((eventType) => ({
    eventType,
    events: report.events.filter((event) => event.eventType === eventType),
  })).filter((group) => group.events.length > 0);

  return (
    <section
      aria-labelledby="quarterly-report-heading"
      className="bg-card border-line rounded-card flex min-w-0 flex-col gap-5 border p-4 tablet:p-6 shadow-raised"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              id="quarterly-report-heading"
              className="text-ink text-[16px] font-semibold tracking-[-0.01em]"
            >
              Quarterly report · {quarter.label}
            </h2>
            <span className="font-mono text-[11.5px] text-ink-3">
              Assembled from stored records
            </span>
          </div>
          <ExportDonorReport quarter={quarter} report={report} narrative={narrative} />
        </div>
        <p className="text-ink-3 max-w-[72ch] text-[13px] leading-relaxed">
          Confirmed records only, assembled from what is stored. Nothing on this
          panel was written by a model.
        </p>

        <nav aria-label="Choose a quarter" className="min-w-0 pt-1">
          <ul className="flex list-none flex-wrap gap-2 p-0">
            {quarters.map((option) => (
              <li key={option.key}>
                <Link
                  href={`/impact?quarter=${option.key}`}
                  aria-current={option.key === quarter.key ? "page" : undefined}
                  className={
                    option.key === quarter.key
                      ? "border-primary bg-surface-tint text-primary-ink rounded-card border px-3 py-1.5 font-mono text-[12px] font-medium no-underline shadow-xs transition-colors"
                      : "border-line text-ink-3 hover:border-sage hover:text-ink rounded-card border px-3 py-1.5 font-mono text-[12px] no-underline transition-colors"
                  }
                >
                  {option.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <ReportSummary report={report} quarter={quarter} />

      <OperationalScorecard report={report} />

      <QuarterlyNarrativeSection
        quarter={quarter}
        narrative={narrative}
        canAuthor={canAuthorNarrative}
      />

      {grouped.map((group) => (
        <section key={group.eventType} className="flex min-w-0 flex-col gap-2.5">
          <h3 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
            {INFLUENCE_EVENT_TYPE_LABELS[group.eventType]}{" "}
            <span className="font-mono tabular-nums text-ink">
              ({group.events.length})
            </span>
          </h3>
          <ul className="flex min-w-0 list-none flex-col gap-3.5 p-0">
            {group.events.map((event) => (
              <li
                key={event.id}
                className="border-line bg-paper/50 rounded-card min-w-0 border-l-[3px] border-l-primary border p-3.5 tablet:p-4"
              >
                <Link
                  href={`/briefs/${event.briefId}`}
                  className="text-ink hover:text-primary text-[14.5px] font-semibold break-words no-underline hover:underline transition-colors"
                >
                  {event.briefTitle}
                </Link>
                <p className="text-ink-2 mt-1.5 max-w-[68ch] text-[13.5px] leading-[1.6] break-words">
                  {event.description}
                </p>
                {event.quotedText ? (
                  /* The citing document's own sentence — the serif (§11.6). */
                  <blockquote className="border-accent text-ink my-2.5 border-l-2 pl-3.5 font-serif text-[14px] leading-[1.55] break-words italic">
                    {event.quotedText}
                  </blockquote>
                ) : null}
                {event.sourceDocument ? (
                  <p className="mt-1.5 min-w-0 text-[13px] break-words">
                    <a
                      href={event.sourceDocument}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary hover:text-primary-hover font-medium underline inline-flex items-center gap-1"
                    >
                      <span>{event.sourceTitle ?? "Source document"}</span>
                      <span aria-hidden="true" className="text-[11px]">↗</span>
                    </a>
                  </p>
                ) : null}
                <p className="text-ink-3 mt-2 font-mono text-[11.5px] break-words">
                  {formatInfluenceDate(event.detectedAt)} ·{" "}
                  {DETECTION_METHOD_LABELS[event.detectionMethod]}
                  {event.verifiedByName
                    ? ` · confirmed by ${event.verifiedByName}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {report.evidence.length > 0 ? (
        <section className="border-line flex min-w-0 flex-col gap-3 border-t pt-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
              Evidence behind these records
            </h3>
            <p className="text-ink-3 max-w-[68ch] text-[13px] leading-relaxed">
              What the briefs above cited. An item appearing across several records
              is evidence that has repeatedly reached policy.
            </p>
          </div>
          <ul className="grid min-w-0 grid-cols-1 gap-2 p-0 list-none tablet:grid-cols-2">
            {report.evidence.map((item) => (
              <li
                key={item.id}
                className="bg-card border-line rounded-card flex min-w-0 items-start justify-between gap-3 border p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-[11px] text-ink-3 tracking-wide">
                    {item.citationKey}
                  </span>
                  <span className="text-ink text-[13px] font-medium leading-snug break-words">
                    {item.title}
                  </span>
                </div>
                <span className="bg-surface-tint border-surface-tint-border text-primary-ink shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[11.5px] font-semibold tabular-nums">
                  {item.eventCount} {item.eventCount === 1 ? "record" : "records"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function OperationalScorecard({ report }: { report: QuarterlyImpactReport }) {
  const { metrics } = report;
  const urgencyClasses: Record<Urgency, string> = {
    [Urgency.immediate]: "border-immediate-border bg-immediate-surface text-immediate-ink",
    [Urgency.near_term]: "border-nearterm-border bg-nearterm-surface text-nearterm-ink",
    [Urgency.horizon]: "border-surface-tint-border bg-surface-tint text-primary-ink",
    [Urgency.watch]: "border-watch-border bg-watch-surface text-watch-ink",
  };

  return (
    <section className="border-line flex min-w-0 flex-col gap-4 border-t pt-5" aria-labelledby="operational-scorecard-heading">
      <div className="flex flex-col gap-1">
        <h3 id="operational-scorecard-heading" className="text-ink text-[15px] font-semibold">
          Operational &amp; strategic scorecard
        </h3>
        <p className="text-ink-3 max-w-[68ch] text-[13px] leading-relaxed">
          Quarter-bounded indicators from stored records. They show activity and review quality; they do not establish causal policy influence.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-4">
        <MetricCard
          label="Median turnaround"
          value={metrics.turnaroundHoursMedian === null ? "—" : `${formatMetricNumber(metrics.turnaroundHoursMedian)}h`}
          detail={metrics.turnaroundHoursMedian === null ? "No completed signal-linked briefs" : "From signal detection to first review"}
          target={metrics.turnaroundHoursMedian === null ? "Target: under 4h" : metrics.turnaroundHoursMedian < 4 ? "Target met · under 4h" : "Target: under 4h"}
          achieved={metrics.turnaroundHoursMedian !== null && metrics.turnaroundHoursMedian < 4}
        />
        <MetricCard
          label="Evidence match quality"
          value={metrics.evidenceMatchQuality === null ? "—" : `${metrics.evidenceMatchQuality}%`}
          detail={`${metrics.evidenceReviewsRelevant} relevant of ${metrics.evidenceReviewsTotal} staff assessments`}
          target={metrics.evidenceMatchQuality === null ? "Benchmark: above 80%" : metrics.evidenceMatchQuality > 80 ? "Benchmark met · above 80%" : "Benchmark: above 80%"}
          achieved={metrics.evidenceMatchQuality !== null && metrics.evidenceMatchQuality > 80}
        />
        <MetricCard
          label="Immediate window capture"
          value={metrics.policyWindowCaptureRate === null ? "—" : `${metrics.policyWindowCaptureRate}%`}
          detail={`${metrics.immediateSignalsCaptured} of ${metrics.immediateSignalsTotal} Immediate signals reached review or beyond`}
          target="Reviewed, submitted, or published"
          achieved={metrics.policyWindowCaptureRate !== null && metrics.policyWindowCaptureRate > 0}
        />
        <MetricCard
          label="Policy signals monitored"
          value={metrics.signalsCount.toLocaleString("en-GB")}
          detail="Detected in the selected quarter"
          target="Across all urgency horizons"
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 laptop:grid-cols-2">
        <DistributionPanel
          heading="Audience coverage"
          description="Briefs active in this quarter, across the five core audiences."
          values={[
            BriefAudience.ghana_ministry_official,
            BriefAudience.cocoa_company_sustainability,
            BriefAudience.eu_regulator,
            BriefAudience.donor_programme_officer,
            BriefAudience.crema_community_governance,
          ].map((audience) => ({ label: BRIEF_AUDIENCE_LABELS[audience], value: metrics.audienceDistribution[audience] }))}
        />
        <DistributionPanel
          heading="Brief pipeline status"
          description="Current status of briefs created or transitioned this quarter."
          values={[
            BriefStatus.draft,
            BriefStatus.reviewed,
            BriefStatus.submitted,
            BriefStatus.published,
          ].map((status) => ({ label: BRIEF_STATUS_LABELS[status], value: metrics.briefStatusCounts[status] }))}
        />
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Signal urgency distribution">
        {([Urgency.immediate, Urgency.near_term, Urgency.horizon, Urgency.watch] as const).map((urgency) => (
          <span key={urgency} className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${urgencyClasses[urgency]}`}>
            {URGENCY_LABELS[urgency]} <span className="font-semibold tabular-nums">{metrics.urgencyCounts[urgency]}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  target,
  achieved,
}: {
  label: string;
  value: string;
  detail: string;
  target: string;
  achieved?: boolean;
}) {
  return (
    <section className="border-line bg-paper/50 rounded-card flex min-w-0 flex-col gap-2 border p-3.5">
      <p className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">{label}</p>
      <p className="text-ink font-mono text-[25px] font-semibold tabular-nums tracking-[-0.03em]">{value}</p>
      <p className="text-ink-3 min-h-[2.5rem] text-[12px] leading-relaxed">{detail}</p>
      <span className={achieved ? "border-surface-tint-border bg-surface-tint text-primary-ink w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium" : "border-line bg-card text-ink-3 w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium"}>
        {target}
      </span>
    </section>
  );
}

function DistributionPanel({
  heading,
  description,
  values,
}: {
  heading: string;
  description: string;
  values: Array<{ label: string; value: number }>;
}) {
  const maximum = Math.max(1, ...values.map((item) => item.value));

  return (
    <section className="border-line bg-paper/40 rounded-card flex min-w-0 flex-col gap-3 border p-4">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-ink text-[13.5px] font-semibold">{heading}</h4>
        <p className="text-ink-3 text-[12px] leading-relaxed">{description}</p>
      </div>
      <ul className="flex list-none flex-col gap-2.5 p-0">
        {values.map((item) => (
          <li key={item.label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-ink-2 truncate text-[12px]">{item.label}</span>
              </div>
              <div className="bg-stone h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                <div className="bg-primary h-full rounded-full" style={{ width: `${(item.value / maximum) * 100}%` }} />
              </div>
            </div>
            <span className="text-ink font-mono text-right text-[12px] font-semibold tabular-nums" aria-label={`${item.label}: ${item.value}`}>{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatMetricNumber(value: number) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
}

function QuarterlyNarrativeSection({
  quarter,
  narrative,
  canAuthor,
}: {
  quarter: Quarter;
  narrative: QuarterlyNarrativeView | null;
  canAuthor: boolean;
}) {
  if (!narrative) {
    return (
      <section className="border-line bg-paper/40 rounded-card flex flex-col gap-3 border border-dashed p-4 tablet:flex-row tablet:items-end tablet:justify-between">
        <div className="flex max-w-[66ch] flex-col gap-1.5">
          <h3 className="text-ink text-[14px] font-semibold">
            Quarterly evaluation narrative
          </h3>
          <p className="text-ink-3 text-[13px] leading-relaxed">
            No staff evaluation has been recorded for {quarter.label} yet. This
            reflection captures what worked, what was missed, and the evidence
            priorities for the next cycle.
          </p>
        </div>
        {canAuthor ? (
          <NarrativeDialog quarterKey={quarter.key} narrative={null} />
        ) : (
          <p className="font-mono text-[11.5px] text-ink-3">
            Read-only for this role
          </p>
        )}
      </section>
    );
  }

  const cards = [
    ["Policy Wins & Influence", "What succeeded this quarter.", narrative.wins],
    ["Missed Windows", "Deadlines or opportunities that passed without engagement.", narrative.missedWindows],
    ["Evidence Gaps (Ingestion Priorities)", "Knowledge gaps revealed during policy work.", narrative.evidenceGaps],
    ["System & Workflow Improvements", "Concrete improvements for the next cycle.", narrative.systemImprovement],
  ] as const;

  return (
    <section className="border-line flex min-w-0 flex-col gap-4 border-t pt-5" aria-labelledby="quarterly-narrative-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="quarterly-narrative-heading" className="text-ink text-[15px] font-semibold">
            Quarterly evaluation narrative
          </h3>
          <p className="text-ink-3 max-w-[68ch] text-[13px] leading-relaxed">
            Staff-authored reflection for the next evidence and policy cycle.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11.5px] text-ink-3">
            <span>Last updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(narrative.updatedAt))} · {narrative.authorName}</span>
            <span className="border-line bg-paper rounded-full border px-2 py-0.5 capitalize">{narrative.authorRole.replaceAll("_", " ")}</span>
          </div>
        </div>
        {canAuthor ? (
          <NarrativeDialog quarterKey={quarter.key} narrative={narrative} />
        ) : null}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 tablet:grid-cols-2">
        {cards.map(([title, description, value]) => (
          <section key={title} className="bg-paper/50 border-line rounded-card flex min-w-0 flex-col gap-2 border p-4">
            <div className="flex flex-col gap-0.5">
              <h4 className="text-ink text-[13.5px] font-semibold">{title}</h4>
              <p className="text-ink-3 text-[12px] leading-relaxed">{description}</p>
            </div>
            <p className="text-ink-2 whitespace-pre-wrap text-[13px] leading-relaxed">{value}</p>
          </section>
        ))}
      </div>
    </section>
  );
}

/**
 * The counts, including the one a donor report must never quietly absorb: how
 * many records in the quarter are still unconfirmed.
 */
function ReportSummary({
  report,
  quarter,
}: {
  report: QuarterlyImpactReport;
  quarter: Quarter;
}) {
  if (report.events.length === 0) {
    return (
      <div className="border-line bg-paper/40 rounded-card flex flex-col gap-2 border border-dashed p-4">
        <p className="text-ink text-[14px] font-semibold">
          No confirmed records in {quarter.label}
        </p>
        <p className="text-ink-3 max-w-[68ch] text-[13px] leading-relaxed">
          {report.unverifiedCount > 0
            ? `${report.unverifiedCount} record${report.unverifiedCount === 1 ? " is" : "s are"} waiting to be confirmed for this quarter. Confirm what holds up in the record below and it will appear here.`
            : "Nothing has been recorded against this quarter yet. Log a record above to begin."}
        </p>
      </div>
    );
  }

  return (
    <div className="border-surface-tint-border bg-surface-tint/60 rounded-card flex flex-col gap-1.5 border p-4">
      <p className="text-primary-ink text-[14.5px] font-medium">
        <span className="font-mono font-semibold tabular-nums">{report.events.length}</span>{" "}
        confirmed record{report.events.length === 1 ? "" : "s"} in {quarter.label}.
      </p>
      <p className="text-ink-3 text-[13px] leading-relaxed">
        {report.unverifiedCount === 0
          ? "Nothing from this quarter is waiting to be confirmed."
          : `A further ${report.unverifiedCount} record${report.unverifiedCount === 1 ? " is" : "s are"} recorded for this quarter but not confirmed, and ${report.unverifiedCount === 1 ? "is" : "are"} excluded from this report.`}
      </p>
    </div>
  );
}
