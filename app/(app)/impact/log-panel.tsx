"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { BriefOption } from "@/lib/db";

import { InfluenceForm } from "./influence-form";

/**
 * Adding to the record, in place.
 *
 * A disclosure rather than a dialog, for the same reason the CRM's is: somebody
 * back from a convening with three things to record should not fight a modal
 * that closes on every save. It opens by default when the record is empty, so
 * the empty state's next step is already on screen (§17.6).
 */
export function LogInfluencePanel({
  briefs,
  defaultOpen = false,
}: {
  briefs: BriefOption[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      aria-labelledby="log-influence-heading"
      className="bg-card border-line rounded-card flex flex-col gap-3.5 border p-4 tablet:p-5 shadow-raised"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="log-influence-heading"
            className="text-ink text-[15px] font-semibold tracking-[-0.01em]"
          >
            Add to the record
          </h2>
          {!open ? (
            <p className="text-ink-3 max-w-[72ch] text-[13px] leading-relaxed">
              Where a brief has been cited, quoted, or acted on — a policy document, a
              legislative instrument, a company commitment, a dialogue outcome, or
              national strategy text.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="h-11 cursor-pointer justify-center px-4 tablet:h-9"
        >
          {open ? "Close" : "Add a record"}
        </Button>
      </div>

      {open ? (
        briefs.length === 0 ? (
          <p className="text-ink-3 max-w-[62ch] text-[13px] py-2">
            There are no briefs to record against yet. An influence record points
            at a brief, so the first step is a brief.
          </p>
        ) : (
          <div className="border-line border-t pt-3">
            <InfluenceForm briefs={briefs} onSaved={() => setOpen(false)} />
          </div>
        )
      ) : null}
    </section>
  );
}
