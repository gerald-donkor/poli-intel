import { StaffRole } from "@/lib/generated/prisma/enums";

/**
 * The WhatsApp digest's one config table (AGENTS.md §13.1's spirit): when it
 * wakes, who receives it, which registered template it sends, and how much text
 * one message may carry.
 *
 * NOT server-only. There is no credential here, only a cadence, a role, a
 * template name and some caps — the same call `lib/digest/config.ts` and
 * `lib/field/config.ts` make for the same reason. The four `WHATSAPP_*`
 * environment variables are read in `lib/whatsapp/client.ts`, which IS
 * server-only.
 *
 * NO PER-SOURCE CADENCE APPEARS HERE. Those live in `lib/radar/sources.ts`. The
 * cron below is when this digest is DELIVERED (§14.2).
 */

/**
 * 07:00 UTC on Mondays.
 *
 * WEEKLY, NOT DAILY — spec §3.2 gives the Field Officer a "weekly policy
 * digest", and the register is the reason as much as the spec is: a person in a
 * cocoa plot receiving a policy nudge every morning stops reading them by
 * Thursday.
 *
 * Ghana is UTC+0, so this is 07:00 in Kumasi. It sits half an hour behind the
 * morning digest's 06:30 so the office and the field are not both being written
 * to in the same minute, and well behind the radar's 05:00 fan-out so the week's
 * signals are fetched, deduplicated and classified before this reads them.
 */
export const WHATSAPP_DIGEST_CRON = "0 7 * * 1";

/**
 * Who receives it: Field Officers, and nobody else.
 *
 * A NARROWING OF `DIGEST_RECIPIENT_ROLES`, NOT A REUSE OF IT. That list
 * deliberately EXCLUDES Field Officers because a kanban-shaped email full of
 * "urgency" and "relevance" is exactly the §11.12 failure. This channel is its
 * mirror image — Field Officers only, plain language only. A Programme Director
 * wanting the same thing on WhatsApp is a different request and is not assumed
 * here.
 */
export const WHATSAPP_RECIPIENT_ROLES: readonly StaffRole[] = [
  StaffRole.field_officer,
];

/**
 * Meta's Graph API version, pinned.
 *
 * PINNED RATHER THAN FLOATING: an unversioned Graph URL silently follows Meta's
 * latest release, so a breaking change to the message shape would arrive as a
 * production failure nobody deployed. Bumping this is a deliberate edit.
 */
export const WHATSAPP_GRAPH_API_VERSION = "v25.0";

/**
 * The registered template the Monday notification uses.
 *
 * WHY A TEMPLATE AT ALL, AND WHY THIS IS NOT OPTIONAL: a business-initiated
 * WhatsApp message sent outside the 24-hour customer service window must use a
 * template the provider has approved. Free-form text is only permitted IN REPLY
 * to an inbound message. That platform rule is what splits this feature in two —
 * a short template out on Monday, the full digest back through the webhook when
 * the officer replies.
 *
 * THE TEMPLATE ITSELF IS REGISTERED BY A HUMAN, in the provider's console, and
 * is not something this code creates or can create. What lives here is the name
 * to call it by, the language it was registered in, and the ORDER of its body
 * variables — `templateVariables` below is the one place that order is stated,
 * because a template's `{{1}}` and `{{2}}` are positional and silently swap
 * meaning if a call site guesses.
 *
 * The registered body this expects, one variable:
 *
 *   "Your weekly update from Tropenbos is ready ({{1}}). Reply UPDATE and we
 *    will send it to you."
 *
 * It says a thing is ready and how to read it. It does not summarise, and it
 * does not imply anybody has decided anything (§8.8).
 */
export const WHATSAPP_DIGEST_TEMPLATE = {
  name: "weekly_policy_update",
  language: "en",
} as const;

/**
 * The body variables, in the order the registered template numbers them.
 *
 * One variable — the week's date — which also keeps each Monday's message
 * distinct rather than byte-identical to the last.
 */
export function templateVariables(weekLabel: string): readonly string[] {
  return [weekLabel];
}

/** Caps, so one busy week cannot produce a message WhatsApp truncates. */
export const WHATSAPP_MAX_SIGNALS = 5;
export const WHATSAPP_MAX_BRIEFS = 3;

/**
 * WhatsApp's own text body limit is 4096 characters. This sits well under it
 * deliberately: a digest cut off mid-sentence by the platform reads as a bug, so
 * the message is capped HERE, where the number of omitted items is known and can
 * be stated (`lib/whatsapp/message.ts`).
 */
export const WHATSAPP_MAX_BODY_CHARS = 3000;

/**
 * The keyword the Monday template asks for.
 *
 * ADVISORY, NOT A GATE. The webhook answers any inbound message from a known
 * number with the digest — a person who replies "yes" or "ok" or mistypes it
 * should not be met with silence, and there is nothing else this channel can do
 * with a message. It exists so the template's copy and the handler agree on one
 * word.
 */
export const WHATSAPP_DIGEST_KEYWORD = "UPDATE";

/**
 * Inbound rate limit, per number.
 *
 * A flood of replies from one handset must not spend the outbound message
 * budget. Deliberately coarse — one digest per number per window is plenty for a
 * read path whose content changes weekly.
 */
export const WHATSAPP_INBOUND_WINDOW_MS = 60_000;
export const WHATSAPP_INBOUND_MAX_PER_WINDOW = 3;

/**
 * The Monday a given instant belongs to, at 00:00 UTC.
 *
 * DETERMINISTIC ON PURPOSE, for the same reason `digestWindowFor` is: a manual
 * re-trigger on Wednesday must produce the same week key as Monday's scheduled
 * run, which is what makes the per-recipient idempotency key mean something.
 */
export function whatsappDigestWeek(now: Date): Date {
  const monday = new Date(now);
  // `getUTCDay()` is 0 for Sunday, so Sunday belongs to the week that began six
  // days earlier rather than to the one starting tomorrow.
  const daysSinceMonday = (monday.getUTCDay() + 6) % 7;

  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);

  return monday;
}

/** The date half of the idempotency key, and the template's one variable. */
export function whatsappWeekKey(monday: Date): string {
  return monday.toISOString().slice(0, 10);
}

/**
 * `whatsapp-digest/<staffUserId>/<YYYY-MM-DD>` — one key per officer per week,
 * so re-running Monday's job sends nothing a second time.
 */
export function whatsappIdempotencyKey(
  staffUserId: string,
  weekKey: string,
): string {
  return `whatsapp-digest/${staffUserId}/${weekKey}`;
}

/**
 * Digits only, no `+`, no spaces, no punctuation.
 *
 * THE CANONICAL FORM, and the reason one exists: the Cloud API's inbound
 * `messages[].from` is digits-only international, while a human typing a number
 * into `db:studio` will write `+233 24 123 4567` about half the time. Both sides
 * of the lookup go through here so the two forms cannot fail to match.
 *
 * Pure, and returns `null` for anything that is not plausibly a number — an
 * inbound `from` is attacker-controllable, so nothing is passed to a query until
 * it has been reduced to digits (§18).
 */
export function normaliseWhatsappNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "");

  // Shortest plausible international number is 8 digits, longest E.164 is 15.
  if (digits.length < 8 || digits.length > 15) return null;

  return digits;
}
