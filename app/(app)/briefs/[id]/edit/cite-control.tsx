"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { BriefForEdit } from "@/lib/db/briefs";

/**
 * Inserting a citation chip.
 *
 * THE LIST IS THE BRIEF'S RECORDED EVIDENCE SET AND NOTHING ELSE. No free-text
 * id entry, no library-wide picker. That set already passed the classification
 * gate at generation, and it is the only source this control has, so the editor
 * cannot introduce an ungated item into a brief (§7, §15.5).
 *
 * The chip is inserted at the cursor — after a selection, at its end — so an
 * officer selects the sentence they are sourcing and cites it without leaving
 * the keyboard.
 */
export function CiteControl({
  evidence,
  onInsert,
  disabled,
}: {
  evidence: BriefForEdit["evidence"];
  onInsert: (item: BriefForEdit["evidence"][number]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled}>
            Cite evidence
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Find an item in this brief’s set" />
          <CommandList>
            <CommandEmpty>
              Nothing in this brief’s evidence set matches.
            </CommandEmpty>
            <CommandGroup>
              {evidence.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.citationKey} ${item.title}`}
                  onSelect={() => {
                    onInsert(item);
                    setOpen(false);
                  }}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="font-mono text-[11.5px]">
                    {item.citationKey}
                  </span>
                  {/* Verbatim source material — the serif (§11.6). */}
                  <span className="text-ink font-serif text-[13px] leading-snug">
                    {item.title}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
