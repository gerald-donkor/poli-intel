/*
 * The Field Officer offline shell (AGENTS.md §17.4).
 *
 * SCOPED TO `/field`, AND THAT IS A SECURITY BOUNDARY, NOT A TIDINESS ONE. It is
 * registered with `{ scope: "/field" }` so it never controls `/signals`,
 * `/briefs`, `/evidence`, or `/impact`, and it never sees a request from them.
 *
 * GET ONLY. The first line of `fetch` returns for every other method, so a
 * Server Action POST — which goes to the page's own URL and is therefore inside
 * the scope — passes straight through untouched. A cached or replayed mutation
 * would be a way to submit an observation twice, or to submit one nobody asked
 * for.
 *
 * `/api/auth/*` IS NEVER CACHED. A cached auth response is a stale session.
 *
 * WHAT IS CACHED: `/field` navigations, so the last digest the officer saw is
 * readable with no connection, and the JSON snapshot at `/api/field/cache`, so a
 * phone that has only ever opened the submission screen still has something to
 * show. Both are network-first — a working connection always wins, and the cache
 * is a fallback rather than a source of truth.
 *
 * A cached page is one staff member's own digest, held in their own browser's
 * storage on their own device. It is served only when the network fails; a
 * signed-out visitor with a connection gets the sign-in redirect from the
 * server, as they would without a worker.
 *
 * Plain JS, no build step, no framework — it is served from `public/` verbatim.
 */

const CACHE = "evibrief-field-v1";
const CACHE_PATH = "/api/field/cache";

self.addEventListener("install", (event) => {
  // Take over as soon as this version is ready. There is one screen and one
  // reader; waiting for every tab to close would leave a fixed worker unused on
  // a phone that never closes tabs.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => name.startsWith("evibrief-field-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

/** Network first; fall back to whatever was stored last. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    // Only a real, complete response is worth storing. An opaque or errored
    // response cached here would be served later as if it were the digest.
    if (response && response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);

    if (cached) return cached;

    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Mutations pass through, always. See the note at the top of this file.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/auth")) return;

  if (url.pathname === CACHE_PATH) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === "navigate" && url.pathname.startsWith("/field")) {
    event.respondWith(networkFirst(request));
  }
});
