import { NextResponse } from "next/server";

import { canSubmitFieldObservation } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { readFieldDigest } from "@/lib/db";

/**
 * The read-only snapshot the service worker keeps warm (AGENTS.md §17.4).
 *
 * WHY A ROUTE HANDLER AND NOT A SERVER COMPONENT: a service worker cannot call
 * one. This is within §5.3's carve-out for external callers — it mutates
 * nothing, takes no input, and has no form behind it. "UI does not mutate
 * through Route Handlers" is untouched: the only write path on this surface is
 * `submitFieldObservationAction`.
 *
 * SESSION-AUTHORISED, and NOT the login-free path. The no-login digest is
 * WhatsApp/USSD, which this does not build (§10.9). A signed-out caller gets a
 * 401 and no body.
 *
 * `no-store` AT THE HTTP LAYER, deliberately, even though the whole point is
 * caching: the copy that may exist is the service worker's, in the browser's own
 * storage on the officer's own device. A shared proxy or a CDN must never hold
 * one staff member's digest.
 *
 * IT CARRIES NO EVIDENCE. `readFieldDigest` selects no column from
 * `evidence_item` or `evidence_chunk`, so there is no field here through which
 * an observation, an excerpt, or an evidence title could reach a phone's cache
 * storage (§7.6).
 */
export async function GET() {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  // Every role that may submit an observation may read the digest; §10.5 gives
  // the Field Officer exactly these two rights and nothing else.
  if (!canSubmitFieldObservation(staffUser.role)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const payload = await readFieldDigest();

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
