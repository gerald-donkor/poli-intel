"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { signIn } from "@/auth";

import { signInErrorCode } from "@/lib/auth/sign-in-error";

/**
 * Colocated with the route that uses it (AGENTS.md §5.3).
 *
 * Redirects to `/`, which resolves the landing surface from the role in the
 * database rather than from anything the browser supplied.
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    // Auth.js throws its redirect response on success. Do not catch that
    // control-flow exception: it is what moves the browser to Google.
    await signIn("google", { redirectTo: "/" });
  } catch (error) {
    // `redirect()` is implemented as a thrown control-flow error. Preserve
    // Auth.js' successful redirect to Google instead of treating it as a
    // failed sign-in.
    if (isRedirectError(error)) throw error;

    // Server Actions use Auth.js' raw mode, so expected AuthError instances
    // can otherwise escape as an unrendered action failure and leave the
    // submit state looking permanent. Convert only the safe, user-facing
    // error code into the existing sign-in page state.
    const code = signInErrorCode(error);

    if (error instanceof AuthError) {
      console.warn("[auth] sign-in action ended with an Auth.js error", {
        type: error.type,
        code,
      });
    } else {
      console.error("[auth] sign-in action ended unexpectedly", { code });
    }

    redirect(`/signin?error=${encodeURIComponent(code)}`);
  }
}
