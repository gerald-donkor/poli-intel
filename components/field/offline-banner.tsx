"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { plainDateTime } from "@/lib/field/plain-language";
import { listQueued, queueAvailable, type QueuedSubmission } from "@/lib/field/queue";
import { cn } from "@/lib/utils";

/**
 * "Offline — showing cached data", said in the reader's own language
 * (AGENTS.md §17.4).
 *
 * IT STATES WHAT THE READER IS LOOKING AT, not merely that something is wrong:
 * "showing the updates saved on your phone", plus when they were saved. A banner
 * that only says "offline" leaves the person wondering whether the cards below
 * are today's.
 *
 * 200ms SLIDE, NO BOUNCE, NEVER OVERLAYING CONTENT (the handoff's motion table).
 * It sits in the document flow above the cards. The global
 * `prefers-reduced-motion` rule in `globals.css` turns the animation off
 * entirely, which is the instant state change §11.10 asks for.
 *
 * `navigator.onLine` IS READ VIA `useSyncExternalStore`. The server has
 * no opinion about the reader's connection, so rendering one would be a
 * hydration mismatch; the banner is absent on the server and appears when the
 * browser mounts.
 */

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerOnlineSnapshot() {
  return true;
}

const noopSubscribe = () => () => {};

export function OfflineBanner({
  savedAt,
  showQueueSummary = true,
  className,
}: {
  savedAt?: string | null;
  showQueueSummary?: boolean;
  className?: string;
}) {
  const isMounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot);
  const [queued, setQueued] = useState<QueuedSubmission[]>([]);

  const checkQueue = useCallback(async () => {
    if (!queueAvailable()) return;
    try {
      const items = await listQueued();
      setQueued(items);
    } catch {
      // IndexedDB unavailable; ignore quietly
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void checkQueue(), 0);
    window.addEventListener("online", checkQueue);
    window.addEventListener("offline", checkQueue);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", checkQueue);
      window.removeEventListener("offline", checkQueue);
    };
  }, [checkQueue]);

  if (!isMounted) return null;

  const offline = !isOnline;
  const queuedCount = queued.length;
  const hasUnauthorised = queued.some((item) => item.reason === "unauthorised");

  if (!offline && (!showQueueSummary || queuedCount === 0)) {
    return null;
  }

  // When online with waiting items
  if (!offline && queuedCount > 0 && showQueueSummary) {
    return (
      <div
        role="status"
        className={cn(
          "bg-stone border-line animate-slide-down flex items-center justify-between border-b px-5 py-2.5 text-[13px] text-ink-2",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-ink-disabled size-2.5 shrink-0 rounded-[2px] border-2 bg-transparent"
          />
          <span>
            {queuedCount === 1
              ? "1 update is waiting on this phone."
              : `${queuedCount} updates are waiting on this phone.`}{" "}
            {hasUnauthorised ? "Sign in again to send." : "Sending when possible."}
          </span>
        </div>
        <Link
          href="/field/sent"
          className="text-primary hover:text-primary-hover font-medium underline underline-offset-2 cursor-pointer"
        >
          View
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        "bg-stone border-line animate-slide-down flex flex-col gap-1.5 border-b px-5 py-3",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        {/*
          A square, not a circle: the circle is the review flag and the square is
          a governance/system state, and the two must be distinguishable at a
          glance and without colour (§11.7).
        */}
        <span
          aria-hidden="true"
          className="border-ink-disabled mt-[3px] size-3 shrink-0 rounded-[2px] border-2 bg-transparent"
        />
        <p className="text-ink-2 text-[14px] leading-relaxed">
          {savedAt
            ? `You are offline. Showing the last update saved on this phone on ${plainDateTime(savedAt)}.`
            : "You are offline. Submissions will wait safely on this phone until you are back online."}
        </p>
      </div>

      {showQueueSummary && queuedCount > 0 ? (
        <div className="text-ink-3 ml-5 flex items-center justify-between text-[13px]">
          <span>
            {queuedCount === 1
              ? "1 update is waiting to send."
              : `${queuedCount} updates are waiting to send.`}{" "}
            {hasUnauthorised && "Sign in again to send."}
          </span>
          <Link
            href="/field/sent"
            className="text-primary hover:text-primary-hover font-medium underline underline-offset-2 cursor-pointer"
          >
            See what is waiting
          </Link>
        </div>
      ) : null}
    </div>
  );
}


