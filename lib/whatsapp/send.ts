import "server-only";

import { messagesEndpoint, whatsappConfig } from "./client";
import { WHATSAPP_DIGEST_TEMPLATE, templateVariables } from "./config";

/**
 * One send, with the Cloud API's error body handled explicitly and a typed
 * result.
 *
 * A FAILURE IS RETURNED, NEVER THROWN, exactly as `lib/email/send.ts` does. That
 * is what gives the weekly job its per-recipient failure isolation: one bad
 * number is one `ok: false`, and the remaining officers still get theirs
 * (`inngest-jobs` rule 5, applied per recipient). Throwing would retry the whole
 * function and re-send everyone who already received Monday's notification.
 *
 * THE ERROR BODY IS CHECKED, NOT THE THROW. `fetch` does not reject on a 4xx, so
 * a `try`/`catch` alone would treat every rejected message as a success. The
 * `catch` below is for transport failures only (DNS, a dropped socket), which is
 * a different thing and is labelled as such.
 *
 * NOTHING ABOUT THE MESSAGE IS LOGGED OR RETURNED. No number, no recipient name,
 * no body — WhatsApp is an egress path off Tropenbos-controlled infrastructure,
 * and its failure record is a machine reason and a status code (§7.6, §13.9).
 */

export type WhatsAppSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; reason: WhatsAppFailureReason; statusCode: number | null };

export type WhatsAppFailureReason =
  | "not_configured"
  /** The 24-hour customer service window has closed; free-form text is refused. */
  | "outside_window"
  | "rate_limited"
  | "rejected"
  | "request_failed";

/** The Cloud API's error envelope — the fields this code actually reads. */
type CloudApiError = {
  error?: { code?: number; error_subcode?: number };
};

type CloudApiSuccess = {
  messages?: Array<{ id?: string }>;
};

/**
 * Meta's error codes for the two outcomes that are ordinary rather than broken.
 *
 * 131047 is "re-engagement message" — the free-form reply arrived after the
 * 24-hour window closed, which is a platform rule being enforced and not a
 * defect. 130429 and 131056 are the throughput and per-pair rate limits; §13.3's
 * rule ("a rate limit is a handled, user-visible state, never a crash") is
 * written for Gemini and applies just as well to a non-Gemini provider.
 */
const OUTSIDE_WINDOW_CODES = new Set([131047, 131051]);
const RATE_LIMIT_CODES = new Set([130429, 131056, 80007, 4]);

async function postMessage(
  payload: Record<string, unknown>,
): Promise<WhatsAppSendResult> {
  const config = whatsappConfig();

  if (config === null) {
    return { ok: false, reason: "not_configured", statusCode: null };
  }

  try {
    const response = await fetch(messagesEndpoint(config.phoneNumberId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      // This runs inside an Inngest step which owns the retry, so a hung socket
      // should surface as a failed attempt rather than holding the step open.
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as CloudApiError;
      const code = body.error?.code;

      return {
        ok: false,
        reason:
          code !== undefined && OUTSIDE_WINDOW_CODES.has(code)
            ? "outside_window"
            : (code !== undefined && RATE_LIMIT_CODES.has(code)) ||
                response.status === 429
              ? "rate_limited"
              : "rejected",
        statusCode: response.status,
      };
    }

    const body = (await response.json().catch(() => ({}))) as CloudApiSuccess;

    return { ok: true, messageId: body.messages?.[0]?.id ?? null };
  } catch {
    // Transport, not API — see the note at the top. Deliberately without the
    // error object: an outcome and a status debug this, and nothing about the
    // message or the number belongs in a log line.
    return { ok: false, reason: "request_failed", statusCode: null };
  }
}

/**
 * The Monday notification — a template, because it is business-initiated.
 *
 * Outside the 24-hour customer service window only a provider-approved template
 * may be sent. `WHATSAPP_DIGEST_TEMPLATE` names the one a human registered;
 * `templateVariables` states the positional order of its body variables, so no
 * call site has to guess what `{{1}}` means.
 */
export function sendWhatsAppDigestTemplate({
  to,
  weekLabel,
}: {
  to: string;
  weekLabel: string;
}): Promise<WhatsAppSendResult> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: WHATSAPP_DIGEST_TEMPLATE.name,
      language: { code: WHATSAPP_DIGEST_TEMPLATE.language },
      components: [
        {
          type: "body",
          parameters: templateVariables(weekLabel).map((text) => ({
            type: "text",
            text,
          })),
        },
      ],
    },
  });
}

/**
 * The digest itself — free-form text, and only ever IN REPLY to an inbound
 * message, which is what opens the 24-hour window this is permitted in.
 *
 * Nothing calls this on a schedule, and nothing should: a business-initiated
 * free-form send is refused by the platform with `outside_window`.
 */
export function sendWhatsAppText({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<WhatsAppSendResult> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: false },
  });
}
