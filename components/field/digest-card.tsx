import type { FieldBriefCard, FieldSignalCard } from "@/lib/db/field";
import {
  BRIEF_STATUS_PLAIN_LABEL,
  URGENCY_EYEBROW_CLASS,
  URGENCY_PLAIN_LABEL,
  URGENCY_RULE_CLASS,
  plainDate,
} from "@/lib/field/plain-language";
import { cn } from "@/lib/utils";

/**
 * One message per card (AGENTS.md §11.12).
 *
 * PLAIN LANGUAGE ONLY. Every word a reader sees comes from
 * `lib/field/plain-language.ts` — no "signal", no "urgency", no "relevance
 * score", no classification value. This surface is read by someone standing in a
 * cocoa plot, not by someone who has been in the office all week.
 *
 * URGENCY IS A 3px LEFT RULE AND AN EYEBROW, never a filled card (§11.5), and
 * the eyebrow always carries the words — the colour is never the only thing
 * saying it (§11.13).
 *
 * 14px MINIMUM BODY. Nothing on this surface is smaller.
 *
 * A SERVER COMPONENT, and it renders no link into the office screens: a Field
 * Officer has no access to `/signals` or `/briefs` (§10.5), so a card that
 * linked there would be an invitation to a sign-in wall.
 */

export function SignalDigestCard({ signal }: { signal: FieldSignalCard }) {
  return (
    <article
      className={cn(
        "bg-card border-line rounded-card shadow-raised border border-l-[3px] p-4.5 transition-shadow",
        URGENCY_RULE_CLASS[signal.urgency],
      )}
    >
      <p
        className={cn(
          "text-[12px] font-semibold tracking-[0.06em] uppercase",
          URGENCY_EYEBROW_CLASS[signal.urgency],
        )}
      >
        {URGENCY_PLAIN_LABEL[signal.urgency]}
      </p>

      <h3 className="text-ink mt-2 text-[16px] leading-snug font-semibold">
        {signal.title}
      </h3>

      {/*
        Generated prose from the classification call — the sans, never the
        serif. The serif is reserved for material the product did not author
        (§11.6).
      */}
      <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">
        {signal.summaryText}
      </p>

      <p className="text-ink-3 mt-3 text-[13px] leading-normal">
        <span>{signal.sourceName}</span>
        <span aria-hidden="true" className="mx-1.5 opacity-60">·</span>
        <span>{plainDate(signal.detectedAt)}</span>
      </p>
    </article>
  );
}

export function BriefDigestCard({ brief }: { brief: FieldBriefCard }) {
  return (
    <article className="bg-card border-line rounded-card shadow-raised border p-4.5 transition-shadow">
      <p className="text-ink-3 text-[12px] font-semibold tracking-[0.06em] uppercase">
        From the office
      </p>

      <h3 className="text-ink mt-2 text-[16px] leading-snug font-semibold">
        {brief.title}
      </h3>

      <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">
        <span>{BRIEF_STATUS_PLAIN_LABEL[brief.status]}</span>
        <span aria-hidden="true" className="mx-1.5 opacity-60">·</span>
        <span>{plainDate(brief.updatedAt)}</span>
      </p>
    </article>
  );
}

