"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { TrackerDatedWindow, TrackerSignal } from "@/lib/db/tracker";

import { URGENCY_ORDER } from "../signals/labels";
import { formatWindowDate } from "./labels";
import { UndatedDrawer, UndatedSummaryCard } from "./undated-drawer";
import {
  dayKey,
  WindowCalendar,
  type DayWindowSummary,
} from "./window-calendar";
import { WindowTable } from "./window-table";

/**
 * The combination view: shadcn `Calendar` and the policy window timeline as ONE screen,
 * not two tabs (spec §5.5).
 *
 * The client boundary sits here because the two halves share one piece of state
 * — the selected day — and nothing else. No data is fetched below this line; the
 * windows arrive already read by the Server Component above (§5.3).
 *
 * LAYOUT. Mobile-first single column: calendar + undated card, then timeline.
 * At `laptop:` the calendar and undated summary form a sticky left rail and the timeline
 * sits beside it. The layout reflows with zero horizontal page scroll from 320px to 1600px.
 */
export function TrackerBoard({
  windows,
  undated = [],
  canSetWindow,
  defaultMonth,
}: {
  windows: TrackerDatedWindow[];
  undated?: TrackerSignal[];
  canSetWindow: boolean;
  /**
   * ISO, chosen server-side. Reading the clock here would be an impure call
   * during render, and the server already knows what "now" is.
   */
  defaultMonth: string;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [undatedDrawerOpen, setUndatedDrawerOpen] = useState(false);

  /**
   * One entry per day that has something closing on it.
   *
   * The stage recorded is the SOONEST of the day, read from `URGENCY_ORDER`
   * rather than compared as strings — the enum's declaration order is the
   * taxonomy, and nothing here re-sorts it (§11.4).
   */
  const summaries = useMemo(() => {
    const map = new Map<string, DayWindowSummary>();

    for (const window of windows) {
      const key = dayKey(new Date(window.windowClosesAt));
      const existing = map.get(key);

      if (!existing) {
        map.set(key, { count: 1, urgency: window.urgency });
        continue;
      }

      const soonest =
        URGENCY_ORDER.indexOf(window.urgency) <
        URGENCY_ORDER.indexOf(existing.urgency)
          ? window.urgency
          : existing.urgency;

      map.set(key, { count: existing.count + 1, urgency: soonest });
    }

    return map;
  }, [windows]);

  const visible = useMemo(
    () =>
      selectedDay === null
        ? windows
        : windows.filter(
            (window) => dayKey(new Date(window.windowClosesAt)) === selectedDay,
          ),
    [windows, selectedDay],
  );

  return (
    <>
      <div className="flex min-w-0 flex-col gap-4 laptop:flex-row laptop:items-start laptop:gap-6">
        <aside className="flex shrink-0 flex-col gap-4 laptop:sticky laptop:top-4 laptop:w-[320px]">
          <div className="bg-card border-line rounded-card overflow-hidden border shadow-raised">
            <WindowCalendar
              summaries={summaries}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              defaultMonth={new Date(defaultMonth)}
            />
          </div>

          <UndatedSummaryCard
            signalsCount={undated.length}
            onOpenDrawer={() => setUndatedDrawerOpen(true)}
          />
        </aside>

        <section
          aria-labelledby="tracker-windows-heading"
          aria-live="polite"
          className="flex min-w-0 flex-1 flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="tracker-windows-heading"
              className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
            >
              {selectedDay === null ? (
                <>
                  All recorded windows{" "}
                  <span className="font-mono tabular-nums">
                    ({windows.length})
                  </span>
                </>
              ) : (
                <>
                  Closing {formatWindowDate(`${selectedDay}T12:00:00.000Z`)}{" "}
                  <span className="font-mono tabular-nums">
                    ({visible.length})
                  </span>
                </>
              )}
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              {undated.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setUndatedDrawerOpen(true)}
                  className="h-11 cursor-pointer tablet:h-8"
                >
                  Undated backlog ({undated.length})
                </Button>
              ) : null}

              {selectedDay !== null ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDay(null)}
                  className="h-11 cursor-pointer tablet:h-8"
                >
                  Show all recorded windows
                </Button>
              ) : null}
            </div>
          </div>

          {visible.length === 0 ? (
            // Filtered-empty, distinct from "nothing recorded at all": the day is
            // real, it simply has nothing on it, and the way back is one click.
            <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
              <h3 className="text-ink text-[15px] font-semibold">
                Nothing closes on this day
              </h3>
              <p className="text-ink-3 max-w-[62ch] text-[13px]">
                No window has been recorded for{" "}
                {formatWindowDate(`${selectedDay}T12:00:00.000Z`)}.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedDay(null)}
                className="h-11 cursor-pointer tablet:h-8"
              >
                Show all recorded windows
              </Button>
            </div>
          ) : (
            <WindowTable
              windows={visible}
              selectedDay={selectedDay}
              canSetWindow={canSetWindow}
            />
          )}
        </section>
      </div>

      <UndatedDrawer
        signals={undated}
        canSetWindow={canSetWindow}
        open={undatedDrawerOpen}
        onOpenChange={setUndatedDrawerOpen}
      />
    </>
  );
}
