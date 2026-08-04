import "server-only";

/**
 * The one place the USSD callback's two environment variables are read.
 *
 * SERVER-ONLY, AND NEVER LOGGED. Neither is `NEXT_PUBLIC_*`, neither is imported
 * from a client component, and neither appears in a log line, a Sentry event, or
 * a PostHog property (AGENTS.md §18, §7.6). The same split
 * `lib/whatsapp/client.ts` makes: this module knows the deployment's
 * credentials, and knows nothing about what a menu is.
 *
 * WHY A PATH SECRET AND NOT A SIGNATURE. Africa's Talking does not sign its USSD
 * callbacks the way Meta signs webhook bodies — their USSD documentation
 * describes the callback as a plain form POST with `sessionId`, `serviceCode`,
 * `phoneNumber` and `text`, and offers no signature header and no published
 * source-IP allowlist to verify against. So the callback URL registered in their
 * dashboard carries a high-entropy secret as a path segment, compared in
 * constant time.
 *
 * A PATH SEGMENT RATHER THAN A QUERY PARAMETER because query strings are the
 * part of a callback URL most likely to be dropped or rewritten in transit.
 *
 * THE HONEST COST: a URL path appears in platform access logs, so this secret is
 * lower-grade than a body signature and is expected to be rotated. It is
 * combined with a second, independent check — the posted `serviceCode` must
 * equal the configured short code — so a leaked URL alone is not a complete key.
 * If Africa's Talking later publishes a signature or an IP allowlist, that is
 * what should be verified here instead.
 */

/**
 * The high-entropy path segment the registered callback URL carries.
 *
 * `null` when unset, so an unconfigured deployment refuses cleanly rather than
 * throwing — the same shape `whatsappWebhookSecret()` uses, and what makes
 * `npm run dev` without credentials a 403 instead of a stack trace.
 */
export function ussdSecret(): string | null {
  return process.env.AFRICASTALKING_USSD_SECRET || null;
}

/**
 * The short code registered with the gateway, e.g. `*384*1234#`.
 *
 * THE SECOND, INDEPENDENT CHECK. The posted `serviceCode` must equal this, so
 * possession of the callback URL is not by itself possession of the digest.
 */
export function ussdServiceCode(): string | null {
  return process.env.USSD_SERVICE_CODE || null;
}
