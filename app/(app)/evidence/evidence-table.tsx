"use client";

import { useState, type ReactNode } from "react";

import { ClassificationBadge } from "@/components/classification-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EvidenceSearchResult,
  MatchProvenance,
} from "@/lib/evidence/search";
import { cn } from "@/lib/utils";

import {
  EVIDENCE_SOURCE_TYPE_LABELS,
  IMPACT_AREA_LABELS,
  formatIngestedAt,
} from "./labels";

/**
 * The eligible evidence listing and its detail panel.
 *
 * The filter rail is the third column of the handoff's Evidence Library recipe
 * (`desktop:grid-cols-[216px_1fr_340px]`) and is rendered by the page, outside
 * this component — so this holds the table and the detail panel, and the page
 * composes the rail beside them.
 *
 * Below 760px the Type and Classification columns drop out of the table and are
 * read from the detail panel instead (design-system.md, responsive table).
 */

/**
 * Rows given a staggered reveal. The handoff asks for a 70ms stagger; past this
 * many rows the last card would arrive over a second after the first, which is
 * a wait rather than an explanation. Everything beyond simply appears.
 */
const MAX_STAGGERED_ROWS = 8;
const ROW_STAGGER_MS = 70;

export function EvidenceTable({
  results,
  showMatch,
}: {
  results: EvidenceSearchResult[];
  /** True when a query is active. The Match column exists only then. */
  showMatch: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    results[0]?.id ?? null,
  );

  // Results change under the selection whenever a filter or query moves, so the
  // selected id may no longer be in the list. Reconciling to the first result
  // here — rather than in an effect — means the panel is never briefly empty.
  const selected =
    results.find((item) => item.id === selectedId) ?? results[0] ?? null;

  return (
    <div className="bg-card border-line rounded-card grid grid-cols-1 overflow-hidden border laptop:grid-cols-[1fr_320px] desktop:grid-cols-[1fr_360px]">
      {/* The table scrolls inside its own panel; the page never scrolls
          horizontally (AGENTS.md §11.15). */}
      <div className="min-w-0 overflow-x-auto">
        <Table>
          <TableHeader className="bg-stone">
            <TableRow>
              <TableHead className="text-ink-2 text-[11.5px] font-semibold tracking-[0.06em] uppercase">
                Title
              </TableHead>
              {showMatch ? (
                <TableHead className="text-ink-2 text-[11.5px] font-semibold tracking-[0.06em] uppercase">
                  Match
                </TableHead>
              ) : null}
              <TableHead className="text-ink-2 hidden text-[11.5px] font-semibold tracking-[0.06em] uppercase tablet:table-cell">
                Type
              </TableHead>
              <TableHead className="text-ink-2 text-[11.5px] font-semibold tracking-[0.06em] uppercase">
                Year
              </TableHead>
              <TableHead className="text-ink-2 hidden text-[11.5px] font-semibold tracking-[0.06em] uppercase tablet:table-cell">
                Country
              </TableHead>
              <TableHead className="text-ink-2 hidden text-[11.5px] font-semibold tracking-[0.06em] uppercase laptop:table-cell">
                Impact area
              </TableHead>
              <TableHead className="text-ink-2 hidden text-[11.5px] font-semibold tracking-[0.06em] uppercase tablet:table-cell">
                Classification
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item, index) => {
              const isSelected = item.id === selected?.id;

              return (
                <TableRow
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  aria-current={isSelected ? "true" : undefined}
                  // Match reveal: fade + 8px rise, 70ms apart, in match order
                  // (handoff motion table). Only when there is a match to
                  // reveal — a browse listing is not a result set. The global
                  // reduced-motion rule neutralises it.
                  style={
                    showMatch && index < MAX_STAGGERED_ROWS
                      ? { animationDelay: `${index * ROW_STAGGER_MS}ms` }
                      : undefined
                  }
                  className={cn(
                    "border-line cursor-pointer border-b transition-colors duration-150",
                    showMatch && index < MAX_STAGGERED_ROWS && "animate-rise-in",
                    // Selected row is a surface-tint background, never a
                    // checkbox alone (design-system.md, evidence table).
                    isSelected ? "bg-surface-tint" : "hover:bg-stone/60",
                  )}
                >
                  <TableCell className="max-w-[420px] py-2.5">
                    {/* The keyboard path: every row is reachable and operable
                        without a pointer (WCAG 2.1 AA). */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(item.id);
                      }}
                      className="text-ink w-full text-left text-[13px] font-medium"
                    >
                      <span className="line-clamp-2">{item.title}</span>
                      <span className="text-ink-3 mt-0.5 block font-mono text-[11px]">
                        {item.citationKey}
                      </span>
                    </button>
                  </TableCell>
                  {showMatch ? (
                    <TableCell className="py-2.5">
                      <MatchCell match={item.match} />
                    </TableCell>
                  ) : null}
                  <TableCell className="text-ink-2 hidden py-2.5 text-[13px] tablet:table-cell">
                    {EVIDENCE_SOURCE_TYPE_LABELS[item.sourceType]}
                  </TableCell>
                  <TableCell className="text-ink-2 py-2.5 font-mono text-[11.5px]">
                    {item.year ?? "—"}
                  </TableCell>
                  <TableCell className="text-ink-2 hidden py-2.5 text-[13px] tablet:table-cell">
                    {item.country ?? "—"}
                  </TableCell>
                  <TableCell className="text-ink-2 hidden py-2.5 text-[13px] laptop:table-cell">
                    {item.impactArea
                      ? IMPACT_AREA_LABELS[item.impactArea]
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden py-2.5 tablet:table-cell">
                    <ClassificationBadge classification={item.classification} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Panel border switches from top to left when the column becomes a
          stacked row (design-system.md, responsive rules). */}
      <aside
        aria-label="Evidence detail"
        className="border-line min-w-0 border-t p-4 laptop:border-t-0 laptop:border-l"
      >
        {selected ? (
          <EvidenceDetail item={selected} />
        ) : (
          <p className="text-ink-3 text-[13px]">
            Select a row to read its details.
          </p>
        )}
      </aside>
    </div>
  );
}

/**
 * The Match column: always populated when it is rendered, so every row explains
 * why it is in the list.
 *
 * Similarity is a number AND a bar, never colour alone (design-system.md,
 * evidence table), with the same information in the `aria-label`. A literal hit
 * has no similarity to report and says so in words rather than borrowing a
 * number it does not have.
 */
function MatchCell({ match }: { match: MatchProvenance | null }) {
  if (match === null) return null;

  if (match.kind === "keyword") {
    return <span className="text-ink-2 text-[13px]">Keyword</span>;
  }

  const score = Math.round(match.similarity * 100);
  const alsoKeyword = match.kind === "both";

  return (
    <span
      className="flex min-w-[104px] flex-col gap-1"
      aria-label={`Closeness ${score} out of 100${
        alsoKeyword ? ", and a keyword match" : ""
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="text-ink font-mono text-[11.5px] font-medium tabular-nums">
          {score}
        </span>
        <span
          aria-hidden="true"
          className="bg-stone h-1 w-14 overflow-hidden rounded-full"
        >
          <span
            className="bg-primary block h-full rounded-full"
            style={{ width: `${score}%` }}
          />
        </span>
      </span>
      {alsoKeyword ? (
        <span className="text-ink-3 text-[11.5px]">and keyword</span>
      ) : null}
    </span>
  );
}

function EvidenceDetail({ item }: { item: EvidenceSearchResult }) {
  const match = item.match;
  const matchedPassage =
    match !== null && match.kind !== "keyword"
      ? { excerpt: match.chunkExcerpt, ordinal: match.chunkOrdinal }
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <h2 className="text-ink text-[15px] leading-snug font-semibold">
          {item.title}
        </h2>
        <ClassificationBadge classification={item.classification} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
        <DetailRow label="Authors">
          {item.authors.length > 0 ? item.authors.join(", ") : "Not recorded"}
        </DetailRow>
        <DetailRow label="Year">{item.year ?? "Not recorded"}</DetailRow>
        <DetailRow label="Country">{item.country ?? "Not recorded"}</DetailRow>
        <DetailRow label="Source type">
          {EVIDENCE_SOURCE_TYPE_LABELS[item.sourceType]}
        </DetailRow>
        <DetailRow label="Impact area">
          {item.impactArea ? IMPACT_AREA_LABELS[item.impactArea] : "Not recorded"}
        </DetailRow>
        <DetailRow label="Citation key">
          <span className="font-mono text-[11.5px]">{item.citationKey}</span>
        </DetailRow>
        <DetailRow label="Ingested">
          {formatIngestedAt(item.ingestedAt)}
        </DetailRow>
        <DetailRow label="Chunks">
          <span className="font-mono text-[11.5px]">{item.chunkCount}</span>
        </DetailRow>
        <DetailRow label="Embedding">
          <EmbeddingState
            chunkCount={item.chunkCount}
            embeddedChunkCount={item.embeddedChunkCount}
          />
        </DetailRow>
        {item.sourceFileName ? (
          <DetailRow label="Source file">{item.sourceFileName}</DetailRow>
        ) : null}
        {item.sourceUrl ? (
          <DetailRow label="Source URL">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all"
            >
              {item.sourceUrl}
            </a>
          </DetailRow>
        ) : null}
      </dl>

      {/* The matched passage sits above the opening excerpt: it is the reason
          this row is on screen, and burying it under the document's first
          paragraph would make the reader hunt for it. */}
      {matchedPassage ? (
        <EvidenceExcerpt
          excerpt={matchedPassage.excerpt}
          label={`Matched passage · chunk ${matchedPassage.ordinal}`}
        />
      ) : null}

      <EvidenceExcerpt excerpt={item.excerpt} />
    </div>
  );
}

/**
 * Embedding state, stated plainly.
 *
 * This is background work with nothing to watch, so there is no spinner and no
 * progress bar — a bar implies something is happening right now, and usually
 * nothing is. The honest reading is a count of how many chunks currently carry
 * a vector.
 *
 * The copy says what is true and nothing more: "embedded" means vectors exist,
 * not that anything was verified, checked, or indexed by the system
 * (AGENTS.md §8.8). Nothing here is red, and no state is treated as an error —
 * an unembedded item is a normal item.
 */
function EmbeddingState({
  chunkCount,
  embeddedChunkCount,
}: {
  chunkCount: number;
  embeddedChunkCount: number;
}) {
  if (chunkCount === 0) {
    return <span className="text-ink-3">No chunks to embed</span>;
  }

  const label =
    embeddedChunkCount === 0
      ? "Not yet embedded"
      : embeddedChunkCount >= chunkCount
        ? "Embedded"
        : "Partly embedded";

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span>{label}</span>
      <span className="text-ink-3 font-mono text-[11.5px] whitespace-nowrap">
        {embeddedChunkCount} / {chunkCount} chunks
      </span>
    </span>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-ink-3 text-[11.5px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase">
        {label}
      </dt>
      <dd className="text-ink-2 min-w-0 break-words">{children}</dd>
    </>
  );
}

/**
 * Extracted document text is quoted material — the source's words, not the
 * product's — so it takes the serif (AGENTS.md §11.6). This distinction is how
 * a reader tells what a source said from what the system wrote; never set this
 * in Inter.
 */
export function EvidenceExcerpt({
  excerpt,
  label = "Opening excerpt",
}: {
  excerpt: string;
  /** What this passage is. The matched-passage variant names its chunk. */
  label?: string;
}) {
  if (!excerpt) return null;

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-ink-3 text-[11.5px] font-semibold tracking-[0.06em] uppercase">
        {label}
      </figcaption>
      <blockquote className="border-accent text-ink font-serif text-[15px] leading-[1.55] border-l-2 pl-4">
        {excerpt}
      </blockquote>
    </figure>
  );
}
