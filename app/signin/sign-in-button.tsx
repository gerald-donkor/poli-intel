"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Pending state without a spinner. `design-system` forbids an indeterminate
 * spinner in this product, so the label carries the state instead — project
 * convention wins over the vendor default composition (AGENTS.md §3).
 *
 * `Button` has no `isLoading` prop; `className` here is height and width only,
 * never colour or type.
 */
export function SignInButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      // 44px tap target, matching the handoff's full-width primary action.
      className="h-11 w-full"
      disabled={pending}
    >
      {pending ? "Signing in…" : "Continue with Google"}
    </Button>
  );
}
