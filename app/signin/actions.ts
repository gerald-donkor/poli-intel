"use server";

import { signIn } from "@/auth";

/**
 * Colocated with the route that uses it (AGENTS.md §5.3).
 *
 * Redirects to `/`, which resolves the landing surface from the role in the
 * database rather than from anything the browser supplied.
 */
export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/" });
}
