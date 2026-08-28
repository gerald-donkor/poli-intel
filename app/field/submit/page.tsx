import Link from "next/link";

import { OfflineBanner } from "@/components/field/offline-banner";
import { FieldServiceWorker } from "@/components/field/sw-register";
import { requireStaffUser } from "@/lib/auth/session";

import { SubmissionForm } from "./submission-form";

export const metadata = {
  title: "Send an update · EviBrief",
  description: "Send what you have seen in the field. Works without a signal.",
};

/**
 * The submission screen.
 *
 * It re-resolves the caller rather than trusting the layout (§10.1's spirit
 * applied to a render path); the action authorises again, server-side, which is
 * the actual boundary.
 *
 * Single column, mobile-first, and never adapted upward (§11.14).
 */
export default async function FieldSubmitPage() {
  await requireStaffUser();

  return (
    <>
      <FieldServiceWorker />

      <header className="bg-primary flex flex-col gap-3 px-5 pt-6 pb-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="border-surface-tint size-[18px] shrink-0 rounded-[2px] border-2"
            />
            <span className="text-surface-tint text-[13px] font-semibold tracking-[0.12em] uppercase">
              EviBrief
            </span>
          </div>
          <Link
            href="/field"
            className="text-surface-tint hover:text-white flex min-h-[44px] items-center text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-tint focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm cursor-pointer underline-offset-4 hover:underline"
          >
            ← Back to this week
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-h2 font-semibold text-white tracking-tight">
            Send an update from the field
          </h1>
          <p className="text-surface-tint text-[14px] leading-relaxed">
            Write what you saw. If you have no signal, it waits safely on your phone and
            sends itself when you are back online.
          </p>
        </div>
      </header>

      <OfflineBanner showQueueSummary={false} />

      <div className="flex flex-1 flex-col px-5 py-5">
        <SubmissionForm />
      </div>
    </>
  );
}

