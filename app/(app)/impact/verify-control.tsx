"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { verifyInfluenceEventAction } from "./actions";

/**
 * The Programme Director's confirmation control.
 *
 * OPTIMISTIC, AND THIS IS THE ONE PLACE ON THE SCREEN THAT MAY BE. `useOptimistic`
 * must never be applied to something the server may refuse on authorisation
 * grounds (`server-actions`), and this control is only ever rendered for a
 * Programme Director — the one role the action admits — so confirming is a
 * known-permitted operation. Logging an event is offered to two roles and is
 * deliberately NOT optimistic.
 *
 * IT ROLLS BACK VISIBLY. A refusal reverts the state and says so in place; the
 * server result is truth.
 *
 * IT SHOWS WHO WROTE THE BRIEF. Decision 11 implements verification at the role
 * level and leaves open whether a Director may confirm a record on a brief they
 * authored — so rather than silently deciding it, the control puts the author in
 * front of the person about to confirm.
 */
export function VerifyControl({
  eventId,
  briefAuthorName,
}: {
  eventId: string;
  briefAuthorName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useOptimistic(false);

  const confirm = () => {
    setError(null);

    startTransition(async () => {
      setConfirmed(true);

      const result = await verifyInfluenceEventAction({ eventId });

      if (!result.ok) {
        // The optimistic value falls away with the transition, so the row goes
        // back to unconfirmed on its own — the message says why.
        setError(
          result.refusal.kind === "unauthorised"
            ? result.refusal.message
            : "That record could not be confirmed.",
        );

        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {briefAuthorName ? (
        <p className="text-ink-3 text-[12px]">
          The brief was written by {briefAuthorName}.
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        disabled={pending || confirmed}
        onClick={confirm}
        className="h-11 cursor-pointer justify-center px-4 tablet:h-9 tablet:w-fit"
      >
        {confirmed ? "Confirming…" : "Confirm this record"}
      </Button>

      {error ? (
        <p
          role="status"
          className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3.5 py-2 text-[13px] leading-relaxed"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
