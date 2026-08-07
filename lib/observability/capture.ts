import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { StaffRole } from "@/lib/generated/prisma/enums";

import { scrubValue } from "./scrub";

/**
 * The one way app code reports a handled-but-notable failure.
 *
 * IT MIRRORS THE CONVENTION ALREADY IN THE CODEBASE rather than replacing it.
 * Forty call sites in `lib/` and `app/` already write
 * `console.warn("dotted.event.name", { ids, counts, statuses })`, and that
 * convention is already safe — it passes scalars and never a body. So this
 * function takes the same two arguments, keeps writing the same
 * `console.warn`, and adds Sentry alongside it. No existing call site is
 * rewritten; `captureFailure` is for new code and for the places where a
 * `console.warn` alone has proved not to be enough.
 *
 * THE CONSOLE LINE IS UNCONDITIONAL. Sentry is optional at runtime (no DSN, no
 * client), and a failure that is only visible when a third-party service
 * happens to be configured is not visible. The terminal is the primary channel;
 * Sentry is the one that survives the terminal being closed.
 *
 * CONTEXT IS SCALARS ONLY, AT THE TYPE LEVEL. A caller cannot pass
 * `{ chunk: chunk.text }` without the compiler objecting, and if one finds a way
 * to — a `string` is a scalar, after all — `scrubValue` still holds the line at
 * runtime. Two layers, because the type is the reminder and the scrubber is the
 * gate.
 */

/** What a context value may be. Ids, counts, statuses, timings. */
type ContextValue = string | number | boolean | null | undefined;

export type FailureContext = Record<string, ContextValue>;

/**
 * @param event Dotted event name, e.g. `"export.pandoc.spawn_failed"`. Same
 *   namespacing as the existing `console.warn` call sites.
 * @param context Scalars only — ids, counts, classifications, statuses, durations.
 * @param error The caught value, where there is one. Its message and stack are
 *   scrubbed on the way out by `beforeSend`; nothing extra is attached here.
 */
export function captureFailure(
  event: string,
  context: FailureContext = {},
  error?: unknown,
): void {
  const safe = scrubValue(context) as Record<string, unknown>;

  console.warn(event, safe);

  if (error === undefined) {
    Sentry.captureMessage(event, { level: "warning", extra: safe });

    return;
  }

  Sentry.captureException(error, { tags: { event }, extra: safe });
}

/**
 * Attach the signed-in person to the Sentry scope.
 *
 * ID AND ROLE ONLY (§18). Never an email, never a name — `sendDefaultPii` is
 * false and `scrubEvent` strips those fields even if some future integration
 * attaches them, but the right place to not send something is to not send it.
 *
 * CALLED FROM `lib/auth/session.ts`, NOT FROM HERE, and the direction matters:
 * `lib/observability/` is a leaf and imports no Prisma, no Gemini, and no
 * evidence module. Auth depends on observability; observability depends on
 * nothing. Reaching into `auth()` from this module would invert that and pull
 * the database adapter into the error reporter.
 */
export function setStaffScope(staffUserId: string, role: StaffRole): void {
  Sentry.setUser({ id: staffUserId, role });
}
