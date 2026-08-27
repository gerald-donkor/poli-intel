"use client";

import type { DocumentOutlineEntry } from "@/lib/briefs/document";
import { cn } from "@/lib/utils";

/**
 * The document's own headings, as a way back to a section.
 *
 * Derived from the document, never from a stored table of contents: a heading
 * the officer just retyped is the heading this lists. It is the third column at
 * `desktop`, and a `Sheet` drawer below it — a nav that reflows to a drawer is
 * still reachable, whereas a nav that is dropped is not.
 *
 * Not a form of navigation in the router sense: it scrolls within the document
 * the officer is already editing, so it is a list of buttons, not links.
 */
export function SectionsNav({
  outline,
  onSelect,
  className,
}: {
  outline: DocumentOutlineEntry[];
  onSelect: (entry: DocumentOutlineEntry) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Sections of this brief"
      className={cn("flex min-w-0 flex-col gap-2", className)}
    >
      <h2 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
        Sections
      </h2>

      {outline.length === 0 ? (
        <p className="text-ink-3 text-[12.5px]">
          This document has no headings yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {outline.map((entry) => (
            <li key={entry.index}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className={cn(
                  "hover:bg-surface-tint hover:text-primary-ink w-full cursor-pointer rounded-[3px] px-2 py-1.5 text-left text-[12.5px] leading-snug transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
                  entry.level === 1 && "text-ink font-semibold",
                  entry.level === 2 &&
                    "text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase",
                  entry.level === 3 && "text-ink-2 pl-3",
                )}
              >
                {entry.text || "Untitled section"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
