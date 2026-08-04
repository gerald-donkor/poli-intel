import "server-only";

import { randomBytes } from "node:crypto";

/**
 * The incremental-authorisation flow's own state: the CSRF value, where it is
 * kept, and the two internal paths the flow moves between.
 *
 * IT LIVES HERE RATHER THAN IN ANY OF THE THREE ROUTES that need it — the
 * export handler starts the flow, `/api/auth/google-drive` sends the browser to
 * Google, and the callback verifies the return. A second copy of the cookie
 * name or of the return path would be a second place for the flow to come
 * apart, and the "once, never a loop" rule below only works if all three agree
 * on one spelling.
 *
 * NO SECRET IS READ HERE. The OAuth credentials and the encryption key are read
 * in `drive-client.ts` and nowhere else.
 */

/**
 * The `state` value, and the brief it belongs to, held in a cookie rather than
 * a table.
 *
 * A ROW WOULD BUY NOTHING. The value is single-use, expires in minutes, and is
 * only ever compared against what comes back on the same browser — which is
 * exactly a cookie's shape. A `google_drive_oauth_state` table would be a
 * migration, a write, and a cleanup job for a value that is dead either way in
 * ten minutes.
 *
 * `HttpOnly` so no script can read it, `SameSite=Lax` because the callback
 * arrives as a top-level GET navigation from Google and a stricter setting
 * would drop the cookie exactly when it is needed, and `Path` scoped to the
 * flow so it is not attached to every other request in the application.
 */
export const DRIVE_STATE_COOKIE = "evibrief.drive_oauth";

export const DRIVE_STATE_COOKIE_PATH = "/api/auth/google-drive";

/** Long enough that a consent screen can be read; short enough to be dead soon. */
export const DRIVE_STATE_MAX_AGE_SECONDS = 600;

/** 256 bits of randomness. The value is opaque and is never rendered. */
export function newConsentState(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * The cookie's payload: the state, then the brief this flow returns to.
 *
 * THE BRIEF ID TRAVELS SERVER-SIDE, in the cookie rather than only in the URL,
 * so that the redirect after consent is built from a value this application
 * set. Google echoes `state` back verbatim; nothing it returns is used to
 * construct a destination.
 */
export function packConsentCookie(state: string, briefId: string): string {
  return `${state}.${briefId}`;
}

export function unpackConsentCookie(
  value: string | undefined,
): { state: string; briefId: string } | null {
  if (!value) return null;

  const separator = value.indexOf(".");

  if (separator <= 0) return null;

  const state = value.slice(0, separator);
  const briefId = value.slice(separator + 1);

  if (!state || !isBriefId(briefId)) return null;

  return { state, briefId };
}

/**
 * A brief id is a UUID, and this is checked before the value is ever used to
 * build a path.
 *
 * The reason is narrow and worth stating: the id becomes a path segment in the
 * return URL. Constraining it to a known shape means the return target cannot
 * be anything but this application's own export route for one brief — which is
 * how this flow avoids an open redirect without needing to validate a URL at
 * all.
 */
export function isBriefId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Where the export handler sends someone who has no usable grant. */
export function driveConsentStartPath(briefId: string): string {
  return `${DRIVE_STATE_COOKIE_PATH}?briefId=${encodeURIComponent(briefId)}`;
}

/**
 * The marker that says "you have just been through consent".
 *
 * IT IS WHAT MAKES THE FLOW HAPPEN ONCE. The export handler redirects into
 * consent only when this is absent; a second pass that still finds no usable
 * grant is a readable refusal instead of another redirect, so a person can
 * never be bounced between Google and this application (§17.6 — every state
 * named, and none of them a loop).
 */
export const DRIVE_GRANTED_PARAM = "granted";

/** Where the callback returns to once the grant is stored. */
export function driveExportReturnPath(briefId: string): string {
  return `/api/briefs/${encodeURIComponent(briefId)}/export?format=gdoc&${DRIVE_GRANTED_PARAM}=1`;
}
