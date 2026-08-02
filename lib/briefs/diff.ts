import { parseBriefBody } from "./body";

/**
 * What an audience switch would change, at SECTION ALTITUDE.
 *
 * `brief-output` rule 4 is a perceptual claim before it is a technical one: a
 * switch must read as "same evidence, reframed", not "new document loaded". That
 * claim is made or broken by the altitude the difference is shown at. A
 * word-level diff paints every reframed sentence as a field of insertions and
 * deletions and says the opposite of what is true — a section-level one shows
 * that the findings and their citations are the same material while the framing
 * moved, which is the thing being asserted.
 *
 * The unit is the block contract `assembleBodyText` writes and `parseBriefBody`
 * reads back: a heading line plus its prose, separated by one blank line. Both
 * documents come out of the same generator, so both parse into the same
 * structure and the comparison is over headings and their bodies.
 *
 * PURE. No Prisma, no React, no Gemini, no governance rule — it takes two
 * strings and returns a description of how they differ, and both halves are
 * produced server-side by the caller (`app/(app)/briefs/[id]/reframe/actions.ts`)
 * so nothing here ever sees client-supplied prose.
 */

export type BriefDiffEntry =
  | { status: "unchanged"; heading: string; body: string }
  | { status: "changed"; heading: string; previousBody: string; nextBody: string }
  | { status: "added"; heading: string; body: string }
  | { status: "removed"; heading: string; body: string };

export type BriefDiffTitle = {
  status: "unchanged" | "changed";
  previous: string;
  next: string;
};

export type BriefDiff = {
  title: BriefDiffTitle;
  entries: BriefDiffEntry[];
  counts: {
    unchanged: number;
    changed: number;
    added: number;
    removed: number;
  };
};

/**
 * Two stored `bodyText` values, as a section-level diff.
 *
 * Sections are aligned by HEADING, using a longest-common-subsequence walk so
 * that a section added in the middle does not misalign everything after it. Two
 * aligned sections with the same prose are `unchanged`; with different prose,
 * `changed`, and both framings are kept so the officer can read them side by
 * side.
 *
 * Headings repeat legitimately in this document shape — every finding and every
 * recommendation is its own block — so alignment is positional within the
 * subsequence rather than by heading identity. Two findings that swapped places
 * therefore read as one removed and one added, which is honest: at this altitude
 * nothing can tell a move from a rewrite, and claiming otherwise would be the
 * fabrication.
 */
export function diffBriefBodies(previous: string, next: string): BriefDiff {
  const before = parseBriefBody(previous);
  const after = parseBriefBody(next);

  const matches = longestCommonSubsequence(
    before.blocks.map((block) => block.heading),
    after.blocks.map((block) => block.heading),
  );

  const entries: BriefDiffEntry[] = [];

  let beforeIndex = 0;
  let afterIndex = 0;

  const emitRemoved = (until: number) => {
    while (beforeIndex < until) {
      const block = before.blocks[beforeIndex];
      entries.push({
        status: "removed",
        heading: block.heading,
        body: block.body,
      });
      beforeIndex += 1;
    }
  };

  const emitAdded = (until: number) => {
    while (afterIndex < until) {
      const block = after.blocks[afterIndex];
      entries.push({ status: "added", heading: block.heading, body: block.body });
      afterIndex += 1;
    }
  };

  for (const match of matches) {
    // Everything before an aligned pair, on either side, is unmatched. Removals
    // are emitted first so a section that was replaced reads in document order:
    // what went, then what came.
    emitRemoved(match.before);
    emitAdded(match.after);

    const previousBlock = before.blocks[match.before];
    const nextBlock = after.blocks[match.after];

    entries.push(
      previousBlock.body === nextBlock.body
        ? {
            status: "unchanged",
            heading: nextBlock.heading,
            body: nextBlock.body,
          }
        : {
            status: "changed",
            heading: nextBlock.heading,
            previousBody: previousBlock.body,
            nextBody: nextBlock.body,
          },
    );

    beforeIndex += 1;
    afterIndex += 1;
  }

  emitRemoved(before.blocks.length);
  emitAdded(after.blocks.length);

  return {
    title: {
      status: before.title === after.title ? "unchanged" : "changed",
      previous: before.title,
      next: after.title,
    },
    entries,
    counts: {
      unchanged: entries.filter((entry) => entry.status === "unchanged").length,
      changed: entries.filter((entry) => entry.status === "changed").length,
      added: entries.filter((entry) => entry.status === "added").length,
      removed: entries.filter((entry) => entry.status === "removed").length,
    },
  };
}

/**
 * The aligned index pairs of the longest common subsequence of two heading
 * lists.
 *
 * A brief has on the order of fifteen blocks, so the quadratic table is a few
 * hundred cells and the straightforward dynamic program is the right one — a
 * cleverer algorithm here would buy nothing and cost a reader's understanding.
 */
function longestCommonSubsequence(
  before: string[],
  after: string[],
): { before: number; after: number }[] {
  const rows = before.length;
  const columns = after.length;

  // lengths[i][j] — the LCS length of before[i..] and after[j..].
  const lengths: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(columns + 1).fill(0),
  );

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        before[i] === after[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const pairs: { before: number; after: number }[] = [];

  let i = 0;
  let j = 0;

  while (i < rows && j < columns) {
    if (before[i] === after[j]) {
      pairs.push({ before: i, after: j });
      i += 1;
      j += 1;
      continue;
    }

    if (lengths[i + 1][j] >= lengths[i][j + 1]) i += 1;
    else j += 1;
  }

  return pairs;
}
