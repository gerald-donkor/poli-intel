"use client";

import Link from "next/link";

import { audienceLabel } from "@/lib/ai/audience-profiles";
import type { TrackerBrief, TrackerDatedWindow } from "@/lib/db/tracker";
import { cn } from "@/lib/utils";

import { BRIEF_STATUS_LABELS } from "../briefs/labels";
import { GEOGRAPHY_LABELS, URGENCY_LABELS } from "../signals/labels";
import {
  describeWindowTiming,
  formatWindowDate,
  isClosedUnanswered,
  WINDOW_EYEBROW,
  WINDOW_URGENCY_BORDER,
} from "./labels";
import { WindowDateControl } from "./window-date-control";

/**
 * The timeline half of the combination view: which windows close when, and what
 * exists to answer each.
 *
 * IT DISPLAYS BRIEF STATUS AND NEVER ADVANCES IT (§8.3, §9.5, §10.7). There is
 * no "mark submitted" control on this route — approval and submission stay the
 * Programme Director's explicit actions on the brief itself.
 *
 * RESPONSIVE TIMELINE. Replaces fixed table overflow with structured timeline
 * cards carrying the 3px urgency left rule, scannable closing dates, timing badges,
 * linked brief status, and date disclosures with no horizontal page scroll at any
 * screen width from 320px to 1600px.
 *
 * 180ms crossfade when the day selection changes, made instant under
 * `prefers-reduced-motion` (§11.9, §11.10).
 */
export function WindowTable({
  windows,
  selectedDay,
  canSetWindow,
}: {
  windows: TrackerDatedWindow[];
  selectedDay: string | null;
  canSetWindow: boolean;
}) {
  return (
    <div
      key={selectedDay ?? "all"}
      className="animate-count-fade flex min-w-0 flex-col gap-3"
    >
      {windows.map((window) => (
        <WindowTimelineCard
          key={window.id}
          window={window}
          canSetWindow={canSetWindow}
        />
      ))}
    </div>
  );
}

function WindowTimelineCard({
  window,
  canSetWindow,
}: {
  window: TrackerDatedWindow;
  canSetWindow: boolean;
}) {
  const closedUnanswered = isClosedUnanswered(window);

  return (
    <article
      className={cn(
        "bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border border-l-[3px] p-4 shadow-raised transition-colors tablet:p-5",
        WINDOW_URGENCY_BORDER[window.urgency],
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-meta font-semibold tracking-[0.06em] uppercase",
              WINDOW_EYEBROW[window.urgency],
            )}
          >
            {URGENCY_LABELS[window.urgency]}
          </span>
          <span className="text-ink-disabled text-[12px]">·</span>
          <span className="text-ink-3 text-[12.5px]">
            {GEOGRAPHY_LABELS[window.geography]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink font-mono text-[13px] font-medium tabular-nums">
            Closes {formatWindowDate(window.windowClosesAt)}
          </span>
          <span className="text-ink-3 text-[12.5px]">
            ({describeWindowTiming(window.windowClosesAt)})
          </span>
          {closedUnanswered ? (
            <span className="bg-watch-surface border-watch-border text-watch-ink inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold">
              <span aria-hidden="true" className="border-watch size-2 border" />
              Window closed
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <Link
          href={`/signals/${window.id}`}
          className="text-ink hover:text-primary text-[15px] leading-snug font-semibold no-underline hover:underline"
        >
          {window.title}
        </Link>
      </div>

      <div className="border-line flex min-w-0 flex-col gap-2 border-t pt-3">
        <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
          Brief coverage
        </span>

        {window.briefs.length === 0 ? (
          <p className="text-ink-3 text-[13px]">
            No brief drafted yet.{" "}
            <Link
              href={`/signals/${window.id}`}
              className="text-primary font-medium no-underline hover:underline"
            >
              Open the signal
            </Link>
          </p>
        ) : (
          <ul className="flex flex-wrap items-center gap-2">
            {window.briefs.map((brief) => (
              <li key={brief.id}>
                <BriefChip brief={brief} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {canSetWindow ? (
        <details className="border-line group mt-1 border-t pt-2.5">
          <summary className="text-ink-3 hover:text-ink cursor-pointer text-[12.5px] font-medium select-none">
            Change closing date
          </summary>
          <div className="mt-2.5">
            <WindowDateControl
              signalId={window.id}
              initialDate={window.windowClosesAt.slice(0, 10)}
            />
          </div>
        </details>
      ) : null}
    </article>
  );
}

function BriefChip({ brief }: { brief: TrackerBrief }) {
  return (
    <Link
      href={`/briefs/${brief.id}`}
      className="bg-surface-tint border-surface-tint-border text-primary-ink focus-visible:ring-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium no-underline transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:outline-none"
    >
      <span>For {audienceLabel(brief.audience)}</span>
      <span className="text-ink-disabled">·</span>
      <span className="text-[11px] font-semibold tracking-[0.02em] uppercase">
        {BRIEF_STATUS_LABELS[brief.status]}
      </span>
    </Link>
  );
}
