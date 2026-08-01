import "server-only";

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from "docx";

import { audienceLabel } from "@/lib/ai/audience-profiles";
import { BRIEF_TYPE_PROFILES, briefTypeLabel } from "@/lib/ai/brief-types";
import {
  buildDocumentFromBodyText,
  parseStoredDocument,
  CITATION_CHIP_NODE,
  type BriefDocument,
  type InlineNode,
} from "@/lib/briefs/document";
import { FLAG_REASON_LABELS } from "@/lib/briefs/flag-labels";
import {
  BriefStatus,
  type BriefAudience,
  type BriefType,
  type FlagReason,
} from "@/lib/generated/prisma/enums";

/**
 * The brief as a Word document — the one place the export mapping lives.
 *
 * PURE, AND SERVER-ONLY. It takes everything it needs as arguments: no Prisma,
 * no session, no request. The Route Handler reads and responds; nothing about
 * how a heading becomes a heading is decided there (AGENTS.md §5.3).
 *
 * THE MAPPING RUNS FROM `lib/briefs/document.ts`'s VOCABULARY and nothing else,
 * which is why that module names export as one of its three consumers. Every
 * node type added there is a node type this function must learn:
 *
 *   heading 1 → Title      heading 2 → Heading 1     heading 3 → Heading 2
 *   paragraph → body       citationChip → [key]      guardFlag → nothing inline
 *
 * A guard flag deliberately leaves no inline mark. Word highlighting is easy to
 * strip and easy to miss, and inside a document that may be forwarded to a
 * ministry it would read as an accusation against a sentence. The flag travels
 * instead as a notice at the top and a list at the end — visible to a reader,
 * and in the guard's register rather than an alarm (§9.7, `hallucination-guard`).
 *
 * NO EVIDENCE BODY TEXT EVER ENTERS THE FILE. The References section carries
 * metadata only — title, authors, year, citation key, source URL — the same
 * fields already on screen. No chunk, no excerpt, no extracted document (§7.6).
 *
 * TYPEFACES DO NOT CROSS THE BOUNDARY. On screen the serif marks quoted material
 * (§11.6); a `.docx` is read in someone else's Word with someone else's fonts,
 * and forcing EviBrief's typefaces into it would be a worse outcome than losing
 * the distinction. The References section is distinguished structurally instead.
 */

export type ExportEvidenceItem = {
  title: string;
  authors: string[];
  year: number | null;
  citationKey: string;
  country: string | null;
  sourceUrl: string | null;
};

export type ExportFlag = {
  claimText: string;
  reason: FlagReason;
};

export type BriefExportInput = {
  briefType: BriefType;
  audience: BriefAudience;
  status: BriefStatus;
  version: number;
  generatedAt: string | null;
  generatingModel: string | null;
  /** The stored `documentJson`, which is null for every pre-editor brief. */
  documentJson: unknown;
  /** The canonical text, and the fallback the editor already uses. */
  bodyText: string;
  /** The recorded evidence set, in the order it was chosen (§16.5). */
  evidence: ExportEvidenceItem[];
  /** OPEN flags only. A closed flag is settled and does not travel (§9.5). */
  openFlags: ExportFlag[];
};

/* -------------------------------------------------------------------------
 * The document's own copy
 * ---------------------------------------------------------------------- */

/**
 * Fixed copy for the exported file. Document copy, not UI copy — it belongs with
 * the mapping that writes it rather than with the screen's labels.
 *
 * The notice never says unverified, incorrect, or false, and never implies the
 * system checked or endorsed anything (§8.8).
 */
const COPY = {
  noticeHeading: "Before you read this draft",
  notice: (count: number) =>
    count === 1
      ? "One claim in this draft has not been traced back to the evidence the draft was generated from. It is not necessarily wrong — it is still being checked by a person. It is listed at the end of this document."
      : `${count} claims in this draft have not been traced back to the evidence the draft was generated from. They are not necessarily wrong — they are still being checked by a person. They are listed at the end of this document.`,
  referencesHeading: "References",
  referencesIntro:
    "The evidence set this brief was generated from, in the order it was chosen.",
  referencesEmpty: "No evidence is recorded against this brief.",
  claimsHeading: "Claims still being checked",
  claimsIntro:
    "Each claim below still needs a person to check it against a source. A claim appearing here has not been shown to be wrong; it has not yet been traced to the evidence supplied to the generator.",
} as const;

const STATUS_LABELS: Record<BriefStatus, string> = {
  [BriefStatus.draft]: "Draft",
  [BriefStatus.reviewed]: "Reviewed",
  [BriefStatus.submitted]: "Submitted",
  [BriefStatus.published]: "Published",
};

/* -------------------------------------------------------------------------
 * Paragraph helpers
 * ---------------------------------------------------------------------- */

/** Twips. Word's own unit, and the reason these are not round numbers of points. */
const SPACE_AFTER_BODY = 160;
const SPACE_BEFORE_HEADING = 320;
const SPACE_AFTER_HEADING = 120;

/** ~9pt, for the header block and the reference detail lines. */
const META_SIZE = 18;
const META_COLOUR = "595959";

function body(text: string, options: IParagraphOptions = {}): Paragraph {
  return new Paragraph({
    spacing: { after: SPACE_AFTER_BODY },
    children: [new TextRun(text)],
    ...options,
  });
}

function meta(text: string, options: IParagraphOptions = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, size: META_SIZE, color: META_COLOUR })],
    ...options,
  });
}

function sectionHeading(
  text: string,
  options: IParagraphOptions = {},
): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: SPACE_BEFORE_HEADING, after: SPACE_AFTER_HEADING },
    children: [new TextRun(text)],
    ...options,
  });
}

/* -------------------------------------------------------------------------
 * The body mapping
 * ---------------------------------------------------------------------- */

const HEADING_STYLES = {
  1: HeadingLevel.TITLE,
  2: HeadingLevel.HEADING_1,
  3: HeadingLevel.HEADING_2,
} as const;

/**
 * A block's inline content as Word runs.
 *
 * A citation chip renders to nothing in `bodyText` and would therefore vanish
 * from the file if it were left alone — and a brief whose citations vanished is
 * the exact opposite of this product's claim (§15.5). It becomes the same
 * bracketed key a reader already sees on the chip, at its position, with a space
 * inserted only where one is not already there.
 *
 * A guard-flag mark contributes nothing: its text run is written as plain text.
 */
function inlineRuns(inline: InlineNode[] | undefined): TextRun[] {
  const runs: TextRun[] = [];
  let previous = "";

  for (const child of inline ?? []) {
    const text =
      child.type === CITATION_CHIP_NODE
        ? `${previous.length > 0 && !/\s$/.test(previous) ? " " : ""}[${child.attrs.citationKey}]`
        : child.text;

    if (text.length === 0) continue;

    runs.push(new TextRun(text));
    previous = text;
  }

  return runs;
}

/**
 * The stored document as Word paragraphs.
 *
 * No page breaks are invented and nothing is reflowed. Length targets are part
 * of the brief's contract (§16.1), so a one-page stakeholder note must not leave
 * here as three.
 */
function documentParagraphs(document: BriefDocument): Paragraph[] {
  return document.content.map((node) => {
    const children = inlineRuns(node.content);

    if (node.type === "heading") {
      return new Paragraph({
        heading: HEADING_STYLES[node.attrs.level],
        spacing: {
          before: node.attrs.level === 1 ? 0 : SPACE_BEFORE_HEADING,
          after: SPACE_AFTER_HEADING,
        },
        children,
      });
    }

    return new Paragraph({ spacing: { after: SPACE_AFTER_BODY }, children });
  });
}

/* -------------------------------------------------------------------------
 * The surrounding blocks
 * ---------------------------------------------------------------------- */

/**
 * What this document is, where an outside reader can see it: §16.5's record —
 * type, audience, version, and the generating model — plus the status, so a
 * draft that gets forwarded is legible as a draft (decision 7).
 */
function headerBlock(input: BriefExportInput): Paragraph[] {
  const profile = BRIEF_TYPE_PROFILES[input.briefType];

  return [
    meta(`${briefTypeLabel(input.briefType)} · ${profile.lengthTarget}`),
    meta(`For ${audienceLabel(input.audience)}`),
    meta(`${STATUS_LABELS[input.status]} · version ${input.version}`),
    meta(`Generated ${formatDate(input.generatedAt)}`),
    meta(`Drafted by ${input.generatingModel ?? "model not recorded"}`, {
      spacing: { after: SPACE_BEFORE_HEADING },
    }),
  ];
}

/**
 * The notice, present whenever the current version has an open flag — at any
 * status, and never blocking the download (§16.8).
 *
 * A brief with no open flags carries no notice at all: an "everything is fine"
 * banner in an outgoing document is noise, and it would train a reader to skip
 * past the block that matters.
 */
function flagNotice(openFlags: ExportFlag[]): Paragraph[] {
  if (openFlags.length === 0) return [];

  return [
    new Paragraph({
      spacing: { after: SPACE_AFTER_HEADING },
      children: [new TextRun({ text: COPY.noticeHeading, bold: true })],
    }),
    body(COPY.notice(openFlags.length), {
      spacing: { after: SPACE_BEFORE_HEADING },
    }),
  ];
}

/**
 * The recorded evidence set, matching `CitationList` on screen field for field.
 *
 * The page break is a document convention rather than a reflow — it is the one
 * break this mapping inserts (decision 8).
 */
function references(evidence: ExportEvidenceItem[]): Paragraph[] {
  const heading = sectionHeading(COPY.referencesHeading, {
    pageBreakBefore: true,
  });

  if (evidence.length === 0) {
    return [heading, body(COPY.referencesEmpty)];
  }

  const entries = evidence.flatMap((item, index) => {
    const detail = [
      item.authors.length > 0 ? item.authors.join(", ") : null,
      item.year !== null ? String(item.year) : null,
      item.country,
    ]
      .filter((part): part is string => part !== null && part.length > 0)
      .join(" · ");

    return [
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun(`${index + 1}. `),
          new TextRun({ text: `[${item.citationKey}] `, bold: true }),
          new TextRun(item.title),
        ],
      }),
      ...(detail.length > 0 ? [meta(detail, { indent: { left: 340 } })] : []),
      ...(item.sourceUrl
        ? [
            meta(item.sourceUrl, {
              indent: { left: 340 },
              spacing: { after: SPACE_AFTER_BODY },
            }),
          ]
        : []),
    ];
  });

  return [heading, body(COPY.referencesIntro), ...entries];
}

/**
 * One entry per open flag, so a reader can actually find the claims the notice
 * refers to. Closed flags are not listed: they are settled, and the record of
 * who closed one and why lives in the product, not in an outgoing file.
 */
function openClaims(openFlags: ExportFlag[]): Paragraph[] {
  if (openFlags.length === 0) return [];

  const entries = openFlags.flatMap((flag) => [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun(flag.claimText)],
    }),
    meta(FLAG_REASON_LABELS[flag.reason], {
      spacing: { after: SPACE_AFTER_BODY },
    }),
  ]);

  return [
    sectionHeading(COPY.claimsHeading),
    body(COPY.claimsIntro),
    ...entries,
  ];
}

function formatDate(iso: string | null): string {
  if (iso === null) return "date not recorded";

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* -------------------------------------------------------------------------
 * The whole file
 * ---------------------------------------------------------------------- */

/**
 * The brief as `.docx` bytes.
 *
 * `Uint8Array<ArrayBuffer>` rather than plain `Uint8Array`: a `Response` body
 * will not accept a view over a `SharedArrayBuffer`, which is what `docx`'s
 * Node `Buffer` widens to.
 */
export async function renderBriefDocx(
  input: BriefExportInput,
): Promise<Uint8Array<ArrayBuffer>> {
  // Exactly the editor's fallback, from the same module rather than a second
  // one: a brief generated before the editor existed exports from `bodyText`,
  // carrying no citation chips because it never had any (decision 3).
  const document =
    parseStoredDocument(input.documentJson) ??
    buildDocumentFromBodyText(input.bodyText);

  const file = new Document({
    sections: [
      {
        children: [
          ...headerBlock(input),
          ...flagNotice(input.openFlags),
          ...documentParagraphs(document),
          ...references(input.evidence),
          ...openClaims(input.openFlags),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(file);
  const bytes = new Uint8Array(buffer.byteLength);

  bytes.set(buffer);

  return bytes;
}
