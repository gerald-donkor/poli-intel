/**
 * The Field Officer surface's one config table.
 *
 * NOT server-only. There is no credential and no prompt instruction here, only
 * caps and a country — the same call `lib/digest/config.ts` makes for the same
 * reason. The service worker's cache name lives here too so the route, the
 * handler, and the worker cannot drift apart into three spellings of one name.
 */

/**
 * What the offline cache holds (AGENTS.md §17.4). Stated once, read by the
 * Route Handler that builds the snapshot and by the screen that renders it.
 */
export const FIELD_CACHE_MAX_SIGNALS = 30;
export const FIELD_CACHE_MAX_BRIEFS = 10;

/** How many of an officer's own submissions `/field/sent` lists. */
export const FIELD_SENT_MAX_ITEMS = 20;

/**
 * Every field observation is recorded against Ghana.
 *
 * A CONSTANT, NOT A FORM FIELD. Tropenbos Ghana's field officers work in the
 * Western North landscapes and nowhere else, and asking a person standing in a
 * cocoa plot to pick their country from a list is friction for an answer that is
 * never in doubt (§17.1). The landscape — the part that actually varies and is
 * the specificity that matters — is `locationNote`, which is asked.
 */
export const FIELD_SUBMISSION_COUNTRY = "Ghana";

/** The snapshot endpoint the service worker prefetches. */
export const FIELD_CACHE_PATH = "/api/field/cache";
