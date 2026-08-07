import * as Sentry from "@sentry/nextjs";

import { clientSentryDsn, sharedSentryOptions } from "@/lib/observability/sentry-options";

/**
 * Browser instrumentation (Next's `instrumentation-client.ts` convention, in
 * the project root — verified against
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md`,
 * because this file has moved more than once across Next versions).
 *
 * It runs after the document loads and before React hydrates, which is what
 * makes it early enough to catch a hydration error.
 *
 * ONLY `NEXT_PUBLIC_SENTRY_DSN` IS READ HERE. `SENTRY_DSN` is server-only and
 * must never be reached for from a module that reaches the browser bundle
 * (§18). No DSN, no `init`, nothing logged.
 */
const dsn = clientSentryDsn();

if (dsn) {
  // The browser SDK's default integrations are kept as they come. Session
  // replay is NOT among them and is not added: replay records the DOM, and the
  // DOM of an Evidence Library screen is evidence body text. Enabling it needs
  // the §7.6 question answered first, not a config line.
  Sentry.init(sharedSentryOptions(dsn));
}

/**
 * Navigation breadcrumbs. Exported unconditionally: with no client initialised
 * Sentry's own handler is a no-op, and a conditional export would be a
 * conditional module shape.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
