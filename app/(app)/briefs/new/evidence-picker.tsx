"use client";

import { useMemo, useState } from "react";

import { ClassificationBadge } from "@/components/classification-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { GENERATION_EVIDENCE_CONTEXT_SIZE } from "@/lib/briefs/generation-limits";
import type { EvidenceListItem } from "@/lib/db/evidence";
import { cn } from "@/lib/utils";

import { EVIDENCE_SOURCE_TYPE_LABELS } from "../../evidence/labels";

/**
 * Choosing the evidence the brief is generated from.
 *
 * PRESENTATION, NOT THE CONTROL. The list arrives already gated
 * (`listEligibleEvidence`), and the cap below is a courtesy to the person, not a
 * guarantee to the server: `startBriefGeneration` re-reads every selected id
 * from the database and puts it through the gate before any Gemini call (§7.1).
 * Nothing here decides eligibility.
 *
 * Auto-matching from the pasted policy text is the Evidence Matcher's job and is
 * not half-built here (§15.1). Selection is manual, so no relevance score is
 * shown — there is nothing that computed one, and a fabricated number in a
 * product about traceability is the wrong trade.
 *
 * The filter is a local narrowing of an already-loaded, already-gated list — not
 * a search, and not a client-side fetch on a read path (§5.3).
 */
export function EvidencePicker({
  evidence,
  selectedIds,
  onToggle,
  disabled,
}: {
  evidence: EvidenceListItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState("");

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();

    if (needle.length === 0) return evidence;

    return evidence.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.citationKey.toLowerCase().includes(needle) ||
        item.country?.toLowerCase().includes(needle) ||
        item.authors.some((author) => author.toLowerCase().includes(needle)),
    );
  }, [evidence, filter]);

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

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Narrow by title, author, country, or citation key"
          aria-label="Narrow the evidence list"
          className="min-w-0 flex-1"
        />
        <span
          aria-live="polite"
          className={cn(
            "font-mono text-[11.5px] whitespace-nowrap",
            atCap ? "text-primary-ink font-medium" : "text-ink-3",
          )}
        >
          {selectedIds.length} / {GENERATION_EVIDENCE_CONTEXT_SIZE} selected
        </span>
      </div>

      {evidence.length === 0 ? (
        <p className="text-ink-3 border-line rounded-card border border-dashed p-4 text-[13px]">
          No evidence is eligible yet. An item becomes available here once a
          Research Officer tags it as public and published in the classification
          queue.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-ink-3 border-line rounded-card border border-dashed p-4 text-[13px]">
          Nothing in the eligible library matches “{filter.trim()}”.
        </p>
      ) : (
        <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
          {visible.map((item) => {
            const isSelected = selected.has(item.id);
            const blocked = !isSelected && atCap;

            return (
              <li key={item.id}>
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
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-ink text-[13.5px] leading-snug font-medium">
                      {item.title}
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
          })}
        </ul>
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
