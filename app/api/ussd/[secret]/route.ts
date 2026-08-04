import type { NextRequest } from "next/server";

import { findStaffUserByWhatsappNumber, readFieldDigest } from "@/lib/db";
import { constantTimeEquals } from "@/lib/net/secret";
import { ussdSecret, ussdServiceCode } from "@/lib/ussd/client";
import {
  USSD_CALLER_ROLES,
  USSD_MAX_PER_WINDOW,
  USSD_WINDOW_MS,
  parseUssdInput,
} from "@/lib/ussd/config";
import { buildUssdScreen, type UssdScreen } from "@/lib/ussd/menu";
import { normaliseWhatsappNumber } from "@/lib/whatsapp/config";

/**
 * The USSD fallback — the same weekly digest, on a handset with no smartphone,
 * no data bundle and no app (spec §3.2's Field Officer row, §5.2 step 6).
 *
 * WHY A ROUTE HANDLER: the caller is Africa's Talking's gateway, a machine,
 * which is exactly what §5.2 keeps Route Handlers for. It is thin by rule —
 * verify, resolve, answer — and every decision it makes lives in `lib/ussd/`.
 *
 * READ-ONLY, AND ENFORCED STRUCTURALLY RATHER THAN BY INTENT. This file imports
 * no Server Action and writes to no table: its only data-layer calls are
 * `findStaffUserByWhatsappNumber` and `readFieldDigest`, both pure reads. There
 * is no `create`, `update`, `delete` or `upsert` anywhere in its import graph.
 * It never advances a signal, never touches a brief's status, never sets a
 * classification, and never creates evidence. Field submission by USSD is
 * deliberately NOT in scope — that is a write from an unauthenticated channel,
 * which is precisely what §10.9 forbids.
 *
 * THE SESSION IS STATELESS, AND THAT IS WHAT KEEPS IT READ-ONLY. Africa's
 * Talking accumulates every keypress of a session into the `text` field, so all
 * navigation state arrives in the request. There is no session table and no
 * cache row, because there is nothing for one to hold.
 *
 * ACCESS CONTROL IS THE PATH SECRET PLUS THE SERVICE CODE. There is no session
 * here by design, and no login does not mean no verification — the trade-off
 * that comes with a path secret rather than a body signature is stated in
 * `lib/ussd/client.ts` rather than hidden.
 *
 * IT LOGS NOTHING ABOUT THE SESSION. Not the phone number, not the keypress
 * path, not the composed screen. A phone number is personal data (§18) and a
 * screen is content (§7.6).
 *
 * NO GEMINI CALL FIRES HERE. Nothing in this file's import graph reaches
 * `lib/ai/` or `lib/governance/`, and every screen is assembled by a pure
 * function from stored rows.
 */

/**
 * Per-number dial-in throttle.
 *
 * IN MEMORY, AND HONESTLY SO: this path may not write to the database, which
 * rules out a counter table, and adding one would breach the read-only rule this
 * endpoint exists to hold. The consequence is stated rather than hidden — the
 * window is per server instance, so a caller spread across instances gets a
 * higher effective ceiling. That is acceptable for a limit whose job is blunting
 * a flood rather than metering a quota.
 *
 * Keyed by the NORMALISED number and never logged.
 */
const sessionHits = new Map<string, number[]>();

function withinRateLimit(number: string, now: number): boolean {
  const cutoff = now - USSD_WINDOW_MS;
  const recent = (sessionHits.get(number) ?? []).filter((at) => at > cutoff);

  if (recent.length >= USSD_MAX_PER_WINDOW) {
    sessionHits.set(number, recent);

    return false;
  }

  recent.push(now);
  sessionHits.set(number, recent);

  // Bounded so a long-lived instance cannot accumulate an entry per number that
  // ever dialled it. Oldest-inserted first, which Map iteration gives for free.
  if (sessionHits.size > 1000) {
    const oldest = sessionHits.keys().next();

    if (!oldest.done) sessionHits.delete(oldest.value);
  }

  return true;
}

/**
 * The gateway reads the first three characters of the body, so `CON ` and `END `
 * are protocol rather than presentation.
 *
 * `text/plain`, because that is what the gateway parses; anything else is
 * delivered to the handset verbatim, markup and all.
 */
function respond({ kind, body }: UssdScreen): Response {
  return new Response(`${kind} ${body}`, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * NEUTRAL, AND IT DISCLOSES NOTHING. A number that is not a registered Field
 * Officer — or a staff member whose role is not on this channel — is not told
 * whether it is known, is not told that staff exist, and is not served the
 * digest. Anyone can dial a short code, including by mistyping a digit.
 */
const UNKNOWN_CALLER_REPLY =
  "This service sends policy updates to registered Tropenbos field officers only. Please contact the Tropenbos Ghana office.";

/**
 * OVER THE LIMIT GETS WORDS, NEVER SILENCE. A USSD caller who receives nothing
 * is looking at their network's error screen, which reads as a fault at
 * Tropenbos rather than as a throttle.
 */
const RATE_LIMITED_REPLY = "Too many requests just now. Please try again shortly.";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  const expectedSecret = ussdSecret();
  const expectedServiceCode = ussdServiceCode();

  // Not configured is a clean refusal, not a 500 — a local `npm run dev` with no
  // credentials must not throw at a caller, and a deployment missing either
  // value has no way to verify who is calling.
  if (expectedSecret === null || expectedServiceCode === null) {
    return new Response(null, { status: 403 });
  }

  const { secret } = await params;

  // FIRST, AND BEFORE THE BODY IS TOUCHED. An unverified caller's request is not
  // parsed, not logged, and not acted on.
  if (!constantTimeEquals(secret, expectedSecret)) {
    return new Response(null, { status: 403 });
  }

  // Africa's Talking posts a plain form: `sessionId`, `serviceCode`,
  // `phoneNumber`, `text`. `networkCode` is also sent and is deliberately not
  // read — nothing here varies by operator.
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return new Response(null, { status: 400 });
  }

  const sessionId = readField(form, "sessionId");
  const serviceCode = readField(form, "serviceCode");
  const phoneNumber = readField(form, "phoneNumber");
  // `text` is empty on the first request of a session, so it is present-but-empty
  // rather than missing — `null` means the gateway did not send the field.
  const text = readField(form, "text", { allowEmpty: true });

  if (
    sessionId === null ||
    serviceCode === null ||
    phoneNumber === null ||
    text === null
  ) {
    return new Response(null, { status: 400 });
  }

  // THE SECOND, INDEPENDENT CHECK, so a leaked callback URL is not by itself a
  // key to the digest.
  if (!constantTimeEquals(serviceCode, expectedServiceCode)) {
    return new Response(null, { status: 403 });
  }

  // Attacker-controllable, so it is reduced to digits before it reaches a query
  // (§18). An implausible value is answered neutrally, exactly as an unknown
  // number is, so the two are indistinguishable from outside.
  const number = normaliseWhatsappNumber(phoneNumber);

  if (number === null) {
    return respond({ kind: "END", body: UNKNOWN_CALLER_REPLY });
  }

  if (!withinRateLimit(number, Date.now())) {
    return respond({ kind: "END", body: RATE_LIMITED_REPLY });
  }

  const staffUser = await findStaffUserByWhatsappNumber(number);

  if (staffUser === null || !USSD_CALLER_ROLES.includes(staffUser.role)) {
    return respond({ kind: "END", body: UNKNOWN_CALLER_REPLY });
  }

  const digest = await readFieldDigest();

  return respond(buildUssdScreen(digest, parseUssdInput(text)));
}

/**
 * One form field as a string, or `null` when absent.
 *
 * `formData()` returns `File` for an uploaded part, so the type is narrowed
 * rather than coerced — a `File` here is a malformed request, not a value to
 * stringify into a menu.
 */
function readField(
  form: FormData,
  name: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): string | null {
  const value = form.get(name);

  if (typeof value !== "string") return null;

  return value.length === 0 && !allowEmpty ? null : value;
}
