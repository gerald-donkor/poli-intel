import { z } from "zod";

import { parseBriefBody } from "./body";

/**
 * The brief document model — the editor's storage format, and the one place the
 * node vocabulary is stated.
 *
 * TWO REPRESENTATIONS, ONE TRUTH. `BriefVersion.documentJson` is the edit
 * surface; `BriefVersion.bodyText` is its deterministic projection, and it stays
 * canonical because three other things already index into it: the brief list's
 * title, the fact-check pass's coordinate space, and (later) export. So one
 * function builds the document and one renders the text, and they are inverses
 * of each other exactly as `assembleBodyText` / `parseBriefBody` already are:
 *
 *     documentToBodyText(buildDocumentFromBodyText(t)) === t
 *
 * THE VOCABULARY, deliberately small:
 *
 *   - the document title           → `heading` level 1
 *   - a section divider            → `heading` level 2   (a single-line block)
 *   - a block heading              → `heading` level 3   (a heading with prose)
 *   - a prose line                 → `paragraph`
 *   - an inline citation           → `citationChip`, atomic, carries an id
 *   - a hallucination-guard flag   → the `guardFlag` mark over its claim
 *
 * There are no other nodes and no formatting marks. The brief's structure is
 * fixed by §16.2 and the export mapping runs from this model, so every node type
 * added here is a node type export, diffing, and validation must all handle.
 *
 * ANCHORS. A flag is stored as character offsets into `bodyText` (`anchorClaim`
 * in lib/ai/fact-check.ts). Offsets are mapped onto guard-flag marks when the
 * document is built and mapped back out of the marks when it is saved — computed
 * both ways, never stored twice, so the two can never disagree.
 *
 * CLIENT-VISIBLE. This module holds no governance rule, no role, and no
 * eligibility predicate (§10.10) — same reasoning as `lib/briefs/body.ts`. It
 * imports nothing from `lib/auth`, `lib/db`, or `lib/ai`.
 */

/* -------------------------------------------------------------------------
 * The vocabulary
 * ---------------------------------------------------------------------- */

export const CITATION_CHIP_NODE = "citationChip";
export const GUARD_FLAG_MARK = "guardFlag";

/** Caps, so a document arriving from a browser is bounded before it is stored. */
export const BRIEF_DOCUMENT_MAX_NODES = 4000;
export const BRIEF_DOCUMENT_MAX_TEXT_CHARS = 20_000;

export type CitationChipAttrs = {
  evidenceItemId: string;
  citationKey: string;
};

export type GuardFlagMarkAttrs = {
  flagId: string;
  reason: string;
};

export type GuardFlagMark = {
  type: typeof GUARD_FLAG_MARK;
  attrs: GuardFlagMarkAttrs;
};

export type TextNode = {
  type: "text";
  text: string;
  marks?: GuardFlagMark[];
};

export type CitationChipNode = {
  type: typeof CITATION_CHIP_NODE;
  attrs: CitationChipAttrs;
};

export type InlineNode = TextNode | CitationChipNode;

export type HeadingLevel = 1 | 2 | 3;

export type BlockNode =
  | { type: "heading"; attrs: { level: HeadingLevel }; content?: InlineNode[] }
  | { type: "paragraph"; content?: InlineNode[] };

export type BriefDocument = {
  type: "doc";
  content: BlockNode[];
};

/* -------------------------------------------------------------------------
 * Validation
 * ---------------------------------------------------------------------- */

const guardFlagMarkSchema = z.object({
  type: z.literal(GUARD_FLAG_MARK),
  attrs: z.object({
    flagId: z.string().min(1),
    reason: z.string().min(1),
  }),
});

const textNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(BRIEF_DOCUMENT_MAX_TEXT_CHARS),
  marks: z.array(guardFlagMarkSchema).optional(),
});

const citationChipNodeSchema = z.object({
  type: z.literal(CITATION_CHIP_NODE),
  attrs: z.object({
    evidenceItemId: z.string().min(1),
    citationKey: z.string().min(1),
  }),
});

const inlineNodeSchema = z.discriminatedUnion("type", [
  textNodeSchema,
  citationChipNodeSchema,
]);

const blockNodeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
    content: z.array(inlineNodeSchema).optional(),
  }),
  z.object({
    type: z.literal("paragraph"),
    content: z.array(inlineNodeSchema).optional(),
  }),
]);

/**
 * The document as it may arrive from a browser.
 *
 * An unrecognised node type is REJECTED, not stored. `documentJson` is rendered
 * back into a rich-text surface, and an unvalidated blob from a client is
 * exactly how that becomes an injection vector. Shape only — nothing here
 * decides who may save (§10.10).
 */
export const briefDocumentSchema: z.ZodType<BriefDocument> = z.object({
  type: z.literal("doc"),
  content: z.array(blockNodeSchema).max(BRIEF_DOCUMENT_MAX_NODES),
});

/* -------------------------------------------------------------------------
 * Building
 * ---------------------------------------------------------------------- */

const BLOCK_SEPARATOR = "\n\n";

function text(value: string): TextNode {
  return { type: "text", text: value };
}

function heading(level: HeadingLevel, value: string): BlockNode {
  return value.length === 0
    ? { type: "heading", attrs: { level } }
    : { type: "heading", attrs: { level }, content: [text(value)] };
}

function paragraph(value: string): BlockNode {
  return value.length === 0
    ? { type: "paragraph" }
    : { type: "paragraph", content: [text(value)] };
}

/**
 * A stored `bodyText` as a document.
 *
 * The fallback for every brief generated before the editor existed
 * (`documentJson` null): those open and edit correctly, they simply carry no
 * citation chips until someone inserts one. No backfill, no migration.
 */
export function buildDocumentFromBodyText(bodyText: string): BriefDocument {
  const parsed = parseBriefBody(bodyText);
  const content: BlockNode[] = [heading(1, parsed.title)];

  for (const block of parsed.blocks) {
    if (block.body === "") {
      content.push(heading(2, block.heading));
      continue;
    }

    content.push(heading(3, block.heading));

    for (const line of block.body.split("\n")) {
      content.push(paragraph(line));
    }
  }

  return { type: "doc", content };
}

/** One finding's citations, in the order `assembleBodyText` wrote its findings. */
export type DraftCitations = {
  /** Evidence item ids, as validated against the supplied set at generation. */
  evidenceItemIds: string[];
};

/**
 * The generated draft as a document, with citation chips already inline at the
 * end of each finding.
 *
 * BUILT FROM THE ASSEMBLED `bodyText`, NOT ALONGSIDE IT. The findings' citations
 * are the one part of the draft `assembleBodyText` does not emit — there is
 * nowhere in the block contract for them — so rather than change that contract
 * (which would move every flag anchor computed against it), the document is
 * built from the very same string and the chips are threaded in afterwards.
 * `bodyText` and every anchor into it are unchanged, because a chip renders to
 * nothing in `bodyText`.
 *
 * `evidenceSectionHeading` is the divider `assembleBodyText` writes above the
 * findings. It is passed in rather than duplicated as a literal here, so the two
 * modules cannot drift apart silently.
 */
export function buildDocumentFromDraft({
  bodyText,
  evidenceSectionHeading,
  findingCitations,
  citationKeys,
}: {
  bodyText: string;
  evidenceSectionHeading: string;
  findingCitations: DraftCitations[];
  /** Evidence item id → the citation key a reader sees on the chip. */
  citationKeys: Map<string, string>;
}): BriefDocument {
  const document = buildDocumentFromBodyText(bodyText);
  const findingBlocks = findingBlockRanges(document, evidenceSectionHeading);

  findingCitations.forEach((finding, index) => {
    const range = findingBlocks[index];

    if (range === undefined) return;

    const chips: CitationChipNode[] = finding.evidenceItemIds.flatMap((id) => {
      const citationKey = citationKeys.get(id);

      // A chip that cannot name a real item in the recorded set is decoration,
      // and this product's claim is traceability (§15.5). It is not written.
      return citationKey === undefined
        ? []
        : [
            {
              type: CITATION_CHIP_NODE as typeof CITATION_CHIP_NODE,
              attrs: { evidenceItemId: id, citationKey },
            },
          ];
    });

    if (chips.length === 0) return;

    const target = document.content[range.lastParagraphIndex];

    if (target === undefined || target.type !== "paragraph") return;

    target.content = [...(target.content ?? []), ...chips];
  });

  return document;
}

/**
 * Where each finding lives in the built document: every level-3 heading between
 * the evidence divider and the next level-2 heading, in order.
 */
function findingBlockRanges(
  document: BriefDocument,
  evidenceSectionHeading: string,
): { lastParagraphIndex: number }[] {
  const ranges: { lastParagraphIndex: number }[] = [];

  let inEvidenceSection = false;

  document.content.forEach((node, index) => {
    if (node.type === "heading" && node.attrs.level === 2) {
      inEvidenceSection = inlineText(node.content) === evidenceSectionHeading;
      return;
    }

    if (!inEvidenceSection) return;

    if (node.type === "heading" && node.attrs.level === 3) {
      ranges.push({ lastParagraphIndex: index });
      return;
    }

    if (node.type === "paragraph" && ranges.length > 0) {
      ranges[ranges.length - 1].lastParagraphIndex = index;
    }
  });

  return ranges;
}

/* -------------------------------------------------------------------------
 * Rendering, and the offset ↔ position mapping
 * ---------------------------------------------------------------------- */

/**
 * One text run, in both coordinate spaces at once.
 *
 * `charFrom`/`charTo` index into the rendered `bodyText`; `pmFrom` is the
 * ProseMirror position of the run's first character. Citation chips occupy one
 * ProseMirror position and zero characters, which is exactly why the two spaces
 * need a map rather than an offset.
 */
export type TextSegment = {
  charFrom: number;
  charTo: number;
  pmFrom: number;
};

export type FlagRange = { anchorFrom: number; anchorTo: number };

export type RenderedDocument = {
  bodyText: string;
  segments: TextSegment[];
  /** Flag id → its current character range in the rendered `bodyText`. */
  flagRanges: Map<string, FlagRange>;
};

/**
 * The document rendered back into the canonical `bodyText`, with everything
 * needed to re-anchor a flag against it.
 *
 * The block contract is `assembleBodyText`'s, inverted:
 *
 *   - a level-1 or level-2 heading is a single-line block
 *   - a level-3 heading opens a block, and the paragraphs after it are its prose
 *   - blocks are separated by one blank line
 *
 * Empty paragraphs are dropped rather than emitted: a blank line inside a block
 * would be read back as a block boundary and split the document in two.
 */
export function renderDocument(document: BriefDocument): RenderedDocument {
  const parts: string[] = [];
  const segments: TextSegment[] = [];
  const flagRanges = new Map<string, FlagRange>();

  let charPos = 0;
  let pmPos = 0;
  let openBlock = false;

  for (const node of document.content) {
    const inline = node.content ?? [];
    const nodeStart = pmPos;

    pmPos += inlineSize(inline) + 2;

    const isHeading = node.type === "heading";
    const value = inlineText(inline);

    // An empty paragraph carries no line. Its ProseMirror positions are simply
    // not mapped — a flag cannot be anchored in text that no longer exists.
    if (!isHeading && value.length === 0) continue;

    // A level-3 heading opens a block the following paragraphs continue; levels
    // 1 and 2 are blocks of their own. A paragraph with no block open starts one.
    const startsBlock = isHeading || !openBlock;
    const separator =
      parts.length === 0 ? "" : startsBlock ? BLOCK_SEPARATOR : "\n";

    openBlock = isHeading ? node.attrs.level === 3 : true;

    charPos += separator.length;

    let cursor = charPos;
    let pmCursor = nodeStart + 1;

    for (const child of inline) {
      if (child.type === CITATION_CHIP_NODE) {
        pmCursor += 1;
        continue;
      }

      const length = child.text.length;

      segments.push({
        charFrom: cursor,
        charTo: cursor + length,
        pmFrom: pmCursor,
      });

      const flag = child.marks?.find((mark) => mark.type === GUARD_FLAG_MARK);

      if (flag !== undefined) {
        const existing = flagRanges.get(flag.attrs.flagId);

        flagRanges.set(flag.attrs.flagId, {
          anchorFrom: existing ? Math.min(existing.anchorFrom, cursor) : cursor,
          anchorTo: existing
            ? Math.max(existing.anchorTo, cursor + length)
            : cursor + length,
        });
      }

      cursor += length;
      pmCursor += length;
    }

    charPos = cursor;
    parts.push(`${separator}${value}`);
  }

  return { bodyText: parts.join(""), segments, flagRanges };
}

/** The half of `renderDocument` most callers want. */
export function documentToBodyText(document: BriefDocument): string {
  return renderDocument(document).bodyText;
}

/**
 * A character offset in `bodyText` as a ProseMirror position.
 *
 * `end: true` resolves an exclusive end offset, which belongs to the run it
 * closes rather than the one that starts there. Returns null when the offset
 * falls in no run at all — the `0/0` case, and any anchor whose text has since
 * been deleted.
 */
export function offsetToPosition(
  segments: TextSegment[],
  offset: number,
  options: { end?: boolean } = {},
): number | null {
  for (const segment of segments) {
    const inside = options.end
      ? offset > segment.charFrom && offset <= segment.charTo
      : offset >= segment.charFrom && offset < segment.charTo;

    if (inside) return segment.pmFrom + (offset - segment.charFrom);
  }

  return null;
}

/** The inverse of `offsetToPosition`. */
export function positionToOffset(
  segments: TextSegment[],
  position: number,
): number | null {
  for (const segment of segments) {
    const pmTo = segment.pmFrom + (segment.charTo - segment.charFrom);

    if (position >= segment.pmFrom && position <= pmTo) {
      return segment.charFrom + (position - segment.pmFrom);
    }
  }

  return null;
}

/* -------------------------------------------------------------------------
 * Flag marks
 * ---------------------------------------------------------------------- */

export type DocumentFlag = {
  id: string;
  reason: string;
  anchorFrom: number;
  anchorTo: number;
};

/**
 * The stored flag records, painted onto the document they anchor into.
 *
 * THE MARK RENDERS STORED STATE. Nothing here scans text, regexes, or infers a
 * flag — the only input is the flag rows (§9.3).
 *
 * A `0/0` anchor means the checker could not locate the claim exactly. Such a
 * flag is still recorded and still rendered in the panel from its `claimText`;
 * it simply has no mark, because there is no range to mark.
 *
 * Where two flags overlap, the first one covering a run wins that run: a
 * ProseMirror text node cannot carry two marks of the same type, and both flags
 * remain in the panel regardless.
 */
export function applyFlagMarks(
  document: BriefDocument,
  flags: DocumentFlag[],
): BriefDocument {
  const anchored = flags.filter(
    (flag) => flag.anchorTo > flag.anchorFrom && flag.anchorFrom >= 0,
  );

  if (anchored.length === 0) return document;

  const { segments } = renderDocument(document);

  let index = 0;
  const content = document.content.map((node) => {
    const inline = node.content ?? [];
    const nodeSegments = segments.slice(index, index + countText(inline));

    index += countText(inline);

    if (nodeSegments.length === 0) return node;

    const rebuilt = splitInline(inline, nodeSegments, anchored);

    return { ...node, content: rebuilt } as BlockNode;
  });

  return { type: "doc", content };
}

function countText(inline: InlineNode[]): number {
  return inline.filter((child) => child.type === "text").length;
}

/** Splits a node's text runs at every flag boundary that falls inside them. */
function splitInline(
  inline: InlineNode[],
  segments: TextSegment[],
  flags: DocumentFlag[],
): InlineNode[] {
  const result: InlineNode[] = [];
  let textIndex = 0;

  for (const child of inline) {
    if (child.type === CITATION_CHIP_NODE) {
      result.push(child);
      continue;
    }

    const segment = segments[textIndex];
    textIndex += 1;

    if (segment === undefined) {
      result.push(child);
      continue;
    }

    const boundaries = new Set<number>([segment.charFrom, segment.charTo]);

    for (const flag of flags) {
      if (flag.anchorFrom > segment.charFrom && flag.anchorFrom < segment.charTo) {
        boundaries.add(flag.anchorFrom);
      }
      if (flag.anchorTo > segment.charFrom && flag.anchorTo < segment.charTo) {
        boundaries.add(flag.anchorTo);
      }
    }

    const ordered = [...boundaries].sort((a, b) => a - b);

    for (let i = 0; i < ordered.length - 1; i += 1) {
      const from = ordered[i];
      const to = ordered[i + 1];
      const slice = child.text.slice(
        from - segment.charFrom,
        to - segment.charFrom,
      );

      if (slice.length === 0) continue;

      const covering = flags.find(
        (flag) => flag.anchorFrom <= from && flag.anchorTo >= to,
      );

      result.push(
        covering === undefined
          ? { type: "text", text: slice }
          : {
              type: "text",
              text: slice,
              marks: [
                {
                  type: GUARD_FLAG_MARK,
                  attrs: { flagId: covering.id, reason: covering.reason },
                },
              ],
            },
      );
    }
  }

  return result;
}

/**
 * The document as it is STORED: without guard-flag marks.
 *
 * Flag state lives in `hallucination_flag` rows, and a copy of it inside the
 * document would be a second place for the same fact to live and drift from.
 * Marks are painted on at load and read back off at save; they are derived, and
 * derived state is not persisted.
 */
export function stripGuardFlagMarks(document: BriefDocument): BriefDocument {
  return {
    type: "doc",
    content: document.content.map((node) => {
      if (node.content === undefined) return node;

      const merged: InlineNode[] = [];

      for (const child of node.content) {
        if (child.type === CITATION_CHIP_NODE) {
          merged.push(child);
          continue;
        }

        const previous = merged[merged.length - 1];

        if (previous !== undefined && previous.type === "text") {
          merged[merged.length - 1] = {
            type: "text",
            text: previous.text + child.text,
          };
          continue;
        }

        merged.push({ type: "text", text: child.text });
      }

      return { ...node, content: merged } as BlockNode;
    }),
  };
}

/* -------------------------------------------------------------------------
 * Reading
 * ---------------------------------------------------------------------- */

/** The evidence item ids a document actually cites, in document order. */
export function citedEvidenceItemIds(document: BriefDocument): string[] {
  const ids: string[] = [];

  for (const node of document.content) {
    for (const child of node.content ?? []) {
      if (child.type === CITATION_CHIP_NODE) ids.push(child.attrs.evidenceItemId);
    }
  }

  return ids;
}

export type DocumentOutlineEntry = {
  /** The heading's index in `document.content` — also its anchor id. */
  index: number;
  level: HeadingLevel;
  text: string;
};

/** The sections nav's list. Headings only, in document order. */
export function documentOutline(
  document: BriefDocument,
): DocumentOutlineEntry[] {
  const entries: DocumentOutlineEntry[] = [];

  document.content.forEach((node, index) => {
    if (node.type !== "heading") return;

    entries.push({
      index,
      level: node.attrs.level,
      text: inlineText(node.content),
    });
  });

  return entries;
}

/** A node's plain text. Citation chips render to nothing (see the header). */
export function inlineText(inline: InlineNode[] | undefined): string {
  return (inline ?? [])
    .map((child) => (child.type === "text" ? child.text : ""))
    .join("");
}

function inlineSize(inline: InlineNode[]): number {
  return inline.reduce(
    (total, child) => total + (child.type === "text" ? child.text.length : 1),
    0,
  );
}

/** Narrows an unknown `documentJson` column value. */
export function parseStoredDocument(value: unknown): BriefDocument | null {
  const parsed = briefDocumentSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}
