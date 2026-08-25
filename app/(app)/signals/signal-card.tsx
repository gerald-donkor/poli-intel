"use client";

import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { GripVertical } from "lucide-react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import type { SignalBoardCard } from "@/lib/db";

import {
  AUDIENCE_TARGET_LABELS,
  formatSignalDate,
  GEOGRAPHY_LABELS,
  IMPACT_AREA_LABELS,
  RELEVANCE_BADGE,
  RELEVANCE_LABELS,
  URGENCY_LABELS,
  URGENCY_RAMP,
} from "./labels";

/**
 * One signal on the board.
 *
 * URGENCY IS THE 3px LEFT RULE AND THE SMALL-CAPS EYEBROW, AND NOTHING ELSE
 * (design-system.md line 137, §11.5). The card body stays on `card` at every
 * stage so a column of them is still readable; a filled urgency background is
 * the specific thing this rule forbids.
 *
 * RELEVANCE IS A SEPARATE SCALE ON A SEPARATE PALETTE. It never borrows the
 * urgency ramp, and it is announced with its own label rather than left as a
 * colour a screen reader cannot see (§11.13).
 *
 * THE SUMMARY IS SANS, NEVER THE SERIF. It was written by the classification
 * call — generated prose, not quoted material — and the serif is the mechanism
 * by which a reader tells the two apart (§11.6). The only serif on the signal
 * surface is the matched passage on the detail page.
 *
 * THE TITLE IS THE LINK AND THE HANDLE IS A BUTTON. Wrapping the whole card in
 * drag listeners would swallow the click that opens it and leave keyboard users
 * with a card they can pick up but not read.
 */
export function SignalCard({
  signal,
  dragHandle,
  dragging = false,
  lifted = false,
}: {
  signal: SignalBoardCard;
  /**
   * The drag handle, rendered by the sortable wrapper that owns dnd-kit's refs
   * and listeners. Absent when the caller may not reclassify — presentation,
   * never the control (§10.1).
   *
   * PASSED IN RATHER THAN BUILT HERE so dnd-kit's activator ref is attached in
   * the component that called `useSortable`, instead of travelling through props
   * as a ref this component would be reading during its own render.
   */
  dragHandle?: ReactNode;
  /** The original, while its copy is being dragged. */
  dragging?: boolean;
  /** The copy in the drag overlay. */
  lifted?: boolean;
}) {
  const ramp = URGENCY_RAMP[signal.urgency];

  return (
    <article
      className={cn(
        "bg-card rounded-card shadow-raised group flex flex-col gap-2.5 border border-l-[3px] p-4 transition-all duration-200",
        ramp.card,
        dragging && "opacity-40",
        lifted && "shadow-[0_8px_24px_rgb(44_44_42_/_0.14)] cursor-grabbing",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-[10.5px] font-semibold tracking-[0.06em] uppercase",
            ramp.eyebrow,
          )}
        >
          {URGENCY_LABELS[signal.urgency]}
          <span className="sr-only"> urgency</span>
        </p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
            RELEVANCE_BADGE[signal.relevance],
          )}
        >
          {RELEVANCE_LABELS[signal.relevance]}
          <span className="sr-only"> relevance</span>
        </span>
      </div>

      <h3 className="text-[14px] leading-snug font-semibold">
        {/* In the overlay this is a copy of a card that is mid-drag; a link there
            is a control nobody can click and a second tab stop for the same
            signal, so the lifted copy renders as plain text. */}
        {lifted ? (
          <span className="text-ink">{signal.title}</span>
        ) : (
          <Link
            href={`/signals/${signal.id}`}
            className="text-ink group-hover:text-primary focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {signal.title}
          </Link>
        )}
      </h3>

      <p className="text-ink-3 line-clamp-2 text-[12.5px] leading-[1.45] font-sans">
        {signal.summaryText}
      </p>

      {/* Geography / Landscape + Impact Area Tags */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="bg-stone border-line text-ink-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium">
          {GEOGRAPHY_LABELS[signal.geography]}
        </span>
        <span className="bg-stone/60 border-line/70 text-ink-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px]">
          {IMPACT_AREA_LABELS[signal.impactArea]}
        </span>
      </div>

      {/* Source + Date + Audience Metadata */}
      <div className="text-ink-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
        <span className="text-ink-2 font-medium">{signal.sourceName}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono">{formatSignalDate(signal.detectedAt)}</span>
        {signal.audienceTarget ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{AUDIENCE_TARGET_LABELS[signal.audienceTarget]}</span>
          </>
        ) : null}
      </div>

      <div className="border-line/70 flex items-center justify-between gap-2 border-t pt-2 mt-0.5">
        <MatchSummary signal={signal} />
        {dragHandle}
      </div>
    </article>
  );
}

/**
 * What the Evidence Matcher has to say about this signal, in the meta row.
 *
 * FOUR STATES, NOT TWO. A gap and a run that never happened are different facts
 * and the run row is what tells them apart (`evidence-matcher` rule 4); the
 * board says which rather than showing "0 matches" for both.
 */
function MatchSummary({ signal }: { signal: SignalBoardCard }) {
  if (signal.latestMatchOutcome === null) {
    return <span className="text-ink-3 text-[11.5px]">Not matched yet</span>;
  }

  if (signal.matchCount > 0) {
    return (
      <span className="text-ink-2 text-[11.5px]">
        <span className="font-mono font-medium tabular-nums">
          {signal.matchCount}
        </span>{" "}
        matched {signal.matchCount === 1 ? "item" : "items"}
      </span>
    );
  }

  return (
    <span className="text-watch-ink text-[11.5px]">
      {signal.latestMatchOutcome === "failed"
        ? "The match did not complete"
        : "No evidence above the threshold"}
    </span>
  );
}

/**
 * The handle a card is dragged by.
 *
 * A BUTTON, NOT THE WHOLE CARD. Drag listeners on the card body would swallow
 * the click that opens the signal and leave keyboard users with something they
 * can pick up but not read. 44px of tap target on a phone, 32px from `tablet`
 * where a pointer is doing the work (§11.13).
 */
export function SignalDragHandle({
  title,
  attributes,
  listeners,
  handleRef,
}: {
  title: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  handleRef: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      ref={handleRef}
      {...attributes}
      {...listeners}
      aria-label={`Move ${title} to another urgency stage`}
      className="text-ink-3 hover:text-ink hover:bg-stone active:cursor-grabbing focus-visible:ring-accent focus-visible:ring-offset-card -mr-1 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-[4px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none tablet:size-8 transition-colors"
    >
      <GripVertical aria-hidden="true" className="size-4" />
    </button>
  );
}
