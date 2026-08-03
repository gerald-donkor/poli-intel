"use client";

import { useEffect } from "react";

import { FIELD_CACHE_PATH } from "@/lib/field/config";

/**
 * Registers the `/field` service worker, and warms its snapshot.
 *
 * A NO-OP WHERE `serviceWorker` IS ABSENT — an older browser, or a page served
 * over plain HTTP in some development setups. Offline reading is then simply
 * unavailable; nothing else on the screen changes, and nothing throws.
 *
 * SCOPE `/field`, PASSED EXPLICITLY. The script sits at the origin root, so its
 * default scope would be the whole app. Narrowing it here is what keeps the
 * worker off `/signals`, `/briefs`, and every Server Action outside this
 * surface.
 *
 * The one `fetch` after registration is the snapshot warm-up: an officer who
 * only ever opens the submission screen would otherwise have nothing cached to
 * read when the connection goes.
 *
 * A FAILED REGISTRATION IS REPORTED, NOT SWALLOWED — but it is not shown to the
 * officer as an error, because it is not one: the screen works, it just will not
 * work offline yet.
 */
export function FieldServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker
      .register("/field-sw.js", { scope: "/field" })
      .then(() => {
        if (cancelled) return;

        // Same-origin, GET, session-cookie authorised. The worker stores the
        // response; nothing here reads it.
        return fetch(FIELD_CACHE_PATH, { credentials: "same-origin" });
      })
      .catch(() => {
        // Deliberately without the error object: nothing about this failure is
        // specific enough to log, and nothing about the officer's data is
        // involved either way.
        console.warn("[field] offline reading is unavailable on this device");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
