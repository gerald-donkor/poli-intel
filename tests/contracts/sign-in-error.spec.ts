import { expect, test } from "@playwright/test";

import { AuthError } from "next-auth";

import { signInErrorCode } from "@/lib/auth/sign-in-error";

test.describe("Sign-in error recovery", () => {
  test("keeps access denial user-readable", () => {
    const error = new AuthError("AccessDenied");
    Object.defineProperty(error, "type", { value: "AccessDenied" });

    expect(signInErrorCode(error)).toBe("AccessDenied");
  });

  test("does not expose Auth.js or database error details", () => {
    expect(
      signInErrorCode(new Error("postgres connection string and token")),
    ).toBe("SignInError");
    expect(signInErrorCode(new AuthError("CallbackRouteError"))).toBe(
      "SignInError",
    );
  });
});
