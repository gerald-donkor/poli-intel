/**
 * The download's filename, derived server-side from the brief's own title.
 *
 * SECURITY, NOT COSMETICS. A `Content-Disposition` header is built from this
 * string, a brief's title is officer-authored free text, and a CR or LF in a
 * response header is header injection. So the output is constrained to a known
 * safe alphabet rather than merely having the obvious characters removed: ASCII
 * letters, digits, hyphen and underscore, nothing else, length-capped.
 *
 * The filename is never taken from a query parameter — a client-supplied
 * filename would be the same injection vector with the sanitiser skipped.
 *
 * It is also never logged (§7.6): a title is document content.
 */

/** Long enough to stay recognisable, short enough for every filesystem. */
const MAX_STEM_LENGTH = 80;

/** When a title reduces to nothing — punctuation only, or non-Latin script. */
const FALLBACK_STEM = "brief";

/**
 * A brief title as a filename stem: ASCII, hyphen-separated, bounded.
 *
 * Diacritics are folded rather than dropped, so "Réforme" becomes "Reforme"
 * instead of "Rforme". A script with no ASCII fold at all — Twi's special
 * characters among them — legitimately reduces to the fallback; a mangled
 * transliteration would be worse than a plain, honest name.
 */
export function sanitiseFilenameStem(title: string): string {
  const folded = title
    .normalize("NFKD")
    // Combining marks left behind by the decomposition above.
    .replace(/[\u0300-\u036f]/g, "");

  const stem = folded
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_STEM_LENGTH)
    // The slice can leave a trailing hyphen behind.
    .replace(/-$/, "");

  return stem.length === 0 ? FALLBACK_STEM : stem;
}

/**
 * A brief version's export name, without an extension.
 *
 * SHARED BY ALL THREE DESTINATIONS: it is the `.docx` download's stem, the
 * `.pdf` download's stem, and the Google Doc's name. One rule, so the same
 * brief is called the same thing wherever it lands, and the sanitiser above
 * cannot be applied to one and skipped on the others.
 */
export function briefExportName(title: string, version: number): string {
  return `${sanitiseFilenameStem(title)}-v${version}`;
}

/**
 * The full download filename for a brief's version.
 *
 * The extension is a literal union rather than free text, and never a query
 * parameter: this string becomes a `Content-Disposition` header, so an
 * unconstrained extension would reopen the injection vector the stem is
 * sanitised to close.
 */
export function briefExportFilename(
  title: string,
  version: number,
  extension: "docx" | "pdf",
): string {
  return `${briefExportName(title, version)}.${extension}`;
}

/**
 * The header value itself.
 *
 * `filename` alone is enough because the stem is already ASCII by construction,
 * so there is nothing for a `filename*` fallback to encode differently.
 */
export function contentDispositionAttachment(filename: string): string {
  return `attachment; filename="${filename}"`;
}
