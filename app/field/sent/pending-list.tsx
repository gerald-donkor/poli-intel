"use client";

import { useCallback, useEffect, useState } from "react";

import { SyncStatusPill } from "@/components/field/sync-status-pill";
import {
  listQueued,
  queueAvailable,
  replayAll,
  type QueuedSubmission,
} from "@/lib/field/queue";

import { submitFieldObservationAction } from "../actions";

/**
 * The updates still on this phone.
 *
 * IT LIVES ABOVE THE SENT LIST AND IT DOES NOT DISAPPEAR. A queued observation
 * is visible until it syncs — that is the whole of §17.2's "never a silent
 * queue", and the reason this is a list rather than a count.
 *
 * REPLAY FIRES ON MOUNT AND ON `online`, the same two triggers the submission
 * form uses, so an officer who lands here first still gets their queue sent.
 *
 * IT RENDERS THE TITLE THE OFFICER GAVE THE UPDATE, not the observation body.
 * The text is on their own device and there is no reason to reprint it here.
 */
export function PendingList() {
  const [queued, setQueued] = useState<QueuedSubmission[]>([]);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    if (!queueAvailable()) {
      setChecked(true);
      return;
    }

    setQueued(await listQueued());
    setChecked(true);
  }, []);

  const replay = useCallback(async () => {
    if (!queueAvailable()) return;

    await replayAll(async (values) => {
      try {
        const result = await submitFieldObservationAction(values);

        if (result.ok) {
          return { ok: true as const, evidenceItemId: result.evidenceItemId };
        }

        return {
          ok: false as const,
          reason:
            result.refusal.kind === "unauthorised"
              ? ("unauthorised" as const)
              : ("failed" as const),
        };
      } catch {
        return { ok: false as const, reason: "offline" as const };
      }
    });

    await refresh();
  }, [refresh]);

  // Scheduled rather than called in the effect body, so the effect itself only
  // subscribes — see the same note in `submit/submission-form.tsx`.
  useEffect(() => {
    const kick = () => void replay();
    const onMount = setTimeout(kick, 0);

    window.addEventListener("online", kick);

    return () => {
      clearTimeout(onMount);
      window.removeEventListener("online", kick);
    };
  }, [replay]);

  if (!checked || queued.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-3 text-[12px] font-semibold tracking-[0.06em] uppercase">
        Still on this phone
      </h2>

      {queued.map((item) => (
        <article
          key={item.submissionKey}
          className="bg-stone border-line rounded-card flex flex-col gap-2 border p-4"
        >
          <SyncStatusPill
            state={item.reason === "unauthorised" ? "sign-in" : "queued"}
            className="self-start"
          />
          <h3 className="text-ink text-[16px] leading-snug font-semibold">
            {item.values.title}
          </h3>
          <p className="text-ink-2 text-[14px] leading-relaxed">
            {item.reason === "unauthorised"
              ? "Sign in again and this will send."
              : "This sends itself as soon as you have a signal."}
          </p>
        </article>
      ))}
    </section>
  );
}
