import "server-only";

import { WHATSAPP_GRAPH_API_VERSION } from "./config";

/**
 * The WhatsApp Cloud API's reach, and the one place the four `WHATSAPP_*`
 * environment variables are read.
 *
 * SERVER-ONLY, AND NEVER LOGGED. None is `NEXT_PUBLIC_*`, none is imported from
 * a client component, and none appears in a log line, a Sentry event, or a
 * PostHog property (§18, §7.6).
 *
 * NO DIGEST KNOWLEDGE HERE. This module knows how to reach the API; it does not
 * know what a digest is. The same split `lib/email/client.ts` makes.
 *
 * WHY THE CLOUD API SHAPE AND NOT TWILIO'S: `WHATSAPP_API_TOKEN` and
 * `WHATSAPP_PHONE_NUMBER_ID` were already declared in `.env.example`, and that
 * naming is Cloud API — Twilio would need an account SID and a `from` number.
 * Taking the existing declaration as the decision means no new send variable and
 * no rename, and 360dialog exposes this same surface, so the choice between it
 * and Meta direct stays a deployment-time one (AGENTS.md §6).
 */

export type WhatsAppConfig = { token: string; phoneNumberId: string };

/**
 * `null` when the deployment has no WhatsApp credentials.
 *
 * A HANDLED, NAMED OUTCOME RATHER THAN A CRASH — the same shape `emailConfig()`
 * uses. A local `npm run dev` with no credentials must not produce a red failed
 * run every Monday, and it is what makes this feature reviewable before
 * Tropenbos has provisioned an account.
 */
export function whatsappConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return null;

  return { token, phoneNumberId };
}

/**
 * The app secret inbound webhook signatures are checked against.
 *
 * A DIFFERENT VALUE FROM THE SEND TOKEN, which is why it is a separate variable:
 * Meta signs webhook bodies with the app secret, and a webhook that cannot
 * verify its caller is an open endpoint serving Tropenbos's weekly digest to
 * anyone who finds the URL.
 */
export function whatsappWebhookSecret(): string | null {
  return process.env.WHATSAPP_WEBHOOK_SECRET || null;
}

/** The string echoed back during the provider's one-time `GET` handshake. */
export function whatsappVerifyToken(): string | null {
  return process.env.WHATSAPP_VERIFY_TOKEN || null;
}

/** The messages endpoint for this deployment's sender identity. */
export function messagesEndpoint(phoneNumberId: string): string {
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}
