"use client";

import { useMemo, useState } from "react";

import { ClassificationBadge } from "@/components/classification-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { GENERATION_EVIDENCE_CONTEXT_SIZE } from "@/lib/briefs/generation-limits";
import type { EvidenceListItem } from "@/lib/db/evidence";
import { cn } from "@/lib/utils";

import { formatScore } from "../../signals/labels";
import { EVIDENCE_SOURCE_TYPE_LABELS } from "../../evidence/labels";

import type { MatchedEvidenceItem } from "./signal-context";

/**
 * Choosing the evidence the brief is generated from.
 *
 * PRESENTATION, NOT THE CONTROL. Both lists arrive already gated — the library
 * from `listEligibleEvidence`, the matched set from a query carrying
 * `ELIGIBLE_EVIDENCE_WHERE` — and the cap below is a courtesy to the person, not
 * a guarantee to the server: `startBriefGeneration` re-reads every selected id
 * from the database and puts it through the gate before any Gemini call (§7.1).
 * Nothing here decides eligibility.
 *
 * A MATCHED ITEM IS A DEFAULT, NOT A FIXTURE. Selecting and deselecting works
 * identically in both groups; the officer composing this brief's evidence set is
 * the whole point (`evidence-matcher` rule 5).
 *
 * SCORES APPEAR ONLY WHERE SOMETHING COMPUTED ONE. A matched item shows the
 * rerank's number and its bar (§11.13); a hand-picked item shows nothing at all,
 * because manual selection produces no score and a fabricated number in a
 * product about traceability is the wrong trade. A candidate the rerank omitted
 * says "not scored" rather than being drawn as a zero — it was left out, not
 * rated badly, and those are not the same claim.
 *
 * The filter is a local narrowing of an already-loaded, already-gated list — not
 * a search, and not a client-side fetch on a read path (§5.3). It applies to the
 * library group only: the matched set is small, deliberate, and the reason the
 * officer is here.
 */
export function EvidencePicker({
  evidence,
  matched,
  selectedIds,
  onToggle,
  disabled,
}: {
  evidence: EvidenceListItem[];
  /** Rank order, from the signal's match set. Empty for a manual draft. */
  matched: MatchedEvidenceItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState("");

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const matchedIds = useMemo(
    () => new Set(matched.map((match) => match.item.id)),
    [matched],
  );

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    // Listed once, in the group that can say where it came from.
    const rest = evidence.filter((item) => !matchedIds.has(item.id));

    if (needle.length === 0) return rest;

    return rest.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.citationKey.toLowerCase().includes(needle) ||
        item.country?.toLowerCase().includes(needle) ||
        item.authors.some((author) => author.toLowerCase().includes(needle)),
    );
  }, [evidence, filter, matchedIds]);

  const atCap = selectedIds.length >= GENERATION_EVIDENCE_CONTEXT_SIZE;

  return (
    <fieldset
      className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border p-4 tablet:p-6"
      disabled={disabled}
    >
      <legend className="sr-only">Evidence for this brief</legend>

      <div className="flex flex-col gap-1">
        <h2 className="text-ink text-h3 font-semibold">Evidence</h2>
        <p className="text-ink-3 text-[13px]">
          Only evidence tagged as public and published can reach the model, so
          only that is listed. Choose up to{" "}
          <span className="font-mono">{GENERATION_EVIDENCE_CONTEXT_SIZE}</span>{" "}
          items — they are the entire source of fact for this brief.
        </p>
      </div>

      <p
        aria-live="polite"
        className={cn(
          "font-mono text-[11.5px]",
          atCap ? "text-primary-ink font-medium" : "text-ink-3",
        )}
      >
        {selectedIds.length} / {GENERATION_EVIDENCE_CONTEXT_SIZE} selected
      </p>

      {evidence.length === 0 && matched.length === 0 ? (
        <p className="text-ink-3 border-line rounded-card border border-dashed p-4 text-[13px]">
          No evidence is eligible yet. An item becomes available here once a
          Research Officer tags it as public and published in the classification
          queue.
        </p>
      ) : (
        <>
          {matched.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-ink-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase">
                From the Evidence Matcher
              </h3>
              <p className="text-ink-3 text-[12.5px]">
                What retrieval returned for this signal, in the order it ranked
                them. Remove anything that does not belong in this brief.
              </p>
              <ul className="flex flex-col gap-2">
                {matched.map((match, index) => (
                  <EvidenceRow
                    key={match.item.id}
                    item={match.item}
                    rank={index + 1}
                    rerankScore={match.rerankScore}
                    isSelected={selected.has(match.item.id)}
                    atCap={atCap}
                    onToggle={onToggle}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {matched.length > 0 ? (
              <h3 className="text-ink-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase">
                Everything else in the library
              </h3>
            ) : null}

            <Input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Narrow by title, author, country, or citation key"
              aria-label="Narrow the evidence list"
              className="min-w-0"
            />

            {visible.length === 0 ? (
              <p className="text-ink-3 border-line rounded-card border border-dashed p-4 text-[13px]">
                {filter.trim().length > 0
                  ? `Nothing else in the eligible library matches “${filter.trim()}”.`
                  : "The eligible library holds nothing beyond the matched set above."}
              </p>
            ) : (
              <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
                {visible.map((item) => (
                  <EvidenceRow
                    key={item.id}
                    item={item}
                    rank={null}
                    rerankScore={null}
                    isSelected={selected.has(item.id)}
                    atCap={atCap}
                    onToggle={onToggle}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {atCap ? (
        <p className="text-ink-3 text-[12.5px]">
          That is the full context the generator receives. Clear one to swap it
          for another.
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * One selectable item, identical in both groups apart from what it can honestly
 * say about itself: a matched row carries its rank and the rerank's score, a
 * library row carries neither.
 */
function EvidenceRow({
  item,
  rank,
  rerankScore,
  isSelected,
  atCap,
  onToggle,
}: {
  item: EvidenceListItem;
  /** Position in the match set, or null for a hand-picked item. */
  rank: number | null;
  rerankScore: number | null;
  isSelected: boolean;
  atCap: boolean;
  onToggle: (id: string) => void;
}) {
  const blocked = !isSelected && atCap;

  return (
    <li>
      <label
        className={cn(
          "rounded-card flex cursor-pointer items-start gap-3 border p-3 transition-colors duration-150",
          isSelected
            ? "border-surface-tint-border bg-surface-tint"
            : "border-line bg-paper hover:border-sage",
          blocked && "cursor-not-allowed opacity-55",
        )}
      >
        <Checkbox
          checked={isSelected}
          disabled={blocked}
          onCheckedChange={() => onToggle(item.id)}
          className="mt-0.5"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex min-w-0 items-start justify-between gap-3">
            <span className="text-ink text-[13.5px] leading-snug font-medium">
              {item.title}
            </span>
            {rank === null ? null : (
              <span className="text-ink-3 shrink-0 font-mono text-[11px]">
                #{rank}
              </span>
            )}
          </span>
          <span className="text-ink-3 text-[12.5px]">
            {[
              item.authors.length > 0 ? item.authors.join(", ") : null,
              item.year !== null ? String(item.year) : null,
              item.country,
              EVIDENCE_SOURCE_TYPE_LABELS[item.sourceType],
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {rank === null ? null : <RelevanceScore value={rerankScore} />}
          <span className="flex flex-wrap items-center gap-2">
            <ClassificationBadge classification={item.classification} />
            <span className="text-ink-3 font-mono text-[11.5px]">
              {item.citationKey}
            </span>
          </span>
        </span>
      </label>
    </li>
  );
}

/**
 * Number AND bar, never colour alone (§11.13). The bar is decorative — the
 * number beside it carries the value, and the label names which scale it is on.
 */
function RelevanceScore({ value }: { value: number | null }) {
  const percent =
    value === null ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <span className="flex items-center gap-2">
      <span className="text-ink-3 text-[11px]">Relevance</span>
      <span
        className={cn(
          "font-mono text-[11.5px] tabular-nums",
          value === null ? "text-ink-3" : "text-ink-2",
        )}
      >
        {value === null ? "not scored" : formatScore(value)}
      </span>
      <span
        aria-hidden="true"
        className="bg-stone h-[3px] w-16 shrink-0 overflow-hidden"
      >
        <span className="bg-primary block h-full" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}
