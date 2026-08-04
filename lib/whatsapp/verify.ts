import { createHmac, timingSafeEqual } from "node:crypto";

import { constantTimeEquals } from "@/lib/net/secret";

/**
 * Inbound request verification. Pure — it takes strings and returns booleans,
 * touches no environment variable, no database, and no network.
 *
 * NOT `server-only`, for the same reason `lib/net/url.ts` is not: there is no
 * secret in this module. The secret is read in `lib/whatsapp/client.ts` and
 * passed in, which is also what makes both functions below testable without an
 * environment.
 *
 * THIS IS THE WEBHOOK'S ACCESS CONTROL. That path has no login by design
 * (§10.9), so signature verification is not a hardening measure on top of
 * authentication — it IS the authentication. No login does not mean no
 * verification.
 */

/**
 * Meta signs the raw request body with the app secret and sends the result as
 * `X-Hub-Signature-256: sha256=<hex>`.
 *
 * THE RAW BODY IS NOT NEGOTIABLE. A re-serialised `await request.json()` differs
 * from what was signed by key order and whitespace, so it will not match — the
 * caller reads `await request.text()` and passes that string through unmodified.
 *
 * CONSTANT-TIME COMPARISON, so a rejected signature leaks nothing about how far
 * it got. Everything before the comparison is shape-checking with no secret
 * involved, so an early return there is not a timing channel.
 */
export function verifyWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
}: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}): boolean {
  if (!signatureHeader) return false;

  const prefix = "sha256=";

  if (!signatureHeader.startsWith(prefix)) return false;

  const received = signatureHeader.slice(prefix.length);

  // A non-hex or wrong-length digest would make `timingSafeEqual` throw on
  // mismatched buffer lengths, so it is rejected on shape first.
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received.toLowerCase(), "hex"),
  );
}

/**
 * The `GET` subscription handshake's token comparison.
 *
 * Constant-time, and now delegating to `lib/net/secret.ts` because the USSD
 * callback needs the same comparison for its path secret. Same behaviour, one
 * implementation — two channels that share nothing else must not share this
 * module either, so the shared piece moved down to `lib/net/` rather than USSD
 * importing from `lib/whatsapp/`.
 */
export function verifyTokenMatches(
  received: string | null,
  expected: string,
): boolean {
  return constantTimeEquals(received, expected);
}
