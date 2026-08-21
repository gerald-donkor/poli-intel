"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { GoogleMark } from "@/components/google-mark";

/**
 * Google's *light* button treatment: the four-colour G is only permitted on
 * white/light or on Google's own blue/black, so dropping it into a filled
 * `primary` green button would be off-spec for Google and would muddy the
 * palette. Hierarchy comes from size, full width, elevation, and the fact that
 * this is the only action on the card.
 *
 * Pending state without a spinner. `design-system` forbids an indeterminate
 * spinner in this product, so the label carries the state instead — project
 * convention wins over the vendor default composition (AGENTS.md §3). The mark
 * stays visible while pending; the disabled cursor comes from the global rule
 * in `globals.css`.
 */
export function SignInButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      // 44px tap target, matching the handoff's full-width primary action.
      // Height, width, surface and border only — no new token, no new type.
      className="h-11 w-full gap-3 rounded-card border-line bg-card text-body font-medium text-ink shadow-raised hover:bg-stone hover:text-ink disabled:pointer-events-auto disabled:cursor-not-allowed"
      disabled={pending}
    >
      <GoogleMark />
      {pending ? "Signing in…" : "Continue with Google"}
    </Button>
  );
}
