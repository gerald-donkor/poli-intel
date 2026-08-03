import type { FieldObservationInput } from "@/app/field/schema";

/**
 * The offline submission queue (AGENTS.md §17.2).
 *
 * CLIENT-ONLY. Every function here touches `indexedDB` and must never be
 * imported by a Server Component, a Server Action, or a job. There is no
 * `"server-only"` counterpart to enforce that at the type level, so the rule is
 * stated here and the module is imported by exactly one client component tree.
 *
 * INDEXEDDB, NOT `localStorage`. A queued observation is user-authored text that
 * must survive a tab close and a phone restart, and `localStorage` is a
 * synchronous 5MB string store that a browser will evict under pressure without
 * telling anyone. Losing a farmer's observation to a storage-eviction heuristic
 * is not an acceptable failure mode.
 *
 * REPLAY IS DRIVEN BY THE `online` EVENT AND A CHECK ON MOUNT, not the
 * Background Sync API. Background Sync is Chromium-only; on iOS Safari — the
 * likelier field device — it silently never fires, which would leave the
 * "waiting to send" indicator telling the officer a lie. An event we can see
 * fail is better than an API we cannot.
 *
 * NOTHING HERE IS EVER CLEARED WITHOUT A SERVER RESULT CARRYING AN
 * `evidenceItemId`. Not on a timeout, not on a parse failure, not on an
 * unauthorised replay. The queue is the officer's work.
 */

const DB_NAME = "evibrief-field";
const DB_VERSION = 1;
const STORE = "pending-submissions";

/** One observation waiting to go. */
export type QueuedSubmission = {
  /** The submission key, and this record's primary key — one row per attempt. */
  submissionKey: string;
  values: FieldObservationInput;
  queuedAt: string;
  /**
   * Why it is still here, where the last attempt said something useful.
   * `"offline"` is the ordinary case; `"unauthorised"` means the session
   * expired while the phone was away and the officer must sign in again.
   */
  reason: "offline" | "failed" | "unauthorised";
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "submissionKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = work(transaction.objectStore(STORE));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

/** True where this browser can queue at all. */
export function queueAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function enqueue(entry: QueuedSubmission): Promise<IDBValidKey> {
  return run("readwrite", (store) => store.put(entry));
}

export async function listQueued(): Promise<QueuedSubmission[]> {
  const rows = await run<QueuedSubmission[]>("readonly", (store) =>
    store.getAll() as IDBRequest<QueuedSubmission[]>,
  );

  return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

/**
 * Removes one entry. Called ONLY with a server result that carried an
 * `evidenceItemId` — see the note at the top of this file.
 */
export function remove(submissionKey: string): Promise<undefined> {
  return run("readwrite", (store) => store.delete(submissionKey));
}

/** Marks why an attempt did not go through, keeping the entry queued. */
export async function markReason(
  submissionKey: string,
  reason: QueuedSubmission["reason"],
): Promise<void> {
  const existing = await run<QueuedSubmission | undefined>(
    "readonly",
    (store) => store.get(submissionKey) as IDBRequest<QueuedSubmission | undefined>,
  );

  if (!existing) return;

  await enqueue({ ...existing, reason });
}

export type ReplayOutcome = {
  sent: number;
  stillQueued: number;
};

/**
 * Attempts every queued submission, oldest first.
 *
 * SEQUENTIAL, not parallel: a phone that has just regained a weak connection
 * does better with one request at a time than with five racing each other, and
 * the order the officer wrote them in is the order they should land.
 *
 * `submit` is injected rather than imported so this module stays free of the
 * Server Action import and can be reasoned about (and, later, tested) on its
 * own.
 */
export async function replayAll(
  submit: (
    values: FieldObservationInput,
  ) => Promise<
    | { ok: true; evidenceItemId: string }
    | { ok: false; reason: QueuedSubmission["reason"] }
  >,
): Promise<ReplayOutcome> {
  const queued = await listQueued();

  let sent = 0;

  for (const entry of queued) {
    const result = await submit(entry.values);

    if (result.ok) {
      await remove(entry.submissionKey);
      sent += 1;
      continue;
    }

    // Kept, with the reason updated so the screen can say something true. A
    // failed replay is never dropped and never retried in a tight loop — the
    // next `online` event or the next visit tries again.
    await markReason(entry.submissionKey, result.reason);
  }

  return { sent, stillQueued: queued.length - sent };
}
