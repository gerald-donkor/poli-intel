import { BriefStatus, Urgency } from "@/lib/generated/prisma/enums";
import type { TrackerBrief } from "@/lib/db/tracker";

/**
 * The tracker's own copy: window states, relative dates, and the calendar mark's
 * colour per urgency.
 *
 * Enum labels are NOT re-declared here — `URGENCY_LABELS`, `GEOGRAPHY_LABELS`
 * and `BRIEF_STATUS_LABELS` are imported from the signals and briefs routes so
 * one taxonomy has one set of words (AGENTS.md §12.7).
 *
 * COPY NEVER IMPLIES THE SYSTEM DECIDED, ESTIMATED OR INFERRED ANYTHING (§8.8).
 * A window is *recorded* by a person; a brief is *drafted* or *submitted*. There
 * is no wording anywhere on this route suggesting a date was worked out from a
 * signal's urgency, because it never is.
 */

/**
 * The urgency ramp as a calendar dot.
 *
 * WRITTEN OUT IN FULL per stage for the same reason `URGENCY_RAMP` is: Tailwind 4
 * scans source for complete class strings, so `bg-${ramp}` is a class that never
 * exists at runtime.
 *
 * A DOT, NEVER A FILLED DAY. Urgency is carried by a small mark and its
 * accessible name (§11.5), and the name is what makes it not colour-only
 * (§11.13). Never red/amber/green — this is the warm→cool ramp in the order the
 * enum declares (§11.4).
 */
export const WINDOW_DOT: Record<Urgency, string> = {
  [Urgency.immediate]: "bg-immediate",
  [Urgency.near_term]: "bg-nearterm",
  [Urgency.horizon]: "bg-horizon",
  [Urgency.watch]: "bg-watch",
};

/** The dot's text-colour twin, for the eyebrow beside a table row's date. */
export const WINDOW_EYEBROW: Record<Urgency, string> = {
  [Urgency.immediate]: "text-immediate",
  [Urgency.near_term]: "text-nearterm",
  [Urgency.horizon]: "text-horizon",
  [Urgency.watch]: "text-watch",
};

/** A window's day, in the product's date register. */
export function formatWindowDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Midnight UTC for a day, so two dates compare as days rather than instants. */
function startOfUtcDay(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

/** Whole days from today to `iso`. Negative means the window has closed. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (startOfUtcDay(new Date(iso)) - startOfUtcDay(now)) / millisecondsPerDay,
  );
}

/**
 * The plain-language form beside the date — "in 9 days", "closed 3 days ago".
 *
 * PLAIN, NOT ALARMED. A passed window says it closed and stops there; it is not
 * shouted at, not counted in exclamation marks, and not rendered in red, because
 * nothing in this product is red (§11.4).
 */
export function describeWindowTiming(iso: string, now: Date = new Date()): string {
  const days = daysUntil(iso, now);

  if (days === 0) return "closes today";
  if (days === 1) return "closes tomorrow";
  if (days === -1) return "closed yesterday";
  if (days > 0) return `in ${days} days`;

  return `closed ${Math.abs(days)} days ago`;
}

/**
 * Whether a window has closed with nothing submitted or published against it.
 *
 * A STATEMENT OF FACT, NOT A VERDICT. It does not say the window was missed —
 * a brief may have gone out by another route, and the product does not know
 * that. It says what the record holds.
 */
export function isClosedUnanswered(
  window: { windowClosesAt: string; briefs: TrackerBrief[] },
  now: Date = new Date(),
): boolean {
  if (daysUntil(window.windowClosesAt, now) >= 0) return false;

  return !window.briefs.some(
    (brief) =>
      brief.status === BriefStatus.submitted ||
      brief.status === BriefStatus.published,
  );
}

/**
 * The accessible name for a day that has windows closing on it.
 *
 * The calendar's mark is a coloured dot, and a dot alone is colour-only
 * information. This sentence is what a screen reader and a colour-blind reader
 * actually get (§11.13).
 */
export function describeDayWindows(count: number, urgencyLabel: string): string {
  const windows = count === 1 ? "1 window closing" : `${count} windows closing`;

  return `${windows}, soonest stage ${urgencyLabel}`;
}
