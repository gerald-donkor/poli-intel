import { AudienceTarget } from "@/lib/generated/prisma/enums";

import { AUDIENCE_TARGET_LABELS } from "../signals/labels";

/**
 * Presentation labels for the CRM.
 *
 * `AUDIENCE_TARGET_LABELS` is re-exported from the signals module rather than
 * re-declared, so a contact's audience type and a signal's read the same table
 * (AGENTS.md §12.7).
 *
 * Copy never implies the product sent anything. The product records what a
 * person did: a share is *logged*, never *sent* and never *delivered* (§8.8).
 */

export { AUDIENCE_TARGET_LABELS };

/**
 * Group order for the list. The enum's declaration order, which is the spec's,
 * and nothing re-sorts it by count or recency.
 */
export const AUDIENCE_TARGET_ORDER = [
  AudienceTarget.ministry,
  AudienceTarget.cocobod,
  AudienceTarget.eu_institutions,
  AudienceTarget.private_sector,
  AudienceTarget.community_governance,
] as const;

export const AUDIENCE_TARGET_OPTIONS = AUDIENCE_TARGET_ORDER.map((value) => ({
  value,
  label: AUDIENCE_TARGET_LABELS[value],
}));

/** Contacts with no audience type recorded still have to go somewhere. */
export const UNGROUPED_LABEL = "No audience type recorded";

/** A share is remembered to the day, so it is shown to the day. */
export function formatSharedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Today in the `YYYY-MM-DD` form the date input and the schema both use. */
export function todayInputValue(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}
