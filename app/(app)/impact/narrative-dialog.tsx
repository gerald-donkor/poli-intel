"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { QuarterlyNarrativeView } from "@/lib/db";

import { saveQuarterlyNarrativeAction } from "./actions";
import { QUARTERLY_NARRATIVE_MAX_CHARS, quarterlyNarrativeSchema, type QuarterlyNarrativeInput } from "./schema";

const fields = [
  ["wins", "Policy wins & influence", "What succeeded this quarter?"],
  ["missedWindows", "Missed windows", "Which deadlines or opportunities passed without engagement?"],
  ["evidenceGaps", "Evidence gaps (ingestion priorities)", "What knowledge would have made the policy response stronger?"],
  ["systemImprovement", "System & workflow improvements", "Name one concrete change for the next cycle."],
] as const;

export function NarrativeDialog({ quarterKey, narrative }: { quarterKey: string; narrative: QuarterlyNarrativeView | null }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<QuarterlyNarrativeInput>({
    resolver: zodResolver(quarterlyNarrativeSchema),
    defaultValues: {
      quarterKey,
      wins: narrative?.wins ?? "",
      missedWindows: narrative?.missedWindows ?? "",
      evidenceGaps: narrative?.evidenceGaps ?? "",
      systemImprovement: narrative?.systemImprovement ?? "",
    },
  });

  const submit = async (values: QuarterlyNarrativeInput) => {
    setFormError(null);
    const result = await saveQuarterlyNarrativeAction(values);
    if (result.ok) {
      setOpen(false);
      return;
    }
    if (result.refusal.kind === "invalid") {
      for (const [field, messages] of Object.entries(result.refusal.fieldErrors)) {
        if (field === "form") setFormError(messages[0] ?? "The evaluation could not be saved.");
        else form.setError(field as keyof QuarterlyNarrativeInput, { message: messages[0] });
      }
      return;
    }
    setFormError(result.refusal.kind === "unauthorised" ? result.refusal.message : "The evaluation could not be saved.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant={narrative ? "outline" : "default"} className="h-10 cursor-pointer px-4 tablet:h-9" />}>
        {narrative ? "Edit narrative" : "Record evaluation"}
      </DialogTrigger>
      <DialogContent className="bg-card border-line max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] overflow-y-auto rounded-modal border p-5 tablet:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="text-ink text-[18px] font-semibold">Quarterly evaluation · {quarterKey}</DialogTitle>
          <DialogDescription className="text-ink-3 text-[13px] leading-relaxed">A staff-authored reflection. It is not generated or fact-checked by a model.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="mt-2">
          <FieldGroup className="gap-4">
            {formError ? <p role="status" className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3 py-2.5 text-[13px]">{formError}</p> : null}
            {fields.map(([name, label, hint]) => {
              return (
                <Field key={name}>
                  <FieldLabel htmlFor={`narrative-${name}`}>{label}</FieldLabel>
                  <Textarea id={`narrative-${name}`} rows={4} disabled={form.formState.isSubmitting} className="bg-card" placeholder={hint} {...form.register(name)} />
                  <FieldDescription>Required · up to {QUARTERLY_NARRATIVE_MAX_CHARS} characters</FieldDescription>
                  <FieldError errors={[form.formState.errors[name]]} />
                </Field>
              );
            })}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" disabled={form.formState.isSubmitting} className="h-11 cursor-pointer px-5 tablet:h-9">
                {form.formState.isSubmitting ? "Saving…" : "Save evaluation"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
