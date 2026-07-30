import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCurrentStaffUser, landingPathForRole } from "@/lib/auth/session";

import { signInWithGoogle } from "./actions";
import { SignInButton } from "./sign-in-button";

export const metadata: Metadata = {
  title: "Sign in · EviBrief",
};

// Auth.js redirects here with `?error=` because `pages.error` points at this
// route — no default Auth.js UI is ever reachable. `AccessDenied` is what the
// `signIn` callback's `false` produces, which for this product means exactly
// one thing: the identity is not a verified account on the Workspace domain.
function alertCopy(errorCode: string | undefined) {
  if (!errorCode) return null;

  if (errorCode === "AccessDenied") {
    return {
      title: "That account can't sign in here",
      description:
        "EviBrief is restricted to the Tropenbos Ghana Workspace. Sign in with your work account.",
    };
  }

  return {
    title: "Sign-in didn't complete",
    description: "Something interrupted the sign-in. Try again.",
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const staffUser = await getCurrentStaffUser();
  if (staffUser) redirect(landingPathForRole(staffUser.role));

  const { error } = await searchParams;
  const alert = alertCopy(Array.isArray(error) ? error[0] : error);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      {/* The handoff's card recipe verbatim. Deliberately not the installed
          `Card`: its own chrome is `rounded-xl` with a `ring-1` instead of a
          hairline border, which fights the 6px radius and `line` border the
          design system fixes for every surface in this product. */}
      <div className="bg-card border-line rounded-card shadow-raised flex w-full max-w-[400px] flex-col gap-6 border p-6 tablet:p-8">
        {/* Abstract structural mark: a sage circle inside two contour rings,
            the topographic motif. Pure CSS — no image, no SVG, no logo asset
            (AGENTS.md §11.7). The rings extend 20px past the box, so the
            wrapper reserves the clear space they need. */}
        <div className="flex justify-center py-5">
          <span
            aria-hidden="true"
            className="border-sage size-14 rounded-full border shadow-[0_0_0_9px_var(--color-paper),0_0_0_10px_var(--color-line),0_0_0_19px_var(--color-card),0_0_0_20px_var(--color-stone)]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-primary text-[13px] font-semibold tracking-[0.12em] uppercase">
            EviBrief
          </span>
          <h1 className="text-h2 text-ink font-semibold">Sign in</h1>
          <p className="text-body text-ink-2">
            Sign in with your Tropenbos Ghana Workspace account.
          </p>
        </div>

        {alert ? (
          <Alert variant="guard">
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        ) : null}

        <form action={signInWithGoogle}>
          <SignInButton />
        </form>
      </div>
    </main>
  );
}
