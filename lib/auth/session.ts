import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { findStaffUserById } from "@/lib/db";
import { setStaffScope } from "@/lib/observability/capture";
import type { StaffUser } from "@/lib/generated/prisma/client";
import type { StaffRole } from "@/lib/generated/prisma/enums";

/**
 * The session Data Access Layer.
 *
 * Next's authentication guide is explicit that layouts do not re-render on
 * navigation, so the check belongs close to the data source: every page and
 * every Server Action resolves the caller here rather than trusting an
 * ancestor layout to have done it.
 *
 * `React.cache` memoises per render pass, so a layout and its page share one
 * database round-trip.
 */

export const getSession = cache(async (): Promise<Session | null> => auth());

/**
 * Resolves the signed-in `StaffUser` row — including its role — from the
 * database. The role is never read from the token, so a promotion or demotion
 * applied in the database takes effect on the very next request.
 *
 * A session whose `staffUserId` no longer resolves to a row (a deleted user) is
 * treated as unauthenticated. Not a crash, and not a silent `null` a caller
 * might forget to check.
 */
export const getCurrentStaffUser = cache(async (): Promise<StaffUser | null> => {
  const session = await getSession();
  const staffUserId = session?.user?.staffUserId;

  if (!staffUserId) return null;

  const staffUser = await findStaffUserById(staffUserId);

  // The one place a resolved staff identity exists on every request path, so it
  // is where the error reporter learns who was on the screen. Id and role only,
  // never email or name (§18) — and the direction of the import matters: auth
  // depends on observability, never the reverse, so the error reporter stays a
  // leaf with no database in it.
  if (staffUser) setStaffScope(staffUser.id, staffUser.role);

  return staffUser;
});

/**
 * Where a signed-in person belongs. A Field Officer's surface is `/field`;
 * every other role starts on the daily-use Signals screen.
 *
 * This is routing, not access control — `/signals` still resolves the caller
 * itself, and every Server Action still authorises server-side (§10.1).
 */
export function landingPathForRole(role: StaffRole): string {
  return role === "field_officer" ? "/field" : "/signals";
}

/** Unauthenticated callers go to the sign-in screen. */
export async function requireStaffUser(): Promise<StaffUser> {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) redirect("/signin");

  return staffUser;
}

/**
 * Role gate for a *render* path. The action layer refuses separately and
 * server-side — a rendered gate is never the enforcement boundary
 * (AGENTS.md §10.1).
 *
 * Returns `null` when the role does not match so the caller can render a calm
 * "not available for your role" panel rather than an error page. `forbidden()`
 * is not used: it requires `experimental.authInterrupts`, and this project does
 * not enable experimental flags for a convenience.
 */
export async function requireRole(
  ...roles: readonly StaffRole[]
): Promise<StaffUser | null> {
  const staffUser = await requireStaffUser();

  return roles.includes(staffUser.role) ? staffUser : null;
}
