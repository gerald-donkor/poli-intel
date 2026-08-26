import { AuthError } from "@auth/core/errors";

/**
 * Keep Auth.js' internal error details out of the browser. The sign-in page
 * only needs to distinguish an access decision from an interrupted attempt.
 */
export type SignInErrorCode = "AccessDenied" | "SignInError";

export function signInErrorCode(error: unknown): SignInErrorCode {
  return error instanceof AuthError && error.type === "AccessDenied"
    ? "AccessDenied"
    : "SignInError";
}
