import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { canSetSignalWindow } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import {
  getTrackerWindows,
  TRACKER_LOOKAHEAD_DAYS,
  TRACKER_LOOKBACK_DAYS,
} from "@/lib/db";

import { TrackerBoard } from "./tracker-board";
import { UndatedPanel } from "./undated-panel";

export const metadata = {
  title: "Tracker · EviBrief",
};

/**
 * The submission tracker: which policy windows close when, and what exists to
 * answer each.
 *
 * A READ VIEW OVER EXISTING DATA PLUS ONE DATE. It is not a planning tool, not a
 * task manager, and not a reminder engine — it sends nothing and schedules
 * nothing. The one mutation on this route records or clears a closing date on a
 * signal.
 *
 * IT DISPLAYS BRIEF STATUS AND NEVER ADVANCES IT (§8.3, §9.5, §10.7). There is
 * no approve, submit, or publish control anywhere below.
 *
 * ONLY A SERVER COMPONENT FETCHES THIS PAGE'S DATA (§5.3). Nothing polls and no
 * client-side fetching library is involved.
 *
 * STATES THAT CANNOT OCCUR HERE, stated rather than built (§17.6): this route
 * makes no Gemini call, so there is no rate-limited state; it persists no
 * generation, so there is no flagged state; and it is not a Field Officer
 * surface, so there is no offline or sync-pending state. The
 * classification-pending queue count is a surface of the evidence and generation
 * screens rather than this layout, and a second copy of it here would be a second
 * place for the same number to drift.
 */
export default async function TrackerPage() {
  const staffUser = await requireStaffUser();

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - TRACKER_LOOKBACK_DAYS);
  const to = new Date(now);
  to.setDate(to.getDate() + TRACKER_LOOKAHEAD_DAYS);

  const { dated, undated } = await getTrackerWindows({ from, to });

  // Presentation only. `setSignalWindowAction` authorises its own caller
  // server-side regardless of what is rendered here (§10.1).
  const maySetWindow = canSetSignalWindow(staffUser.role);

  return (
    <>
      <PageHeader
        title="Tracker"
        subtitle="When each policy window closes, and what has been drafted for it. Dates are recorded by a person reading the source — nothing here is worked out from a signal's urgency."
      />

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-8 p-4 tablet:p-6 desktop:px-10">
        {dated.length === 0 ? (
          <EmptyTrackerState hasUndated={undated.length > 0} />
        ) : (
          <TrackerBoard
            windows={dated}
            canSetWindow={maySetWindow}
            // The month to land on: the soonest window that has not closed, or
            // the last recorded one if they all have. Chosen here because the
            // clock is not a thing a client component may read during render.
            defaultMonth={
              (
                dated.find(
                  (window) => new Date(window.windowClosesAt) >= now,
                ) ?? dated[dated.length - 1]
              ).windowClosesAt
            }
          />
        )}

        <UndatedPanel signals={undated} canSetWindow={maySetWindow} />
      </div>
    </>
  );
}

/**
 * No window recorded at all — distinct from a selected day with nothing on it,
 * which the board handles.
 *
 * IT NAMES THE REAL NEXT STEP, and which step that is depends on what exists: if
 * there are undated signals, the panel below this one is where a date goes; if
 * there are none, there is nothing to date yet and the board is the place to
 * look.
 */
function EmptyTrackerState({ hasUndated }: { hasUndated: boolean }) {
  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      {/* Concentric contour rings — abstract structural mark, no icon asset. */}
      <span
        aria-hidden="true"
        className="mx-4 mt-4 mb-5 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h2 className="text-ink text-[15px] font-semibold">
        No closing dates recorded yet
      </h2>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        {hasUndated
          ? "A closing date is recorded on a signal. The signals below have none yet — set one and the window appears on the calendar."
          : "A closing date is recorded on a signal, and the radar has not picked up any live signals to date. The board is where they arrive."}
      </p>
      {hasUndated ? null : (
        <Link href="/signals" className={buttonVariants({ variant: "outline" })}>
          Open the signal board
        </Link>
      )}
    </div>
  );
}
