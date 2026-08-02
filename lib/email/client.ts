import "server-only";

import { Resend } from "resend";

/**
 * The Resend client, and the one place `RESEND_API_KEY` and `DIGEST_FROM_EMAIL`
 * are read.
 *
 * SERVER-ONLY, AND NEVER LOGGED. Neither value is `NEXT_PUBLIC_*`, neither is
 * imported from a client component, and the Resend API does not support CORS —
 * it is called from jobs and nowhere else (§18).
 *
 * NO TEMPLATE KNOWLEDGE HERE. This module knows how to reach Resend; it does not
 * know what a digest is.
 */

export type EmailConfig = { apiKey: string; from: string };

/**
 * `null` when the deployment has no email configured.
 *
 * A HANDLED, NAMED OUTCOME RATHER THAN A CRASH — the same shape the Gemini paths
 * use for `missing_api_key`. A local `npm run dev` with no key must not produce
 * a red failed run every morning.
 */
export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL;

  if (!apiKey || !from) return null;

  return { apiKey, from };
}

/**
 * Constructed per send rather than held at module scope, so a key rotated in the
 * environment takes effect on the next run rather than on the next deploy.
 */
export function resendClient(apiKey: string): Resend {
  return new Resend(apiKey);
}
