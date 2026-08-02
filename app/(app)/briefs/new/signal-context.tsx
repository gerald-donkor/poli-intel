import type { EvidenceListItem } from "@/lib/db/evidence";
import type {
  EvidenceMatchOutcome,
  Relevance,
  Urgency,
} from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

import {
  describeSignalPrefill,
  RELEVANCE_BADGE,
  RELEVANCE_LABELS,
  URGENCY_LABELS,
  URGENCY_RAMP,
} from "../../signals/labels";

/**
 * The signal this form was opened from, named at the top of it.
 *
 * URGENCY IS THE LEFT RULE AND THE EYEBROW, never a filled card (§11.5), and
 * relevance carries its own badge on its own scale, never the urgency ramp
 * (§11.4). The same treatment the signal's own card gets, so the two screens
 * read as one thing.
 *
 * THE SUMMARY IS GENERATED PROSE — the classification pass wrote it — so it
 * stays in the sans. The serif is for verbatim source material only, and this is
 * not that (§11.6). The line under the textarea says so in words too, because
 * the difference between "the radar's summary" and "the source document" is
 * exactly what an officer needs to know before pressing Generate.
 *
 * NOTHING HERE SAYS THE SYSTEM CHOSE ANYTHING (§8.8). Retrieval returned a
 * starting set; every sentence is about what was found, not what was decided.
 */
export function SignalContext({
  signal,
  matchedCount,
}: {
  signal: {
    signalId: string;
    title: string;
    summaryText: string;
    sourceName: string;
    sourceUrl: string;
    urgency: Urgency;
    relevance: Relevance;
    latestMatchOutcome: EvidenceMatchOutcome | null;
  };
  matchedCount: number;
}) {
  const ramp = URGENCY_RAMP[signal.urgency];

  return (
    <section
      className={cn(
        "bg-card rounded-card flex min-w-0 flex-col gap-3 border border-l-[3px] p-4 tablet:p-5",
        ramp.card,
      )}
      aria-labelledby="signal-context-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "text-[10.5px] font-semibold tracking-[0.06em] uppercase",
            ramp.eyebrow,
          )}
        >
          {URGENCY_LABELS[signal.urgency]}
          <span className="sr-only"> urgency</span>
        </p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
            RELEVANCE_BADGE[signal.relevance],
          )}
        >
          {RELEVANCE_LABELS[signal.relevance]}
          <span className="sr-only"> relevance</span>
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-ink-3 text-[11.5px]">Drafting from a signal</p>
        <h2
          id="signal-context-heading"
          className="text-ink text-[15px] leading-snug font-semibold"
        >
          {signal.title}
        </h2>
      </div>

      <p className="text-ink-2 max-w-[70ch] text-[13px] leading-[1.55]">
        {describeSignalPrefill({
          outcome: signal.latestMatchOutcome,
          matchedCount,
        })}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
        {/* External and untrusted: a link, never fetched, never embedded (§18). */}
        <a
          href={signal.sourceUrl}
          rel="noreferrer"
          target="_blank"
          className="text-primary-ink focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] break-words underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Open the source at {signal.sourceName}
        </a>
        <a
          href={`/signals/${signal.signalId}`}
          className="text-ink-3 focus-visible:ring-accent focus-visible:ring-offset-card rounded-[3px] underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Back to the signal
        </a>
      </div>
    </section>
  );
}

/**
 * The matched item as the picker needs it: the library row plus the number the
 * rerank actually computed for it.
 */
export type MatchedEvidenceItem = {
  item: EvidenceListItem;
  /** Null where the rerank omitted this candidate — "not scored", never a zero. */
  rerankScore: number | null;
};

/** Everything the generation form needs to open from a signal. */
export type SignalPrefill = {
  signalId: string;
  title: string;
  summaryText: string;
  sourceName: string;
  sourceUrl: string;
  urgency: Urgency;
  relevance: Relevance;
  latestMatchOutcome: EvidenceMatchOutcome | null;
  /** The textarea's opening value — the radar's title and summary, not a document. */
  policyText: string;
  /** Eligible matched items in rank order, already capped at the context size. */
  matched: MatchedEvidenceItem[];
};
