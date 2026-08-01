"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { BriefStatus } from "@/lib/generated/prisma/enums";

import { BRIEF_TRANSITION_LABELS } from "../labels";
import { changeBriefStatusAction } from "./actions";
import type { ChangeBriefStatusInput } from "./schema";

type Transition = ChangeBriefStatusInput["transition"];

/**
 * The Programme Director's decision surface (§8.3, §10.2).
 *
 * APPROVE IS DISABLED, NOT HIDDEN, while a flag is open, WITH THE REASON STATED
 * INLINE beside it — never a bare greyed button. The disabled state is
 * presentation; `changeBriefStatusAction` re-reads flag state inside its own
 * transaction and refuses regardless, and only that is the control (§9.5).
 *
 * A ROLE THAT MAY DO NONE OF THIS SEES NO PANEL AND NO DISABLED GHOST — the page
 * does not render this component for them, and the brief reads as it did before.
 *
 * NO OPTIMISTIC UPDATE. Every one of these can be refused, and nobody should
 * briefly see a brief approved that the server then declines (`server-actions`).
 *
 * COPY: the Director approves; the product records it. Nothing here says the
 * system verified, approved or endorsed anything (§8.8). "Send back" covers both
 * of the spec's declining actions, told apart by the reason recorded with it.
 */
export function ReviewPanel({
  briefId,
  status,
  openFlagCount,
}: {
  briefId: string;
  status: BriefStatus;
  openFlagCount: number;
}) {
  const router = useRouter();
  const reasonFieldId = useId();

  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Transition | null>(null);
  const [isPending, startTransition] = useTransition();

  const blockedByFlags = openFlagCount > 0;
  const isDraft = status === BriefStatus.draft;
  const isReviewed = status === BriefStatus.reviewed;
  const closed =
    status === BriefStatus.submitted || status === BriefStatus.published;

  const run = (transition: Transition) => {
    setError(null);
    setPending(transition);

    startTransition(async () => {
      const result = await changeBriefStatusAction({
        briefId,
        transition,
        reason: reason.trim() === "" ? undefined : reason.trim(),
      });

      setPending(null);

      if (result.ok) {
        setReason("");
        router.refresh();
        return;
      }

      setError(
        result.refusal.kind === "unauthorised"
          ? result.refusal.message
          : result.refusal.kind === "refused-unresolved-flags"
            ? `${result.refusal.openFlagCount} ${result.refusal.openFlagCount === 1 ? "claim" : "claims"} still need checking before this can be approved.`
            : result.refusal.kind === "invalid"
              ? (result.refusal.fieldErrors.reason?.[0] ??
                result.refusal.fieldErrors.form?.[0] ??
                "That could not be recorded.")
              : "That could not be recorded.",
      );
    });
  };

  return (
    <section
      aria-labelledby="review-heading"
      className="bg-card border-line rounded-card flex flex-col gap-3 border p-4"
    >
      <h2
        id="review-heading"
        className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
      >
        Your decision
      </h2>

      {closed ? (
        <p className="text-ink-3 text-[13px]">
          This brief has left the building. Its record is below, and its text is
          no longer editable.
        </p>
      ) : (
        <>
          <p className="text-ink-3 text-[13px]">
            {isDraft
              ? "Approving records that you have read this draft and are content for it to go forward. Sending it back returns it to the officer with your reason."
              : "This brief is approved and no longer editable. Mark it submitted or published once it has gone out, or send it back for more work."}
          </p>

          <Field>
            <FieldLabel htmlFor={reasonFieldId} className="text-[12.5px]">
              Reason — required to send back, optional otherwise
            </FieldLabel>
            <Textarea
              id={reasonFieldId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={500}
              aria-invalid={error !== null}
              placeholder="Recorded with your name and the time."
              className="text-[13px]"
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>

          <div className="flex flex-col gap-2 tablet:flex-row tablet:flex-wrap">
            {isDraft ? (
              <Button
                type="button"
                variant="default"
                disabled={isPending || blockedByFlags}
                aria-describedby={
                  blockedByFlags ? "approve-blocked" : undefined
                }
                onClick={() => run("approve")}
                className="h-11 justify-center tablet:h-8"
              >
                {pending === "approve"
                  ? "Recording…"
                  : BRIEF_TRANSITION_LABELS.approve}
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              disabled={isPending || reason.trim().length < 3}
              onClick={() => run("send_back")}
              className="h-11 justify-center tablet:h-8"
            >
              {pending === "send_back"
                ? "Recording…"
                : BRIEF_TRANSITION_LABELS.send_back}
            </Button>

            {isReviewed ? (
              <>
                <Button
                  type="button"
                  variant="default"
                  disabled={isPending}
                  onClick={() => run("submit")}
                  className="h-11 justify-center tablet:h-8"
                >
                  {pending === "submit"
                    ? "Recording…"
                    : BRIEF_TRANSITION_LABELS.submit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run("publish")}
                  className="h-11 justify-center tablet:h-8"
                >
                  {pending === "publish"
                    ? "Recording…"
                    : BRIEF_TRANSITION_LABELS.publish}
                </Button>
              </>
            ) : null}
          </div>

          {/* The reason the button is disabled, in words, next to it. A greyed
              control with no explanation is how a governance hold becomes a
              mystery (§9.5, hallucination-guard). */}
          {isDraft && blockedByFlags ? (
            <p id="approve-blocked" className="text-watch-ink text-[12.5px]">
              {openFlagCount}{" "}
              {openFlagCount === 1 ? "claim still needs" : "claims still need"}{" "}
              checking before this brief can be approved. They are in the panel
              above.
            </p>
          ) : null}

          <p className="text-ink-3 text-[12.5px]">
            Sending back needs a reason. Nothing here happens automatically —
            every move is recorded against your name.
          </p>
        </>
      )}
    </section>
  );
}
