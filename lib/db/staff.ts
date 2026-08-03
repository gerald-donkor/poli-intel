import "server-only";

import type { StaffUser } from "@/lib/generated/prisma/client";
import { StaffRole } from "@/lib/generated/prisma/enums";
import { normaliseWhatsappNumber } from "@/lib/whatsapp/config";

import { prisma } from "./client";

/**
 * StaffUser reads and the sign-in provisioning write. Prisma stays in the data
 * layer: `auth.ts` and `lib/auth/*` call these functions and never construct a
 * client themselves (AGENTS.md §5.2).
 */

export function findStaffUserById(id: string): Promise<StaffUser | null> {
  return prisma.staffUser.findUnique({ where: { id } });
}

export function findStaffUserByEmail(email: string): Promise<StaffUser | null> {
  return prisma.staffUser.findUnique({ where: { email } });
}

/**
 * First sign-in auto-provisions at the least-privileged role.
 *
 * The domain check in `auth.ts` has already established the person is
 * Tropenbos staff, so refusing them entirely would leave no way in — but
 * granting anything above `field_officer` on the strength of an email domain
 * would hand out brief generation or classification authority automatically.
 * `field_officer` is mobile submission and digest reading only (AGENTS.md
 * §10.5).
 *
 * The role is set here, at the single provisioning call site, rather than as a
 * `@default` in `schema.prisma` — so no migration is needed to introduce it.
 *
 * This is an upsert on `email`, and `update` deliberately touches `name` only:
 * a name change at Google flows through, and a role assigned later by a
 * Programme Director is never reset on a subsequent sign-in.
 */
export function provisionStaffUser({
  email,
  name,
}: {
  email: string;
  name: string;
}): Promise<StaffUser> {
  return prisma.staffUser.upsert({
    where: { email },
    update: { name },
    create: { email, name, role: StaffRole.field_officer },
  });
}

/** One officer the weekly WhatsApp digest is sent to. */
export type WhatsappRecipient = {
  id: string;
  role: StaffRole;
  whatsappNumber: string;
};

/**
 * Who the weekly WhatsApp digest goes to, resolved server-side from `StaffUser`.
 *
 * NO NUMBER EVER COMES FROM INPUT, a query parameter, or an event payload — the
 * same rule `listDigestRecipients` states for addresses. A null
 * `whatsappNumber` means not subscribed, so the `not: null` filter IS the
 * subscription check; there is no second table and no active flag.
 *
 * NEITHER `name` NOR `email` IS SELECTED. The job logs a staff user id and an
 * outcome and nothing else, so there is no field here through which a person's
 * name could reach a log line (§7.6).
 */
export async function listWhatsappRecipients(
  roles: readonly StaffRole[],
): Promise<WhatsappRecipient[]> {
  const rows = await prisma.staffUser.findMany({
    where: { role: { in: [...roles] }, whatsappNumber: { not: null } },
    orderBy: { id: "asc" },
    select: { id: true, role: true, whatsappNumber: true },
  });

  return rows.flatMap((row) =>
    row.whatsappNumber === null
      ? []
      : [{ id: row.id, role: row.role, whatsappNumber: row.whatsappNumber }],
  );
}

/**
 * The inbound webhook's one read: which staff user, if any, this number belongs
 * to.
 *
 * THE NUMBER IS NORMALISED BEFORE IT REACHES THE QUERY. An inbound `from` is
 * attacker-controllable, so it is reduced to digits first and a value that is
 * not plausibly a phone number never becomes a query at all (§18). An unknown
 * number returning `null` is the ordinary case, not an error — the caller
 * answers it neutrally without disclosing whether it is known.
 *
 * BOTH STORED FORMS ARE TRIED, because a human setting this in `db:studio` may
 * reasonably type `+233...` even though the canonical form is digits-only. Two
 * exact lookups rather than a `contains`, which would let a short number match a
 * longer one's suffix.
 */
export async function findStaffUserByWhatsappNumber(
  rawNumber: string,
): Promise<StaffUser | null> {
  const digits = normaliseWhatsappNumber(rawNumber);

  if (digits === null) return null;

  return prisma.staffUser.findFirst({
    where: { whatsappNumber: { in: [digits, `+${digits}`] } },
  });
}
