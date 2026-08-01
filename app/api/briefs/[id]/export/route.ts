import type { NextRequest } from "next/server";

import { canExportBrief } from "@/lib/auth/authorize";
import { getCurrentStaffUser } from "@/lib/auth/session";
import { findBriefForExport } from "@/lib/db";
import { renderBriefDocx } from "@/lib/export/docx";
import {
  briefExportFilename,
  contentDispositionAttachment,
} from "@/lib/export/filename";

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
 * `format` exists so a later prompt can add Google Docs without moving the
 * route. An unrecognised value is a 400 naming what is available, never a silent
 * fallback to Word, and nothing in the UI offers a format this handler cannot
 * produce.
 */

/** The only value accepted today. Pandoc PDF and Google Docs are separate work. */
const SUPPORTED_FORMAT = "docx";

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

  const format = request.nextUrl.searchParams.get("format") ?? SUPPORTED_FORMAT;

  if (format !== SUPPORTED_FORMAT) {
    return refuse(
      400,
      `${format} export is not available. Word (?format=docx) is the only export available today.`,
    );
  }

  const { id } = await params;
  const brief = await findBriefForExport(id);

  if (!brief) {
    return refuse(404, "That brief does not exist.");
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
