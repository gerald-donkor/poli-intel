import "server-only";

/**
 * THE SOURCE REGISTRY — one table, and the single answer to "how often do we
 * check the Gazette?" (AGENTS.md §14.2).
 *
 * Per-source cadences live here and NOWHERE else. No job below `lib/jobs/`
 * contains a cadence literal, a source URL, or a retrieval-method branch keyed
 * to a source name: the scheduler asks this module which sources are due, and
 * the fetch function asks it what one source is.
 *
 * The seven sources and their cadences are spec §3.2 verbatim. The RETRIEVAL
 * METHODS are not: spec §3.2 (and the `inngest-jobs` skill after it) assigns RSS
 * to UNFCCC, CBD and ITTO, and every URL below was checked against the live site
 * on 2026-08-02, which found that split to be wrong in three places.
 *
 *   - UNFCCC serves no reachable feed. `unfccc.int/news/rss.xml`,
 *     `/rss.xml` and `/news/rss` all answer 200 with an Incapsula bot-check
 *     page rather than XML, so a plain fetch can never read it. It is a SCRAPE
 *     source: a real browser is what gets past that.
 *   - ITTO publishes no RSS feed at all. Also a scrape source.
 *   - The Forestry Commission, conversely, DOES publish a feed — its site moved
 *     to fc.gov.gh, and `fc.gov.gh/feed/` returns `application/rss+xml`. It is
 *     the one source that gained a feed rather than losing one. (The old
 *     `fcghana.org` is now a placeholder page with no news section.)
 *
 * The methods below are what the sites actually serve. Where that departs from
 * the spec, this comment is the record of why.
 *
 * Source URLs are deliberately NOT environment variables. They are not secrets,
 * they are the definition of what this product monitors, and moving them to
 * `.env` would leave a registry that no longer says what it registers.
 */

/** Spec §3.2's three retrieval mechanisms. */
export type RadarRetrievalMethod = "rss" | "scrape" | "grounded";

export type RadarCadence = "daily" | "weekly" | "monthly";

/**
 * A period during which a source is checked more often than its base cadence.
 *
 * This type exists because of one row in spec §3.2: UNFCCC is "daily during
 * COP". That is a real conditional, not a rounding of "daily". Hard-coding the
 * busier rate all year spends the free-tier budget for eleven months on a
 * secretariat that publishes nothing; hard-coding the quieter one misses the
 * fortnight the whole source exists for.
 */
export type IntensifiedWindow = {
  /** Named so a run record and a gap analysis can say WHY the rate changed. */
  name: string;
  cadence: RadarCadence;
  /** Inclusive, ISO date (UTC). */
  from: string;
  /** Inclusive, ISO date (UTC). */
  to: string;
};

export type RadarSource = {
  /** Stable registry key. Written to `radar_run.source_id`; never renamed. */
  id: string;
  /** Human-readable, and what `policy_signal.source_name` carries. */
  name: string;
  /** The listing page or feed the fetch starts from. Absolute http(s). */
  url: string;
  method: RadarRetrievalMethod;
  cadence: RadarCadence;
  intensified?: readonly IntensifiedWindow[];
  /** Spec §3.2's "signal type" column — what this source is monitored FOR. */
  signalTypes: string;
  /**
   * CSS selector for the anchors that are this source's listing entries.
   *
   * Scrape sources only. Every URL in this registry was verified live on
   * 2026-08-02; THESE SELECTORS WERE NOT — they are broad, conventional
   * patterns chosen to survive a redesign rather than to fit one exactly, and
   * each should be narrowed once someone has watched what its source actually
   * returns. A selector that stops matching is exactly the failure `radar_run`
   * exists to make visible: it shows up as `empty` run after run, which the gap
   * analysis reports rather than mistaking for a quiet fortnight.
   */
  itemSelector?: string;
};

/**
 * COP31, Belém → the November 2026 session window.
 *
 * MAINTAINED BY HAND, AND UNVERIFIED. These dates are config data rather than
 * logic precisely so that correcting them is a one-line edit; confirm them
 * against the UNFCCC calendar before November, because a wrong window here
 * fails quietly in both directions — an unnoticed fortnight of daily polling,
 * or an unnoticed fortnight of missing the negotiating texts.
 */
const COP_WINDOWS: readonly IntensifiedWindow[] = [
  { name: "COP31", cadence: "daily", from: "2026-11-09", to: "2026-11-20" },
];

/**
 * Spec §3.2's monitoring table, in the order it appears there.
 */
export const RADAR_SOURCES: readonly RadarSource[] = [
  {
    id: "ghana-gazette",
    name: "Ghana Gazette / Forestry Commission",
    // Verified 2026-08-02: application/rss+xml. The Commission's site moved
    // from fcghana.org, which is now an empty placeholder.
    url: "https://fc.gov.gh/feed/",
    method: "rss",
    cadence: "daily",
    signalTypes: "Draft regulations, policy notices",
  },
  {
    id: "eudr-implementing-acts",
    name: "EUDR implementing acts",
    url: "https://environment.ec.europa.eu/topics/forests/deforestation_en",
    method: "scrape",
    cadence: "weekly",
    signalTypes: "Consultation periods, guidance updates",
    itemSelector: "main a, .ecl-content-block a",
  },
  {
    id: "unfccc",
    name: "UNFCCC secretariat",
    // Verified 2026-08-02: every feed path answers with an Incapsula bot-check
    // page, so this is scraped with a real browser rather than polled.
    url: "https://unfccc.int/news",
    method: "scrape",
    itemSelector: ".news-listing a, article a, .views-row a",
    // Base cadence outside a session. Spec §3.2 states the intensified rate
    // ("daily during COP") and leaves the quiet-period rate implied; weekly is
    // the reading that keeps draft decisions inside a working week without
    // spending a daily request on a secretariat between sessions.
    cadence: "weekly",
    intensified: COP_WINDOWS,
    signalTypes: "Draft decisions, negotiating texts",
  },
  {
    id: "cocobod",
    name: "Cocobod announcements",
    url: "https://cocobod.gh/news",
    method: "scrape",
    cadence: "weekly",
    signalTypes: "Standard revisions, trade requirements",
    itemSelector: "article a, .news-item a",
  },
  {
    id: "itto",
    name: "ITTO newsletters",
    // Verified 2026-08-02: ITTO publishes no RSS feed, so this is scraped.
    url: "https://www.itto.int/news/",
    method: "scrape",
    cadence: "monthly",
    signalTypes: "Trade policy, legality discussions",
    itemSelector: "article a, .news a, .list-group-item a",
  },
  {
    id: "cbd",
    name: "CBD secretariat",
    // Verified 2026-08-02: text/xml RSS 2.0. Notifications rather than the
    // general news feed, because notifications ARE spec §3.2's signal type for
    // this source — implementation guidance and reporting obligations.
    url: "https://www.cbd.int/rss/notifications.aspx",
    method: "rss",
    cadence: "monthly",
    signalTypes: "Implementation guidance, reporting",
  },
  {
    id: "news-ghana-forestry",
    name: "Reuters / AllAfrica — Ghana forest policy",
    // Grounded search has no feed to fetch. The URL records where a person
    // would go to read the same material by hand.
    url: "https://allafrica.com/ghana/",
    method: "grounded",
    cadence: "daily",
    signalTypes: "Political signals, minister statements",
  },
];

export function findRadarSource(sourceId: string): RadarSource | undefined {
  return RADAR_SOURCES.find((source) => source.id === sourceId);
}

/**
 * The cadence a source is on for a given day — its base rate, unless an
 * intensified window covers the day.
 */
export function effectiveCadence(
  source: RadarSource,
  on: Date,
): { cadence: RadarCadence; window?: string } {
  const day = toIsoDate(on);

  for (const window of source.intensified ?? []) {
    if (day >= window.from && day <= window.to) {
      return { cadence: window.cadence, window: window.name };
    }
  }

  return { cadence: source.cadence };
}

/**
 * Whether a source is due on a given day.
 *
 * Derived from the date alone, with no stored "last run" state, so it is pure,
 * testable, and cannot drift out of step with reality after a missed day or a
 * replayed run:
 *
 *   - daily   — every day
 *   - weekly  — Mondays (UTC), so a week's consultations are in front of staff
 *               at the start of their week rather than the end of it
 *   - monthly — the 1st (UTC)
 */
export function isDueOn(source: RadarSource, on: Date): boolean {
  const { cadence } = effectiveCadence(source, on);

  switch (cadence) {
    case "daily":
      return true;
    case "weekly":
      return on.getUTCDay() === 1;
    case "monthly":
      return on.getUTCDate() === 1;
  }
}

export function dueSourcesOn(on: Date): RadarSource[] {
  return RADAR_SOURCES.filter((source) => isDueOn(source, on));
}

/** `YYYY-MM-DD` in UTC — also the per-day half of the fetch idempotency key. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
