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
import type { EvidenceListItem } from "@/lib/db/evidence";
import { cn } from "@/lib/utils";

import {
  EVIDENCE_SOURCE_TYPE_LABELS,
  IMPACT_AREA_LABELS,
  formatIngestedAt,
} from "./labels";

/**
 * The eligible evidence listing and its detail panel.
 *
 * TWO columns for now. The handoff's three-column recipe
 * (`desktop:grid-cols-[216px_1fr_340px]`) adds a filter rail on the left —
 * that rail, and keyword/semantic search, are the evidence-library-search
 * prompt. Rendering an empty filter column ahead of it would be a placeholder
 * pretending to be a feature.
 *
 * Below 760px the Type and Classification columns drop out of the table and are
 * read from the detail panel instead (design-system.md, responsive table).
 */
export function EvidenceTable({ items }: { items: EvidenceListItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  const selected = items.find((item) => item.id === selectedId) ?? null;

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
            {items.map((item) => {
              const isSelected = item.id === selectedId;

              return (
                <TableRow
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "border-line cursor-pointer border-b transition-colors duration-150",
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

function EvidenceDetail({ item }: { item: EvidenceListItem }) {
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
export function EvidenceExcerpt({ excerpt }: { excerpt: string }) {
  if (!excerpt) return null;

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-ink-3 text-[11.5px] font-semibold tracking-[0.06em] uppercase">
        Opening excerpt
      </figcaption>
      <blockquote className="border-accent text-ink font-serif text-[15px] leading-[1.55] border-l-2 pl-4">
        {excerpt}
      </blockquote>
    </figure>
  );
}
