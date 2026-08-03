import Link from "next/link";

import { SyncStatusPill } from "@/components/field/sync-status-pill";
import { FieldServiceWorker } from "@/components/field/sw-register";
import { requireStaffUser } from "@/lib/auth/session";
import { listFieldSubmissionsByStaffUser } from "@/lib/db";
import { FIELD_SENT_MAX_ITEMS } from "@/lib/field/config";
import { plainDate } from "@/lib/field/plain-language";

import { PendingList } from "./pending-list";

export const metadata = {
  title: "Updates you have sent · EviBrief",
  description: "What you have sent from the field, and what is still waiting.",
};

/**
 * The officer's own submissions, and the queue behind them.
 *
 * SCOPED TO THE CALLER by the query itself — `listFieldSubmissionsByStaffUser`
 * takes a staff user id and offers no "everyone" mode, so there is no shape here
 * through which one officer could read another's observation (§10.5).
 *
 * PLAIN LANGUAGE ONLY. "With the office" and "Read by the office", never
 * `unpublished_internal` and never "classification" (§11.12). The distinction a
 * reader actually needs is whether a colleague has looked at it yet.
 *
 * The observation body is not rendered. The officer wrote it and it is on the
 * record; this screen answers "did it arrive?", which is a different question.
 */
export default async function FieldSentPage() {
  const staffUser = await requireStaffUser();

  const submissions = await listFieldSubmissionsByStaffUser(
    staffUser.id,
    FIELD_SENT_MAX_ITEMS,
  );

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
          Updates you have sent
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <PendingList />

        {submissions.length === 0 ? (
          <div className="bg-card border-line rounded-card border p-4">
            <h2 className="text-ink text-[16px] font-semibold">
              Nothing sent yet
            </h2>
            <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">
              When you send an update from the field it will be listed here, with
              whether the office has read it.
            </p>
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="text-ink-3 text-[12px] font-semibold tracking-[0.06em] uppercase">
              Sent
            </h2>

            {submissions.map((submission) => (
              <article
                key={submission.id}
                className="bg-card border-line rounded-card flex flex-col gap-2 border p-4"
              >
                <SyncStatusPill
                  state={submission.reviewed ? "read" : "waiting-review"}
                  className="self-start"
                />
                <h3 className="text-ink text-[16px] leading-snug font-semibold">
                  {submission.title}
                </h3>
                <p className="text-ink-3 text-[14px] leading-relaxed">
                  Sent {plainDate(submission.submittedAt)}
                  {submission.locationNote ? ` · ${submission.locationNote}` : ""}
                </p>
                <p className="text-ink-2 text-[14px] leading-relaxed">
                  {submission.reviewed
                    ? "A colleague at the office has read this."
                    : "Waiting for someone at the office to read it."}
                </p>
              </article>
            ))}
          </section>
        )}

        <Link
          href="/field/submit"
          className="bg-primary hover:bg-primary-hover rounded-card flex min-h-[48px] w-full items-center justify-center px-4 text-[16px] font-semibold text-white"
        >
          Send another update
        </Link>
      </div>
    </>
  );
}
