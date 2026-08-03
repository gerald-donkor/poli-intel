"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { setSignalWindowAction } from "./actions";
import { setSignalWindowSchema } from "./schema";

/**
 * Recording, changing, or clearing the day a window closes.
 *
 * RENDERED ONLY FOR ROLES THAT MAY USE IT, and that is presentation — the
 * control is never the control. `setSignalWindowAction` re-checks the caller's
 * role server-side on every invocation (§10.1).
 *
 * A NATIVE DAY INPUT, deliberately. It is fully operable from the keyboard, it
 * accepts a typed date without a pointer, and it speaks the platform's own date
 * format to a screen reader — none of which a bespoke popover calendar would give
 * for free. The page's calendar is for reading the shape of the month; this is
 * for entering one day.
 *
 * IT VALIDATES WITH THE SHARED SCHEMA. The same Zod object the action parses
 * runs here, so a five-years-out typo is caught in the same words on both sides
 * and the rule exists once (§10.10).
 *
 * NOTHING IS INFERRED. There is no "suggest a date" affordance and no prefill
 * from urgency: an empty field means nobody has recorded a date, which is exactly
 * what the column means.
 */
export function WindowDateControl({
  signalId,
  initialDate,
}: {
  signalId: string;
  /** `YYYY-MM-DD`, or null where nothing has been recorded. */
  initialDate: string | null;
}) {
  const router = useRouter();
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialDate ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const submit = (windowClosesOn: string | null) => {
    setMessage(null);

    const parsed = setSignalWindowSchema.safeParse({ signalId, windowClosesOn });

    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check the date.");
      return;
    }

    startTransition(async () => {
      const result = await setSignalWindowAction(parsed.data);

      if (!result.ok) {
        setMessage(
          result.refusal.kind === "unauthorised"
            ? result.refusal.message
            : "That date could not be recorded.",
        );
        return;
      }

      setValue(result.windowClosesAt?.slice(0, 10) ?? "");
      router.refresh();
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={inputId} className="text-ink-2 text-[13px] font-medium">
        Closing date
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={inputId}
          type="date"
          value={value}
          disabled={pending}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 w-[168px] font-mono text-[13px] tabular-nums"
        />
        <Button
          type="button"
          size="sm"
          disabled={pending || value === ""}
          onClick={() => submit(value === "" ? null : value)}
        >
          {pending ? "Saving…" : "Record"}
        </Button>
        {initialDate !== null ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => submit(null)}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {message ? (
        // Slate, never red — `destructive` is deliberately unmapped (§11.4).
        <p
          role="status"
          className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3 py-2 text-[13px]"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
