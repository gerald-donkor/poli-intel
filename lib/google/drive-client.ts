import "server-only";

import { decodeKey, open, seal } from "@/lib/crypto/secret-box";

/**
 * The Google Drive grant's reach: the consent URL, the code exchange, and the
 * minting of a short-lived access token from a stored refresh token.
 *
 * THE ONE PLACE `DRIVE_TOKEN_ENCRYPTION_KEY` IS READ, and the one place a
 * refresh token is opened. Everything else in this feature handles ciphertext
 * or an access token that dies with the request. Nothing here is
 * `NEXT_PUBLIC_*`, nothing here is imported from a client component, and no
 * token, code, or key appears in a log line, a Sentry event, or a PostHog
 * property (§18, §7.6).
 *
 * THE SIGN-IN PATH IS NOT TOUCHED. `auth.ts` requests no Drive scope: widening
 * it would make every staff member grant Drive access at first sign-in,
 * including the Field Officers who can never export anything (§10.5). This is
 * Google's own incremental-authorisation pattern instead — the consent screen
 * names Drive at the moment someone asked for a Google Doc.
 *
 * IT REUSES `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. The same OAuth client that
 * signs staff in requests this grant; a second client would mean a second
 * consent relationship for one application, and Google's own incremental
 * authorization is built around it being the same one.
 *
 * `null` WHEN UNCONFIGURED, the same shape `whatsappConfig()` and
 * `ussdSecret()` use. A local `npm run dev` with no Drive setup must not crash,
 * and it is what makes the export reviewable before Tropenbos has provisioned
 * anything.
 */

/**
 * Per-file access, and nothing wider.
 *
 * `drive.file` is limited to files this application created. It is a
 * non-sensitive scope, so it needs no Google app verification and no CASA
 * security assessment — the paid annual third-party audit that `drive` and
 * `drive.readonly` trigger, which a four-person organisation on free tiers
 * cannot absorb.
 *
 * It is also the right scope on the merits: EviBrief has no business reading
 * anything else in anyone's Drive, and this makes that structural rather than
 * promised. Do not widen it.
 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export type DriveOAuthConfig = {
  clientId: string;
  clientSecret: string;
  encryptionKey: Buffer;
};

/**
 * The three values this feature needs, or null.
 *
 * All three or none: a deployment with an OAuth client but no encryption key
 * could complete a consent flow and then have nowhere safe to put the refresh
 * token, so it is treated as unconfigured rather than half-working.
 */
export function driveOAuthConfig(): DriveOAuthConfig | null {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  const encryptionKey = decodeKey(process.env.DRIVE_TOKEN_ENCRYPTION_KEY);

  if (!clientId || !clientSecret || !encryptionKey) return null;

  return { clientId, clientSecret, encryptionKey };
}

/** Whether this deployment can offer Google Docs export at all. */
export function isDriveExportConfigured(): boolean {
  return driveOAuthConfig() !== null;
}

/**
 * Where the browser is sent to ask for the Drive grant.
 *
 * `access_type=offline` with `prompt=consent` is what makes Google issue a
 * refresh token. `prompt=consent` is here rather than on every export
 * deliberately: this URL is built only when there is no usable grant, so the
 * consent screen appears the first time and after a revocation, and never
 * again. An application that shows a consent screen repeatedly teaches its
 * users to click through consent screens without reading them.
 *
 * `include_granted_scopes=true` keeps the sign-in scopes the person already
 * granted rather than replacing them with this one.
 */
export function driveConsentUrl(input: {
  config: DriveOAuthConfig;
  redirectUri: string;
  state: string;
  /** Pre-selects the right account when someone is signed into several. */
  loginHint?: string | null;
}): string {
  const url = new URL(AUTHORIZATION_ENDPOINT);

  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);

  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);

  return url.toString();
}

/**
 * The redirect URI, which must match a URI registered on the OAuth client
 * exactly — Google compares the string, not the route.
 *
 * `AUTH_URL` FIRST, request origin second. Auth.js already treats `AUTH_URL` as
 * this deployment's canonical address, so deriving the Drive callback from
 * anything else would let a proxied or preview host produce a URI Google has
 * never seen. The request's own origin is the fallback for a local `npm run
 * dev` where `AUTH_URL` is often unset.
 *
 * It is built from configuration, never from a query parameter — a
 * caller-supplied redirect URI is how an OAuth flow becomes an open redirect.
 */
export function driveCallbackUrl(requestUrl: string): string {
  const base = process.env.AUTH_URL?.trim() || new URL(requestUrl).origin;

  return new URL("/api/auth/google-drive/callback", base).toString();
}

export type CodeExchangeResult =
  | { ok: true; refreshTokenSealed: string; scope: string }
  | { ok: false; reason: "no_refresh_token" | "exchange_failed" };

/**
 * The authorisation code, exchanged for a refresh token — sealed before it
 * leaves this function.
 *
 * THE RAW TOKEN NEVER CROSSES THIS BOUNDARY. The caller receives ciphertext, so
 * the route that stores it cannot log or return the credential even by
 * accident.
 *
 * `no_refresh_token` is a real, separate outcome rather than a crash: Google
 * omits `refresh_token` when a grant already exists and consent was not
 * re-prompted, and the honest answer to the person is "authorise again", not a
 * 500.
 */
export async function exchangeDriveCode(input: {
  config: DriveOAuthConfig;
  code: string;
  redirectUri: string;
}): Promise<CodeExchangeResult> {
  const body = new URLSearchParams({
    client_id: input.config.clientId,
    client_secret: input.config.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
  });

  let response: Response;

  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    // The network, not the grant. No response body to read and nothing to
    // report but the shape of the failure.
    return { ok: false, reason: "exchange_failed" };
  }

  if (!response.ok) {
    // Status only. A token endpoint's error body can echo the code back.
    console.warn("drive.oauth.exchange_failed", { status: response.status });
    return { ok: false, reason: "exchange_failed" };
  }

  const payload = (await response.json()) as {
    refresh_token?: unknown;
    scope?: unknown;
  };

  const refreshToken =
    typeof payload.refresh_token === "string" ? payload.refresh_token : null;

  if (!refreshToken) return { ok: false, reason: "no_refresh_token" };

  return {
    ok: true,
    refreshTokenSealed: seal(refreshToken, input.config.encryptionKey),
    scope: typeof payload.scope === "string" ? payload.scope : DRIVE_SCOPE,
  };
}

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "revoked" | "unavailable" };

/**
 * A short-lived access token for one request, minted from the stored grant.
 *
 * IT IS NEVER PERSISTED. It lives on the stack for the length of one export and
 * is not written to the grant row, a cookie, or a cache.
 *
 * `revoked` IS A DISTINCT OUTCOME, and it is the one that matters: Google
 * answers `invalid_grant` when the person has withdrawn access at
 * myaccount.google.com. That is not a server error — it is a fact about the
 * grant, and the caller's correct response is to delete the stale row and send
 * them back through consent (§17.6, every state named).
 *
 * A grant whose ciphertext will not open — a rotated encryption key, a
 * corrupted value — is `revoked` too, and deliberately so: the stored secret is
 * unusable and the only way forward is a fresh grant. Reporting it differently
 * would give a caller a distinction it cannot act on.
 */
export async function driveAccessToken(input: {
  config: DriveOAuthConfig;
  refreshTokenSealed: string;
}): Promise<AccessTokenResult> {
  const refreshToken = open(input.refreshTokenSealed, input.config.encryptionKey);

  if (!refreshToken) return { ok: false, reason: "revoked" };

  const body = new URLSearchParams({
    client_id: input.config.clientId,
    client_secret: input.config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  let response: Response;

  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    // `invalid_grant` is the documented answer to a refresh token that has been
    // revoked, expired, or had its consent withdrawn. Read as text so a
    // non-JSON error page cannot throw on this path.
    const text = await response.text().catch(() => "");
    const revoked = text.includes("invalid_grant");

    console.warn("drive.oauth.refresh_failed", {
      status: response.status,
      revoked,
    });

    return { ok: false, reason: revoked ? "revoked" : "unavailable" };
  }

  const payload = (await response.json()) as { access_token?: unknown };

  if (typeof payload.access_token !== "string") {
    return { ok: false, reason: "unavailable" };
  }

  return { ok: true, accessToken: payload.access_token };
}
