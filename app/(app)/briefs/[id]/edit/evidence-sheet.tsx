"use client";

import { ClassificationBadge } from "@/components/classification-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BriefForEdit } from "@/lib/db/briefs";

/**
 * A citation chip's evidence item, in a side panel.
 *
 * NEVER A ROUTE CHANGE. The officer is mid-sentence; navigating away loses their
 * place, and the whole point of the chip is that a claim can be checked without
 * leaving the document (`tiptap-editor`, design-system.md).
 *
 * THE SERIF RULE IS AT ITS MOST FRAGILE HERE. The item's TITLE is verbatim
 * source material and is set in the serif; every piece of metadata around it —
 * authors, year, country, citation key, classification — is the product's own
 * voice and stays in the sans (§11.6). Do not "tidy" the metadata into the serif
 * to make the panel look consistent: the inconsistency is the mechanism.
 *
 * Classification is DISPLAYED here, never changed. There is no classification
 * control on this route (§10.8).
 */
export function EvidenceSheet({
  item,
  onClose,
}: {
  item: BriefForEdit["evidence"][number] | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full max-w-[min(28rem,100vw)] gap-0 overflow-y-auto"
      >
        <SheetHeader className="border-line gap-2 border-b p-5">
          <SheetTitle className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
            Cited evidence
          </SheetTitle>
          <SheetDescription className="sr-only">
            The evidence item this citation points to, from the set this brief
            was generated from.
          </SheetDescription>
        </SheetHeader>

        {item === null ? null : (
          <div className="flex flex-col gap-4 p-5">
            {/* Verbatim source material — the serif (§11.6). */}
            <p className="border-accent text-ink text-quote font-serif border-l-2 pl-4 leading-snug">
              {item.title}
            </p>

            <dl className="flex flex-col gap-2 text-[12.5px]">
              <Row label="Authors">
                {item.authors.length > 0 ? item.authors.join(", ") : "Not recorded"}
              </Row>
              <Row label="Year">
                {item.year === null ? "Not recorded" : String(item.year)}
              </Row>
              <Row label="Country">{item.country ?? "Not recorded"}</Row>
              <Row label="Citation key">
                <span className="font-mono text-[11.5px]">{item.citationKey}</span>
              </Row>
            </dl>

            <ClassificationBadge classification={item.classification} />

            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[12.5px] font-medium"
              >
                Open the source
              </a>
            ) : (
              <p className="text-ink-3 text-[12.5px]">
                No source link is recorded for this item.
              </p>
            )}

            <p className="text-ink-3 text-[12.5px]">
              This item is part of the evidence set this brief was generated
              from. It has not been re-checked by a person here.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-3 w-24 shrink-0">{label}</dt>
      <dd className="text-ink-2 min-w-0">{children}</dd>
    </div>
  );
}
