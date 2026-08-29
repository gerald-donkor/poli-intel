import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { EvidenceMatcherFeedbackSummary } from "@/lib/db";
import { cn } from "@/lib/utils";

import { EVIDENCE_SOURCE_TYPE_LABELS } from "./labels";

/**
 * Evidence Matcher quality feedback summary for Research Officers and Programme Directors.
 *
 * Surfaced high on /evidence to inform research priorities based on staff validation of
 * retrieval usefulness (spec §3.5, §5.2). Stored-data aggregate only — no AI calls,
 * no causal claims, and no automated re-ranking.
 */
export function EvidenceMatcherFeedback({
  summary,
}: {
  summary: EvidenceMatcherFeedbackSummary;
}) {
  const hasReviews = summary.totalReviewedCount > 0;

  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-3.5 border p-4 tablet:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-ink text-[14.5px] font-semibold">
              Evidence Matcher feedback
            </h2>
            <span className="bg-stone border-line/60 text-ink-3 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10.5px] font-medium">
              Research review
            </span>
          </div>
          <p className="text-ink-3 max-w-[75ch] text-[12.5px] leading-relaxed">
            Staff assessments of whether retrieved evidence was useful for detected policy signals.
            This informs knowledge base priorities and complements the Quarterly Impact Report&apos;s
            citation records.
          </p>
        </div>
        {hasReviews ? (
          <div className="text-ink-3 flex items-center gap-2 font-mono text-[12px]">
            <span>
              <span className="text-ink font-semibold tabular-nums">
                {summary.totalReviewedCount}
              </span>{" "}
              {summary.totalReviewedCount === 1 ? "match" : "matches"} assessed
            </span>
            {summary.overallRelevantPercentage !== null ? (
              <>
                <span>·</span>
                <span>
                  <span className="text-ink font-semibold tabular-nums">
                    {summary.overallRelevantPercentage}%
                  </span>{" "}
                  relevant
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {!hasReviews ? (
        <div className="bg-stone/40 border-line/60 rounded-card flex flex-col items-start justify-between gap-3 border p-3.5 tablet:flex-row tablet:items-center">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="border-watch mt-0.5 size-3.5 shrink-0 rounded-full border-2"
            />
            <div className="flex flex-col gap-0.5">
              <h3 className="text-ink text-[13px] font-medium">
                No match reviews recorded yet
              </h3>
              <p className="text-ink-3 max-w-[65ch] text-[12px] leading-relaxed">
                Feedback summaries will appear here as Research Officers and Directors review matched evidence on individual policy signal pages.
              </p>
            </div>
          </div>
          <Link
            href="/signals"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0 text-[12px]",
            )}
          >
            Review signal matches
          </Link>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-2.5 tablet:grid-cols-3">
          {summary.bySourceType.map((item) => {
            const hasTypeReviews = item.reviewedCount > 0;

            return (
              <div
                key={item.sourceType}
                className="bg-paper/70 border-line/60 rounded-card flex flex-col justify-between gap-2.5 border p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink text-[13px] font-semibold">
                    {EVIDENCE_SOURCE_TYPE_LABELS[item.sourceType]}
                  </span>
                  <span className="text-ink-3 font-mono text-[11px]">
                    {hasTypeReviews ? (
                      `${item.reviewedCount} ${item.reviewedCount === 1 ? "match" : "matches"}`
                    ) : (
                      "No reviews"
                    )}
                  </span>
                </div>

                {hasTypeReviews ? (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink-3 text-[11.5px]">
                        Relevant ({item.relevantCount}/{item.reviewedCount})
                      </span>
                      <span className="text-ink font-mono text-[12px] font-medium tabular-nums">
                        {item.relevantPercentage}%
                      </span>
                    </div>
                    <span
                      aria-hidden="true"
                      className="bg-stone h-1.5 w-full overflow-hidden rounded-full"
                    >
                      <span
                        className="bg-primary block h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.relevantPercentage ?? 0}%` }}
                      />
                    </span>
                  </div>
                ) : (
                  <p className="text-ink-3 text-[11.5px] italic">
                    Feedback will appear once matches from this source type are assessed.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
