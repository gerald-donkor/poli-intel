import { USSD_MAX_SCREEN_CHARS } from "./config";

/**
 * The two string reductions every screen goes through before it leaves this
 * module.
 *
 * PURE. No environment, no clock, no network — the same reason
 * `lib/whatsapp/message.ts` is pure.
 *
 * WHY ASCII IS NOT A STYLE CHOICE. USSD is transmitted in the GSM 7-bit
 * alphabet, so a curly quote, an en dash, or an accented character either fails
 * to render on the handset or is re-encoded in a way that silently halves the
 * characters available on the screen. `plainDate` renders "3 August 2026" and a
 * signal title comes from a scraped source, so neither is guaranteed ASCII on
 * its own; everything is reduced here rather than trusted.
 */

/**
 * Common typographic characters replaced with their ASCII equivalents, before
 * the general stripping pass below.
 *
 * SPELLED OUT RATHER THAN STRIPPED, because an en dash between two clauses
 * carries meaning that a deleted character does not. Everything not listed falls
 * through to Unicode decomposition and then to removal.
 */
const ASCII_SUBSTITUTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[‘’‚‛′]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/[‐‑‒–—―]/g, "-"],
  [/[…]/g, "..."],
  [/[    ]/g, " "],
  [/[•·]/g, "-"],
];

/**
 * Anything a GSM handset can render, and nothing else.
 *
 * The decomposition step turns "Sefwi-Wiawso" and "Côte d'Ivoire" into their
 * unaccented forms rather than dropping the letter, which is the difference
 * between a readable place name and a misspelled one. Whatever survives neither
 * substitution nor decomposition — a symbol, an emoji, a non-Latin script — is
 * removed, and runs of whitespace are collapsed so the removal does not leave a
 * gap in the middle of a sentence.
 */
export function toGsmSafe(value: string): string {
  let out = value;

  for (const [pattern, replacement] of ASCII_SUBSTITUTIONS) {
    out = out.replace(pattern, replacement);
  }

  return out
    .normalize("NFKD")
    // Combining marks left behind by the decomposition above.
    .replace(/[̀-ͯ]/g, "")
    // Newlines are kept: they are the only layout a USSD screen has.
    .replace(/[^\n\x20-\x7E]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * Cut on a word boundary, and say that it was cut.
 *
 * Mid-word truncation is the failure this function exists to avoid, so the cut
 * walks back to the last space rather than slicing at the character. The
 * trailing `...` is three ASCII dots, not an ellipsis character, because the
 * ellipsis is exactly the sort of glyph `toGsmSafe` exists to remove.
 *
 * The default is the screen cap; list lines pass their own smaller allowance.
 */
export function capScreen(
  value: string,
  limit: number = USSD_MAX_SCREEN_CHARS,
): string {
  if (value.length <= limit) return value;

  const marker = "...";
  const room = Math.max(0, limit - marker.length);
  const cut = value.slice(0, room);
  const lastBreak = cut.search(/\s\S*$/);

  return `${(lastBreak > 0 ? cut.slice(0, lastBreak) : cut).trimEnd()}${marker}`;
}
