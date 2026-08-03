/**
 * URL validation for anything that arrives from outside the application.
 *
 * IT LIVES HERE RATHER THAN IN EITHER CALLER because two layers now need it:
 * the radar's extraction (`lib/radar/extract.ts`) and the shared grounded-search
 * call (`lib/ai/grounded-search.ts`). A second copy of "is this a URL we may
 * store?" is a second place for the answer to drift, and the answer is a
 * security rule (AGENTS.md §18): every URL the product stores, renders as a
 * link, or resolves has been through here first.
 *
 * PURE, and deliberately not `server-only`: it takes a string and returns a
 * boolean. It touches no model, no database, and no secret.
 */

/** Absolute http(s) only. A `javascript:`, `data:` or relative URL is not one. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** The hostname, or a placeholder. Never throws on a malformed URL. */
export function describeHost(uri: string): string {
  try {
    return new URL(uri).hostname;
  } catch {
    return "unknown source";
  }
}
