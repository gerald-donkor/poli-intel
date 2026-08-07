"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { FailureAction, FailurePanel } from "@/components/failure-panel";

/**
 * The boundary for the Director, Officer, and Research surfaces. It renders
 * inside the `(app)` shell, so the nav stays and a person can leave for another
 * screen without a browser back.
 *
 * IT DOES NOT REPLACE THE `Result` CONVENTION. Handled failures — a Gemini rate
 * limit, a governance refusal, a validation error — return typed results and
 * render their own states with their own next steps (`server-actions`). This
 * file is for the unhandled crash only, and no existing typed failure is routed
 * through it.
 *
 * `error.message` IS NOT RENDERED. It is precisely the string the scrubber
 * exists to distrust: a message built by interpolation can carry evidence body
 * text, and a boundary is a place a reader could screenshot. `error.digest` is
 * a hash, so it is shown instead — enough to match this render against a server
 * log or a Sentry event, and readable by nothing on its own.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  // Next 16 supersedes `reset()` with `unstable_retry()`: `reset()` only clears
  // the boundary's state, while a screen that crashed in a Server Component
  // needs its data fetched again to have any chance of rendering. Verified in
  // node_modules/next/dist/docs/.../file-conventions/error.md, which says to
  // prefer it.
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // A client render error never reaches the server, so without this line the
    // whole class of them is invisible. `beforeSend` scrubs it like any other.
    Sentry.captureException(error);
  }, [error]);

  return (
    <FailurePanel
      title="This screen could not be loaded."
      description="Nothing was changed and no draft was lost. Try again, or move to another screen and come back — if it keeps happening, pass the reference below to whoever is looking after the deployment."
      reference={error.digest}
    >
      <FailureAction onClick={() => unstable_retry()}>Try again</FailureAction>
    </FailurePanel>
  );
}
