import "server-only";

import { RADAR_MAX_DOCUMENT_CHARS, RADAR_MAX_ITEMS_PER_RUN } from "@/lib/ai/config";

import type { RadarSource } from "./sources";

/**
 * Fetching and extraction — RSS polling and Playwright scraping, reduced to one
 * common `DetectedItem` shape so the rest of the pipeline never branches on
 * where an item came from (spec §3.2, AGENTS.md §14.3).
 *
 * SERVER-ONLY, AND JOBS ONLY. Scraping and radar processing never run in
 * browser code and never inside a request handler (§18, §14.1).
 *
 * EVERYTHING HERE FETCHES UNTRUSTED REMOTE PAGES, so every path is bounded:
 *   - a hard navigation / request timeout, so a hanging host cannot park a run;
 *   - a response-size cap, so a hostile or broken feed cannot exhaust memory;
 *   - a character cap per item, so one enormous page cannot become one enormous
 *     Gemini request;
 *   - an item cap per run, which is also what the Gemini throttle is sized from.
 *
 * ONLY TEXT LEAVES HERE. No fetched HTML is stored, nothing fetched is
 * evaluated into application state, and a scraped page's markup never reaches
 * the database. A policy document the radar fetches is the SUBJECT of a signal,
 * never evidence: nothing in this module writes to `evidence_item`, and a
 * fetched Gazette notice does not enter the knowledge base.
 *
 * LOGGING: nothing here logs a fetched body, a title, or a caught error's
 * message (§7.6, §13.9).
 */

/** One thing a source published, before any model has seen it. */
export type DetectedItem = {
  sourceId: string;
  sourceName: string;
  /** Absolute http(s), validated before it is ever stored or followed. */
  url: string;
  title: string;
  /** Public document text, already capped at RADAR_MAX_DOCUMENT_CHARS. */
  text: string;
  publishedAt: Date | null;
};

export type FetchFailure = {
  /** Short machine reason. Never a caught error's message. */
  reason: string;
};

export type FetchResult =
  | { ok: true; items: DetectedItem[] }
  | { ok: false; failure: FetchFailure };

/** A slow host is a failed source, not a stalled radar. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Feeds are text. Anything past this is not a feed worth parsing. */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Chromium's own budget, including page scripts settling. */
const PAGE_TIMEOUT_MS = 30_000;

/**
 * Fetch one source by its declared retrieval method.
 *
 * `grounded` is rejected here as a typed failure rather than silently returning
 * nothing: Gemini grounded-search detection is a different mechanism with
 * different failure modes and it is not implemented yet. The caller turns this
 * into a `not_implemented` run record so the gap analysis reads "not yet
 * monitored" and never "a quiet week" (§14.7).
 */
export async function fetchSource(source: RadarSource): Promise<FetchResult> {
  switch (source.method) {
    case "rss":
      return fetchRssSource(source);
    case "scrape":
      return scrapeSource(source);
    case "grounded":
      return { ok: false, failure: { reason: "not_implemented:grounded" } };
  }
}

/* -------------------------------------------------------------------------
 * RSS
 * ---------------------------------------------------------------------- */

async function fetchRssSource(source: RadarSource): Promise<FetchResult> {
  const body = await fetchText(source.url);

  if (!body.ok) return body;

  // A BODY THAT IS NOT A FEED IS A FAILURE, NOT AN EMPTY WEEK.
  //
  // This check earns its place: three of this project's candidate feeds answer
  // HTTP 200 with an HTML page — a bot-check interstitial, a soft 404, a
  // "site moved" notice. Parsing that yields zero items, and without this the
  // run would be recorded as `empty`, which is precisely the reading §14.7
  // exists to prevent. A source that has quietly stopped serving a feed must be
  // distinguishable from a source with no news.
  if (!looksLikeFeed(body.text)) {
    return { ok: false, failure: { reason: "not_a_feed" } };
  }

  return { ok: true, items: parseFeed(body.text, source) };
}

function looksLikeFeed(body: string): boolean {
  const head = body.slice(0, 1000).toLowerCase();

  return (
    head.includes("<rss") || head.includes("<feed") || head.includes("<rdf:rdf")
  );
}

async function fetchText(
  url: string,
): Promise<{ ok: true; text: string } | { ok: false; failure: FetchFailure }> {
  if (!isHttpUrl(url)) {
    return { ok: false, failure: { reason: "invalid_source_url" } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });

    if (!response.ok) {
      return { ok: false, failure: { reason: `http_${response.status}` } };
    }

    const body = await response.arrayBuffer();

    if (body.byteLength > MAX_RESPONSE_BYTES) {
      return { ok: false, failure: { reason: "response_too_large" } };
    }

    return { ok: true, text: new TextDecoder().decode(body) };
  } catch (error) {
    // The reason, never the message — an error body can echo the response.
    return {
      ok: false,
      failure: {
        reason:
          error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : "request_failed",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A deliberately small RSS 2.0 / Atom reader.
 *
 * No XML dependency: this change adds Playwright and nothing alongside it, and
 * a feed reader that only ever reads five fields out of a well-formed feed does
 * not earn a parser. It reads what it recognises and ignores everything else —
 * a feed it cannot understand yields no items, which the caller records as
 * `empty` and the gap analysis surfaces.
 */
export function parseFeed(xml: string, source: RadarSource): DetectedItem[] {
  const entries = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)];
  const items: DetectedItem[] = [];

  for (const [entry] of entries) {
    if (items.length >= RADAR_MAX_ITEMS_PER_RUN) break;

    const title = decodeXmlText(readTag(entry, "title") ?? "");
    const url = readFeedLink(entry);

    // Both are required: a title is what dedup compares, and a URL is what a
    // reviewer opens. An entry missing either is not a signal.
    if (title.length === 0 || !url) continue;

    const description =
      readTag(entry, "content:encoded") ??
      readTag(entry, "description") ??
      readTag(entry, "summary") ??
      readTag(entry, "content") ??
      "";

    items.push({
      sourceId: source.id,
      sourceName: source.name,
      url,
      title: clamp(title, 300),
      text: clamp(stripTags(decodeXmlText(description)), RADAR_MAX_DOCUMENT_CHARS),
      publishedAt: readDate(entry),
    });
  }

  return items;
}

function readTag(entry: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const match = pattern.exec(entry);

  return match ? match[1].trim() : null;
}

/** RSS puts the URL in `<link>`'s text; Atom puts it in `<link href>`. */
function readFeedLink(entry: string): string | null {
  const href = /<link[^>]*\bhref=["']([^"']+)["']/i.exec(entry);
  const candidate = href
    ? href[1]
    : (readTag(entry, "link") ?? readTag(entry, "guid") ?? "");
  const url = decodeXmlText(candidate).trim();

  return isHttpUrl(url) ? url : null;
}

function readDate(entry: string): Date | null {
  const raw =
    readTag(entry, "pubDate") ??
    readTag(entry, "updated") ??
    readTag(entry, "published") ??
    readTag(entry, "dc:date");

  if (!raw) return null;

  const parsed = new Date(decodeXmlText(raw));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Markup is never stored or rendered — only the text inside it survives. */
function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------
 * Playwright
 * ---------------------------------------------------------------------- */

/**
 * Scrape one listing page.
 *
 * ONE page load per run, and no navigation to detail pages. A crawl would
 * multiply both the run's duration and the load this puts on a government site,
 * and the listing entry already carries what detection needs: a headline to
 * deduplicate on, a URL a reviewer can open, and enough surrounding text for
 * classification. Following every link would also be the point at which a
 * hostile page could steer the run somewhere it was never configured to go.
 *
 * The browser is closed in `finally`, including on a thrown navigation, so a
 * failing source cannot leak a Chromium process into the next run.
 */
async function scrapeSource(source: RadarSource): Promise<FetchResult> {
  if (!isHttpUrl(source.url)) {
    return { ok: false, failure: { reason: "invalid_source_url" } };
  }

  const { chromium } = await import("playwright");

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch();

    const page = await browser.newPage();

    page.setDefaultTimeout(PAGE_TIMEOUT_MS);

    const response = await page.goto(source.url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });

    if (response && !response.ok()) {
      return { ok: false, failure: { reason: `http_${response.status()}` } };
    }

    const selector = source.itemSelector ?? "a";

    // `evaluate` returns plain data — strings the page cannot use to reach into
    // this process. Nothing from the page is executed here, and no markup
    // crosses this boundary.
    const raw = await page.evaluate(
      ({ selector, limit, maxChars }) => {
        const seen = new Set<string>();
        const out: { href: string; title: string; text: string }[] = [];

        for (const node of Array.from(document.querySelectorAll(selector))) {
          if (out.length >= limit) break;

          const anchor = node as HTMLAnchorElement;
          const href = anchor.href;
          const title = (anchor.textContent ?? "").replace(/\s+/g, " ").trim();

          if (!href || title.length < 12 || seen.has(href)) continue;

          seen.add(href);

          const container = anchor.closest("article, li, .card, section") ?? anchor;
          const text = (container.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, maxChars);

          out.push({ href, title, text });
        }

        return out;
      },
      {
        selector,
        limit: RADAR_MAX_ITEMS_PER_RUN,
        maxChars: RADAR_MAX_DOCUMENT_CHARS,
      },
    );

    const items: DetectedItem[] = [];

    for (const entry of raw) {
      // Re-validated on this side of the boundary. The page chose that string.
      if (!isHttpUrl(entry.href)) continue;

      items.push({
        sourceId: source.id,
        sourceName: source.name,
        url: entry.href,
        title: clamp(entry.title, 300),
        text: clamp(entry.text, RADAR_MAX_DOCUMENT_CHARS),
        publishedAt: null,
      });
    }

    return { ok: true, items };
  } catch (error) {
    return {
      ok: false,
      failure: {
        reason:
          error instanceof Error && error.name === "TimeoutError"
            ? "timeout"
            : "scrape_failed",
      },
    };
  } finally {
    await browser?.close().catch(() => {
      // Nothing to report: the run's outcome is already decided, and a browser
      // that will not close is not something a radar record should carry.
    });
  }
}

/* -------------------------------------------------------------------------
 * Shared
 * ---------------------------------------------------------------------- */

/**
 * `sourceUrl` is stored and later rendered as a link, so it is validated as an
 * absolute http(s) URL before it is stored — never a `javascript:` or `data:`
 * URL from a page this project does not control.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
