"use server";

import { signOut } from "@/auth";

/**
 * Colocated with the shell that uses it (AGENTS.md §5.3).
 *
 * Sign out is POST-only through this action. There is no GET sign-out URL —
 * a link that ends a session can be triggered by any third-party page.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/signin" });
}
