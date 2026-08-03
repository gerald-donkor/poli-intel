import { z } from "zod";

/**
 * The window-date control's input shape, shared by the control and the Server
 * Action so the rules exist once (AGENTS.md §10.10).
 *
 * SHAPE ONLY — this module ships to the browser. It says a window date names a
 * signal and either a calendar day or nothing at all. It carries NO ROLE, no
 * role list, and no statement about who may record a date: `canSetSignalWindow`
 * lives in `lib/auth/authorize.ts`, which is `server-only`.
 */

/** Five years. A typo'd year should not silently open a window in 2225. */
export const MAX_WINDOW_YEARS_AHEAD = 5;

/**
 * A plain `YYYY-MM-DD` day, not an instant.
 *
 * A closing date is a DAY in Ghana, not a timestamp, and sending an instant
 * would make the stored date depend on the recording officer's timezone — a
 * deadline that reads as the 14th in Kumasi and the 13th in Brussels is exactly
 * the kind of quiet wrongness this column exists to avoid. The action parses it
 * at midday UTC so no offset can push it across a day boundary either way.
 *
 * `null` clears the date. Clearing is a real, deliberate action — it says nobody
 * knows the deadline any more — and is not the same as never having set one only
 * in that it leaves a trace on `updatedAt`.
 */
export const setSignalWindowSchema = z.object({
  signalId: z.uuid(),
  windowClosesOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.")
    .refine((value) => {
      const parsed = new Date(`${value}T12:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) return false;

      // Round-trip guard: `2026-02-31` parses to 3 March without it.
      return parsed.toISOString().slice(0, 10) === value;
    }, "That is not a real date.")
    .refine((value) => {
      const parsed = new Date(`${value}T12:00:00.000Z`);
      const ceiling = new Date();
      ceiling.setUTCFullYear(ceiling.getUTCFullYear() + MAX_WINDOW_YEARS_AHEAD);

      return parsed <= ceiling;
    }, `A closing date more than ${MAX_WINDOW_YEARS_AHEAD} years out is almost certainly a typo.`)
    .nullable(),
});

export type SetSignalWindowInput = z.infer<typeof setSignalWindowSchema>;
