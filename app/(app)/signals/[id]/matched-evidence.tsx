"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EVIDENCE_SEARCH_PARAMS } from "@/app/(app)/evidence/search-schema";
import type {
  SignalEvidenceMatchView,
  SignalMatchRunView,
} from "@/lib/db";
import type { ImpactArea } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

import {
  describeMatchFailure,
  formatScore,
  formatSignalDateTime,
  IMPACT_AREA_LABELS,
} from "../labels";
import { requestEvidenceRematchAction } from "./actions";

/**
 * What the Evidence Matcher found for this signal — and, when it found nothing,
 * what to do about it.
 *
 * FOUR STATES, ALL READ FROM THE RUN ROW, NONE INFERRED FROM AN EMPTY JOIN:
 * `matched` renders the set, `gap` renders the empty state and its next steps,
 * `failed` says what failed and offers the re-match, and NO RUN AT ALL says the
 * matcher has not run — which is a different fact from a gap and is exactly what
 * the run row exists to distinguish (`evidence-matcher` rule 4).
 *
 * SCORES RENDER AS NUMBER AND BAR, never colour alone (§11.13). Similarity and
 * the rerank score are two different scales measuring two different things and
 * are labelled as such rather than averaged into one reassuring figure.
 *
 * THE EXCERPT IS THE ONLY SERIF ON THIS SCREEN. It is verbatim source material;
 * the signal's own summary above it was written by the classification call and
 * stays in the sans. That contrast is the mechanism, not decoration (§11.6).
 *
 * NOTHING HERE GENERATES A BRIEF. Detection triggers the Matcher and stops
 * there, and generation is a person's decision on a different screen (§8.4).
 */
export function MatchedEvidence({
  signalId,
  impactArea,
  matches,
  ineligibleMatchCount,
  runs,
  canRematch,
}: {
  signalId: string;
  impactArea: ImpactArea;
  matches: SignalEvidenceMatchView[];
  ineligibleMatchCount: number;
  /** Newest first. Empty means the matcher has never run for this signal. */
  runs: SignalMatchRunView[];
  /** Presentation only — the action authorises its own caller (§10.1). */
  canRematch: boolean;
}) {
  const latest = runs[0] ?? null;

  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-4 border p-4 tablet:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-ink text-[15px] font-semibold">Matched evidence</h2>
        {latest ? (
          <p className="text-ink-3 text-[11.5px]">
            Last searched {formatSignalDateTime(latest.startedAt)}
          </p>
        ) : null}
      </div>

      <IneligibleNotice count={ineligibleMatchCount} />

      {/* Composed rather than chained, because two of these are true at once
          more often than a chain admits: a failed run leaves the previous match
          set standing, and it must still be readable underneath the notice. */}
      {latest === null ? <NotMatchedYet /> : null}
      {latest?.outcome === "failed" ? <MatchFailed run={latest} /> : null}
      {matches.length > 0 ? <MatchList matches={matches} /> : null}
      {latest !== null && latest.outcome !== "failed" && matches.length === 0 ? (
        ineligibleMatchCount > 0 ? (
          <AllHeldBack />
        ) : (
          <MatchGap impactArea={impactArea} />
        )
      ) : null}

      <div className="border-line flex flex-col gap-2 border-t pt-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <p className="text-ink-3 max-w-[52ch] text-[12.5px]">
          Retrieval reaches only evidence tagged public and published. What it
          returns is a starting set for a person to check, not a conclusion.
        </p>
        {canRematch ? <RematchControl signalId={signalId} /> : null}
      </div>
    </section>
  );
}

/**
 * A governance surface, and never what gets hidden at a smaller width
 * (`design-system`, responsive rules). A stored match whose item has since been
 * downgraded is held back from the list — counted here rather than vanishing,
 * so the backlog cannot be quietly forgotten (§7.5).
 */
function IneligibleNotice({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="bg-immediate-surface border-immediate-border text-immediate-ink rounded-card flex items-start gap-2.5 border p-3">
      {/* A square: the governance-hold glyph, distinct from the circle a review
          flag uses, so the two are told apart with colour ignored (§11.7). */}
      <span
        aria-hidden="true"
        className="border-immediate mt-0.5 size-3 shrink-0 border-2"
      />
      <p className="text-[12.5px]">
        <span className="font-mono font-medium tabular-nums">{count}</span>{" "}
        matched {count === 1 ? "item is" : "items are"} awaiting
        re-classification and {count === 1 ? "is" : "are"} not shown. Evidence
        reaches this panel only while it is tagged public and published.
      </p>
    </div>
  );
}

function MatchList({ matches }: { matches: SignalEvidenceMatchView[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {matches.map((match) => (
        <li
          key={match.evidenceItemId}
          className="border-line rounded-card flex flex-col gap-2 border p-3.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 className="text-ink text-[13.5px] leading-snug font-semibold">
                {match.title}
              </h3>
              <p className="text-ink-3 font-mono text-[11px]">
                {match.citationKey}
                {match.year === null ? "" : ` · ${match.year}`}
                {match.country === null ? "" : ` · ${match.country}`}
              </p>
            </div>
            <span className="text-ink-3 shrink-0 font-mono text-[11px]">
              #{match.rank}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 tablet:flex-row tablet:gap-6">
            <ScoreBar label="Similarity" value={match.similarity} />
            <ScoreBar label="Relevance" value={match.rerankScore} />
          </div>

          {match.excerpt ? (
            <blockquote className="border-accent text-ink border-l-2 pl-3 font-serif text-[13px] leading-[1.5]">
              {match.excerpt}
            </blockquote>
          ) : (
            <p className="text-ink-3 text-[12.5px]">
              The matched passage is no longer stored. The item itself is still
              in the library.
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Number AND bar (§11.13). A null relevance is stated as "not scored" rather
 * than drawn as a zero — the model omitted the candidate, it did not rate it
 * badly, and those are not the same claim.
 */
function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const percent = value === null ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-3 w-[64px] shrink-0 text-[11px]">{label}</span>
      <span
        className={cn(
          "font-mono text-[11.5px] tabular-nums",
          value === null ? "text-ink-3" : "text-ink-2",
        )}
      >
        {value === null ? "not scored" : formatScore(value)}
      </span>
      <span
        aria-hidden="true"
        className="bg-stone h-[3px] w-20 shrink-0 overflow-hidden"
      >
        <span
          className="bg-primary block h-full"
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  );
}

/**
 * The gap — with two next steps that both do something (`evidence-matcher`
 * rule 4). Widening the search is the re-match below; checking what the library
 * actually holds in this impact area is a real link to a real filtered listing,
 * not a button labelled "record a research gap" with no table behind it.
 */
function MatchGap({ impactArea }: { impactArea: ImpactArea }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <span
        aria-hidden="true"
        className="mx-4 mt-3 mb-4 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h3 className="text-ink text-[14px] font-semibold">
        Nothing in the eligible library was close enough
      </h3>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        The search ran and returned no evidence above the confidence threshold.
        That is a finding about the corpus, not a fault — and it is worth
        recording as a research gap in {IMPACT_AREA_LABELS[impactArea]}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/evidence?${EVIDENCE_SEARCH_PARAMS.impactArea}=${impactArea}`}
          className={buttonVariants({ variant: "outline" })}
        >
          See what the library holds on {IMPACT_AREA_LABELS[impactArea]}
        </Link>
        <Link
          href="/evidence/new"
          className={buttonVariants({ variant: "outline" })}
        >
          Add evidence
        </Link>
      </div>
    </div>
  );
}

/**
 * The run did not complete. The stored reason is a short machine token, said
 * here in words — never an API error message, which can echo request material
 * back (§7.6).
 */
function MatchFailed({ run }: { run: SignalMatchRunView }) {
  return (
    <div className="bg-watch-surface border-watch-border text-watch-ink rounded-card flex items-start gap-2.5 border p-3.5">
      <span
        aria-hidden="true"
        className="border-watch mt-0.5 size-3.5 shrink-0 rounded-full border-2"
      />
      <div className="flex flex-col gap-1">
        <h3 className="text-[13px] font-semibold">The match did not complete</h3>
        <p className="max-w-[62ch] text-[12.5px]">
          {describeMatchFailure(run.failureReason)} An earlier match set, if
          there was one, is left untouched and still shows below.
        </p>
      </div>
    </div>
  );
}

/**
 * The matcher found evidence and every item of it has since been downgraded.
 *
 * NOT RENDERED AS A GAP, deliberately. The corpus does hold something relevant;
 * it is held at the classification queue, and telling an officer "nothing was
 * close enough" would send them looking for evidence that already exists (§7.5).
 */
function AllHeldBack() {
  return (
    <div className="flex flex-col items-start gap-2">
      <h3 className="text-ink text-[14px] font-semibold">
        Every matched item is awaiting re-classification
      </h3>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        The search found evidence, but none of it is currently tagged public and
        published. A Research Officer can review the classification queue.
      </p>
      <Link
        href="/evidence/queue"
        className={buttonVariants({ variant: "outline" })}
      >
        Open the classification queue
      </Link>
    </div>
  );
}

/** The fourth state. Not a gap, not a failure — the matcher has not run. */
function NotMatchedYet() {
  return (
    <div className="flex flex-col items-start gap-2">
      <h3 className="text-ink text-[14px] font-semibold">Not matched yet</h3>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        The Evidence Matcher has not run for this signal. Detection normally
        starts it; a signal detected before the Matcher existed will not have one
        until someone asks for it.
      </p>
    </div>
  );
}

/**
 * Queues a run and says so — nothing more.
 *
 * NO SPINNER AND NO PRETEND RESULT. The job runs in the background and the page
 * is a Server Component read, so the honest confirmation is "queued, reload in a
 * moment", not a progress bar for work this component cannot see.
 *
 * No optimistic update either: this action can be refused on authorisation
 * grounds, and `server-actions` reserves optimism for operations already known
 * to be permitted.
 */
function RematchControl({ signalId }: { signalId: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "queued" } | { kind: "refused"; message: string }
  >({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const run = () => {
    setState({ kind: "idle" });

    startTransition(async () => {
      const result = await requestEvidenceRematchAction({ signalId });

      if (result.ok) {
        setState({ kind: "queued" });
        return;
      }

      setState({
        kind: "refused",
        message:
          result.refusal.kind === "unauthorised"
            ? result.refusal.message
            : result.refusal.kind === "invalid"
              ? (result.refusal.fieldErrors.form?.[0] ??
                "The re-match could not be queued.")
              : "The re-match could not be queued.",
      });
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5 tablet:items-end">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={run}
        className="h-11 justify-center tablet:h-8"
      >
        Re-match evidence
      </Button>
      <p aria-live="polite" className="empty:hidden">
        {state.kind === "queued" ? (
          <span className="text-ink-3 max-w-[34ch] text-[12px] tablet:text-right">
            Queued. It runs in the background —{" "}
            <button
              type="button"
              onClick={() => router.refresh()}
              className="text-primary-ink underline underline-offset-2"
            >
              reload
            </button>{" "}
            in a moment to see the new set.
          </span>
        ) : state.kind === "refused" ? (
          <span className="text-watch-ink max-w-[34ch] text-[12px] tablet:text-right">
            {state.message}
          </span>
        ) : null}
      </p>
    </div>
  );
}
