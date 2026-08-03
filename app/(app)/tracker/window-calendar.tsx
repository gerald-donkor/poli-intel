"use client";

import type { ComponentProps } from "react";
import type { DayButton } from "react-day-picker";

import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Urgency } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

import { URGENCY_LABELS, URGENCY_ORDER } from "../signals/labels";
import { describeDayWindows, WINDOW_DOT } from "./labels";

/**
 * The calendar half of the combination view.
 *
 * A DOT PER DAY, NEVER A FILLED DAY BACKGROUND. Urgency is carried by a small
 * mark coloured on the warm→cool ramp — immediate bronze, near-term olive,
 * horizon teal, watch slate — and never by red/amber/green (§11.4, §11.5).
 *
 * THE MARK IS NEVER COLOUR-ONLY. Every marked day carries an accessible name
 * saying how many windows close on it and at which stage, so the information
 * survives a screen reader and a colour-blind reader (§11.13).
 *
 * KEYBOARD NAVIGATION comes from `react-day-picker` itself — arrow keys move the
 * focused day, Enter selects — and the marks ride on the same buttons rather
 * than being a separate, unreachable layer.
 */

/** What is closing on one day: how many, and the soonest stage among them. */
export type DayWindowSummary = { count: number; urgency: Urgency };

/** A local `YYYY-MM-DD` key, so a day matches the day a person sees. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function WindowCalendar({
  summaries,
  selectedDay,
  onSelectDay,
  defaultMonth,
}: {
  summaries: Map<string, DayWindowSummary>;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  defaultMonth: Date;
}) {
  // One modifier per urgency stage, so a day's dot colour comes from the stage
  // and not from a class computed at render time.
  const modifiers: Record<string, Date[]> = {};
  for (const stage of URGENCY_ORDER) modifiers[stage] = [];

  for (const [key, summary] of summaries) {
    const [year, month, day] = key.split("-").map(Number);
    modifiers[summary.urgency].push(new Date(year, month - 1, day));
  }

  const selectedDate = selectedDay
    ? (() => {
        const [year, month, day] = selectedDay.split("-").map(Number);
        return new Date(year, month - 1, day);
      })()
    : undefined;

  return (
    <Calendar
      mode="single"
      required={false}
      selected={selectedDate}
      onSelect={(date) => onSelectDay(date ? dayKey(date) : null)}
      defaultMonth={defaultMonth}
      modifiers={modifiers}
      showOutsideDays={false}
      className="bg-card w-full p-3 [--cell-size:--spacing(9)]"
      components={{
        DayButton: (props) => (
          <WindowDayButton {...props} summaries={summaries} />
        ),
      }}
    />
  );
}

function WindowDayButton({
  summaries,
  ...props
}: ComponentProps<typeof DayButton> & {
  summaries: Map<string, DayWindowSummary>;
}) {
  const summary = summaries.get(dayKey(props.day.date));

  const dateLabel = props.day.date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <CalendarDayButton
      {...props}
      aria-label={
        summary
          ? `${dateLabel}. ${describeDayWindows(summary.count, URGENCY_LABELS[summary.urgency])}`
          : dateLabel
      }
    >
      {props.children}
      {summary ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full opacity-100",
            WINDOW_DOT[summary.urgency],
          )}
        />
      ) : null}
    </CalendarDayButton>
  );
}
