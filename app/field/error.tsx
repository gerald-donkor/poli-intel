"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The boundary for the Field Officer surface.
 *
 * DELIBERATELY NOT `FailurePanel`. Every other boundary in the product speaks
 * to someone at a desk who can act on a reference string; this one speaks to
 * someone standing in a cocoa plot on a phone. §11.12 strips this surface to one
 * message per screen and plain language, and `lib/field/plain-language.ts` is
 * where that rule is kept — no internal vocabulary reaches here. "Segment",
 * "boundary", "signal", "digest", "reference" are all words this file must not
 * contain, which rules out the shared panel's eyebrow and its digest line.
 *
 * THE SENTENCE ABOUT SAVED SUBMISSIONS IS TRUE, AND WAS CHECKED. `lib/field/queue.ts`
 * keeps pending submissions in IndexedDB and clears a record only on a server
 * result carrying an `evidenceItemId` — not on a timeout, not on a parse
 * failure. A render crash on this page does not touch that store, so telling an
 * officer their work is still on the phone is a statement of fact, not
 * reassurance.
 *
 * SINGLE COLUMN AT EVERY WIDTH, like the rest of `/field`. No `tablet:` or
 * `laptop:` variant: an officer on a laptop still gets the phone layout
 * (§11.14).
 */
export default function FieldError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col justify-center gap-5 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-ink text-h2 font-semibold">Something went wrong.</h1>
        <p className="text-ink-2 text-[15px] leading-relaxed">
          This page did not open. Anything you have saved is still on this phone
          and has not been lost.
        </p>
      </div>

      <button
        type="button"
        onClick={() => unstable_retry()}
        className="bg-primary hover:bg-primary-hover focus-visible:ring-accent/50 focus-visible:ring-offset-card rounded-input inline-flex h-12 w-full items-center justify-center px-4 text-[15px] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Try again
      </button>

      <p className="text-ink-3 text-[14px] leading-relaxed">
        If it still does not open, close this page and open it again later. Your
        connection may come back on its own.
      </p>
    </div>
  );
}
