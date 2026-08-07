import * as Sentry from "@sentry/nextjs";

import { serverSentryDsn, sharedSentryOptions } from "@/lib/observability/sentry-options";

/**
 * Server-side instrumentation (Next's `instrumentation.ts` convention).
 *
 * `register()` runs once per server instance, before the first request. It is
 * the only place the Node-runtime Sentry client is initialised.
 *
 * NO DSN MEANS NO `init`, AND NOTHING PRINTED. Sentry is not provisioned for
 * this project yet, so the unconfigured path is the ordinary path and must be
 * silent — see `lib/observability/sentry-options.ts`.
 *
 * NODE RUNTIME ONLY, ON PURPOSE. There is no `middleware.ts` in this project
 * and no route opts into the edge runtime, so an edge branch here would be a
 * branch that never runs. Add it in the change that adds the first edge
 * surface, not in anticipation of one.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const dsn = serverSentryDsn();

  if (!dsn) return;

  Sentry.init(sharedSentryOptions(dsn));
}

/**
 * Next's hook for server-side render and route errors.
 *
 * Sentry's `captureRequestError` reports through the same client `register()`
 * configured, so it inherits `beforeSend` and therefore the scrubber — there is
 * no separate transport here to audit. With no DSN there is no client and the
 * call is a no-op.
 */
export const onRequestError = Sentry.captureRequestError;
