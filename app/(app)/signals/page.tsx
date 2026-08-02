import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { SIGNAL_BOARD_MAX_ITEMS } from "@/lib/ai/config";
import { canReclassifySignal } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import { listSignalBoard } from "@/lib/db";

import { SignalBoard } from "./signal-board";

export const metadata = {
  title: "Signals · EviBrief",
};

/**
 * The urgency board — what the Policy Radar found, arranged by how soon it needs
 * someone.
 *
 * The DAL call, not the layout, is the check that matters: layouts do not
 * re-render on navigation (AGENTS.md §10.1, Next's authentication guide).
 *
 * A SERVER COMPONENT READ, revalidated after a mutation. Live polling is
 * deliberately not here: §5.3 permits SWR on this one board, but a poll that
 * re-sorts cards under an active reviewer is precisely what §11.10 forbids, so
 * it needs queue-and-apply-on-next-load designing rather than assuming.
 */
export default async function SignalsPage() {
  const staffUser = await requireStaffUser();
  const { signals, truncated } = await listSignalBoard();

  // Presentation only. `reclassifySignalUrgencyAction` authorises its own caller
  // server-side, and a hidden handle is never the control (§10.1).
  const mayReclassify = canReclassifySignal(staffUser.role);

  return (
    <>
      <PageHeader
        title="Signals"
        subtitle="Policy developments picked up across Ghana, the EU, and international bodies. Acting on one is always your call."
      />
      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        {signals.length === 0 ? (
          <EmptyBoardState />
        ) : (
          <>
            <SignalBoard signals={signals} canReclassify={mayReclassify} />
            <p className="text-ink-3 max-w-[70ch] text-[12.5px]">
              {truncated
                ? `Showing the ${SIGNAL_BOARD_MAX_ITEMS} most recently detected signals. `
                : ""}
              Urgency is a starting suggestion from the classification pass.
              Moving a card records the change with your name and the time; it
              does not act on the signal.
            </p>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Nothing on the board yet, with a real next step rather than a blank grid
 * (AGENTS.md §17.6). The radar is scheduled work, so the honest next step is
 * where to look at it, not a button that pretends to conjure signals.
 */
function EmptyBoardState() {
  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      {/* Concentric contour rings — an abstract structural mark, no icon asset
          and no leaf (AGENTS.md §11.7). */}
      <span
        aria-hidden="true"
        className="mx-4 mt-4 mb-5 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h2 className="text-ink text-[15px] font-semibold">
        No signals have been detected yet
      </h2>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        The Policy Radar checks each source on its own cadence — the Gazette and
        the Forestry Commission daily, EU implementing acts weekly, ITTO and the
        CBD monthly. A stage with nothing in it is a stage with nothing in it,
        not a fault.
      </p>
      <Link href="/evidence" className={buttonVariants({ variant: "outline" })}>
        Go to the evidence library
      </Link>
    </div>
  );
}
