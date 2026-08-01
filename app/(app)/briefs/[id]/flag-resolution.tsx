"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

import { reopenFlagAction, resolveFlagAction } from "./actions";

/**
 * Closing a flag, and reopening one.
 *
 * TWO OUTCOMES, NOT ONE BUTTON. Resolved means a person checked the claim
 * against a source and it holds; dismissed means the claim is being let through
 * without that check — because the sentence was rewritten, or removed. Both stop
 * blocking approval, and the difference is the entire audit value of the record.
 *
 * A REASON IS REQUIRED, here and in the action. This control's requirement is a
 * courtesy to the person typing; the server's is the rule (§9.6).
 *
 * NO RED, in any state, including every validation message this can produce: the
 * textarea's invalid ring is the watch ramp and `FieldError` is `watch-ink`
 * (§11.4). No optimistic update either — both actions can be refused on
 * authorisation grounds, and nobody should briefly see a flag closed that the
 * server then refuses (`server-actions`).
 *
 * NO TOAST. A refusal is stated in place, under the field it belongs to.
 */
export function FlagResolution({
  flagId,
  mode,
}: {
  flagId: string;
  mode: "clear" | "reopen";
}) {
  const router = useRouter();
  const fieldId = useId();

  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (outcome: "resolved" | "dismissed" | "reopen") => {
    setError(null);

    startTransition(async () => {
      const result =
        outcome === "reopen"
          ? await reopenFlagAction({ flagId, reason })
          : await resolveFlagAction({ flagId, outcome, reason });

      if (result.ok) {
        setReason("");
        // Re-read from the server: the panel, the review controls and the open
        // count all come from the database rather than from local state.
        router.refresh();
        return;
      }

      setError(
        result.refusal.kind === "unauthorised"
          ? result.refusal.message
          : result.refusal.kind === "invalid"
            ? (result.refusal.fieldErrors.reason?.[0] ??
              result.refusal.fieldErrors.form?.[0] ??
              "That could not be recorded.")
            : "That could not be recorded.",
      );
    });
  };

  return (
    <div className="border-watch-border mt-3 flex flex-col gap-2 border-t pt-3">
      <Field>
        <FieldLabel htmlFor={fieldId} className="text-[12.5px]">
          {mode === "clear"
            ? "What did you find? (recorded with your name and the time)"
            : "Why is this being reopened?"}
        </FieldLabel>
        <Textarea
          id={fieldId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={500}
          aria-invalid={error !== null}
          placeholder={
            mode === "clear"
              ? "e.g. figure confirmed on p.14 of the 2023 landscape report"
              : "e.g. closed against the wrong source"
          }
          className="bg-card text-[13px]"
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>

      <div className="flex flex-col gap-2 tablet:flex-row tablet:flex-wrap">
        {mode === "clear" ? (
          <>
            <Button
              type="button"
              variant="default"
              disabled={isPending}
              onClick={() => run("resolved")}
              className="h-11 justify-center tablet:h-8"
            >
              Checked against a source
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => run("dismissed")}
              className="h-11 justify-center tablet:h-8"
            >
              Let through without a check
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => run("reopen")}
            className="h-11 justify-center tablet:h-8"
          >
            Reopen this flag
          </Button>
        )}
      </div>
    </div>
  );
}
