"use client";

import { useEffect, useState } from "react";

import { plainDateTime } from "@/lib/field/plain-language";

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
 * `navigator.onLine` IS READ IN AN EFFECT, NEVER DURING RENDER. The server has
 * no opinion about the reader's connection, so rendering one would be a
 * hydration mismatch; the banner is absent on the server and on the first client
 * paint, and appears when the browser says so.
 */
export function OfflineBanner({ savedAt }: { savedAt: string | null }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="bg-stone border-line animate-slide-down flex items-start gap-2 border-b px-5 py-3"
    >
      {/*
        A square, not a circle: the circle is the review flag and the square is
        a governance/system state, and the two must be distinguishable at a
        glance and without colour (§11.7).
      */}
      <span
        aria-hidden="true"
        className="border-ink-disabled mt-[3px] size-3 shrink-0 rounded-[2px] border-2"
      />
      <p className="text-ink-2 text-[14px] leading-relaxed">
        You are offline. This is what was saved on your phone
        {savedAt ? ` on ${plainDateTime(savedAt)}` : ""}.
      </p>
    </div>
  );
}
