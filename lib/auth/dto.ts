import "server-only";

import type { StaffUser } from "@/lib/generated/prisma/client";
import type { StaffRole } from "@/lib/generated/prisma/enums";

/**
 * The serialisable shape a client component may receive.
 *
 * Client Components cannot import the DAL, so the shell resolves the user
 * server-side and passes this across as props. It deliberately carries no id
 * and no timestamps: nothing in the browser needs them, and a database id in
 * client props is one more thing to keep out of an analytics payload.
 *
 * The role is here for its *label* only — the nav shows "Research Officer". It
 * is not an authorisation source. Every predicate lives in
 * `lib/auth/authorize.ts` and runs server-side (AGENTS.md §10.1, §10.10).
 */
export type StaffUserDto = {
  name: string;
  email: string;
  role: StaffRole;
  initials: string;
};

function initialsFrom(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  const single = parts[0] ?? email;
  return single.slice(0, 2).toUpperCase();
}

export function toStaffUserDto(user: StaffUser): StaffUserDto {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    initials: initialsFrom(user.name, user.email),
  };
}
