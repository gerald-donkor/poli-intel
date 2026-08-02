"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { StakeholderForm } from "./stakeholder-form";

/**
 * Adding a contact, in place.
 *
 * The form is a disclosure rather than a dialog: adding several contacts in a
 * row is the ordinary case here, and a modal that closes on every save makes
 * that worse. It opens by default when the list is empty, so the empty state's
 * next step is already on screen (§17.6).
 */
export function CreateStakeholderPanel({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      aria-labelledby="add-contact-heading"
      className="bg-card border-line rounded-card flex flex-col gap-3 border p-4 tablet:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="add-contact-heading"
          className="text-ink text-[15px] font-semibold"
        >
          Add a contact
        </h2>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="h-11 justify-center tablet:h-8"
        >
          {open ? "Close" : "Add a contact"}
        </Button>
      </div>

      {open ? (
        <StakeholderForm />
      ) : (
        <p className="text-ink-3 max-w-[62ch] text-[13px]">
          Who a brief is written for, and who it has actually reached. A contact
          record holds a name, an organisation, and the language they read in —
          nothing that would let the product write to them.
        </p>
      )}
    </section>
  );
}
