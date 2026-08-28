import Link from "next/link";

import { OfflineBanner } from "@/components/field/offline-banner";
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
            Updates you have sent
          </h1>
          <p className="text-surface-tint text-[14px] leading-relaxed">
            What you have sent from the field, and what is still waiting on this phone.
          </p>
        </div>
      </header>

      <OfflineBanner showQueueSummary={false} />

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <PendingList />

        {submissions.length === 0 ? (
          <div className="bg-card border-line rounded-card shadow-raised border p-5">
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
              Sent to the office
            </h2>

            {submissions.map((submission) => (
              <article
                key={submission.id}
                className="bg-card border-line rounded-card shadow-raised flex flex-col gap-2 border p-4.5 transition-shadow"
              >
                <SyncStatusPill
                  state={submission.reviewed ? "read" : "waiting-review"}
                  className="self-start"
                />
                <h3 className="text-ink text-[16px] leading-snug font-semibold">
                  {submission.title}
                </h3>
                <p className="text-ink-3 text-[13px] leading-relaxed">
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
          className="bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-card shadow-raised flex min-h-[48px] w-full items-center justify-center px-4 text-[16px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 cursor-pointer mt-2"
        >
          Send another update
        </Link>
      </div>
    </>
  );
}

