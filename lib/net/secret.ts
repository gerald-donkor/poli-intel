import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of a caller-supplied value against a shared secret.
 *
 * IT LIVES HERE RATHER THAN IN EITHER CALLER because two independent channels
 * now need it: the WhatsApp webhook's subscription handshake
 * (`lib/whatsapp/verify.ts`) and the USSD callback's path secret
 * (`app/api/ussd/[secret]/route.ts`). The alternative — USSD importing from
 * `lib/whatsapp/` — would make two channels that share nothing else
 * structurally dependent on each other, so that a change to one channel's
 * verification is a change to the other's.
 *
 * PURE, and deliberately not `server-only`, for the same reason `lib/net/url.ts`
 * is not: there is no secret in this module. The secret is read in each
 * channel's own `client.ts` and passed in, which is also what makes this
 * testable without an environment.
 */

/**
 * `true` only when both strings are present, the same length, and equal.
 *
 * CONSTANT-TIME, because the expected value is a shared secret and a
 * byte-by-byte `===` on a value an unauthenticated caller supplies is exactly
 * the comparison worth not writing. Length is not secret — it is observable from
 * the request anyway — but `timingSafeEqual` throws unless the buffers match, so
 * it is shape-checked first, and a shape check with no secret involved is not a
 * timing channel.
 */
export function constantTimeEquals(
  received: string | null | undefined,
  expected: string,
): boolean {
  if (!received) return false;

  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
