"use client";

import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { BriefQaReviewView } from "@/lib/db";

import { saveBriefQaReviewAction } from "./actions";
import { BRIEF_QA_NOTES_MAX_CHARS } from "./schema";

const dimensions = [
  ["factualGroundingChecked", "Factual grounding & source alignment", "Claims and statistics trace to the cited evidence supplied with this brief."],
  ["landscapeSpecificityChecked", "Landscape & local specificity", "Names the relevant landscape, such as Juabeso-Bia, Sefwi-Wiawso, or Western North Region, where the evidence supports it."],
  ["audienceFramingChecked", "Audience framing & register", "The register and structure suit the intended reader without losing the evidence-first tone."],
  ["actionableAsksChecked", "Concrete, actionable recommendations", "Two to four realistic asks identify a decision-maker and an implementation path."],
  ["crossCuttingThemesChecked", "Cross-cutting policy themes", "Gender, youth, local financial capacity, and livelihood implications have been considered."],
] as const;

type ChecklistState = Record<(typeof dimensions)[number][0], boolean>;

function initialState(review: BriefQaReviewView | null): ChecklistState {
  return {
    factualGroundingChecked: review?.factualGroundingChecked ?? false,
    landscapeSpecificityChecked: review?.landscapeSpecificityChecked ?? false,
    audienceFramingChecked: review?.audienceFramingChecked ?? false,
    actionableAsksChecked: review?.actionableAsksChecked ?? false,
    crossCuttingThemesChecked: review?.crossCuttingThemesChecked ?? false,
  };
}

export function BriefQaPanel({
  briefId,
  canReview,
  unavailableReason,
  review,
}: {
  briefId: string;
  canReview: boolean;
  unavailableReason: string;
  review: BriefQaReviewView | null;
}) {
  const notesId = useId();
  const [checks, setChecks] = useState(() => initialState(review));
  const [notes, setNotes] = useState(review?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedReview, setSavedReview] = useState(review);
  const [isPending, startTransition] = useTransition();
  const complete = Object.values(checks).every(Boolean);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveBriefQaReviewAction({ briefId, ...checks, notes });
      if (result.ok) {
        setSavedReview(result.review);
        return;
      }
      setError(
        result.refusal.kind === "unauthorised"
          ? result.refusal.message
          : result.refusal.kind === "invalid"
            ? (result.refusal.fieldErrors.notes?.[0] ?? result.refusal.fieldErrors.form?.[0] ?? "The QA review could not be saved.")
            : "The QA review could not be saved.",
      );
    });
  };

  return (
    <section aria-labelledby="qa-review-heading" className="bg-card border-line rounded-card flex flex-col gap-4 border p-4">
      <div className="flex flex-col gap-1">
        <h2 id="qa-review-heading" className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">Brief QA review</h2>
        <p className="text-ink-3 text-[13px] leading-relaxed">A structured human check before the Director makes a decision. It does not replace citation flags.</p>
      </div>

      {savedReview?.completedAt ? (
        <p className="bg-surface-tint border-surface-tint-border text-primary-ink rounded-card border px-3 py-2 text-[12.5px]">
          Completed by {savedReview.reviewerName} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(savedReview.completedAt))}
        </p>
      ) : (
        <p className="bg-stone border-line text-ink-2 rounded-card border px-3 py-2 text-[12.5px]">Checklist pending — each dimension needs a human reviewer’s attention.</p>
      )}

      <FieldGroup className="gap-3">
        {dimensions.map(([key, label, description]) => {
          const id = `brief-qa-${key}`;
          return (
            <Field key={key} className="bg-paper border-line rounded-card flex-row items-start gap-3 border p-3">
              <Checkbox id={id} checked={checks[key]} disabled={!canReview || isPending} onCheckedChange={(checked) => setChecks((current) => ({ ...current, [key]: checked === true }))} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <FieldLabel htmlFor={id} className="cursor-pointer text-[13px] font-semibold text-ink">{label}</FieldLabel>
                <FieldDescription className="text-[12.5px] leading-relaxed">{description}</FieldDescription>
              </div>
            </Field>
          );
        })}
        <Field>
          <FieldLabel htmlFor={notesId} className="text-[12.5px]">Reviewer notes <span className="text-ink-3 font-normal">(optional)</span></FieldLabel>
          <Textarea id={notesId} value={notes} disabled={!canReview || isPending} maxLength={BRIEF_QA_NOTES_MAX_CHARS} rows={3} onChange={(event) => setNotes(event.target.value)} placeholder="Observations for the author or Director." className="bg-card text-[13px]" />
          <FieldDescription>{notes.length}/{BRIEF_QA_NOTES_MAX_CHARS} characters</FieldDescription>
        </Field>
      </FieldGroup>

      {error ? <p role="status" className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3 py-2 text-[12.5px]">{error}</p> : null}

      {canReview ? (
        <Button type="button" disabled={isPending} onClick={save} className="min-h-[44px] cursor-pointer tablet:min-h-0 tablet:h-8">
          {isPending ? "Saving…" : complete ? "Save completed QA review" : "Save QA progress"}
        </Button>
      ) : (
        <p className="text-ink-3 text-[12.5px] leading-relaxed">{unavailableReason}</p>
      )}
    </section>
  );
}
