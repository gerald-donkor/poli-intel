"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { SyncStatusPill } from "@/components/field/sync-status-pill";
import {
  enqueue,
  listQueued,
  queueAvailable,
  replayAll,
  type QueuedSubmission,
} from "@/lib/field/queue";

import { submitFieldObservationAction } from "../actions";
import {
  fieldObservationSchema,
  observedAtMax,
  type FieldObservationInput,
} from "../schema";

/**
 * The field submission form, and the offline queue that stands behind it.
 *
 * NEVER A SILENT FAILURE AND NEVER A SILENT QUEUE (AGENTS.md §17.2). Three
 * outcomes, all of them visible and none of them a toast that disappears:
 *
 *   - sent — a confirmation that stays on screen until the officer moves on;
 *   - waiting to send — the item is in IndexedDB, the pill says so, and it is
 *     still there after a reload and after the phone restarts;
 *   - sign in again to send — the session expired while the phone was away.
 *     The observation is NOT dropped and is NOT retried in a loop.
 *
 * THE QUEUE IS CLEARED ONLY BY A SERVER RESULT CARRYING AN `evidenceItemId`.
 * Not by a timeout, not by a failed parse, not by an unauthorised reply.
 *
 * `submissionKey` IS MINTED AT COMPOSE TIME, before a word is typed, and travels
 * with the observation through IndexedDB and into the action. Without it a flaky
 * connection that half-succeeded would produce two evidence items from one
 * observation.
 *
 * NOTHING HERE CALLS A MODEL, and nothing it calls does. There is no import from
 * `lib/ai/` on this path (§7).
 */

type Outcome =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "sent" }
  | { phase: "queued" }
  | { phase: "refused"; message: string };

function newKey(): string {
  return crypto.randomUUID();
}

const EMPTY = {
  title: "",
  observation: "",
  locationNote: "",
  observedAt: "",
} as const;

export function SubmissionForm() {
  const [outcome, setOutcome] = useState<Outcome>({ phase: "idle" });
  const [queued, setQueued] = useState<QueuedSubmission[]>([]);

  const form = useForm<FieldObservationInput>({
    resolver: zodResolver(fieldObservationSchema),
    defaultValues: { submissionKey: newKey(), ...EMPTY },
  });

  const refreshQueue = useCallback(async () => {
    if (!queueAvailable()) return;

    setQueued(await listQueued());
  }, []);

  /**
   * One attempt at the server, with every outcome named.
   *
   * A thrown `fetch` is the offline case and is the ONLY thing treated as
   * "try again later" — a refusal that came back from the server is a real
   * answer and is reported as one.
   */
  const attempt = useCallback(
    async (
      values: FieldObservationInput,
    ): Promise<
      | { ok: true; evidenceItemId: string }
      | { ok: false; reason: QueuedSubmission["reason"]; message?: string }
    > => {
      try {
        const result = await submitFieldObservationAction(values);

        if (result.ok) {
          return { ok: true, evidenceItemId: result.evidenceItemId };
        }

        if (result.refusal.kind === "unauthorised") {
          return {
            ok: false,
            reason: "unauthorised",
            message: result.refusal.message,
          };
        }

        return {
          ok: false,
          reason: "failed",
          message:
            "Something in this update could not be accepted. Check the fields and try again.",
        };
      } catch {
        // No network, or the request never completed. Deliberately without the
        // error object — nothing about it is worth logging, and the officer's
        // text is not going anywhere near a log line (§7.6).
        return { ok: false, reason: "offline" };
      }
    },
    [],
  );

  /** Replays everything queued, oldest first. */
  const replay = useCallback(async () => {
    if (!queueAvailable()) return;

    await replayAll(async (values) => {
      const result = await attempt(values);

      return result.ok
        ? { ok: true as const, evidenceItemId: result.evidenceItemId }
        : { ok: false as const, reason: result.reason };
    });

    await refreshQueue();
  }, [attempt, refreshQueue]);

  // On mount and whenever the connection returns. Not a poll: a timer on a
  // phone with no signal spends battery to learn nothing.
  //
  // The mount attempt is scheduled rather than called in the effect body, so
  // the effect itself only subscribes — the queue read and its state update
  // happen off the render path.
  useEffect(() => {
    const kick = () => void replay();
    const onMount = setTimeout(kick, 0);

    window.addEventListener("online", kick);

    return () => {
      clearTimeout(onMount);
      window.removeEventListener("online", kick);
    };
  }, [replay]);

  async function onSubmit(values: FieldObservationInput) {
    setOutcome({ phase: "sending" });

    // Offline is known before the request is made, so the officer sees the
    // queued state immediately rather than after a timeout.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueIt(values, "offline");
      return;
    }

    const result = await attempt(values);

    if (result.ok) {
      form.reset({ submissionKey: newKey(), ...EMPTY });
      setOutcome({ phase: "sent" });
      return;
    }

    if (result.reason === "failed") {
      setOutcome({
        phase: "refused",
        message: result.message ?? "That update could not be sent.",
      });
      return;
    }

    await queueIt(values, result.reason);
  }

  async function queueIt(
    values: FieldObservationInput,
    reason: QueuedSubmission["reason"],
  ) {
    if (!queueAvailable()) {
      // The one case where there is nowhere to put it. Said plainly, with the
      // text still in the form so nothing is lost.
      setOutcome({
        phase: "refused",
        message:
          "This phone cannot hold updates while offline. Your text is still here — try again when you have a signal.",
      });
      return;
    }

    await enqueue({
      submissionKey: values.submissionKey,
      values,
      queuedAt: new Date().toISOString(),
      reason,
    });

    form.reset({ submissionKey: newKey(), ...EMPTY });
    await refreshQueue();
    setOutcome({ phase: "queued" });
  }

  const waitingToSend = queued.length;
  const needsSignIn = queued.some((item) => item.reason === "unauthorised");

  return (
    <div className="flex flex-col gap-5">
      {/*
        The queue is visible before, during and after writing — it is the
        product's promise that nothing was lost, and it never disappears on a
        timer (§17.2).
      */}
      {waitingToSend > 0 ? (
        <div className="bg-stone border-line rounded-card flex flex-col gap-2 border p-4">
          <SyncStatusPill
            state={needsSignIn ? "sign-in" : "queued"}
            className="self-start"
          />
          <p className="text-ink-2 text-[14px] leading-relaxed">
            {waitingToSend === 1
              ? "One update is waiting on this phone."
              : `${waitingToSend} updates are waiting on this phone.`}{" "}
            {needsSignIn
              ? "Sign in again and they will send."
              : "They send themselves when you are back online."}
          </p>
          <Link
            href="/field/sent"
            className="text-primary text-[14px] font-medium underline"
          >
            See what is waiting
          </Link>
        </div>
      ) : null}

      {outcome.phase === "sent" ? (
        <div
          role="status"
          className="bg-surface-tint border-surface-tint-border rounded-card flex flex-col gap-2 border p-4"
        >
          <SyncStatusPill state="sent" className="self-start" />
          <p className="text-surface-tint-ink text-[14px] leading-relaxed">
            Thank you. Your update is with the office and someone will read it
            before it is used for anything.
          </p>
        </div>
      ) : null}

      {outcome.phase === "queued" ? (
        <div
          role="status"
          className="bg-stone border-line rounded-card flex flex-col gap-2 border p-4"
        >
          <SyncStatusPill state="queued" className="self-start" />
          <p className="text-ink-2 text-[14px] leading-relaxed">
            Saved on your phone. It will send itself as soon as you have a
            signal — you can close this page.
          </p>
        </div>
      ) : null}

      {outcome.phase === "refused" ? (
        /*
          The watch (slate) ramp, never red — nothing in this product is, and a
          refusal here is a prompt to look again, not an alarm (§11.4).
        */
        <div
          role="status"
          className="bg-watch-surface border-watch-border rounded-card border p-4"
        >
          <p className="text-watch-ink text-[14px] leading-relaxed">
            {outcome.message}
          </p>
        </div>
      ) : null}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        <input type="hidden" {...form.register("submissionKey")} />

        <div className="flex flex-col gap-2">
          <label
            htmlFor="field-title"
            className="text-ink text-[15px] font-semibold"
          >
            What is this about?
          </label>
          <input
            id="field-title"
            type="text"
            autoComplete="off"
            className="border-line bg-card rounded-input text-ink min-h-[48px] px-3 text-[16px]"
            {...form.register("title")}
          />
          <FieldMessage message={form.formState.errors.title?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="field-observation"
            className="text-ink text-[15px] font-semibold"
          >
            What did you see?
          </label>
          <textarea
            id="field-observation"
            rows={8}
            className="border-line bg-card rounded-input text-ink min-h-[160px] p-3 text-[16px] leading-relaxed"
            {...form.register("observation")}
          />
          <p className="text-ink-3 text-[14px] leading-relaxed">
            Write it in your own words. Say where it was and who was involved if
            you can.
          </p>
          <FieldMessage message={form.formState.errors.observation?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="field-location"
            className="text-ink text-[15px] font-semibold"
          >
            Where was it? <span className="text-ink-3">(optional)</span>
          </label>
          <input
            id="field-location"
            type="text"
            autoComplete="off"
            placeholder="Eastern edge of Juabeso-Bia"
            className="border-line bg-card rounded-input text-ink min-h-[48px] px-3 text-[16px]"
            {...form.register("locationNote")}
          />
          <FieldMessage message={form.formState.errors.locationNote?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="field-observed-at"
            className="text-ink text-[15px] font-semibold"
          >
            When did you see it? <span className="text-ink-3">(optional)</span>
          </label>
          <input
            id="field-observed-at"
            type="date"
            max={observedAtMax()}
            className="border-line bg-card rounded-input text-ink min-h-[48px] px-3 text-[16px]"
            {...form.register("observedAt")}
          />
          <FieldMessage message={form.formState.errors.observedAt?.message} />
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="bg-primary hover:bg-primary-hover rounded-card min-h-[48px] w-full px-4 text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {outcome.phase === "sending" ? "Sending…" : "Send this update"}
        </button>

        <p className="text-ink-3 text-[14px] leading-relaxed">
          Your update goes to the office as it is. Nobody uses it for anything
          until a colleague there has read it.
        </p>
      </form>
    </div>
  );
}

/** Validation messages use the slate ramp, never red (§11.4). */
function FieldMessage({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-watch-ink text-[14px] leading-relaxed">{message}</p>;
}
