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
  const leadConfirmedId = events.find((e) => e.verified)?.id ?? null;
  const leadUnconfirmedId = events.find((e) => !e.verified)?.id ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 pb-1">
        <h3 className="text-ink text-[14.5px] font-semibold tracking-[-0.01em]">
          Influence records
        </h3>
        <span className="font-mono text-[11.5px] text-ink-3">
          Newest first
        </span>
      </div>

      <ul className="flex min-w-0 list-none flex-col gap-3.5 p-0">
        {events.map((event) => (
          <li key={event.id} className="min-w-0">
            <InfluenceEventCard
              event={event}
              canVerify={canVerify}
              isLeadConfirmed={event.id === leadConfirmedId}
              isLeadUnconfirmed={event.id === leadUnconfirmedId}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfluenceEventCard({
  event,
  canVerify,
  isLeadConfirmed,
  isLeadUnconfirmed,
}: {
  event: InfluenceEventView;
  canVerify: boolean;
  isLeadConfirmed: boolean;
  isLeadUnconfirmed: boolean;
}) {
  const cardStyle = event.verified && isLeadConfirmed
    ? "border-surface-tint-border bg-surface-tint/25 shadow-raised"
    : !event.verified && isLeadUnconfirmed
      ? "bg-card border-line shadow-raised ring-1 ring-sage/30"
      : "bg-card border-line shadow-raised";

  return (
    <article
      className={`${cardStyle} rounded-card flex min-w-0 flex-col gap-3 border p-4 transition-colors`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
            {INFLUENCE_EVENT_TYPE_LABELS[event.eventType]}
          </span>
          <span className="font-mono text-[11px] text-ink-3">
            {formatInfluenceDate(event.detectedAt)}
          </span>
        </div>
        <Link
          href={`/briefs/${event.briefId}`}
          className="text-ink hover:text-primary text-[14.5px] leading-snug font-semibold break-words no-underline hover:underline transition-colors"
        >
          {event.briefTitle}
        </Link>
      </div>

      {/* Generated or staff-written prose — the sans, always. */}
      <p className="text-ink-2 max-w-[68ch] text-[13.5px] leading-[1.6] break-words">
        {event.description}
      </p>

      {event.quotedText ? (
        // THE SERIF, and the only place on this screen it appears: this is the
        // citing document's own sentence, not ours (§11.6).
        <blockquote className="border-accent text-ink my-0 border-l-2 pl-3.5 font-serif text-[14px] leading-[1.55] break-words italic">
          {event.quotedText}
        </blockquote>
      ) : null}

      {event.sourceDocument ? (
        <p className="min-w-0 text-[13px] break-words">
          <a
            href={event.sourceDocument}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:text-primary-hover inline-flex items-center gap-1 font-medium underline"
          >
            <span>{event.sourceTitle ?? "Open the source document"}</span>
            <span aria-hidden="true" className="text-[11px]">↗</span>
          </a>
        </p>
      ) : (
        <p className="text-ink-3 text-[12.5px]">No source document recorded.</p>
      )}

      <p className="text-ink-3 font-mono text-[11px] break-words">
        {DETECTION_METHOD_LABELS[event.detectionMethod]}
        {event.loggedByName ? ` · ${event.loggedByName}` : ""}
      </p>

      <div className="border-line border-t pt-2.5">
        <VerificationState event={event} />
      </div>

      {!event.verified && canVerify ? (
        <div className="pt-1">
          <VerifyControl
            eventId={event.id}
            briefAuthorName={event.briefAuthorName}
          />
        </div>
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
      <p className="text-primary-ink flex flex-wrap items-baseline gap-1.5 text-[13px] font-medium">
        <span aria-hidden="true" className="text-primary">◆</span>
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
    <p className="text-ink-3 flex flex-wrap items-baseline gap-1.5 text-[12.5px] leading-snug">
      <span aria-hidden="true" className="text-ink-3">◇</span>
      <span>
        Not yet confirmed. It is not counted in the quarterly report until the
        Programme Director confirms it.
      </span>
    </p>
  );
}
