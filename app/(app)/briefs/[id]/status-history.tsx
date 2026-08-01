import type { BriefStatusEvent } from "@/lib/db/briefs";

import { BRIEF_STATUS_LABELS, formatDecisionAt } from "../labels";

/**
 * Who moved this brief, when, and why (§8.3).
 *
 * A plain account, newest first. Every row is a DECISION a person took — a
 * send-back on a brief that was already a draft moves nothing and is recorded
 * anyway, because "not yet, and here is why" that left no trace would be the
 * same as no review at all.
 *
 * The reason is staff-authored free text rendered back to staff as TEXT, never
 * as markup. Nothing here implies the system decided anything (§8.8).
 */
export function StatusHistory({ events }: { events: BriefStatusEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section
      aria-labelledby="status-history-heading"
      className="bg-card border-line rounded-card flex flex-col gap-3 border p-4"
    >
      <h2
        id="status-history-heading"
        className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
      >
        Record ({events.length})
      </h2>

      <ol className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="flex min-w-0 flex-col gap-0.5">
            <p className="text-ink text-[13px]">
              <span className="font-medium">
                {event.actorName ?? "A member of staff"}
              </span>{" "}
              {describe(event)}
            </p>
            <p className="text-ink-3 font-mono text-[11.5px]">
              {formatDecisionAt(event.changedAt)}
            </p>
            {event.reason ? (
              <p className="text-ink-2 mt-1 text-[12.5px]">{event.reason}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function describe(event: BriefStatusEvent): string {
  const to = BRIEF_STATUS_LABELS[event.newStatus].toLowerCase();

  if (event.previousStatus === event.newStatus) {
    return `sent this brief back — it stays a ${to}`;
  }

  const from =
    event.previousStatus === null
      ? null
      : BRIEF_STATUS_LABELS[event.previousStatus].toLowerCase();

  return from === null
    ? `set this brief to ${to}`
    : `moved this brief from ${from} to ${to}`;
}
