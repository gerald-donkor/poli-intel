import Link from "next/link";

import { FailurePanel } from "@/components/failure-panel";

export const metadata = {
  title: "Not found · EviBrief",
};

/**
 * The 404, in the same visual family as the error boundaries.
 *
 * A SERVER COMPONENT, not a client boundary. Nothing crashed and there is
 * nothing to retry — an unknown address is an ordinary outcome, so it neither
 * needs `"use client"` nor reports to Sentry.
 *
 * The link goes to `/`, which resolves the caller and sends them to their own
 * landing screen — a Field Officer to `/field`, everyone else to `/signals`
 * (`landingPathForRole`). Hard-coding `/signals` here would send a Field
 * Officer somewhere they cannot use.
 */
export default function NotFound() {
  return (
    <FailurePanel
      eyebrow="Not found"
      title="This address does not exist."
      description="The link may be out of date, or the item may have been removed."
    >
      <Link
        href="/"
        className="bg-primary hover:bg-primary-hover focus-visible:ring-accent/50 focus-visible:ring-offset-card rounded-input inline-flex h-9 items-center justify-center px-4 text-[13px] font-medium text-white no-underline transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Back to EviBrief
      </Link>
    </FailurePanel>
  );
}
