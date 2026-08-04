import { NextResponse, type NextRequest } from "next/server";

import { canExportBrief } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import {
  deleteGoogleDriveGrant,
  findBriefForExport,
  findGoogleDriveGrant,
} from "@/lib/db";
import { renderBriefDocx } from "@/lib/export/docx";
import {
  briefExportFilename,
  briefExportName,
  contentDispositionAttachment,
} from "@/lib/export/filename";
import { uploadBriefAsGoogleDoc } from "@/lib/export/gdoc";
import { driveAccessToken, driveOAuthConfig } from "@/lib/google/drive-client";
import {
  DRIVE_GRANTED_PARAM,
  driveConsentStartPath,
} from "@/lib/google/drive-consent";

/**
 * The brief download.
 *
 * A ROUTE HANDLER, NOT A SERVER ACTION, and that is the rule rather than a
 * preference: an export is a *response*, not a mutation (AGENTS.md §5.2,
 * `tiptap-editor`). This route is GET, reads only, writes no status, and touches
 * no flag.
 *
 * IT STILL AUTHORISES INSIDE ITSELF. "Route Handlers are for external callers"
 * is about shape, not about trust — this one serves the app's own signed-in
 * staff, and the download link being hidden from a Field Officer is presentation
 * and never the control (§10.1). Order is the same as everywhere else in this
 * codebase: resolve session → authorise → validate → do the work.
 *
 * IT HOLDS NO MAPPING LOGIC. It reads, calls `lib/export/docx.ts`, and responds.
 * A handler that starts deciding how a heading becomes a heading has absorbed a
 * layer that is not its own (§18).
 *
 * `format` is why Google Docs slots in here rather than getting a route of its
 * own: it is the same authorisation, the same read, and the same rendering with
 * a different destination. An unrecognised value is a 400 naming every format
 * that exists, never a silent fallback to Word, and nothing in the UI offers a
 * format this handler cannot produce.
 *
 * TWO KINDS OF RESPONSE, HONESTLY. `docx` responds with bytes; `gdoc` responds
 * with a redirect to the created Doc. Returning JSON and having the browser
 * open a window instead would put pipeline state in the UI (§5.3).
 */

/** Pandoc PDF is still separate work; `?format=pdf` keeps its 400. */
const SUPPORTED_FORMATS = ["docx", "gdoc"] as const;

type ExportFormat = (typeof SUPPORTED_FORMATS)[number];

const DEFAULT_FORMAT: ExportFormat = "docx";

function isSupportedFormat(value: string): value is ExportFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(value);
}

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Refusals a person can read. Never an empty body, never a partial file. */
function refuse(status: number, message: string): Response {
  return new Response(`${message}\n`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) {
    return refuse(401, "Sign in to download a brief.");
  }

  if (!canExportBrief(staffUser.role)) {
    return refuse(403, "Your role does not have access to briefs.");
  }

  const format = request.nextUrl.searchParams.get("format") ?? DEFAULT_FORMAT;

  if (!isSupportedFormat(format)) {
    return refuse(
      400,
      `${format} export is not available. Word (?format=docx) and Google Docs (?format=gdoc) are the exports available today.`,
    );
  }

  // A deployment with no Drive credentials refuses `gdoc` before reading the
  // brief. The menu item is not offered either — this is the direct-URL case
  // (§17.6, the unconfigured state).
  const driveConfig = format === "gdoc" ? driveOAuthConfig() : null;

  if (format === "gdoc" && !driveConfig) {
    return refuse(
      400,
      "Google Docs export is not configured on this deployment. Word (?format=docx) still works.",
    );
  }

  const { id } = await params;
  const brief = await findBriefForExport(id);

  if (!brief) {
    return refuse(404, "That brief does not exist.");
  }

  // Resolved BEFORE the document is rendered, so a person who has not
  // authorised Drive is sent to the consent screen rather than made to wait for
  // a file nobody will receive.
  let accessToken: string | null = null;

  if (format === "gdoc" && driveConfig) {
    // Set by the consent callback on its way back here. Its whole job is to
    // make this happen once: a second pass that still has no usable grant is a
    // readable refusal, never another redirect.
    const returningFromConsent =
      request.nextUrl.searchParams.get(DRIVE_GRANTED_PARAM) === "1";

    const grant = await findGoogleDriveGrant(staffUser.id);

    const token = grant
      ? await driveAccessToken({
          config: driveConfig,
          refreshTokenSealed: grant.refreshTokenSealed,
        })
      : null;

    if (token && !token.ok && token.reason === "revoked") {
      // Withdrawn at myaccount.google.com, or sealed under a key this
      // deployment no longer has. Either way the stored credential is dead, so
      // it goes rather than sitting there failing every export.
      await deleteGoogleDriveGrant(staffUser.id);
    }

    if (token && !token.ok && token.reason === "unavailable") {
      return refuse(
        502,
        "Google could not be reached to authorise this export. Word (?format=docx) still works.",
      );
    }

    if (!token || !token.ok) {
      if (returningFromConsent) {
        return refuse(
          502,
          "Google Drive access is still not available for your account, so no Doc was created. Word (?format=docx) still works.",
        );
      }

      return NextResponse.redirect(
        new URL(driveConsentStartPath(brief.id), request.nextUrl.origin),
      );
    }

    accessToken = token.accessToken;
  }

  const bytes = await renderBriefDocx({
    briefType: brief.briefType,
    audience: brief.audience,
    status: brief.status,
    version: brief.version,
    generatedAt: brief.generatedAt,
    generatingModel: brief.generatingModel,
    documentJson: brief.documentJson,
    bodyText: brief.bodyText,
    evidence: brief.evidence,
    openFlags: brief.openFlags,
  });

  if (format === "gdoc" && accessToken) {
    // THE SAME BYTES THE WORD PATH PRODUCES, converted on the way into Drive.
    // If the two ever diverge, that is the defect — and it is also what carries
    // the flag notice and the open-claims list into the Doc without this route
    // knowing anything about either (§16.8, §9.5).
    const upload = await uploadBriefAsGoogleDoc({
      accessToken,
      name: briefExportName(brief.title, brief.version),
      docxBytes: bytes,
    });

    if (!upload.ok) {
      if (upload.reason === "unauthorised") {
        // The grant no longer carries what the upload needs. Cleared, so the
        // next attempt re-consents rather than failing the same way forever.
        await deleteGoogleDriveGrant(staffUser.id);

        return refuse(
          502,
          "Google Drive refused this upload, so no Doc was created. Try the export again to re-authorise, or use Word (?format=docx).",
        );
      }

      return refuse(
        502,
        "Google Drive could not be reached, so no Doc was created. The brief is untouched and Word (?format=docx) still works.",
      );
    }

    // Ids and counts only — and the Doc's id, never its name (§7.6).
    console.info("brief.export.gdoc_created", {
      briefId: brief.id,
      actorId: staffUser.id,
      format,
      byteLength: bytes.byteLength,
      openFlagCount: brief.openFlags.length,
      documentId: upload.documentId,
    });

    return NextResponse.redirect(upload.webViewLink);
  }

  // Ids and counts only. Never the document, never a claim, never a citation,
  // and never the filename — a filename is derived from the brief's title, and
  // a title is document content (§7.6).
  console.info("brief.export.downloaded", {
    briefId: brief.id,
    actorId: staffUser.id,
    format,
    byteLength: bytes.byteLength,
    openFlagCount: brief.openFlags.length,
  });

  return new Response(bytes, {
    headers: {
      "content-type": DOCX_CONTENT_TYPE,
      "content-disposition": contentDispositionAttachment(
        briefExportFilename(brief.title, brief.version),
      ),
      // A brief's current version changes under this URL; a cached copy would
      // be a stale document with a stale flag notice attached to it.
      "cache-control": "no-store",
    },
  });
}
