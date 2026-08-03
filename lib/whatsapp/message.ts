import type { FieldDigestPayload } from "@/lib/db/field";
import {
  BRIEF_STATUS_PLAIN_LABEL,
  URGENCY_PLAIN_LABEL,
  plainDate,
} from "@/lib/field/plain-language";

import {
  WHATSAPP_MAX_BODY_CHARS,
  WHATSAPP_MAX_BRIEFS,
  WHATSAPP_MAX_SIGNALS,
} from "./config";

/**
 * `readFieldDigest()`'s payload → the plain-text message an officer reads on a
 * handset.
 *
 * PURE, AND THAT IS THE POINT. The whole message can be read, tested and
 * reviewed without credentials, a network, or a provider account — the same call
 * `lib/digest/build.ts` makes. No `fetch`, no Prisma, no environment.
 *
 * IT DECLARES NO LABEL OF ITS OWN. Every word describing a signal or a brief
 * comes from `lib/field/plain-language.ts`, which is where §11.12 is enforced.
 * A label written inline here would be a second vocabulary for the same surface
 * and would drift from `/field` within a release. No "signal", no "urgency", no
 * "relevance", no classification value, no brief id.
 *
 * IT CARRIES NO EVIDENCE AND NO BRIEF BODY. `FieldDigestPayload` has no field
 * through which an evidence title, excerpt, body or citation key could arrive —
 * `readFieldDigest` selects no column from `evidence_item` or `evidence_chunk`
 * (§7.6). That read is not to be widened to serve this channel; if a future
 * message wants evidence, that is a governance decision and a different prompt.
 *
 * NOTHING HERE IMPLIES THE SYSTEM DECIDED ANYTHING (§8.8). It reports what
 * exists and when, and the brief labels are "Sent to the people it was written
 * for", never "approved" or "verified".
 */

/**
 * The whole message, capped.
 *
 * CAPPED HERE RATHER THAN BY THE PLATFORM. WhatsApp truncates a body over 4096
 * characters, and a digest cut off mid-sentence reads as a bug. Cutting it at a
 * known point is what makes it possible to SAY how many items were left out
 * instead of silently losing them.
 */
export function buildWhatsappDigest(payload: FieldDigestPayload): string {
  const signals = payload.signals.slice(0, WHATSAPP_MAX_SIGNALS);
  const briefs = payload.briefs.slice(0, WHATSAPP_MAX_BRIEFS);

  const omittedSignals = payload.signals.length - signals.length;
  const omittedBriefs = payload.briefs.length - briefs.length;

  const lines: string[] = [
    `Tropenbos weekly update — ${plainDate(payload.generatedAt)}`,
  ];

  if (signals.length > 0) {
    lines.push("", "What is happening in policy:");

    for (const signal of signals) {
      lines.push(
        "",
        `• ${signal.title}`,
        `  ${URGENCY_PLAIN_LABEL[signal.urgency]}`,
        `  ${signal.summaryText}`,
      );
    }

    if (omittedSignals > 0) {
      lines.push(
        "",
        `And ${omittedSignals} more ${omittedSignals === 1 ? "update" : "updates"} not shown here.`,
      );
    }
  }

  if (briefs.length > 0) {
    lines.push("", "Papers the office has written:");

    for (const brief of briefs) {
      lines.push("", `• ${brief.title}`, `  ${BRIEF_STATUS_PLAIN_LABEL[brief.status]}`);
    }

    if (omittedBriefs > 0) {
      lines.push(
        "",
        `And ${omittedBriefs} more not shown here.`,
      );
    }
  }

  // A week with nothing in it still gets an honest answer rather than an empty
  // message — the officer asked, and silence would read as a broken service.
  if (signals.length === 0 && briefs.length === 0) {
    lines.push("", "There is nothing new to report this week.");
  }

  return capBody(lines.join("\n"));
}

/**
 * Cut on a line boundary, and say that it was cut.
 *
 * Mid-word truncation is the failure this whole function exists to avoid, so the
 * cut walks back to the last complete line rather than slicing at the character.
 */
function capBody(body: string): string {
  if (body.length <= WHATSAPP_MAX_BODY_CHARS) return body;

  const notice = "\n\nThis update was shortened. Ask the office for the rest.";
  const room = WHATSAPP_MAX_BODY_CHARS - notice.length;
  const cut = body.slice(0, room);
  const lastBreak = cut.lastIndexOf("\n");

  return `${(lastBreak > 0 ? cut.slice(0, lastBreak) : cut).trimEnd()}${notice}`;
}

/**
 * What an inbound message from a number this system does not know is answered
 * with.
 *
 * NEUTRAL AND NON-COMMITTAL BY DESIGN. It must not disclose whether the number is
 * known, must not name Tropenbos staff, and must not send the digest. Anyone can
 * message a business number, including by mistyping a digit.
 */
export const WHATSAPP_UNKNOWN_SENDER_REPLY =
  "Thanks for your message. This number sends policy updates to registered Tropenbos field officers only, and it cannot take replies or reports. Please contact the Tropenbos Ghana office directly.";
