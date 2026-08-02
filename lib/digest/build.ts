import { BRIEF_STATUS_LABELS } from "@/app/(app)/briefs/labels";
import {
  formatSignalDate,
  RELEVANCE_LABELS,
  URGENCY_LABELS,
  URGENCY_ORDER,
  URGENCY_WINDOWS,
} from "@/app/(app)/signals/labels";
import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import type { DigestRecipient, DigestWindowReads } from "@/lib/db/digest";
import { DIGEST_SECTIONS, DIGEST_WINDOW_HOURS } from "@/lib/digest/config";
import type {
  DigestUrgencyGroup,
  MorningDigestProps,
} from "@/emails/morning-digest";

/**
 * Turn the window's reads plus one recipient's role into the template's props.
 *
 * PURE, so the whole shape of a person's email can be read in one place without
 * a database or an API key. The job does the I/O; this does the deciding.
 *
 * IT READS THE BOARD'S OWN LABEL TABLES rather than restating them
 * (`app/(app)/signals/labels.ts`, `app/(app)/briefs/labels.ts`, the two AI
 * profile tables). A rename there must not leave the digest saying something the
 * board no longer says — and the enums are never re-declared as string unions
 * (§12.7).
 *
 * NOTHING HERE READS EVIDENCE. `DigestWindowReads` has no field that could carry
 * an evidence title, excerpt or body (see `lib/db/digest.ts`), so there is
 * nothing to filter out here — the gate's egress half is enforced upstream, by
 * the shape of the read (§7.6).
 */
export function buildMorningDigest({
  recipient,
  reads,
  window,
  appUrl,
}: {
  recipient: DigestRecipient;
  reads: DigestWindowReads;
  window: { start: Date; end: Date };
  appUrl: string;
}): MorningDigestProps | null {
  const sections = DIGEST_SECTIONS[recipient.role];

  const signalGroups = sections.signals ? groupByUrgency(reads) : [];
  const briefs = sections.drafts
    ? reads.briefs.map((brief) => ({
        id: brief.id,
        title: brief.title,
        briefTypeLabel: briefTypeLabel(brief.briefType),
        audienceLabel: audienceLabel(brief.audience),
        statusLabel: BRIEF_STATUS_LABELS[brief.status],
        openFlagCount: brief.openFlagCount,
      }))
    : null;
  const classificationQueueCount = sections.classificationQueue
    ? reads.pendingClassificationCount
    : null;

  const signalCount = signalGroups.reduce(
    (total, group) => total + group.signals.length,
    0,
  );

  // A RECIPIENT WITH NOTHING TO READ IS SENT NOTHING. A daily "nothing happened"
  // trains people to stop opening it, which costs more than it saves — and the
  // per-recipient form of that rule is the one that matters, because an officer
  // whose only section is empty should not receive a page of headings.
  const hasContent =
    signalCount > 0 ||
    (briefs !== null && briefs.length > 0) ||
    (classificationQueueCount !== null && classificationQueueCount > 0);

  if (!hasContent) return null;

  return {
    recipientName: firstName(recipient.name),
    windowLabel: describeWindow(window),
    appUrl,
    signalGroups,
    signalCount,
    signalsTruncated: reads.signalsTruncated,
    radar: reads.radar,
    briefs,
    briefsTruncated: briefs !== null && reads.briefsTruncated,
    classificationQueueCount,
  };
}

/**
 * Group into sections in `URGENCY_ORDER` — immediate, near-term, horizon, watch.
 *
 * THE ENUM'S ORDER CARRIES THE TAXONOMY and nothing re-sorts it: not by count,
 * not by recency (§11.4). Empty stages are dropped rather than rendered as empty
 * headings, which is a presentation decision, not a re-ordering one.
 */
function groupByUrgency(reads: DigestWindowReads): DigestUrgencyGroup[] {
  return URGENCY_ORDER.map((urgency) => ({
    urgency,
    label: URGENCY_LABELS[urgency],
    window: URGENCY_WINDOWS[urgency],
    signals: reads.signals
      .filter((signal) => signal.urgency === urgency)
      .map((signal) => ({
        id: signal.id,
        title: signal.title,
        summaryText: signal.summaryText,
        sourceName: signal.sourceName,
        detectedAt: formatSignalDate(signal.detectedAt),
        relevanceLabel: RELEVANCE_LABELS[signal.relevance],
      })),
  })).filter((group) => group.signals.length > 0);
}

/** "the 24 hours to 06:30 UTC on 2 August 2026" — the window, stated. */
function describeWindow({ end }: { start: Date; end: Date }): string {
  const time = `${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`;
  const date = end.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return `the ${DIGEST_WINDOW_HOURS} hours to ${time} UTC on ${date}`;
}

/** Addressed to a person, not to a mailing list. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Hello";
}
