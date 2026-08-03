import type { NextRequest } from "next/server";

import { findStaffUserByWhatsappNumber, readFieldDigest } from "@/lib/db";
import { whatsappVerifyToken, whatsappWebhookSecret } from "@/lib/whatsapp/client";
import {
  WHATSAPP_INBOUND_MAX_PER_WINDOW,
  WHATSAPP_INBOUND_WINDOW_MS,
  WHATSAPP_RECIPIENT_ROLES,
  normaliseWhatsappNumber,
} from "@/lib/whatsapp/config";
import {
  WHATSAPP_UNKNOWN_SENDER_REPLY,
  buildWhatsappDigest,
} from "@/lib/whatsapp/message";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { verifyTokenMatches, verifyWebhookSignature } from "@/lib/whatsapp/verify";

/**
 * The reverse read path — the officer asks, and the digest comes back with NO
 * LOGIN AT ALL (AGENTS.md §10.9, spec §5.2 step 6).
 *
 * WHY A ROUTE HANDLER: the caller is Meta's webhook, a machine, which is exactly
 * what §5.2 keeps Route Handlers for. It is thin by rule — verify, resolve,
 * reply — and every decision it makes lives in `lib/whatsapp/`.
 *
 * READ-ONLY, AND ENFORCED STRUCTURALLY RATHER THAN BY INTENT. This file imports
 * no Server Action and writes to no table: its only data-layer calls are
 * `findStaffUserByWhatsappNumber` and `readFieldDigest`, both pure reads. It
 * never advances a signal, never touches a brief's status, never sets a
 * classification, and never creates evidence. A field observation submitted by
 * WhatsApp is deliberately NOT in scope — that is a write from an
 * unauthenticated channel, which is precisely what §10.9 forbids. An unrecognised
 * reply is answered with the digest anyway; it is never interpreted as a
 * submission.
 *
 * SIGNATURE VERIFICATION IS THE ACCESS CONTROL. There is no session here by
 * design, so no login does not mean no verification — see `lib/whatsapp/verify.ts`.
 *
 * IT LOGS NOTHING ABOUT THE MESSAGE. Not the officer's reply text, not their
 * number, not the composed digest. A phone number is personal data (§18) and the
 * reply is content (§7.6).
 *
 * NO GEMINI CALL FIRES HERE. Nothing in this file's import graph reaches
 * `lib/ai/`, and the digest is assembled by a pure function from stored rows.
 */

/**
 * Per-number inbound throttle, so a flood of replies from one handset cannot
 * spend the outbound message budget.
 *
 * IN MEMORY, AND HONESTLY SO: this path may not write to the database, which
 * rules out a counter table, and adding one would breach the read-only rule this
 * endpoint exists to hold. The consequence is stated rather than hidden — the
 * window is per server instance, so a caller spread across instances gets a
 * higher effective ceiling. That is acceptable for a limit whose job is blunting
 * a flood rather than metering a quota, and the ceiling is low enough that even
 * several instances' worth stays cheap.
 *
 * Keyed by the NORMALISED number and never logged.
 */
const inboundHits = new Map<string, number[]>();

function withinRateLimit(number: string, now: number): boolean {
  const cutoff = now - WHATSAPP_INBOUND_WINDOW_MS;
  const recent = (inboundHits.get(number) ?? []).filter((at) => at > cutoff);

  if (recent.length >= WHATSAPP_INBOUND_MAX_PER_WINDOW) {
    inboundHits.set(number, recent);

    return false;
  }

  recent.push(now);
  inboundHits.set(number, recent);

  // Bounded so a long-lived instance cannot accumulate an entry per number that
  // ever messaged it. Oldest-inserted first, which Map iteration gives for free.
  if (inboundHits.size > 1000) {
    const oldest = inboundHits.keys().next();

    if (!oldest.done) inboundHits.delete(oldest.value);
  }

  return true;
}

/**
 * The provider's one-time subscription handshake.
 *
 * Echoes `hub.challenge` ONLY when `hub.mode` is `subscribe` and the token
 * matches, compared in constant time. A wrong token gets a 403 and no challenge,
 * which is what stops somebody else pointing their app at this URL.
 */
export function GET(request: NextRequest) {
  const expected = whatsappVerifyToken();

  if (expected === null) {
    // Not configured is a clean refusal, not a 500 — a local `npm run dev` with
    // no credentials must not throw at a caller.
    return new Response(null, { status: 403 });
  }

  const params = request.nextUrl.searchParams;

  if (
    params.get("hub.mode") !== "subscribe" ||
    !verifyTokenMatches(params.get("hub.verify_token"), expected)
  ) {
    return new Response(null, { status: 403 });
  }

  return new Response(params.get("hub.challenge") ?? "", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/** The shape this handler reads out of the notification, and nothing more. */
type InboundPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: Array<{ from?: string }> };
    }>;
  }>;
};

export async function POST(request: NextRequest) {
  const secret = whatsappWebhookSecret();

  if (secret === null) {
    // No secret means no way to verify the caller, so there is no safe way to
    // act on the body. A named refusal rather than a 500 or an unverified read.
    return new Response(null, { status: 403 });
  }

  // THE RAW BODY, NOT A RE-SERIALISED `request.json()`. Meta signs the exact
  // bytes it sent, and JSON round-tripping changes key order and whitespace, so
  // a re-serialised body would never match its own signature. `request.text()`
  // is the documented Route Handler webhook path in Next 16.2.
  const rawBody = await request.text();

  if (
    !verifyWebhookSignature({
      rawBody,
      signatureHeader: request.headers.get("x-hub-signature-256"),
      secret,
    })
  ) {
    // NOT PARSED, NOT LOGGED, NOT ACTED ON. An unverified body is an unknown
    // caller's, and the only correct thing to do with it is nothing.
    return new Response(null, { status: 401 });
  }

  let payload: InboundPayload;

  try {
    payload = JSON.parse(rawBody) as InboundPayload;
  } catch {
    return new Response(null, { status: 400 });
  }

  // A verified notification is answered 200 whatever happens downstream: Meta
  // retries a non-200, and retrying will not make an unknown number known or an
  // unconfigured deployment configured. Failures are handled here, not deferred
  // to a redelivery.
  await Promise.all(
    collectSenders(payload).map((sender) => replyToSender(sender)),
  );

  return new Response(null, { status: 200 });
}

/**
 * Every distinct sender in the notification.
 *
 * Deduplicated: one notification may batch several messages from the same
 * person, and each deserves one digest, not three.
 */
function collectSenders(payload: InboundPayload): string[] {
  const senders = new Set<string>();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        // Status callbacks (delivered/read) carry no `messages`, so they fall
        // out here without a special case.
        if (message.from) senders.add(message.from);
      }
    }
  }

  return [...senders];
}

/**
 * One sender, one reply.
 *
 * THE MESSAGE TEXT IS NEVER READ. Nothing branches on what the officer typed —
 * any inbound message from a known number is a request for the digest, because
 * that is the only thing this channel can do. A keyword check would only
 * manufacture a way to reply and get silence.
 */
async function replyToSender(from: string): Promise<void> {
  const number = normaliseWhatsappNumber(from);

  if (number === null) return;

  if (!withinRateLimit(number, Date.now())) return;

  const staffUser = await findStaffUserByWhatsappNumber(number);

  // NEUTRAL, AND IT DISCLOSES NOTHING. An unknown number — or a staff member
  // whose role is not on this channel — is not told whether it is known, and is
  // not sent the digest. Anyone can message a business number, including by
  // mistyping a digit.
  if (
    staffUser === null ||
    !WHATSAPP_RECIPIENT_ROLES.includes(staffUser.role)
  ) {
    await sendWhatsAppText({ to: from, body: WHATSAPP_UNKNOWN_SENDER_REPLY });

    return;
  }

  const digest = await readFieldDigest();

  await sendWhatsAppText({ to: from, body: buildWhatsappDigest(digest) });
}
