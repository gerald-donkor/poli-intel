import { StaffRole } from "@/lib/generated/prisma/enums";

/**
 * The USSD fallback's one config table (AGENTS.md §13.1's spirit): who may dial
 * in, how much text one screen may carry, how many items a list may hold, and
 * how the gateway's accumulated keypresses become a path.
 *
 * NOT server-only. There is no credential here, only caps, a role and a pure
 * parser — the same call `lib/whatsapp/config.ts` and `lib/field/config.ts`
 * make for the same reason. `AFRICASTALKING_USSD_SECRET` and
 * `USSD_SERVICE_CODE` are read in `lib/ussd/client.ts`, which IS server-only.
 *
 * NOTHING HERE IS SCHEDULED. A USSD session is request/response only: the
 * gateway calls us, we answer with text. There is no outbound USSD and no SMS
 * on this path, so `AFRICASTALKING_USERNAME` and `AFRICASTALKING_API_KEY` are
 * not read by any module in this directory.
 */

/**
 * Who may dial in: Field Officers, and nobody else.
 *
 * THE SAME NARROWING `WHATSAPP_RECIPIENT_ROLES` MAKES, for the same reason. This
 * channel speaks only the plain language of `lib/field/plain-language.ts`; an
 * office reader wanting the kanban's vocabulary has `/signals`, and a Programme
 * Director wanting the digest on a handset is a different request that is not
 * assumed here.
 */
export const USSD_CALLER_ROLES: readonly StaffRole[] = [StaffRole.field_officer];

/**
 * How much text one screen may carry.
 *
 * 160, NOT THE 182 THAT GETS QUOTED. Africa's Talking's own help centre gives
 * the limit per telco rather than as one number — 160 characters on Safaricom,
 * 184 on Airtel — and a menu over the limit is broken up by the operator into
 * its own paginated "98:More 00:Back" screens, which would sit on top of this
 * menu's numbering and confuse it. Taking the low end means every screen this
 * module composes fits on the strictest network without the operator
 * intervening.
 *
 * Cap and truncation live in `lib/ussd/text.ts`; this is the only place the
 * number is written.
 */
export const USSD_MAX_SCREEN_CHARS = 160;

/**
 * How many items a list screen offers.
 *
 * DELIBERATELY FEWER THAN THE DIGEST HOLDS. `readFieldDigest()` returns the last
 * 30 signals and 10 briefs; three of each is what fits legibly in 160 characters
 * beside a header and a back option. What does not fit is answered with "ask the
 * office", the same escape hatch the WhatsApp cap uses — a person holding a
 * handset to their ear is not going to page through thirty items before the
 * session times out.
 */
export const USSD_MAX_SIGNALS = 3;
export const USSD_MAX_BRIEFS = 3;

/**
 * How much of a title one numbered line may spend.
 *
 * Three lines of `n. ` plus a title, a header and a back option come to roughly
 * 140 characters at this width, which leaves the screen cap headroom rather than
 * relying on it.
 */
export const USSD_MAX_ITEM_CHARS = 34;

/**
 * Inbound rate limit, per number.
 *
 * A flood of dial-ins from one handset must not spend the database's connection
 * budget. Deliberately coarse: a menu three levels wide takes at most three
 * requests to walk, so this allows two full walks a minute.
 */
export const USSD_WINDOW_MS = 60_000;
export const USSD_MAX_PER_WINDOW = 6;

/**
 * The gateway's accumulated `text` → the keypress path.
 *
 * AFRICA'S TALKING ACCUMULATES EVERY KEYPRESS OF A SESSION into this one field,
 * `*`-separated: the first request carries `""`, the second `"1"`, the third
 * `"1*2"`. ALL NAVIGATION STATE THEREFORE LIVES IN THE REQUEST, which is not a
 * convenience — it is the structural reason this endpoint cannot mutate
 * anything. There is no session table, no cache row, and no write of any kind,
 * because there is nothing for one to hold (AGENTS.md §10.9).
 *
 * Pure, and tolerant: empty segments from a doubled `*` or a trailing separator
 * are dropped rather than becoming a phantom level.
 */
export function parseUssdInput(text: string): string[] {
  return text
    .split("*")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}
