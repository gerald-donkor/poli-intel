import { StaffRole } from "@/lib/generated/prisma/enums";

/**
 * The morning digest's one config table (AGENTS.md §13.1's spirit): when it
 * wakes, what window it reads, how much it carries, and who receives it.
 *
 * NOT server-only. There is no credential and no prompt instruction here, only
 * a cadence and a role table — the same call `brief-types.ts` makes for the same
 * reason. `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` are read in `lib/email/`,
 * which IS server-only.
 *
 * NO PER-SOURCE CADENCE APPEARS HERE. Those live in `lib/radar/sources.ts` and
 * are not the digest's business — the times below are when the digest is
 * DELIVERED, not how often anything is checked.
 */

/**
 * 06:30 UTC daily.
 *
 * Ghana is UTC+0, so this is 06:30 in Kumasi — a morning digest that actually
 * arrives in the morning. It sits behind the radar's 05:00 fan-out and the
 * evidence sweep's 05:30 so the night's signals are fetched, deduplicated and
 * classified before the digest reads them.
 */
export const DIGEST_CRON = "30 6 * * *";

/** The two halves of `DIGEST_CRON`, so the window can be derived from it. */
export const DIGEST_SEND_HOUR_UTC = 6;
export const DIGEST_SEND_MINUTE_UTC = 30;

/**
 * The window is "since the previous digest", expressed as the last 24 hours.
 *
 * Not "today", which would silently drop a signal detected at 06:29. The length
 * lives beside the send time above so the two cannot drift into overlapping or
 * leaving a gap.
 */
export const DIGEST_WINDOW_HOURS = 24;

/** Caps, so one busy night cannot produce a 4,000-line email. */
export const DIGEST_MAX_SIGNALS = 12;
export const DIGEST_MAX_BRIEFS = 8;

/**
 * Who receives it.
 *
 * FIELD OFFICERS ARE ABSENT, DELIBERATELY. §10.5 gives them mobile submission
 * and digests in their OWN register — plain language, one message per screen, no
 * internal taxonomy (§11.12). Sending them a kanban-shaped email full of
 * "urgency" and "relevance" would be the exact failure that rule exists to
 * prevent. Their digest is the WhatsApp path, and it is a different prompt.
 */
export const DIGEST_RECIPIENT_ROLES: readonly StaffRole[] = [
  StaffRole.programme_director,
  StaffRole.policy_advocacy_officer,
  StaffRole.research_officer,
];

/**
 * ONE TEMPLATE, ROLE-AWARE SECTIONS — not three templates, which would be three
 * places to fix one wording change.
 *
 * Drafts awaiting a decision are the Programme Director's, because they are the
 * only role that can approve, send back, submit or publish (§10.2). The
 * classification backlog is a Research Officer's queue (§10.4), and the Director
 * sees it too because they hold full access and a governance backlog is the last
 * thing to hide from the person accountable for it (§7.5).
 */
export const DIGEST_SECTIONS: Record<
  StaffRole,
  { signals: boolean; drafts: boolean; classificationQueue: boolean }
> = {
  [StaffRole.programme_director]: {
    signals: true,
    drafts: true,
    classificationQueue: true,
  },
  [StaffRole.policy_advocacy_officer]: {
    signals: true,
    drafts: false,
    classificationQueue: false,
  },
  [StaffRole.research_officer]: {
    signals: true,
    drafts: false,
    classificationQueue: true,
  },
  [StaffRole.field_officer]: {
    signals: false,
    drafts: false,
    classificationQueue: false,
  },
};

/**
 * The instant the digest reads up to, derived from the cron rather than from
 * "now".
 *
 * DETERMINISTIC ON PURPOSE. Re-triggering the job on the same day must produce
 * the same window, which is what makes the per-recipient idempotency key mean
 * something: the same key with a DIFFERENT payload is a 409 from Resend, not a
 * silent no-op. Anchoring to the scheduled instant keeps the payload identical,
 * so a retry genuinely re-sends nothing.
 *
 * The consequence is stated rather than hidden: a manual 09:00 trigger still
 * reports the morning's window, not the three hours since it.
 */
export function digestWindowFor(now: Date): { start: Date; end: Date } {
  const end = new Date(now);
  end.setUTCHours(DIGEST_SEND_HOUR_UTC, DIGEST_SEND_MINUTE_UTC, 0, 0);

  const start = new Date(end.getTime() - DIGEST_WINDOW_HOURS * 60 * 60 * 1000);

  return { start, end };
}

/** The date half of the idempotency key, and of the email's own dateline. */
export function digestDate(end: Date): string {
  return end.toISOString().slice(0, 10);
}

/**
 * `digest/<staffUserId>/<YYYY-MM-DD>` — inside Resend's 24-hour expiry and well
 * inside its 256-character cap, so an Inngest retry of a step that already sent
 * re-sends nothing.
 */
export function digestIdempotencyKey(
  staffUserId: string,
  isoDate: string,
): string {
  return `digest/${staffUserId}/${isoDate}`;
}

/**
 * The base every link in the email is joined to.
 *
 * `AUTH_URL` is Auth.js v5's canonical deployment URL and already in
 * `.env.example`, so the digest introduces no new environment variable. No URL
 * in the email is ever built from stored external content.
 */
export function appBaseUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
