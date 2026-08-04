import { NextResponse, type NextRequest } from "next/server";

import { canExportBrief } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { saveGoogleDriveGrant } from "@/lib/db";
import {
  driveCallbackUrl,
  driveOAuthConfig,
  exchangeDriveCode,
} from "@/lib/google/drive-client";
import {
  DRIVE_STATE_COOKIE,
  DRIVE_STATE_COOKIE_PATH,
  driveExportReturnPath,
  unpackConsentCookie,
} from "@/lib/google/drive-consent";
import { constantTimeEquals } from "@/lib/net/secret";

/**
 * Google's return from the Drive consent screen.
 *
 * THIN, LIKE EVERY ROUTE HANDLER HERE: verify the return, exchange the code,
 * store the sealed refresh token, send the person back to the export they asked
 * for. No document is rendered here and no brief is read.
 *
 * THE `state` IS VERIFIED BEFORE ANY CODE IS EXCHANGED. It was generated
 * server-side, kept in an HttpOnly cookie, and is single-use — the cookie is
 * cleared on every exit from this route, success or not, so a replayed callback
 * finds nothing to match against. An unverified return is a 403 that exchanges
 * nothing.
 *
 * THE DESTINATION COMES FROM THE COOKIE, NOT FROM GOOGLE. The brief id was
 * written by this application when the flow started and is shape-checked as a
 * UUID, so the redirect can only ever be this application's own export route
 * for one brief. Nothing in the callback's query string builds a URL.
 */

function refuse(status: number, message: string): Response {
  const response = new Response(`${message}\n`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

  clearStateCookie(response);

  return response;
}

/** Single-use, on every path out of this route. */
function clearStateCookie(response: Response): void {
  response.headers.append(
    "set-cookie",
    `${DRIVE_STATE_COOKIE}=; Path=${DRIVE_STATE_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax`,
  );
}

export async function GET(request: NextRequest) {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return refuse(401, "Sign in to connect Google Drive.");
  }

  if (!canExportBrief(staffUser.role)) {
    return refuse(403, "Your role does not have access to briefs.");
  }

  const config = driveOAuthConfig();

  if (!config) {
    return refuse(
      400,
      "Google Docs export is not configured on this deployment. Word (?format=docx) still works.",
    );
  }

  const expected = unpackConsentCookie(
    request.cookies.get(DRIVE_STATE_COOKIE)?.value,
  );

  const returnedState = request.nextUrl.searchParams.get("state") ?? "";

  if (!expected || !constantTimeEquals(returnedState, expected.state)) {
    // No code exchange, and nothing said about which half failed.
    console.warn("drive.consent.state_rejected", { actorId: staffUser.id });

    return refuse(
      403,
      "That Google Drive authorisation could not be verified. Start the export again.",
    );
  }

  // The person declined, or Google refused. A named outcome, not a 500.
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.info("drive.consent.declined", {
      actorId: staffUser.id,
      briefId: expected.briefId,
    });

    return refuse(
      400,
      "Google Drive access was not granted, so no Doc was created. Word export still works.",
    );
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return refuse(400, "That Google Drive authorisation came back incomplete.");
  }

  const exchange = await exchangeDriveCode({
    config,
    code,
    redirectUri: driveCallbackUrl(request.url),
  });

  if (!exchange.ok) {
    console.warn("drive.consent.exchange_refused", {
      actorId: staffUser.id,
      reason: exchange.reason,
    });

    return refuse(
      502,
      exchange.reason === "no_refresh_token"
        ? "Google did not return a lasting Drive authorisation. Remove EviBrief at myaccount.google.com/permissions and try the export again."
        : "Google Drive could not be reached to complete the authorisation. Word export still works.",
    );
  }

  await saveGoogleDriveGrant({
    staffUserId: staffUser.id,
    refreshTokenSealed: exchange.refreshTokenSealed,
    scope: exchange.scope,
  });

  // Ids and the granted scope. Never the code, never the token (§7.6, §18).
  console.info("drive.consent.granted", {
    actorId: staffUser.id,
    briefId: expected.briefId,
    scope: exchange.scope,
  });

  const response = NextResponse.redirect(
    new URL(driveExportReturnPath(expected.briefId), request.nextUrl.origin),
  );

  clearStateCookie(response);

  return response;
}
