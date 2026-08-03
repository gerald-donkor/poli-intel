import Link from "next/link";

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

      <header className="bg-primary flex flex-col gap-3 px-5 pt-6 pb-5">
        <Link
          href="/field"
          className="text-surface-tint inline-flex min-h-[44px] items-center text-[14px] font-medium hover:underline"
        >
          Back to this week
        </Link>
        <h1 className="text-h2 font-semibold text-white">
          Send an update from the field
        </h1>
        <p className="text-surface-tint text-[14px] leading-relaxed">
          Write what you saw. If you have no signal, it waits on your phone and
          sends itself when you are back online.
        </p>
      </header>

      <div className="flex flex-1 flex-col px-5 py-5">
        <SubmissionForm />
      </div>
    </>
  );
}
