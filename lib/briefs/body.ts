/**
 * Reading a stored `bodyText` back into renderable blocks.
 *
 * THE EXACT INVERSE of `assembleBodyText` in `lib/ai/generate-brief.ts`, where
 * the contract is stated in full. Change one and you must change the other.
 * Restated here because this is the half that runs at render time:
 *
 *   - Blocks are separated by one blank line.
 *   - A single-line block is a heading with no prose of its own.
 *   - A multi-line block is a heading (line 1) plus its prose (the rest).
 *
 * The parse carries each block's CHARACTER OFFSET into `bodyText`, because that
 * is the coordinate space a hallucination-guard flag anchors in until the editor
 * prompt maps them to Tiptap positions (`anchorClaim` in lib/ai/fact-check.ts).
 * A renderer that recomputed offsets would silently drift from the stored ones.
 *
 * Client-visible, and holds no governance rule, no role, and no eligibility
 * predicate (§10.10).
 */

export type BriefBlock = {
  heading: string;
  /** Empty for a section divider. */
  body: string;
  /** Offset of the block's first character within `bodyText`. */
  offset: number;
};

export type ParsedBriefBody = {
  /** The document's own title — the first block, always a single line. */
  title: string;
  blocks: BriefBlock[];
};

const BLOCK_SEPARATOR = "\n\n";

export function parseBriefBody(bodyText: string): ParsedBriefBody {
  const raw = bodyText.split(BLOCK_SEPARATOR);

  let offset = 0;
  const blocks: BriefBlock[] = [];

  for (const block of raw) {
    const newlineIndex = block.indexOf("\n");

    blocks.push(
      newlineIndex === -1
        ? { heading: block, body: "", offset }
        : {
            heading: block.slice(0, newlineIndex),
            body: block.slice(newlineIndex + 1),
            offset,
          },
    );

    offset += block.length + BLOCK_SEPARATOR.length;
  }

  const [first, ...rest] = blocks;

  return { title: first?.heading ?? "", blocks: rest };
}
