import "server-only";

import type { ReactElement } from "react";

import { emailConfig, resendClient } from "./client";

/**
 * One send, with the `{ data, error }` contract handled and a typed result.
 *
 * THE SDK'S `error` IS CHECKED EXPLICITLY. The Resend Node SDK does not throw
 * for API errors — it returns them — so a `try`/`catch` in place of that check
 * would silently treat every 4xx as a success. The `catch` below is for
 * transport failures only (DNS, a dropped socket), which is a different thing
 * and is labelled as such.
 *
 * A FAILURE IS RETURNED, NEVER THROWN. That is what gives the digest job its
 * per-recipient failure isolation: one bad address is one `ok: false`, and the
 * remaining recipients still get theirs (`inngest-jobs` rule 5, applied per
 * recipient).
 *
 * NOTHING ABOUT THE MESSAGE IS LOGGED OR RETURNED. No subject line's contents,
 * no recipient name, no rendered body — an email is an egress path, and its
 * failure record is an id, a machine reason, and a status code (§7.6, §13.9).
 */

export type SendResult =
  | { ok: true; emailId: string | null }
  /** Resend recognised the key and payload as one it has already sent today. */
  | { ok: true; emailId: null; deduped: true }
  | { ok: false; reason: SendFailureReason; statusCode: number | null };

export type SendFailureReason =
  | "not_configured"
  | "rejected"
  | "rate_limited"
  | "request_failed";

export async function sendTransactionalEmail({
  to,
  subject,
  react,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  react: ReactElement;
  idempotencyKey: string;
}): Promise<SendResult> {
  const config = emailConfig();

  if (config === null) {
    return { ok: false, reason: "not_configured", statusCode: null };
  }

  try {
    const { data, error } = await resendClient(config.apiKey).emails.send(
      { from: config.from, to: [to], subject, react },
      { idempotencyKey },
    );

    if (error) {
      // 409 is the idempotency key colliding with a DIFFERENT payload. Nothing
      // was sent, which is the outcome the key exists to produce, so it is a
      // success for the caller's purposes and is named rather than counted as a
      // failure the reader would have to interpret.
      if (error.statusCode === 409) {
        return { ok: true, emailId: null, deduped: true };
      }

      return {
        ok: false,
        reason: error.statusCode === 429 ? "rate_limited" : "rejected",
        statusCode: error.statusCode,
      };
    }

    return { ok: true, emailId: data?.id ?? null };
  } catch {
    // Transport, not API — see the note at the top. Deliberately without the
    // error object: an outcome and a status debug this, and nothing about the
    // message belongs in a log line.
    return { ok: false, reason: "request_failed", statusCode: null };
  }
}
