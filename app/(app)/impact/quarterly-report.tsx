import Link from "next/link";

import type { QuarterlyImpactReport } from "@/lib/db";
import type { Quarter } from "@/lib/impact/config";

import {
  DETECTION_METHOD_LABELS,
  formatInfluenceDate,
  INFLUENCE_EVENT_TYPE_LABELS,
  INFLUENCE_EVENT_TYPE_ORDER,
} from "./labels";

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
}: {
  quarter: Quarter;
  quarters: Quarter[];
  report: QuarterlyImpactReport;
}) {
  const grouped = INFLUENCE_EVENT_TYPE_ORDER.map((eventType) => ({
    eventType,
    events: report.events.filter((event) => event.eventType === eventType),
  })).filter((group) => group.events.length > 0);

  return (
    <section
      aria-labelledby="quarterly-report-heading"
      className="bg-card border-line rounded-card flex min-w-0 flex-col gap-4 border p-4 tablet:p-5"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <h2
          id="quarterly-report-heading"
          className="text-ink text-[15px] font-semibold"
        >
          Quarterly report · {quarter.label}
        </h2>
        <p className="text-ink-3 max-w-[68ch] text-[13px]">
          Confirmed records only, assembled from what is stored. Nothing on this
          panel was written by a model.
        </p>

        <nav aria-label="Choose a quarter" className="min-w-0">
          <ul className="flex list-none flex-wrap gap-2 p-0">
            {quarters.map((option) => (
              <li key={option.key}>
                <Link
                  href={`/impact?quarter=${option.key}`}
                  aria-current={option.key === quarter.key ? "true" : undefined}
                  className={
                    option.key === quarter.key
                      ? "border-primary bg-surface-tint text-primary-ink rounded-card border px-2.5 py-1 font-mono text-[11.5px] no-underline"
                      : "border-line text-ink-3 hover:border-sage rounded-card border px-2.5 py-1 font-mono text-[11.5px] no-underline"
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

      {grouped.map((group) => (
        <section key={group.eventType} className="flex min-w-0 flex-col gap-2">
          <h3 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
            {INFLUENCE_EVENT_TYPE_LABELS[group.eventType]}{" "}
            <span className="font-mono tabular-nums">
              ({group.events.length})
            </span>
          </h3>
          <ul className="flex min-w-0 list-none flex-col gap-3 p-0">
            {group.events.map((event) => (
              <li
                key={event.id}
                className="border-line min-w-0 border-l-2 pl-3"
              >
                <Link
                  href={`/briefs/${event.briefId}`}
                  className="text-ink text-[14px] font-semibold break-words no-underline hover:underline"
                >
                  {event.briefTitle}
                </Link>
                <p className="text-ink-2 mt-1 max-w-[68ch] text-[13px] leading-[1.6] break-words">
                  {event.description}
                </p>
                {event.quotedText ? (
                  /* The citing document's own sentence — the serif (§11.6). */
                  <blockquote className="border-accent text-ink my-2 border-l-2 pl-3 font-serif text-[14px] leading-[1.55] break-words">
                    {event.quotedText}
                  </blockquote>
                ) : null}
                {event.sourceDocument ? (
                  <p className="mt-1 min-w-0 text-[13px] break-words">
                    <a
                      href={event.sourceDocument}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary underline"
                    >
                      {event.sourceTitle ?? "Source document"}
                    </a>
                  </p>
                ) : null}
                <p className="text-ink-3 mt-1 font-mono text-[11.5px] break-words">
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
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
            Evidence behind these records
          </h3>
          <p className="text-ink-3 max-w-[68ch] text-[13px]">
            What the briefs above cited. An item appearing across several records
            is evidence that has repeatedly reached policy.
          </p>
          <ul className="flex min-w-0 list-none flex-col gap-1.5 p-0">
            {report.evidence.map((item) => (
              <li
                key={item.id}
                className="text-ink-2 min-w-0 text-[13px] break-words"
              >
                {item.title}{" "}
                <span className="text-ink-3 font-mono text-[11.5px] tabular-nums">
                  {item.citationKey} · {item.eventCount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
      <div className="border-line rounded-card flex flex-col gap-2 border border-dashed p-4">
        <p className="text-ink text-[14px] font-semibold">
          No confirmed records in {quarter.label}
        </p>
        <p className="text-ink-3 max-w-[68ch] text-[13px]">
          {report.unverifiedCount > 0
            ? `${report.unverifiedCount} record${report.unverifiedCount === 1 ? " is" : "s are"} waiting to be confirmed for this quarter. Confirm what holds up and it will appear here.`
            : "Nothing has been recorded against this quarter yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="border-surface-tint-border bg-surface-tint rounded-card flex flex-col gap-1.5 border p-4">
      <p className="text-primary-ink text-[14px]">
        <span className="font-mono tabular-nums">{report.events.length}</span>{" "}
        confirmed record
        {report.events.length === 1 ? "" : "s"} in {quarter.label}.
      </p>
      <p className="text-ink-3 text-[13px]">
        {report.unverifiedCount === 0
          ? "Nothing from this quarter is waiting to be confirmed."
          : `A further ${report.unverifiedCount} record${report.unverifiedCount === 1 ? " is" : "s are"} recorded for this quarter but not confirmed, and ${report.unverifiedCount === 1 ? "is" : "are"} not counted above.`}
      </p>
    </div>
  );
}
