import { scrubBreadcrumb, scrubEvent } from "./scrub";

/**
 * One place that decides how Sentry is configured, for every runtime.
 *
 * SAME RULE AS `lib/ai/config.ts` (§13.1): a DSN, an environment, a release, or
 * a sample rate is never inlined in a route, an action, a job, or a boundary.
 * If a value here needs to change it changes once, and the three `init` call
 * sites — `instrumentation.ts`, `instrumentation-client.ts`, and
 * `lib/observability/capture.ts`'s consumers — inherit it.
 *
 * THE SCRUBBER IS WIRED HERE AND NOWHERE ELSE, and every transport hook Sentry
 * offers is covered: `beforeSend` for errors, `beforeSendTransaction` for
 * traces, `beforeBreadcrumb` for the console history. There is no exported
 * options object without them, which is what makes "no unscrubbed door" a
 * structural property rather than a habit.
 *
 * SENTRY IS OPTIONAL AT RUNTIME. No DSN means no `init` at all — not a disabled
 * client, not a warning, not a line in the terminal. Unset is the state this
 * project ships in today (no Sentry organisation is provisioned yet, and
 * provisioning a Tropenbos-owned one is the client's call), so unset has to be
 * a first-class state rather than a degraded one. The same shape §19 already
 * uses for `PANDOC_BIN`.
 */

/** `undefined` rather than `""`, so a blank line in `.env` reads as absent. */
function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();

  return next ? next : undefined;
}

/**
 * Server-side DSN. Never read from a client module — `SENTRY_DSN` has no
 * `NEXT_PUBLIC_` prefix and would resolve to `undefined` in the browser anyway,
 * but the boundary is stated rather than discovered (§18).
 */
export function serverSentryDsn(): string | undefined {
  return trimmed(process.env.SENTRY_DSN);
}

/**
 * Browser DSN. The literal `process.env.NEXT_PUBLIC_SENTRY_DSN` is what Next
 * statically replaces at build time, so it is written out in full here rather
 * than reached through a variable.
 */
export function clientSentryDsn(): string | undefined {
  return trimmed(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * Which deployment an event came from. Vercel sets `VERCEL_ENV` to
 * `production` / `preview` / `development`; locally there is only `NODE_ENV`.
 */
function environment(): string {
  return trimmed(process.env.VERCEL_ENV) ?? process.env.NODE_ENV ?? "development";
}

/**
 * Which build. The commit SHA is what a source map upload would be keyed to, so
 * the two agree by construction rather than by a hand-typed version.
 */
function release(): string | undefined {
  return trimmed(process.env.VERCEL_GIT_COMMIT_SHA);
}

/**
 * The options every runtime shares. Callers add only what is genuinely
 * runtime-specific.
 *
 * `tracesSampleRate: 0` IS A DECISION, NOT AN OMISSION. Tracing on a free-tier
 * Sentry alongside Inngest jobs, Gemini calls, and pgvector queries spends the
 * quota on data nobody is reading yet, and every span name is one more surface
 * to audit for evidence text (`beforeSendTransaction` is wired regardless, so
 * turning tracing on later does not open an unscrubbed path). Errors first;
 * tracing is a later, deliberate change.
 *
 * `sendDefaultPii: false` IS ALSO A DECISION. Staff here are named individuals
 * at a small organisation. The scope carries a staff id and role — see
 * `lib/observability/capture.ts` — and never an email, a name, or an IP.
 */
export function sharedSentryOptions(dsn: string) {
  return {
    dsn,
    environment: environment(),
    release: release(),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Generic rather than typed against Sentry's `ErrorEvent` /
    // `TransactionEvent`: the installed SDK does not re-export
    // `TransactionEvent` from `@sentry/nextjs`, and reaching into
    // `@sentry/core` for a type would depend on a transitive package this
    // project does not declare. A generic over `object` is instantiated at each
    // hook's own signature and keeps the scrubber structural, which is what
    // lets PostHog reuse it later.
    beforeSend: <T extends object>(event: T): T => scrubEvent(event),
    beforeSendTransaction: <T extends object>(event: T): T => scrubEvent(event),
    beforeBreadcrumb: <T extends object>(breadcrumb: T): T => scrubBreadcrumb(breadcrumb),
  };
}
