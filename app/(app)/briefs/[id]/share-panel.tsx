"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AudienceTypeBadge } from "@/components/audience-type-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { BriefShare, StakeholderOption } from "@/lib/db";

import { formatSharedAt, todayInputValue } from "../../stakeholders/labels";
import { logShareSchema, type LogShareInput } from "../../stakeholders/schema";
import { logBriefShareAction } from "./actions";

/**
 * Who this brief has been sent to, and the control for recording another.
 *
 * THE PRODUCT SENDS NOTHING. This records what a person did — "Log a share",
 * "Shared with", "Logged by Ama on 4 Aug". Never "Sent", never "Delivered", and
 * never anything implying the system decided or dispatched anything (§8.8).
 *
 * LOGGING A SHARE MOVES NOTHING. The brief's status is untouched by every path
 * here, and this panel does not read flag state at all: an open flag blocks
 * Programme Director approval and nothing else (§9.5).
 *
 * NO OPTIMISTIC UPDATE — the action can refuse on authorisation grounds, so the
 * list re-reads from the server instead. NO RED anywhere, including validation.
 */
export function SharePanel({
  briefId,
  shares,
  contacts,
  canLog,
}: {
  briefId: string;
  shares: BriefShare[];
  contacts: StakeholderOption[];
  /** Presentation only. The action authorises its own caller (§10.1). */
  canLog: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"created" | "updated" | null>(null);

  const form = useForm<LogShareInput>({
    resolver: zodResolver(logShareSchema),
    defaultValues: {
      briefId,
      stakeholderId: "",
      sharedAt: todayInputValue(),
      note: "",
    },
  });

  const busy = form.formState.isSubmitting;

  const submit = async (values: LogShareInput) => {
    setFormError(null);

    const result = await logBriefShareAction(values);

    if (!result.ok) {
      const refusal = result.refusal;

      if (refusal.kind === "unauthorised") {
        setFormError(refusal.message);
        return;
      }

      if (refusal.kind !== "invalid") {
        setFormError("That could not be recorded.");
        return;
      }

      for (const [field, messages] of Object.entries(refusal.fieldErrors)) {
        if (field === "form") {
          setFormError(messages[0] ?? "That could not be recorded.");
          continue;
        }

        form.setError(field as keyof LogShareInput, { message: messages[0] });
      }

      return;
    }

    setOutcome(result.outcome);
    setOpen(false);
    form.reset({
      briefId,
      stakeholderId: "",
      sharedAt: todayInputValue(),
      note: "",
    });
    router.refresh();
  };

  return (
    <section
      aria-labelledby="share-panel-heading"
      className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="share-panel-heading"
          className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
        >
          Shared with{" "}
          <span className="font-mono tabular-nums">({shares.length})</span>
        </h2>

        {canLog ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-center tablet:h-8"
                />
              }
            >
              Log a share
            </DialogTrigger>
            <DialogContent className="max-w-[min(92vw,520px)]">
              <DialogHeader>
                <DialogTitle>Log a share</DialogTitle>
                <DialogDescription>
                  A record of something a person did. It does not move this brief
                  and it sends nothing.
                </DialogDescription>
              </DialogHeader>

              {contacts.length === 0 ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-ink-3 text-[13px]">
                    There are no contacts to log a share against yet.
                  </p>
                  <Link
                    href="/stakeholders"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Open the stakeholder list
                  </Link>
                </div>
              ) : (
                <form onSubmit={form.handleSubmit(submit)} noValidate>
                  <FieldGroup className="gap-4">
                    {formError ? (
                      <p
                        role="status"
                        className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3 py-2 text-[13px]"
                      >
                        {formError}
                      </p>
                    ) : null}

                    <Field>
                      <FieldLabel htmlFor="share-stakeholder">
                        Who it went to
                      </FieldLabel>
                      <NativeSelect
                        className="w-full"
                        id="share-stakeholder"
                        disabled={busy}
                        {...form.register("stakeholderId")}
                      >
                        <NativeSelectOption value="">
                          Choose a contact
                        </NativeSelectOption>
                        {contacts.map((contact) => (
                          <NativeSelectOption
                            key={contact.id}
                            value={contact.id}
                          >
                            {contact.organisation
                              ? `${contact.name} — ${contact.organisation}`
                              : contact.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <FieldError
                        errors={[form.formState.errors.stakeholderId]}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="share-date">When</FieldLabel>
                      <Input
                        id="share-date"
                        type="date"
                        max={todayInputValue()}
                        disabled={busy}
                        className="bg-card"
                        {...form.register("sharedAt")}
                      />
                      <FieldError errors={[form.formState.errors.sharedAt]} />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="share-note">
                        Note (optional)
                      </FieldLabel>
                      <Textarea
                        id="share-note"
                        rows={3}
                        maxLength={500}
                        disabled={busy}
                        placeholder="e.g. handed over at the Forestry Commission consultation"
                        className="bg-card text-[13px]"
                        {...form.register("note")}
                      />
                      <FieldError errors={[form.formState.errors.note]} />
                    </Field>
                  </FieldGroup>

                  <DialogFooter className="mt-4">
                    <DialogClose
                      render={<Button type="button" variant="outline" />}
                    >
                      Cancel
                    </DialogClose>
                    <Button type="submit" disabled={busy}>
                      Log this share
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {outcome ? (
        <p role="status" className="text-ink-3 text-[12.5px]">
          {outcome === "updated"
            ? "That share was already logged — the record was updated."
            : "Share logged."}
        </p>
      ) : null}

      {shares.length === 0 ? (
        <p className="text-ink-3 text-[12.5px]">
          Not logged as shared with anyone yet.
        </p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-3">
          {shares.map((share) => (
            <li
              key={share.stakeholderId}
              className="border-line flex min-w-0 flex-col gap-1 border-t pt-3 first:border-t-0 first:pt-0"
            >
              <Link
                href={`/stakeholders/${share.stakeholderId}`}
                className="text-primary-ink focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] text-[13px] leading-snug font-medium break-words underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {share.stakeholderName}
              </Link>
              {share.stakeholderOrganisation ? (
                <p className="text-ink-3 text-[12.5px] break-words">
                  {share.stakeholderOrganisation}
                </p>
              ) : null}
              {share.audienceType ? (
                <AudienceTypeBadge
                  audienceType={share.audienceType}
                  className="mt-0.5"
                />
              ) : null}
              <p className="text-ink-3 font-mono text-[11.5px]">
                Logged by {share.sharedByName ?? "a member of staff"} on{" "}
                {formatSharedAt(share.sharedAt)}
              </p>
              {share.note ? (
                <p className="text-ink-2 mt-1 text-[12.5px] break-words">
                  {share.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
