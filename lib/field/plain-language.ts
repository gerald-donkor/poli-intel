import type { BriefStatus, Urgency } from "@/lib/generated/prisma/enums";

/**
 * Internal taxonomy → plain language, in one place.
 *
 * THIS FILE IS WHERE §11.12 IS ENFORCED. The `/field` surface never exposes
 * internal taxonomy vocabulary — no "signal", no "urgency", no "relevance
 * score", no classification value — and the way to keep that true is to have
 * exactly one module that can produce the words this surface says. Any screen
 * under `/field` that writes a label inline has stepped around it.
 *
 * The labels are TIME AND ACTION, not the enum's own name: a person reading on a
 * phone in a cocoa plot needs "act this month", not "immediate urgency". The
 * order of `Urgency` still carries the taxonomy (§11.4) — nothing here re-sorts
 * or remaps it, it only renames.
 *
 * NOT server-only: these labels render in client components too.
 */

export const URGENCY_PLAIN_LABEL: Record<Urgency, string> = {
  immediate: "Act this month",
  near_term: "Coming in the next few months",
  horizon: "Coming later this year",
  watch: "Worth knowing about",
};

/**
 * The card's left rule, per the warm→cool ramp. Colour ALONE never carries the
 * meaning — every card renders the label above beside it (§11.13).
 */
export const URGENCY_RULE_CLASS: Record<Urgency, string> = {
  immediate: "border-l-immediate",
  near_term: "border-l-nearterm",
  horizon: "border-l-horizon",
  watch: "border-l-watch",
};

export const URGENCY_EYEBROW_CLASS: Record<Urgency, string> = {
  immediate: "text-immediate-ink",
  near_term: "text-nearterm-ink",
  horizon: "text-horizon-ink",
  watch: "text-watch-ink",
};

/**
 * Only `submitted` and `published` reach this surface (see `lib/db/field.ts`),
 * but the map is total so a future status cannot render as a raw enum value.
 *
 * "Sent to" and "Published", never "approved" or "verified" — the product does
 * not describe itself as having decided anything (§8.8).
 */
export const BRIEF_STATUS_PLAIN_LABEL: Record<BriefStatus, string> = {
  draft: "Being written",
  reviewed: "With the office",
  submitted: "Sent to the people it was written for",
  published: "Published",
};

/**
 * A date a person can read without doing arithmetic — "3 August 2026".
 *
 * `en-GB` explicitly rather than the runtime's locale: a cached page rendered on
 * a phone set to US English would otherwise silently switch to month-first and
 * read as a different day.
 */
export function plainDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** The same, with the time, for "saved at" on the offline banner. */
export function plainDateTime(iso: string): string {
  const date = new Date(iso);

  return `${plainDate(iso)} at ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
