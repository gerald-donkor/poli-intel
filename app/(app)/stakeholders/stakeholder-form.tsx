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

import { createStakeholderAction, updateStakeholderAction } from "./actions";
import { AUDIENCE_TARGET_OPTIONS } from "./labels";
import {
  createStakeholderSchema,
  PREFERRED_LANGUAGES,
  type CreateStakeholderInput,
} from "./schema";

/**
 * One form, two jobs: adding a contact and correcting one.
 *
 * NO OPTIMISTIC UPDATE. Both actions can be refused on authorisation grounds,
 * and nobody should briefly see a contact saved that the server then refuses
 * (`server-actions`). The page re-reads from the server on success instead.
 *
 * NO RED, in any state. `--destructive` is unmapped and validation messages are
 * `FieldError`, which is the watch ramp, never an alarm (§11.4).
 *
 * NO TOAST. A refusal is stated in place, above the controls it belongs to.
 */

type Existing = {
  id: string;
  name: string;
  organisation: string | null;
  role: string | null;
  audienceType: CreateStakeholderInput["audienceType"];
  preferredLanguage: CreateStakeholderInput["preferredLanguage"];
};

const EMPTY: CreateStakeholderInput = {
  name: "",
  organisation: "",
  role: "",
  audienceType: "",
  preferredLanguage: "",
};

export function StakeholderForm({
  existing,
  onSaved,
}: {
  /** Absent for the create form; present when correcting a record. */
  existing?: Existing;
  /** Optional hook, so the create form can collapse after it saves. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<CreateStakeholderInput>({
    resolver: zodResolver(createStakeholderSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          organisation: existing.organisation ?? "",
          role: existing.role ?? "",
          audienceType: existing.audienceType ?? "",
          preferredLanguage: existing.preferredLanguage ?? "",
        }
      : EMPTY,
  });

  const busy = form.formState.isSubmitting;

  const submit = async (values: CreateStakeholderInput) => {
    setFormError(null);
    setSaved(false);

    const result = existing
      ? await updateStakeholderAction({ ...values, id: existing.id })
      : await createStakeholderAction(values);

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
        setFormError("That could not be saved.");
        return;
      }

      for (const [field, messages] of Object.entries(refusal.fieldErrors)) {
        if (field === "form") {
          setFormError(messages[0] ?? "That could not be saved.");
          continue;
        }

        form.setError(field as keyof CreateStakeholderInput, {
          message: messages[0],
        });
      }

      return;
    }

    if (!existing) form.reset(EMPTY);

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
            className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3 py-2 text-[13px]"
          >
            {formError}
          </p>
        ) : null}

        <Field>
          <FieldLabel htmlFor="stakeholder-name">Name</FieldLabel>
          <Input
            id="stakeholder-name"
            autoComplete="off"
            disabled={busy}
            className="bg-card"
            {...form.register("name")}
          />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>

        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="stakeholder-organisation">
              Organisation
            </FieldLabel>
            <Input
              id="stakeholder-organisation"
              autoComplete="off"
              disabled={busy}
              className="bg-card"
              {...form.register("organisation")}
            />
            <FieldError errors={[form.formState.errors.organisation]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="stakeholder-role">Role</FieldLabel>
            <Input
              id="stakeholder-role"
              autoComplete="off"
              disabled={busy}
              className="bg-card"
              placeholder="e.g. Director, Forestry Commission"
              {...form.register("role")}
            />
            <FieldError errors={[form.formState.errors.role]} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="stakeholder-audience">Audience type</FieldLabel>
            <NativeSelect
              className="w-full"
              id="stakeholder-audience"
              disabled={busy}
              {...form.register("audienceType")}
            >
              <NativeSelectOption value="">Not recorded</NativeSelectOption>
              {AUDIENCE_TARGET_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              How this contact is grouped. It is not matched against a
              brief&rsquo;s audience — that judgment stays a person&rsquo;s.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.audienceType]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="stakeholder-language">
              Preferred language
            </FieldLabel>
            <NativeSelect
              className="w-full"
              id="stakeholder-language"
              disabled={busy}
              {...form.register("preferredLanguage")}
            >
              <NativeSelectOption value="">Not recorded</NativeSelectOption>
              {PREFERRED_LANGUAGES.map((language) => (
                <NativeSelectOption key={language} value={language}>
                  {language}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[form.formState.errors.preferredLanguage]} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={busy}
            className="h-11 justify-center tablet:h-8"
          >
            {existing ? "Save changes" : "Add contact"}
          </Button>
          {saved ? (
            <span role="status" className="text-ink-3 text-[13px]">
              {existing ? "Changes saved." : "Contact added."}
            </span>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  );
}
