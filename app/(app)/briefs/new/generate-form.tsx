"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { GuardFlagIcon } from "@/components/guard-flag-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AUDIENCE_OPTIONS } from "@/lib/ai/audience-profiles";
import { BRIEF_TYPE_OPTIONS } from "@/lib/ai/brief-types";
import type { ActionRefusal } from "@/lib/auth/authorize";
import { BRIEF_POLICY_TEXT_MAX_CHARS } from "@/lib/briefs/generation-limits";
import type { EvidenceListItem } from "@/lib/db/evidence";
import { classificationLabel } from "@/components/classification-badge";
import { cn } from "@/lib/utils";

import {
  draftBriefAction,
  startBriefGeneration,
  verifyBriefAction,
} from "./actions";
import { EvidencePicker } from "./evidence-picker";
import { GENERATION_STAGES, GenerationStepper } from "./generation-stepper";
import { generateBriefSchema, type GenerateBriefInput } from "./schema";
import { SignalContext, type SignalPrefill } from "./signal-context";

/**
 * The generation form, and the client half of the three-stage sequence.
 *
 * Each stage is a separate awaited Server Action, so the stepper reports work
 * that actually ran rather than a timer (§16.7). The component holds the pasted
 * text, the selections and the attempt id in state, which is what makes the
 * rate-limit contract real: a 429 halts the run, says when to try again, and the
 * next press RESUMES from the stage that was interrupted — the draft already on
 * the attempt row is not regenerated and nothing typed is lost (§13.4).
 *
 * NOTHING HERE DECIDES ANYTHING. Every refusal below is a value returned by an
 * action that authorised and gated server-side first (§10.1, §7.2).
 */

type Run =
  | { phase: "idle" }
  | { phase: "running"; stage: number; generationId: string | null }
  | {
      phase: "halted";
      stage: number;
      generationId: string | null;
      refusal: ActionRefusal;
    };

export function GenerateBriefForm({
  evidence,
  prefill,
}: {
  evidence: EvidenceListItem[];
  /** Set when the form was opened from a signal; null for a manual draft. */
  prefill: SignalPrefill | null;
}) {
  const router = useRouter();
  const [run, setRun] = useState<Run>({ phase: "idle" });

  const form = useForm<GenerateBriefInput>({
    resolver: zodResolver(generateBriefSchema),
    // `briefType` and `audience` have no safe default — a brief written for the
    // wrong audience is worse than one not yet started — so they open unchosen
    // and the schema rejects until picked. NEITHER IS PREFILLED FROM A SIGNAL
    // for the same reason: the matcher scored evidence, it did not decide who
    // the brief is for (§8.8).
    defaultValues: {
      policyText: prefill?.policyText ?? "",
      evidenceItemIds: prefill?.matched.map((match) => match.item.id) ?? [],
      // Carried as a form value rather than re-read from the URL at submit, so
      // the association travels with the request the schema validates.
      signalId: prefill?.signalId,
    },
  });

  const busy = run.phase === "running";

  // `useWatch`, not `form.watch`: the latter returns a fresh function each
  // render, which makes React Compiler skip memoising this whole component.
  const policyText = useWatch({ control: form.control, name: "policyText" }) ?? "";
  const selectedIds =
    useWatch({ control: form.control, name: "evidenceItemIds" }) ?? [];

  const halt = (stage: number, generationId: string | null, refusal: ActionRefusal) => {
    if (refusal.kind === "invalid") applyFieldErrors(refusal, form);

    setRun({ phase: "halted", stage, generationId, refusal });
  };

  const submit = async (values: GenerateBriefInput) => {
    const resume =
      run.phase === "halted" && run.refusal.kind === "rate-limited"
        ? { generationId: run.generationId, stage: run.stage }
        : { generationId: null, stage: 0 };

    let generationId = resume.generationId;

    // Stage 1 — Reading evidence.
    if (generationId === null) {
      setRun({ phase: "running", stage: 0, generationId: null });

      const started = await startBriefGeneration(values);

      if (!started.ok) {
        halt(0, null, started.refusal);
        return;
      }

      generationId = started.generationId;
    }

    // Stage 2 — Drafting. Skipped when resuming a run that got past it.
    if (resume.stage <= 1) {
      setRun({ phase: "running", stage: 1, generationId });

      const drafted = await draftBriefAction(generationId);

      if (!drafted.ok) {
        halt(1, generationId, drafted.refusal);
        return;
      }
    }

    // Stage 3 — Verifying citations. Nothing is a brief until this returns.
    setRun({ phase: "running", stage: 2, generationId });

    const verified = await verifyBriefAction(generationId);

    if (!verified.ok) {
      halt(2, generationId, verified.refusal);
      return;
    }

    setRun({ phase: "running", stage: GENERATION_STAGES.length, generationId });
    router.push(`/briefs/${verified.briefId}`);
  };

  const toggleEvidence = (id: string) => {
    const current = form.getValues("evidenceItemIds") ?? [];

    form.setValue(
      "evidenceItemIds",
      current.includes(id)
        ? current.filter((selected) => selected !== id)
        : [...current, id],
      { shouldValidate: form.formState.isSubmitted },
    );
  };

  const setSelectedEvidence = (ids: string[]) => {
    form.setValue("evidenceItemIds", ids, {
      shouldValidate: form.formState.isSubmitted,
    });
  };

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(submit)(event);
      }}
      noValidate
      className="flex min-w-0 flex-col gap-4"
    >
      {prefill ? (
        <SignalContext signal={prefill} matchedCount={prefill.matched.length} />
      ) : null}

      {/* `signalId` has no input of its own, so its refusal needs somewhere to
          land. Stage 1 refuses rather than silently dropping the association,
          and a refusal nobody can read would defeat that. */}
      <FieldError errors={[form.formState.errors.signalId]} />

      {/* Single column on phones; the picker moves alongside the form at
          `laptop` (§11.15). No fixed pixel width anywhere. */}
      <div className="grid min-w-0 grid-cols-1 gap-4 laptop:grid-cols-[minmax(0,1fr)_minmax(0,420px)] laptop:items-start desktop:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="bg-card border-line rounded-card flex flex-col gap-3 border p-4 tablet:p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-ink text-h3 font-semibold">
                Policy document
              </h2>
              <p className="text-ink-3 text-[13px]">
                The external text the brief responds to — a consultation notice,
                an implementing act, a draft bill.
              </p>
            </div>

            {/* Said plainly, because the difference matters: what is in the box
                is the radar's own summary of the document, not the document.
                The source link is beside it so the real text can be pasted
                over. */}
            {prefill ? (
              <p className="text-ink-2 border-line rounded-card border border-dashed p-3 text-[12.5px] leading-[1.5]">
                This is the radar&rsquo;s summary of the signal, not the source
                document. Replace it with the passage the brief should respond
                to if you have it —{" "}
                <a
                  href={prefill.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                  className="text-primary-ink focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] break-words underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  open it at {prefill.sourceName}
                </a>
                .
              </p>
            ) : null}

            {/* Governance notice. The pasted text goes to Gemini as context, so
                it must be public material. It is never stored as evidence, never
                embedded, and never enters the library (§7). */}
            <Alert variant="pending" className="rounded-card px-3.5 py-3">
              <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
                <span
                  aria-hidden="true"
                  className="border-immediate size-3.5 shrink-0 rounded-[2px] border-2"
                />
                Public policy documents only
              </AlertTitle>
              <AlertDescription className="text-immediate-ink/90 text-[13px]">
                <p>
                  This text is sent to the model. Do not paste community-sourced
                  or unpublished internal material. It is not saved as evidence
                  and never enters the library.
                </p>
              </AlertDescription>
            </Alert>

            <Field>
              <FieldLabel htmlFor="policyText">Policy text</FieldLabel>
              <Textarea
                id="policyText"
                rows={12}
                disabled={busy}
                placeholder="Paste the passage the brief should respond to…"
                className="min-h-[220px] text-[13.5px]"
                {...form.register("policyText")}
              />
              <FieldDescription>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    policyText.length > BRIEF_POLICY_TEXT_MAX_CHARS &&
                      "text-immediate-ink font-medium",
                  )}
                >
                  {policyText.length.toLocaleString()}
                </span>{" "}
                of {BRIEF_POLICY_TEXT_MAX_CHARS.toLocaleString()} characters
              </FieldDescription>
              <FieldError errors={[form.formState.errors.policyText]} />
            </Field>
          </section>

          <section className="bg-card border-line rounded-card flex flex-col gap-3 border p-4 tablet:p-6">
            <h2 className="text-ink text-h3 font-semibold">Brief type</h2>
            <Controller
              control={form.control}
              name="briefType"
              render={({ field }) => (
                <RadioGroup
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={busy}
                  aria-label="Brief type"
                  className="gap-2"
                >
                  {BRIEF_TYPE_OPTIONS.map((option) => (
                    <OptionRow
                      key={option.value}
                      value={option.value}
                      selected={field.value === option.value}
                      title={option.label}
                      meta={`${option.lengthTarget} · ${option.approximateWords}`}
                      description={option.description}
                    />
                  ))}
                </RadioGroup>
              )}
            />
            <FieldError errors={[form.formState.errors.briefType]} />
          </section>

          <section className="bg-card border-line rounded-card flex flex-col gap-3 border p-4 tablet:p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-ink text-h3 font-semibold">Audience</h2>
              <p className="text-ink-3 text-[13px]">
                The same evidence, framed for one reader. This sets the framing
                emphasis and the tone the draft is written in.
              </p>
            </div>
            <Controller
              control={form.control}
              name="audience"
              render={({ field }) => (
                <RadioGroup
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={busy}
                  aria-label="Audience"
                  className="gap-2"
                >
                  {AUDIENCE_OPTIONS.map((option) => (
                    <OptionRow
                      key={option.value}
                      value={option.value}
                      selected={field.value === option.value}
                      title={option.label}
                      meta={option.tone}
                      description={option.framingEmphasis}
                    />
                  ))}
                </RadioGroup>
              )}
            />
            <FieldError errors={[form.formState.errors.audience]} />
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <EvidencePicker
            evidence={evidence}
            matched={prefill?.matched ?? []}
            selectedIds={selectedIds}
            onToggle={toggleEvidence}
            onSetSelected={setSelectedEvidence}
            disabled={busy}
          />
          <FieldError errors={[form.formState.errors.evidenceItemIds]} />
        </div>
      </div>

      {run.phase === "halted" ? <RefusalPanel refusal={run.refusal} /> : null}

      {run.phase !== "idle" ? (
        <GenerationStepper
          activeIndex={run.stage}
          halted={run.phase === "halted"}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy} className="h-11 tablet:h-8">
          {busy
            ? "Generating…"
            : run.phase === "halted" &&
                run.refusal.kind === "rate-limited" &&
                run.generationId !== null
              ? "Resume generation"
              : "Generate draft"}
        </Button>
        <Link
          href="/briefs"
          aria-disabled={busy || undefined}
          tabIndex={busy ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            busy && "pointer-events-none opacity-50",
          )}
        >
          Cancel
        </Link>
      </div>

      <p className="text-ink-3 max-w-[70ch] text-[12.5px]">
        The draft is checked against the evidence above before it is saved, and
        anything the evidence does not carry is flagged for a person to look at.
        Nothing here is approved, submitted, or published by the system.
      </p>
    </form>
  );
}

/** One radio row: the choice, what it costs in length or tone, and why. */
function OptionRow({
  value,
  selected,
  title,
  meta,
  description,
}: {
  value: string;
  selected: boolean;
  title: string;
  meta: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "rounded-card flex min-h-11 cursor-pointer items-start gap-3 border p-3 transition-colors duration-150 tablet:min-h-0",
        selected
          ? "border-surface-tint-border bg-surface-tint"
          : "border-line bg-paper hover:border-sage",
      )}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-ink text-[13.5px] font-medium">{title}</span>
        <span className="text-ink-2 text-[12.5px]">{meta}</span>
        <span className="text-ink-3 text-[12.5px]">{description}</span>
      </span>
    </label>
  );
}

/**
 * Every refusal an action can return, given a designed state (§17.6).
 *
 * All of them sit on the watch (slate) or immediate ramp. NEVER `destructive`,
 * never red, never a toast — a rate limit is normal free-tier operation and a
 * governance refusal is the product working, not failing (§11.4).
 */
function RefusalPanel({ refusal }: { refusal: ActionRefusal }) {
  if (refusal.kind === "refused-ineligible-classification") {
    return (
      <Alert variant="pending" className="rounded-card">
        <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
          <span
            aria-hidden="true"
            className="border-immediate size-3.5 shrink-0 rounded-[2px] border-2"
          />
          Generation refused — evidence is not eligible
        </AlertTitle>
        <AlertDescription className="text-immediate-ink/90 text-[13px]">
          <p>
            Nothing was sent to the model. The classification of{" "}
            {refusal.items.length === 1 ? "one selected item" : "some selected items"}{" "}
            changed since you picked it:
          </p>
          <ul className="mt-2 mb-3 flex list-disc flex-col gap-1 pl-5">
            {refusal.items.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span> —{" "}
                {classificationLabel(item.classification).toLowerCase()}
              </li>
            ))}
          </ul>
          <p>
            <Link href="/evidence/queue" className="font-medium">
              Open the classification queue
            </Link>{" "}
            or remove the item from the selection and generate again.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (refusal.kind === "rate-limited") {
    return (
      <Alert variant="guard" className="rounded-card">
        <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
          <GuardFlagIcon className="size-3.5" />
          Paused — the free-tier allowance is spent for the moment
        </AlertTitle>
        <AlertDescription className="text-watch-ink/90 text-[13px]">
          <p>
            Try again in about {formatRetry(refusal.retryAfterMs)}. Your policy
            text, your selections, and anything already drafted are kept — the
            run resumes from where it stopped.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const message =
    refusal.kind === "unauthorised"
      ? refusal.message
      : refusal.kind === "generation-failed"
        ? refusal.message
        : "Check the fields above and try again.";

  return (
    <Alert variant="guard" className="rounded-card">
      <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
        <GuardFlagIcon className="size-3.5" />
        {refusal.kind === "unauthorised"
          ? "Not permitted"
          : "The draft was not created"}
      </AlertTitle>
      <AlertDescription className="text-watch-ink/90 text-[13px]">
        <p>{message}</p>
      </AlertDescription>
    </Alert>
  );
}

function applyFieldErrors(
  refusal: Extract<ActionRefusal, { kind: "invalid" }>,
  form: ReturnType<typeof useForm<GenerateBriefInput>>,
) {
  for (const [field, messages] of Object.entries(refusal.fieldErrors)) {
    const message = messages[0];

    if (!message) continue;
    if (field === "form") continue;

    form.setError(field as keyof GenerateBriefInput, { message });
  }
}

function formatRetry(retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / 60_000);

  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
