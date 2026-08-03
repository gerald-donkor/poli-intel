import Link from "next/link";

import type { InfluenceEventView } from "@/lib/db";

import {
  DETECTION_METHOD_LABELS,
  formatInfluenceDate,
  INFLUENCE_EVENT_TYPE_LABELS,
} from "./labels";
import { VerifyControl } from "./verify-control";

/**
 * The influence record, newest first.
 *
 * CONFIRMED AND UNCONFIRMED ARE DISTINGUISHED BY SHAPE AND WORDS, NOT COLOUR
 * (§11.13). A filled lozenge and "Confirmed by …" against a hollow one and
 * "Not yet confirmed" — never a tick against a cross, never green against red,
 * and never the guard flag's circle or the classification hold's square, both of
 * which mean something else (§11.7).
 *
 * NO URGENCY RAMP APPEARS ON THIS SCREEN. An influence event has no urgency, and
 * borrowing that ramp would attach a taxonomy it does not have (decision 9).
 *
 * THE SERIF IS USED EXACTLY ONCE: the verbatim line from the citing document.
 * The description beside it — written by a person, or drafted by the detection
 * pass — is the sans, because the product or its staff wrote it (§11.6).
 *
 * THE COPY NEVER SAYS THE SYSTEM VERIFIED ANYTHING (§8.8). A record was *found*
 * or *logged*; a person *confirmed* it.
 */
export function InfluenceEventRail({
  events,
  canVerify,
}: {
  events: InfluenceEventView[];
  /** Programme Director only. The action refuses independently regardless. */
  canVerify: boolean;
}) {
  return (
    <ul className="flex min-w-0 list-none flex-col gap-3 p-0">
      {events.map((event) => (
        <li key={event.id} className="min-w-0">
          <InfluenceEventCard event={event} canVerify={canVerify} />
        </li>
      ))}
    </ul>
  );
}

function InfluenceEventCard({
  event,
  canVerify,
}: {
  event: InfluenceEventView;
  canVerify: boolean;
}) {
  return (
    <article className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
          {INFLUENCE_EVENT_TYPE_LABELS[event.eventType]}
        </span>
        <Link
          href={`/briefs/${event.briefId}`}
          className="text-ink text-[15px] leading-snug font-semibold break-words no-underline hover:underline"
        >
          {event.briefTitle}
        </Link>
      </div>

      {/* Generated or staff-written prose — the sans, always. */}
      <p className="text-ink-2 max-w-[68ch] text-[14px] leading-[1.6] break-words">
        {event.description}
      </p>

      {event.quotedText ? (
        // THE SERIF, and the only place on this screen it appears: this is the
        // citing document's own sentence, not ours (§11.6).
        <blockquote className="border-accent text-ink my-0 border-l-2 pl-4 font-serif text-[15px] leading-[1.55] break-words">
          {event.quotedText}
        </blockquote>
      ) : null}

      {event.sourceDocument ? (
        <p className="min-w-0 text-[13px] break-words">
          <a
            href={event.sourceDocument}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline"
          >
            {event.sourceTitle ?? "Open the source document"}
          </a>
        </p>
      ) : (
        <p className="text-ink-3 text-[13px]">No source document recorded.</p>
      )}

      <p className="text-ink-3 font-mono text-[11.5px] break-words">
        {formatInfluenceDate(event.detectedAt)} ·{" "}
        {DETECTION_METHOD_LABELS[event.detectionMethod]}
        {event.loggedByName ? ` · ${event.loggedByName}` : ""}
      </p>

      <VerificationState event={event} />

      {!event.verified && canVerify ? (
        <VerifyControl
          eventId={event.id}
          briefAuthorName={event.briefAuthorName}
        />
      ) : null}
    </article>
  );
}

/**
 * Shape plus words, and a text alternative for the glyph so a screen reader gets
 * the state rather than a lozenge (§11.13).
 */
function VerificationState({ event }: { event: InfluenceEventView }) {
  if (event.verified) {
    return (
      <p className="text-primary-ink flex flex-wrap items-baseline gap-1.5 text-[13px]">
        <span aria-hidden="true">◆</span>
        <span>
          Confirmed
          {event.verifiedByName ? ` by ${event.verifiedByName}` : ""}
          {event.verifiedAt
            ? ` on ${formatInfluenceDate(event.verifiedAt)}`
            : ""}
        </span>
      </p>
    );
  }

  return (
    <p className="text-ink-3 flex flex-wrap items-baseline gap-1.5 text-[13px]">
      <span aria-hidden="true">◇</span>
      <span>
        Not yet confirmed. It is not counted in the quarterly report until the
        Programme Director confirms it.
      </span>
    </p>
  );
}
