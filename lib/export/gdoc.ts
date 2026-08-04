import "server-only";

/**
 * The rendered Word bytes, uploaded to Drive and converted into a native Google
 * Doc on the way in.
 *
 * ONE DOCUMENT MAPPING, NOT TWO. This module takes `renderBriefDocx`'s output
 * and hands it to Drive; it does not translate the Tiptap document a second
 * time. The alternative — building Google Docs API `batchUpdate` requests —
 * would be a second place for headings, citation chips, the flag notice and the
 * open-claims list to be expressed, and therefore a second place for them to
 * drift.
 *
 * IT IS ALSO HOW THE GUARD CONTRACT IS INHERITED RATHER THAN RE-IMPLEMENTED.
 * `renderBriefDocx` already emits the flag notice and the open-claims list, so
 * a brief with unresolved flags cannot reach Google Docs without its notice
 * (§16.8, §9.5, `hallucination-guard`). A hand-written Docs mapping would have
 * to re-implement that, and forgetting it would put an unflagged-looking
 * document in front of a reader.
 *
 * IT KNOWS NOTHING ABOUT BRIEFS, FLAGS OR ROLES. Bytes, a name, and a token in;
 * an id and a link out. The Route Handler authorises and reads; this uploads.
 */

const UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2CwebViewLink";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * The target type. Naming a Google Workspace `mimeType` in the metadata part is
 * what makes Drive import the `.docx` as a native Doc rather than parking the
 * file in Drive as an attachment.
 */
const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";

/**
 * The multipart boundary.
 *
 * FIXED, AND SAFE BECAUSE OF WHAT THE PARTS CONTAIN. The metadata part is a
 * JSON-encoded name drawn from `sanitiseFilenameStem`, which admits only ASCII
 * letters, digits, hyphen and underscore — so it cannot contain the boundary.
 * The media part is binary and is concatenated as bytes rather than as text,
 * and a `.docx` is a ZIP whose byte stream could in principle contain anything,
 * which is why the boundary is long and distinctive rather than short.
 */
const BOUNDARY = "evibrief-brief-export-boundary-0f6e56";

export type DriveUploadResult =
  | { ok: true; documentId: string; webViewLink: string }
  | { ok: false; reason: "unauthorised" | "unavailable" };

/**
 * `files.create`, multipart: a JSON metadata part naming the target type, then
 * the `.docx` bytes.
 *
 * NO FOLDER IS SET, so the Doc lands in the exporter's own Drive root. Whose
 * Drive, which folder, and whether briefs belong in a shared drive is a
 * Tropenbos operational decision nobody has made; the person's own Drive is the
 * assumption that cannot be wrong for them, and moving a Doc afterwards is one
 * drag. Do not invent a folder structure here.
 *
 * `unauthorised` is separated from `unavailable` because only the first one is
 * worth re-consenting over. A 401 or 403 from Drive means the token no longer
 * carries the access it needs; a 429 or a 5xx means try again later, and
 * sending someone through a consent screen for a quota error would be a lie
 * about what went wrong.
 */
export async function uploadBriefAsGoogleDoc(input: {
  accessToken: string;
  /** The Doc's name. Already sanitised by `lib/export/filename.ts`. */
  name: string;
  docxBytes: Uint8Array;
}): Promise<DriveUploadResult> {
  const metadata = JSON.stringify({
    name: input.name,
    mimeType: GOOGLE_DOC_MIME_TYPE,
  });

  const head = Buffer.from(
    `--${BOUNDARY}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${metadata}\r\n` +
      `--${BOUNDARY}\r\n` +
      `Content-Type: ${DOCX_CONTENT_TYPE}\r\n\r\n`,
    "utf8",
  );

  const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`, "utf8");

  const body = Buffer.concat([head, Buffer.from(input.docxBytes), tail]);

  let response: Response;

  try {
    response = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": `multipart/related; boundary=${BOUNDARY}`,
      },
      body: new Uint8Array(body),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    // Status only. Drive's error body can echo the file's name back, and a
    // brief's name is derived from its title — which is document content
    // (§7.6).
    console.warn("drive.upload.failed", { status: response.status });

    const unauthorised = response.status === 401 || response.status === 403;

    return { ok: false, reason: unauthorised ? "unauthorised" : "unavailable" };
  }

  const payload = (await response.json()) as {
    id?: unknown;
    webViewLink?: unknown;
  };

  if (typeof payload.id !== "string") {
    return { ok: false, reason: "unavailable" };
  }

  return {
    ok: true,
    documentId: payload.id,
    webViewLink: safeDocumentLink(payload.webViewLink, payload.id),
  };
}

/**
 * The URL the export redirects to, checked before it becomes a redirect.
 *
 * `webViewLink` IS A VALUE FROM OUTSIDE THIS APPLICATION, and the export route
 * turns it into a `Location` header. It is Drive's own answer about a file this
 * application just created, so it is not a likely attack — but "a redirect
 * target arrived over the network" is exactly the shape worth constraining
 * rather than trusting (§18). Anything that is not an `https` Google host falls
 * back to the canonical Docs URL built from the id, which is derivable anyway.
 */
function safeDocumentLink(link: unknown, documentId: string): string {
  const canonical = `https://docs.google.com/document/d/${documentId}/edit`;

  if (typeof link !== "string") return canonical;

  try {
    const url = new URL(link);

    const googleHost =
      url.hostname === "google.com" || url.hostname.endsWith(".google.com");

    return url.protocol === "https:" && googleHost ? url.toString() : canonical;
  } catch {
    return canonical;
  }
}
