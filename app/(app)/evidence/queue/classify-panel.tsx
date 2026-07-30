"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import { ClassificationBadge } from "@/components/classification-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { EvidenceListItem } from "@/lib/db/evidence";
import { Classification } from "@/lib/generated/prisma/enums";

import { classifyEvidenceAction } from "../actions";
import { EvidenceExcerpt } from "../evidence-table";
import {
  EVIDENCE_SOURCE_TYPE_LABELS,
  IMPACT_AREA_LABELS,
  formatIngestedAt,
} from "../labels";

/**
 * The triage surface.
 *
 * Motion, per the handoff's table: the queue count crossfades 180ms, a tagged
 * row collapses over 200ms. Both are instant under `prefers-reduced-motion` —
 * the global CSS rule kills the transition, and the JS timing is zeroed here so
 * the row does not linger after its animation has been disabled.
 */

/**
 * The row collapse, per the handoff's motion table. The count's 180ms crossfade
 * is CSS (`--animate-count-fade`) and needs no constant here.
 */
const ROW_COLLAPSE_MS = 200;

/** The three values, ordered so the eligible one is not the default reach. */
const CLASSIFICATION_CHOICES = [
  {
    value: Classification.public_published,
    label: "Public — published",
    hint: "Already in the public domain. Becomes searchable and eligible for the AI pipeline.",
  },
  {
    value: Classification.community_sourced,
    label: "Community-sourced",
    hint: "Collected from farmers or CREMA communities. Stays on Tropenbos infrastructure.",
  },
  {
    value: Classification.unpublished_internal,
    label: "Unpublished — internal",
    hint: "Internal research not yet published. Held from the AI pipeline.",
  },
] as const;

/**
 * The CSS rule in `globals.css` disables transitions under reduced motion, but
 * it cannot shorten a JS timer — a row would sit there for 200ms after its
 * animation had been switched off. This reads the preference so the timing goes
 * to zero as well (AGENTS.md §11.10).
 *
 * `useSyncExternalStore` rather than an effect: the media query is an external
 * store, and subscribing to one is exactly what it is for.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

export function ClassifyQueue({ items }: { items: EvidenceListItem[] }) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();

  const [remaining, setRemaining] = useState(items);
  const [collapsingId, setCollapsingId] = useState<string | null>(null);

  const handleTagged = (evidenceItemId: string) => {
    setCollapsingId(evidenceItemId);

    window.setTimeout(
      () => {
        setRemaining((current) =>
          current.filter((item) => item.id !== evidenceItemId),
        );
        setCollapsingId(null);
        // Re-read from the server so the /evidence listing and this count come
        // from the database rather than from optimistic local state.
        router.refresh();
      },
      reducedMotion ? 0 : ROW_COLLAPSE_MS,
    );
  };

  if (remaining.length === 0) {
    return (
      <div className="bg-card border-line rounded-card flex flex-col items-start gap-2 border p-6">
        <h2 className="text-ink text-[15px] font-semibold">
          The queue is clear
        </h2>
        <p className="text-ink-3 max-w-[62ch] text-[13px]">
          Every ingested item has been tagged. New uploads arrive here before
          they are searchable or eligible for the AI pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <QueueCount count={remaining.length} />

      <ul className="flex list-none flex-col gap-4 p-0">
        {remaining.map((item) => (
          <li
            key={item.id}
            className="grid transition-[grid-template-rows,opacity] ease-[var(--ease-standard)]"
            style={{
              gridTemplateRows: collapsingId === item.id ? "0fr" : "1fr",
              opacity: collapsingId === item.id ? 0 : 1,
              transitionDuration: `${reducedMotion ? 0 : ROW_COLLAPSE_MS}ms`,
            }}
          >
            <div className="min-h-0 overflow-hidden">
              <QueueRow item={item} onTagged={handleTagged} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Crossfades on change and never animates idly.
 *
 * `key={count}` remounts the number so the CSS animation replays on each
 * decrement — no state, no effect, and the reduced-motion rule in `globals.css`
 * switches it off without any JS branch here.
 */
function QueueCount({ count }: { count: number }) {
  return (
    <p aria-live="polite" className="text-ink-3 text-[13px]">
      <span
        key={count}
        className="text-ink animate-count-fade inline-block font-mono font-medium"
      >
        {count}
      </span>{" "}
      {count === 1 ? "item is" : "items are"} waiting, oldest first.
    </p>
  );
}

function QueueRow({
  item,
  onTagged,
}: {
  item: EvidenceListItem;
  onTagged: (evidenceItemId: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<Classification | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const classify = (classification: Classification) => {
    setError(null);
    setPendingChoice(classification);

    startTransition(async () => {
      const result = await classifyEvidenceAction({
        evidenceItemId: item.id,
        classification,
        reason: reason.trim() || undefined,
      });

      if (result.ok) {
        onTagged(item.id);
        return;
      }

      setPendingChoice(null);
      setError(
        result.refusal.kind === "unauthorised"
          ? result.refusal.message
          : (Object.values(result.refusal.fieldErrors)[0]?.[0] ??
            "That classification could not be recorded."),
      );
    });
  };

  return (
    <article className="bg-card border-line rounded-card flex flex-col gap-4 border p-4 tablet:p-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-ink min-w-0 text-[15px] leading-snug font-semibold">
            {item.title}
          </h2>
          <ClassificationBadge classification={item.classification} />
        </div>
        <p className="text-ink-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          <span className="font-mono text-[11.5px]">{item.citationKey}</span>
          <span>{EVIDENCE_SOURCE_TYPE_LABELS[item.sourceType]}</span>
          {item.year ? <span>{item.year}</span> : null}
          {item.country ? <span>{item.country}</span> : null}
          {item.impactArea ? (
            <span>{IMPACT_AREA_LABELS[item.impactArea]}</span>
          ) : null}
          <span>Ingested {formatIngestedAt(item.ingestedAt)}</span>
          <span className="font-mono text-[11.5px]">
            {item.chunkCount} chunks
          </span>
        </p>
      </header>

      <EvidenceExcerpt excerpt={item.excerpt} />

      <Field>
        <FieldLabel htmlFor={`reason-${item.id}`} className="text-[13px]">
          Note (optional)
        </FieldLabel>
        <Input
          id={`reason-${item.id}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why this classification — recorded with your name and the time."
          maxLength={500}
          className="text-[13px]"
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>

      <div
        role="group"
        aria-label={`Set a classification for ${item.title}`}
        className="flex flex-col gap-2 tablet:flex-row tablet:flex-wrap"
      >
        {CLASSIFICATION_CHOICES.map((choice) => {
          const isCurrent = choice.value === item.classification;

          return (
            <Button
              key={choice.value}
              type="button"
              variant={
                choice.value === Classification.public_published
                  ? "default"
                  : "outline"
              }
              disabled={isPending || isCurrent}
              aria-label={`${choice.label} — ${choice.hint}`}
              onClick={() => classify(choice.value)}
              className="h-11 justify-center tablet:h-8"
            >
              {pendingChoice === choice.value ? "Recording…" : choice.label}
            </Button>
          );
        })}
      </div>

      <dl className="text-ink-3 grid gap-1 text-[12px]">
        {CLASSIFICATION_CHOICES.map((choice) => (
          <div key={choice.value} className="flex flex-wrap gap-x-1.5">
            <dt className="text-ink-2 font-medium">{choice.label} —</dt>
            <dd className="min-w-0">{choice.hint}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
