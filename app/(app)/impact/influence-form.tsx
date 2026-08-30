"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { BriefOption } from "@/lib/db";
import { InfluenceEventType } from "@/lib/generated/prisma/enums";
import { TBI_PARTNER_COUNTRIES } from "@/lib/impact/network-partners";

import { logInfluenceEventAction } from "./actions";
import {
  INFLUENCE_EVENT_TYPE_HINTS,
  INFLUENCE_EVENT_TYPE_LABELS,
  INFLUENCE_EVENT_TYPE_ORDER,
} from "./labels";
import {
  logInfluenceEventSchema,
  type LogInfluenceEventInput,
} from "./schema";

/**
 * Recording that a brief reached something.
 *
 * NO OPTIMISTIC UPDATE, and that is a rule rather than a preference. This action
 * is offered to two roles and still authorises server-side, so a refusal is
 * possible — and `server-actions` is explicit that optimism is only for
 * operations already known to be permitted. Nothing here is latency-sensitive
 * enough to earn the risk of showing a donor-facing claim as recorded before the
 * server agreed. The page re-reads on success instead.
 *
 * NO RED, in any state. `--destructive` is unmapped and validation messages are
 * `FieldError`, which is the watch ramp, never an alarm (§11.4).
 *
 * THE QUOTED LINE IS THE ONLY SERIF FIELD, and the label says why: it is material
 * the citing document's author wrote, not something the product or this member of
 * staff did (§11.6).
 */

function todayInUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyValues = (): LogInfluenceEventInput => ({
  briefId: "",
  eventType: "policy_citation",
  description: "",
  sourceDocument: "",
  sourceTitle: "",
  quotedText: "",
  hectaresImpacted: null,
  peopleImpacted: null,
  adaptedCountries: [],
  detectedAt: todayInUtc(),
});

export function InfluenceForm({
  briefs,
  onSaved,
}: {
  briefs: BriefOption[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<LogInfluenceEventInput>({
    resolver: zodResolver(logInfluenceEventSchema),
    defaultValues: emptyValues(),
  });

  const busy = form.formState.isSubmitting;

  /**
   * The select's own value, mirrored so the hint under it can change.
   *
   * NOT `form.watch`. `watch` returns a value React Compiler cannot memoize, and
   * it makes the compiler skip this whole component — which `npm run lint`
   * reports. A registered `onChange` chained onto RHF's own costs one line and
   * keeps the component compiled. The form's value is still RHF's; this is only
   * what the hint reads.
   */
  const [eventType, setEventType] = useState<InfluenceEventType>(
    InfluenceEventType.policy_citation,
  );

  const eventTypeField = form.register("eventType");

  const submit = async (values: LogInfluenceEventInput) => {
    setFormError(null);
    setSaved(false);

    const result = await logInfluenceEventAction(values);

    if (!result.ok) {
      const refusal = result.refusal;

      if (refusal.kind === "unauthorised") {
        setFormError(refusal.message);
        return;
      }

      // `ActionRefusal` carries variants this action cannot produce — the
      // governance and rate-limit refusals belong to the generation path — so
      // the invalid case is named rather than assumed.
      if (refusal.kind !== "invalid") {
        setFormError("That could not be recorded.");
        return;
      }

      for (const [field, messages] of Object.entries(refusal.fieldErrors)) {
        if (field === "form") {
          setFormError(messages[0] ?? "That could not be recorded.");
          continue;
        }

        form.setError(field as keyof LogInfluenceEventInput, {
          message: messages[0],
        });
      }

      return;
    }

    form.reset(emptyValues());
    setEventType(InfluenceEventType.policy_citation);
    setSaved(true);
    router.refresh();
    onSaved?.();
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="min-w-0">
      <FieldGroup className="gap-4">
        {formError ? (
          <p
            role="status"
            className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3.5 py-2.5 text-[13px] leading-relaxed"
          >
            {formError}
          </p>
        ) : null}

        <div className="grid min-w-0 grid-cols-1 gap-4 tablet:grid-cols-3">
          <Field className="min-w-0">
            <FieldLabel htmlFor="influence-brief">Brief</FieldLabel>
            <NativeSelect
              className="w-full cursor-pointer"
              id="influence-brief"
              disabled={busy}
              {...form.register("briefId")}
            >
              <NativeSelectOption value="">Choose a brief</NativeSelectOption>
              {briefs.map((brief) => (
                <NativeSelectOption key={brief.id} value={brief.id}>
                  {brief.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[form.formState.errors.briefId]} />
          </Field>

          <Field className="min-w-0">
            <FieldLabel htmlFor="influence-type">Kind of record</FieldLabel>
            <NativeSelect
              className="w-full cursor-pointer"
              id="influence-type"
              disabled={busy}
              {...eventTypeField}
              onChange={(event) => {
                void eventTypeField.onChange(event);
                setEventType(event.target.value as InfluenceEventType);
              }}
            >
              {INFLUENCE_EVENT_TYPE_ORDER.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {INFLUENCE_EVENT_TYPE_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[form.formState.errors.eventType]} />
          </Field>

          <Field className="min-w-0">
            <FieldLabel htmlFor="influence-date">Date</FieldLabel>
            <Input
              id="influence-date"
              type="date"
              max={todayInUtc()}
              disabled={busy}
              className="bg-card cursor-pointer"
              {...form.register("detectedAt")}
            />
            <FieldError errors={[form.formState.errors.detectedAt]} />
          </Field>
        </div>

        {INFLUENCE_EVENT_TYPE_HINTS[eventType] ? (
          <p className="text-ink-3 -mt-1 text-[12px]">
            {INFLUENCE_EVENT_TYPE_HINTS[eventType]}
          </p>
        ) : null}

        <Field>
          <FieldLabel htmlFor="influence-description">
            What happened
          </FieldLabel>
          <Textarea
            id="influence-description"
            rows={3}
            disabled={busy}
            className="bg-card"
            placeholder="e.g. The Forestry Commission's consultation response refers to the brief's recommendation on tree registration."
            {...form.register("description")}
          />
          <FieldDescription>
            Your own account of it. This is not treated as established influence
            until the Programme Director confirms the record.
          </FieldDescription>
          <FieldError errors={[form.formState.errors.description]} />
        </Field>

        <div className="border-line grid min-w-0 grid-cols-1 gap-4 border-t pt-4 tablet:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="influence-hectares">Estimated landscape hectares</FieldLabel>
            <Input id="influence-hectares" type="number" min="0" step="1" disabled={busy} className="bg-card" placeholder="Optional" {...form.register("hectaresImpacted", { setValueAs: (value) => value === "" ? null : Number(value) })} />
            <FieldDescription>Record a defensible estimate only; it is included in annual totals after confirmation.</FieldDescription>
            <FieldError errors={[form.formState.errors.hectaresImpacted]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="influence-people">Estimated people benefiting</FieldLabel>
            <Input id="influence-people" type="number" min="0" step="1" disabled={busy} className="bg-card" placeholder="Optional" {...form.register("peopleImpacted", { setValueAs: (value) => value === "" ? null : Number(value) })} />
            <FieldDescription>For example, smallholders with improved tenure or livelihood security.</FieldDescription>
            <FieldError errors={[form.formState.errors.peopleImpacted]} />
          </Field>
        </div>

        <Field>
          <FieldLabel>Network knowledge exchange</FieldLabel>
          <FieldDescription>Select partner programmes that adopted, piloted, or referenced this Ghana-developed approach.</FieldDescription>
          <div className="mt-2 grid grid-cols-1 gap-2 tablet:grid-cols-3" role="group" aria-label="TBI partner country adaptations">
            {TBI_PARTNER_COUNTRIES.map((partner) => (
              <label key={partner.code} className="border-line bg-card flex min-h-11 cursor-pointer items-center gap-2 rounded-input border px-3 text-[13px] text-ink">
                <input type="checkbox" value={partner.code} disabled={busy} className="cursor-pointer accent-primary" {...form.register("adaptedCountries")} />
                {partner.country}
              </label>
            ))}
          </div>
          <FieldError errors={[form.formState.errors.adaptedCountries]} />
        </Field>

        <div className="grid min-w-0 grid-cols-1 gap-4 tablet:grid-cols-2">
          <Field className="min-w-0">
            <FieldLabel htmlFor="influence-source">
              Link to the document
            </FieldLabel>
            <Input
              id="influence-source"
              inputMode="url"
              autoComplete="off"
              disabled={busy}
              className="bg-card"
              placeholder="https://"
              {...form.register("sourceDocument")}
            />
            <FieldDescription>
              Optional. Some real influence has no link — a dialogue outcome you
              were in the room for is still a record.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.sourceDocument]} />
          </Field>

          <Field className="min-w-0">
            <FieldLabel htmlFor="influence-source-title">
              Document title
            </FieldLabel>
            <Input
              id="influence-source-title"
              autoComplete="off"
              disabled={busy}
              className="bg-card"
              placeholder="e.g. National REDD+ Strategy Review"
              {...form.register("sourceTitle")}
            />
            <FieldError errors={[form.formState.errors.sourceTitle]} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="influence-quote">
            The line from that document
          </FieldLabel>
          <Textarea
            id="influence-quote"
            rows={2}
            disabled={busy}
            className="bg-card font-serif text-[14.5px] leading-[1.55]"
            placeholder="“…verbatim excerpt from the citing document…”"
            {...form.register("quotedText")}
          />
          <FieldDescription>
            Optional, and copied word for word. It is set in the serif everywhere
            it appears, because it is the document&rsquo;s own words rather than
            ours.
          </FieldDescription>
          <FieldError errors={[form.formState.errors.quotedText]} />
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={busy}
            className="h-11 cursor-pointer justify-center px-5 font-medium tablet:h-9"
          >
            {busy ? "Recording…" : "Add to the record"}
          </Button>
          {saved ? (
            <span role="status" className="text-ink-3 text-[13px]">
              Recorded. It is waiting to be confirmed.
            </span>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  );
}
