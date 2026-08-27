import Link from "next/link";

import type { TrackerSignal } from "@/lib/db/tracker";
import { cn } from "@/lib/utils";

import { GEOGRAPHY_LABELS, URGENCY_LABELS } from "../signals/labels";
import {
  formatWindowDate,
  TRACKER_UNDATED_LIMIT,
  WINDOW_EYEBROW,
  WINDOW_URGENCY_BORDER,
} from "./labels";
import { UndatedDrawer, UndatedSummaryCard } from "./undated-drawer";
import { WindowDateControl } from "./window-date-control";

export { UndatedDrawer, UndatedSummaryCard };

/**
 * Signals nobody has recorded a closing date for.
 *
 * BESIDE THE CALENDAR, NOT HIDDEN BEHIND IT. An undated signal is the one the
 * tracker cannot help with, so burying it would make the calendar look complete
 * while the backlog grew out of sight — the same failure mode the
 * classification-pending queue count exists to prevent.
 *
 * THE COPY STATES A FACT, NOT AN ESTIMATE. "No closing date recorded" is exactly
 * what the null column means. Nothing here says the system estimated, inferred,
 * or suggested a date, because it never does (§8.8) — the field starts empty and
 * a person fills it in.
 */
export function UndatedPanel({
  signals,
  canSetWindow,
}: {
  signals: TrackerSignal[];
  canSetWindow: boolean;
}) {
  return (
    <section
      aria-labelledby="tracker-undated-heading"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2
        id="tracker-undated-heading"
        className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
      >
        No closing date recorded{" "}
        <span className="font-mono tabular-nums">({signals.length})</span>
      </h2>

      {signals.length === 0 ? (
        <p className="text-ink-3 text-[13px]">
          Every live signal has a closing date against it.
        </p>
      ) : (
        <>
          <p className="text-ink-3 max-w-[72ch] text-[13px]">
            These signals have no recorded deadline. A date is set by a person
            reading the source — it is never worked out from a signal&rsquo;s
            urgency, so an empty field means nobody has recorded one yet.
          </p>

          <ul className="grid grid-cols-1 gap-3 laptop:grid-cols-2">
            {signals.map((signal) => (
              <li
                key={signal.id}
                className={cn(
                  "bg-card border-line rounded-card flex flex-col gap-2 border border-l-[3px] p-4 shadow-raised",
                  WINDOW_URGENCY_BORDER[signal.urgency],
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-meta font-semibold tracking-[0.06em] uppercase",
                      WINDOW_EYEBROW[signal.urgency],
                    )}
                  >
                    {URGENCY_LABELS[signal.urgency]}
                  </span>
                  <span className="text-ink-3 text-[12px]">
                    {GEOGRAPHY_LABELS[signal.geography]}
                  </span>
                </div>

                <Link
                  href={`/signals/${signal.id}`}
                  className="text-ink hover:text-primary text-[14.5px] leading-snug font-semibold no-underline hover:underline"
                >
                  {signal.title}
                </Link>

                <span className="text-ink-3 font-mono text-[12px] tabular-nums">
                  Picked up {formatWindowDate(signal.detectedAt)}
                </span>

                {canSetWindow ? (
                  <div className="border-line mt-1 border-t pt-2.5">
                    <WindowDateControl signalId={signal.id} initialDate={null} />
                  </div>
                ) : (
                  <span className="text-ink-3 border-line mt-1 border-t pt-2 text-[12.5px]">
                    Recording a closing date is a Policy &amp; Advocacy Officer
                    or Programme Director task.
                  </span>
                )}
              </li>
            ))}
          </ul>

          {signals.length === TRACKER_UNDATED_LIMIT ? (
            // Said, not hidden: a truncated list that looks complete is worse
            // than a long one.
            <p className="text-ink-3 text-[13px]">
              Showing the {TRACKER_UNDATED_LIMIT} most recently detected. Older
              undated signals are on the{" "}
              <Link
                href="/signals"
                className="text-primary no-underline hover:underline"
              >
                signal board
              </Link>
              .
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
