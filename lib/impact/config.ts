/**
 * The Impact Tracker's cadence and its reporting calendar.
 *
 * NOT server-only. There is no credential and no prompt instruction here — a
 * cron string and some date arithmetic the quarterly report's UI also needs. The
 * model IDs, request budgets and caps live in `lib/ai/config.ts`, which IS
 * server-only.
 *
 * NO PER-SOURCE RADAR CADENCE APPEARS HERE. Those live in `lib/radar/sources.ts`
 * and are not this module's business (AGENTS.md §14.2).
 */

/**
 * Weekly, Monday 04:00 UTC (`AGENTS.md` §14.9, `inngest-jobs` rule 9).
 *
 * AHEAD of the radar's 05:00 fan-out and the digest's 06:30, so a citation found
 * overnight is in Monday's digest rather than Tuesday's — and early enough that
 * the two jobs are not competing for the same minute of the Gemini RPM ceiling.
 */
export const IMPACT_DETECTION_CRON = "0 4 * * 1";

/** A quarter, named the way a donor report names one. */
export type Quarter = {
  /** `2026-Q3` — stable, sortable, and what the URL carries. */
  key: string;
  year: number;
  /** 1–4. */
  quarter: number;
  label: string;
  start: Date;
  /** Exclusive: the first instant of the next quarter. */
  end: Date;
};

const QUARTER_KEY = /^(\d{4})-Q([1-4])$/;

/** The quarter a date falls in, in UTC. */
export function quarterFor(date: Date): Quarter {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;

  return buildQuarter(year, quarter);
}

/** The quarter before this one — the one a report is usually written about. */
export function previousQuarter(quarter: Quarter): Quarter {
  return quarter.quarter === 1
    ? buildQuarter(quarter.year - 1, 4)
    : buildQuarter(quarter.year, quarter.quarter - 1);
}

/**
 * Parse a `YYYY-Qn` key, or `null`.
 *
 * A URL parameter is untrusted input like any other: a key that does not match
 * the pattern exactly, or names an implausible year, produces `null` and the
 * caller falls back rather than constructing a window from a guess.
 */
export function parseQuarterKey(key: string): Quarter | null {
  const match = QUARTER_KEY.exec(key);

  if (!match) return null;

  const year = Number(match[1]);
  const quarter = Number(match[2]);

  if (year < 2000 || year > 2100) return null;

  return buildQuarter(year, quarter);
}

/** The quarters a report may be run for: this one and the seven before it. */
export function recentQuarters(now: Date, count = 8): Quarter[] {
  const quarters: Quarter[] = [];
  let cursor = quarterFor(now);

  for (let index = 0; index < count; index += 1) {
    quarters.push(cursor);
    cursor = previousQuarter(cursor);
  }

  return quarters;
}

function buildQuarter(year: number, quarter: number): Quarter {
  const startMonth = (quarter - 1) * 3;

  return {
    key: `${year}-Q${quarter}`,
    year,
    quarter,
    label: `Q${quarter} ${year}`,
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 1)),
  };
}
