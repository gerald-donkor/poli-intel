import { z } from "zod";

/**
 * The field observation's shape, shared by the Server Action and React Hook Form
 * so the rules exist once (AGENTS.md §10.10).
 *
 * SHAPE ONLY. This module ships to the browser — and, via the offline queue,
 * into IndexedDB on the officer's phone — so it carries no role list, no
 * predicate, and no authorisation logic. Those live in `lib/auth/authorize.ts`,
 * which is server-only.
 *
 * `classification` is deliberately absent and must never be added. The schema
 * default in `prisma/schema.prisma` is the only way a submission's
 * classification is first set (§7.3); a field here would be a client-supplied
 * path around the governance gate.
 *
 * No `.transform()`: keeping the parsed output identical to the input means
 * React Hook Form's field types and the action's argument type are the same
 * object, and — more importantly here — a queued submission serialised to
 * IndexedDB round-trips through this schema unchanged when it is replayed.
 * `observedAt` is therefore a `YYYY-MM-DD` string, converted inside the action.
 */

/** Today in the browser's own timezone, as the date input's `max`. */
function todayIso(): string {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();

  return new Date(now.getTime() - offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

export const fieldObservationSchema = z.object({
  /**
   * The idempotency key, generated on the device at compose time.
   *
   * IN THE SHARED SCHEMA ON PURPOSE, so a replayed submission cannot lose it
   * between IndexedDB and the action. It is not a secret and grants nothing:
   * the server still resolves the session and authorises the caller, and a key
   * only ever collapses two attempts into one row.
   */
  submissionKey: z.uuid("This submission is missing its reference."),

  title: z
    .string()
    .trim()
    .min(3, "Give the update a short title of at least 3 characters.")
    .max(120, "Keep the title under 120 characters."),

  observation: z
    .string()
    .trim()
    .min(20, "Tell us what you saw — at least 20 characters.")
    .max(4000, "Keep the update under 4,000 characters."),

  locationNote: z
    .string()
    .trim()
    .max(120, "Keep the place under 120 characters.")
    .optional(),

  observedAt: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(value)) &&
          value <= todayIso()),
      "Use a date that is today or earlier.",
    )
    .optional(),
});

export type FieldObservationInput = z.infer<typeof fieldObservationSchema>;

/** The date input's `max`, so the picker agrees with the rule above. */
export const observedAtMax = todayIso;
