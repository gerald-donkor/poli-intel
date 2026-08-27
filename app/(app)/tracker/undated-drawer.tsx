"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TrackerSignal } from "@/lib/db/tracker";
import { cn } from "@/lib/utils";

import { GEOGRAPHY_LABELS, URGENCY_LABELS } from "../signals/labels";
import {
  formatWindowDate,
  TRACKER_UNDATED_LIMIT,
  WINDOW_EYEBROW,
  WINDOW_URGENCY_BORDER,
} from "./labels";
import { WindowDateControl } from "./window-date-control";

/**
 * Quick drawer for signals that have no closing date recorded yet.
 *
 * GOVERNANCE-ADJACENT BACKLOG. Undated signals are policy windows that cannot be
 * placed on the timeline or calendar until a staff member records their deadline.
 * Opening this drawer lets staff review and record dates directly without losing
 * their place on the tracker.
 *
 * PLAIN COPY, NO INFERENCE (§8.8). "No closing date recorded" states the record
 * fact plainly without claiming the system estimated or detected anything.
 */
export function UndatedDrawer({
  signals,
  canSetWindow,
  open,
  onOpenChange,
}: {
  signals: TrackerSignal[];
  canSetWindow: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-card flex w-full flex-col border-l sm:max-w-lg"
      >
        <SheetHeader className="border-line border-b p-4">
          <SheetTitle className="text-ink text-[16px] font-semibold">
            No closing date recorded{" "}
            <span className="font-mono tabular-nums">({signals.length})</span>
          </SheetTitle>
          <SheetDescription className="text-ink-3 text-[13px] leading-relaxed">
            These signals have no recorded deadline. A date is set by a person
            reading the source — it is never worked out from a signal&rsquo;s
            urgency, so setting a date places it on the tracker timeline.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {signals.length === 0 ? (
            <div className="bg-surface-tint/40 border-surface-tint-border rounded-card border p-4">
              <p className="text-ink text-[13px]">
                Every live signal currently has a closing date recorded.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-3">
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
                      className="text-ink hover:text-primary text-[14px] leading-snug font-medium no-underline hover:underline"
                    >
                      {signal.title}
                    </Link>

                    <span className="text-ink-3 font-mono text-[11.5px] tabular-nums">
                      Picked up {formatWindowDate(signal.detectedAt)}
                    </span>

                    {canSetWindow ? (
                      <div className="border-line mt-1 border-t pt-2.5">
                        <WindowDateControl
                          signalId={signal.id}
                          initialDate={null}
                        />
                      </div>
                    ) : (
                      <p className="text-ink-3 border-line mt-1 border-t pt-2 text-[12px]">
                        Recording a closing date is a Policy &amp; Advocacy
                        Officer or Programme Director task.
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {signals.length === TRACKER_UNDATED_LIMIT ? (
                <div className="bg-stone/40 border-line rounded-card mt-2 border p-3">
                  <p className="text-ink-3 text-[12.5px]">
                    Showing the {TRACKER_UNDATED_LIMIT} most recently detected
                    undated signals. Older signals remain accessible on the{" "}
                    <Link
                      href="/signals"
                      className="text-primary font-medium no-underline hover:underline"
                    >
                      signal board
                    </Link>
                    .
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Compact rail card or backlog summary shown in the tracker sidebar / stack.
 */
export function UndatedSummaryCard({
  signalsCount,
  onOpenDrawer,
}: {
  signalsCount: number;
  onOpenDrawer: () => void;
}) {
  return (
    <div className="bg-card border-line rounded-card flex flex-col gap-2.5 border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-ink text-[13.5px] font-semibold">
          Undated signals backlog
        </h3>
        <span className="bg-stone border-line text-ink-2 font-mono rounded-full border px-2 py-0.5 text-[11.5px] font-medium tabular-nums">
          {signalsCount}
        </span>
      </div>

      <p className="text-ink-3 text-[12.5px] leading-relaxed">
        {signalsCount === 0
          ? "Every live signal has a recorded closing date."
          : "Signals without a recorded deadline are not visible on the timeline."}
      </p>

      {signalsCount > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenDrawer}
          className="h-11 w-full cursor-pointer justify-center tablet:h-8"
        >
          Review undated signals ({signalsCount})
        </Button>
      ) : null}
    </div>
  );
}
