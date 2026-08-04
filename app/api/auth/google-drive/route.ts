import { NextResponse, type NextRequest } from "next/server";

import { canExportBrief } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import {
  driveCallbackUrl,
  driveConsentUrl,
  driveOAuthConfig,
} from "@/lib/google/drive-client";
import {
  DRIVE_STATE_COOKIE,
  DRIVE_STATE_COOKIE_PATH,
  DRIVE_STATE_MAX_AGE_SECONDS,
  isBriefId,
  newConsentState,
  packConsentCookie,
} from "@/lib/google/drive-consent";

/**
 * The Drive grant, asked for.
 *
 * A SEPARATE FLOW FROM SIGN-IN, ON PURPOSE. `auth.ts` requests no Drive scope,
 * so signing in grants nothing in anyone's Drive and a Field Officer never sees
 * a Drive consent screen (§10.5). This route is entered the first time someone
 * exports a brief to Google Docs — which is the moment the consent screen makes
 * sense to the person reading it.
 *
 * IT AUTHORISES INSIDE ITSELF, like the export route it serves. Only a role
 * that can export a brief can be asked for the access an export needs; a Drive
 * grant is never a way in to something the role could not already reach.
 *
 * IT MUTATES NOTHING IN THE APPLICATION'S OWN DATA. It sets a short-lived
 * cookie and redirects. The grant is written by the callback, after the code
 * exchange.
 */

function refuse(status: number, message: string): Response {
  return new Response(`${message}\n`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
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

  const briefId = request.nextUrl.searchParams.get("briefId") ?? "";

  // Shape-checked before it is carried anywhere, because it becomes a path
  // segment in the return URL after consent (`drive-consent.ts`).
  if (!isBriefId(briefId)) {
    return refuse(400, "That is not a brief this export can return to.");
  }

  const state = newConsentState();

  const response = NextResponse.redirect(
    driveConsentUrl({
      config,
      redirectUri: driveCallbackUrl(request.url),
      state,
      // The account this person is already signed in as, so someone with
      // several Google accounts is not asked to pick the wrong one.
      loginHint: staffUser.email,
    }),
  );

  response.cookies.set({
    name: DRIVE_STATE_COOKIE,
    value: packConsentCookie(state, briefId),
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: DRIVE_STATE_COOKIE_PATH,
    maxAge: DRIVE_STATE_MAX_AGE_SECONDS,
  });

  // Ids only. Never the state, never the email, never a token (§7.6, §18).
  console.info("drive.consent.started", {
    actorId: staffUser.id,
    briefId,
  });

  return response;
}
