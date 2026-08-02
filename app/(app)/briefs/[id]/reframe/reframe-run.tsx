"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { classificationLabel } from "@/components/classification-badge";
import { GuardFlagIcon } from "@/components/guard-flag-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ActionRefusal } from "@/lib/auth/authorize";
import type { BriefDiff } from "@/lib/briefs/diff";
import type { BriefAudience } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

import {
  GENERATION_STAGES,
  GenerationStepper,
} from "../../new/generation-stepper";
import {
  commitReframeAction,
  discardReframeAction,
  draftReframeAction,
  startBriefReframe,
  verifyReframeAction,
} from "./actions";
import { ReframeDiff } from "./reframe-diff";

/**
 * The client half of an audience switch.
 *
 * IT DOES NOT START ON ARRIVAL. Landing here shows what a reframe would cost and
 * asks; it does not spend two free-tier Gemini requests because someone selected
 * a tab or followed a link (decision 9). One press starts it, and a second,
 * separate press decides what happens to the result.
 *
 * THE SAME THREE STAGES, THE SAME STEPPER — imported from the generation form
 * rather than reimplemented, so the labels cannot drift and every stage still
 * corresponds to a request that genuinely ran (§16.7). No indeterminate spinner
 * anywhere.
 *
 * A 429 halts the run, names the retry timing, and the next press RESUMES from
 * the stage that was interrupted: the attempt row still holds whatever was
 * produced, so nothing already paid for is regenerated (§13.4).
 *
 * NOTHING HERE DECIDES ANYTHING. Every refusal below is a value returned by an
 * action that authorised, re-read the brief's status, and put the evidence
 * through the classification gate server-side first (§10.1, §7.2).
 */

type Run =
  | { phase: "confirm" }
  | { phase: "running"; stage: number; generationId: string | null }
  | {
      phase: "halted";
      stage: number;
      generationId: string | null;
      refusal: ActionRefusal;
    }
  | { phase: "ready"; generationId: string; diff: BriefDiff; flagCount: number }
  | {
      phase: "deciding";
      generationId: string;
      diff: BriefDiff;
      flagCount: number;
      action: "commit" | "discard";
    };

export function ReframeRunner({
  briefId,
  audience,
  fromAudienceLabel,
  toAudienceLabel,
  toFramingEmphasis,
  toTone,
  currentVersion,
  evidenceCount,
}: {
  briefId: string;
  /** Validated against the enum by the route before this ever renders. */
  audience: BriefAudience;
  fromAudienceLabel: string;
  toAudienceLabel: string;
  toFramingEmphasis: string;
  toTone: string;
  currentVersion: number;
  evidenceCount: number;
}) {
  const router = useRouter();
  const [run, setRun] = useState<Run>({ phase: "confirm" });

  const busy = run.phase === "running" || run.phase === "deciding";

  const start = async () => {
    const resume =
      run.phase === "halted" && run.refusal.kind === "rate-limited"
        ? { generationId: run.generationId, stage: run.stage }
        : { generationId: null, stage: 0 };

    let generationId = resume.generationId;

    // Stage 1 — Reading evidence.
    if (generationId === null) {
      setRun({ phase: "running", stage: 0, generationId: null });

      // The action re-validates both fields with the shared schema regardless of
      // what this sends — client validation is a courtesy, never a guarantee.
      const started = await startBriefReframe({ briefId, audience });

      if (!started.ok) {
        setRun({ phase: "halted", stage: 0, generationId: null, refusal: started.refusal });
        return;
      }

      generationId = started.generationId;
    }

    // Stage 2 — Drafting. Skipped when resuming a run that got past it.
    if (resume.stage <= 1) {
      setRun({ phase: "running", stage: 1, generationId });

      const drafted = await draftReframeAction(generationId);

      if (!drafted.ok) {
        setRun({ phase: "halted", stage: 1, generationId, refusal: drafted.refusal });
        return;
      }
    }

    // Stage 3 — Verifying citations. Still nothing written.
    setRun({ phase: "running", stage: 2, generationId });

    const verified = await verifyReframeAction(generationId);

    if (!verified.ok) {
      setRun({ phase: "halted", stage: 2, generationId, refusal: verified.refusal });
      return;
    }

    setRun({
      phase: "ready",
      generationId,
      diff: verified.diff,
      flagCount: verified.flagCount,
    });
  };

  const decide = async (action: "commit" | "discard") => {
    if (run.phase !== "ready") return;

    const { generationId, diff, flagCount } = run;

    setRun({ phase: "deciding", generationId, diff, flagCount, action });

    const result =
      action === "commit"
        ? await commitReframeAction(generationId)
        : await discardReframeAction(generationId);

    if (!result.ok) {
      setRun({
        phase: "halted",
        stage: GENERATION_STAGES.length,
        generationId,
        refusal: result.refusal,
      });
      return;
    }

    router.push(`/briefs/${briefId}`);
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
      {run.phase === "confirm" || run.phase === "running" || run.phase === "halted" ? (
        <section className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border p-4 tablet:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-ink text-h3 font-semibold">
              Reframe for {toAudienceLabel}
            </h2>
            <p className="text-ink-2 max-w-[70ch] text-[13px] leading-[1.6]">
              This brief is written for {fromAudienceLabel}. Reframing keeps the
              same {evidenceCount === 1 ? "evidence item" : `${evidenceCount} evidence items`}{" "}
              and the same policy document, and rewrites the framing and tone for
              a different reader. You will see what would change before anything
              is saved.
            </p>
          </div>

          <dl className="border-line grid grid-cols-1 gap-3 border-t pt-3 tablet:grid-cols-2">
            <Detail label="Framing emphasis" value={toFramingEmphasis} />
            <Detail label="Tone" value={toTone} />
          </dl>

          <p className="text-ink-3 max-w-[70ch] text-[12.5px] leading-[1.6]">
            The reframed draft is checked against the same evidence before you
            see it, and anything the evidence does not carry is flagged for a
            person to look at. Because it is new text, it gets a new check — the
            claims someone already cleared on version{" "}
            <span className="font-mono">{currentVersion}</span> stay cleared on
            that version and are not carried across.
          </p>
        </section>
      ) : null}

      {run.phase === "halted" ? <RefusalPanel refusal={run.refusal} /> : null}

      {run.phase === "running" || run.phase === "halted" ? (
        <GenerationStepper
          activeIndex={run.stage}
          halted={run.phase === "halted"}
        />
      ) : null}

      {run.phase === "ready" || run.phase === "deciding" ? (
        <>
          <ReframeDiff diff={run.diff} toAudienceLabel={toAudienceLabel} />
          {run.flagCount > 0 ? <FlagNotice count={run.flagCount} /> : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {run.phase === "ready" || run.phase === "deciding" ? (
          <>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void decide("commit")}
              className="h-11 tablet:h-8"
            >
              {run.phase === "deciding" && run.action === "commit"
                ? "Saving…"
                : "Use this version"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void decide("discard")}
              className="h-11 tablet:h-8"
            >
              {run.phase === "deciding" && run.action === "discard"
                ? "Discarding…"
                : "Discard and keep the current version"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            className="h-11 tablet:h-8"
          >
            {run.phase === "running"
              ? "Reframing…"
              : run.phase === "halted" &&
                  run.refusal.kind === "rate-limited" &&
                  run.generationId !== null
                ? "Resume reframe"
                : `Reframe for ${toAudienceLabel}`}
          </Button>
        )}

        <Link
          href={`/briefs/${briefId}`}
          aria-disabled={busy || undefined}
          tabIndex={busy ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            busy && "pointer-events-none opacity-50",
          )}
        >
          Back to the brief
        </Link>
      </div>

      <p className="text-ink-3 max-w-[70ch] text-[12.5px]">
        Nothing here is approved, submitted, or published by the system. A
        reframe changes who the brief is written for; it does not move the
        brief&rsquo;s status.
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
        {label}
      </dt>
      <dd className="text-ink-2 text-[12.5px] leading-[1.55]">{value}</dd>
    </div>
  );
}

/**
 * The guard's own register: a flag means a claim needs a person's eyes, never
 * that it is false. Slate, a circle, no red, no toast (§9.7).
 */
function FlagNotice({ count }: { count: number }) {
  return (
    <Alert variant="guard" className="rounded-card">
      <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
        <GuardFlagIcon className="size-3.5" />
        {count === 1
          ? "One claim in the reframed draft needs checking"
          : `${count} claims in the reframed draft need checking`}
      </AlertTitle>
      <AlertDescription className="text-watch-ink/90 text-[13px]">
        <p>
          {count === 1 ? "It is" : "They are"} not traceable to the evidence
          supplied. If you use this version, {count === 1 ? "it" : "they"} will
          be recorded against it and approval stays blocked until a Research
          Officer or the Programme Director has looked.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Every refusal these actions can return, given a designed state (§17.6).
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
          Reframe refused — evidence is not eligible
        </AlertTitle>
        <AlertDescription className="text-immediate-ink/90 text-[13px]">
          <p>
            Nothing was sent to the model and the brief is unchanged. This brief
            was drafted before{" "}
            {refusal.items.length === 1 ? "this item" : "these items"} changed
            classification, and a brief already existing is not permission to
            send the evidence again:
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
            </Link>
            .
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
            Try again in about {formatRetry(refusal.retryAfterMs)}. The brief is
            untouched, and anything already drafted is kept — the run resumes
            from where it stopped.
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
        : refusal.kind === "version-conflict"
          ? `Someone saved version ${refusal.currentVersion} of this brief while you were reading the diff. Nothing was changed — reload the brief and reframe again if you still want to.`
          : refusal.kind === "invalid"
            ? (Object.values(refusal.fieldErrors)[0]?.[0] ??
              "That reframe request could not be read.")
            : "The brief is unchanged.";

  return (
    <Alert variant="guard" className="rounded-card">
      <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
        <GuardFlagIcon className="size-3.5" />
        {refusal.kind === "unauthorised"
          ? "Not permitted"
          : "The brief was not changed"}
      </AlertTitle>
      <AlertDescription className="text-watch-ink/90 text-[13px]">
        <p>{message}</p>
      </AlertDescription>
    </Alert>
  );
}

function formatRetry(retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / 60_000);

  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
