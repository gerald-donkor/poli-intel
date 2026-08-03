"use client";

import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import type { TrackerBrief, TrackerDatedWindow } from "@/lib/db/tracker";
import { cn } from "@/lib/utils";

import { BRIEF_STATUS_LABELS } from "../briefs/labels";
import { GEOGRAPHY_LABELS, URGENCY_LABELS } from "../signals/labels";
import {
  describeWindowTiming,
  formatWindowDate,
  isClosedUnanswered,
  WINDOW_EYEBROW,
} from "./labels";
import { WindowDateControl } from "./window-date-control";

/**
 * The data half of the combination view: which windows close when, and what
 * exists to answer each.
 *
 * IT DISPLAYS BRIEF STATUS AND NEVER ADVANCES IT. There is no "mark submitted"
 * control on this route — approval and submission stay the Programme Director's
 * explicit actions on the brief itself, still refused server-side while
 * unresolved flags exist (§9.5, §10.7). A calendar must not become a second,
 * unguarded path to a status change.
 *
 * SCROLLS INSIDE ITS OWN CONTAINER, never the page (§11.15). Five columns do not
 * reflow below `tablet`, so the container takes the horizontal scroll and the
 * frame stays put.
 *
 * A client component for one reason only: the 180ms crossfade when the selection
 * changes. It fetches nothing and owns no pipeline state.
 */
export function WindowTable({
  windows,
  selectedDay,
  canSetWindow,
}: {
  windows: TrackerDatedWindow[];
  selectedDay: string | null;
  canSetWindow: boolean;
}) {
  return (
    <div className="bg-card border-line rounded-card min-w-0 overflow-x-auto border">
      <Table
        // Keyed on the selection so the rows crossfade rather than snapping.
        // 180ms, and the global `prefers-reduced-motion` rule makes it instant
        // (§11.9, §11.10).
        key={selectedDay ?? "all"}
        className="animate-count-fade min-w-170"
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-ink-3 text-meta w-42 font-semibold tracking-[0.06em] uppercase">
              Window closes
            </TableHead>
            <TableHead className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
              Signal
            </TableHead>
            <TableHead className="text-ink-3 text-meta w-28 font-semibold tracking-[0.06em] uppercase">
              Urgency
            </TableHead>
            <TableHead className="text-ink-3 text-meta w-37 font-semibold tracking-[0.06em] uppercase">
              Geography
            </TableHead>
            <TableHead className="text-ink-3 text-meta w-59 font-semibold tracking-[0.06em] uppercase">
              Brief
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {windows.map((window) => (
            <WindowRow
              key={window.id}
              window={window}
              canSetWindow={canSetWindow}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WindowRow({
  window,
  canSetWindow,
}: {
  window: TrackerDatedWindow;
  canSetWindow: boolean;
}) {
  const closedUnanswered = isClosedUnanswered(window);

  return (
    <TableRow className="align-top">
      <TableCell className="py-3">
        <span className="text-ink block font-mono text-[13px] tabular-nums">
          {formatWindowDate(window.windowClosesAt)}
        </span>
        <span className="text-ink-3 block text-[13px]">
          {describeWindowTiming(window.windowClosesAt)}
        </span>
        {closedUnanswered ? (
          // Slate, plain, and not an alarm. Nothing in this product is red, and
          // this is a statement about the record — not an accusation that the
          // window was missed (§11.4).
          <span className="bg-watch-surface border-watch-border text-watch-ink mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold">
            {/* Square glyph: a governance-adjacent state, never the guard
                flag's circle (design-system rule 4). */}
            <span aria-hidden="true" className="border-watch size-2 border" />
            Window closed
          </span>
        ) : null}

        {canSetWindow ? (
          // A native disclosure: keyboard-operable with no JavaScript of its own,
          // and collapsed by default so a table of dates does not become a table
          // of forms. Hiding it for other roles is presentation — the action
          // re-checks the caller's role regardless (§10.1).
          <details className="mt-2">
            <summary className="text-ink-3 hover:text-ink cursor-pointer text-[13px]">
              Change date
            </summary>
            <div className="mt-2">
              <WindowDateControl
                signalId={window.id}
                initialDate={window.windowClosesAt.slice(0, 10)}
              />
            </div>
          </details>
        ) : null}
      </TableCell>

      <TableCell className="py-3">
        <Link
          href={`/signals/${window.id}`}
          className="text-ink text-[13px] leading-snug font-medium no-underline hover:underline"
        >
          {window.title}
        </Link>
      </TableCell>

      <TableCell className="py-3">
        <span
          className={cn(
            "text-meta font-semibold tracking-[0.06em] uppercase",
            WINDOW_EYEBROW[window.urgency],
          )}
        >
          {URGENCY_LABELS[window.urgency]}
        </span>
      </TableCell>

      <TableCell className="text-ink-2 py-3 text-[13px]">
        {GEOGRAPHY_LABELS[window.geography]}
      </TableCell>

      <TableCell className="py-3">
        {window.briefs.length === 0 ? (
          // Never an empty cell. The absence is the point of the screen, and it
          // carries the step that would change it.
          <span className="text-ink-3 block text-[13px]">
            No brief drafted.{" "}
            <Link
              href={`/signals/${window.id}`}
              className="text-primary no-underline hover:underline"
            >
              Open the signal
            </Link>
          </span>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {window.briefs.map((brief) => (
              <li key={brief.id}>
                <BriefLine brief={brief} />
              </li>
            ))}
          </ul>
        )}
      </TableCell>
    </TableRow>
  );
}

function BriefLine({ brief }: { brief: TrackerBrief }) {
  return (
    <Link
      href={`/briefs/${brief.id}`}
      className="flex flex-col gap-0.5 no-underline hover:underline"
    >
      <span className="text-ink text-[13px]">
        For {audienceLabel(brief.audience)}
      </span>
      <span
        className="bg-surface-tint text-primary-ink border-surface-tint-border w-fit rounded-full border px-2 py-0.5 text-[11.5px] font-semibold"
        aria-label={`Brief status: ${BRIEF_STATUS_LABELS[brief.status]}`}
      >
        {BRIEF_STATUS_LABELS[brief.status]}
      </span>
    </Link>
  );
}
