import "server-only";

import type { StaffUser } from "@/lib/generated/prisma/client";
import { StaffRole } from "@/lib/generated/prisma/enums";

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
