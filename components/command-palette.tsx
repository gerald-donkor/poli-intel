"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  FileTextIcon,
  LandPlotIcon,
  LibraryIcon,
  ListChecksIcon,
  MapPinnedIcon,
  SearchIcon,
  SquarePenIcon,
  UsersIcon,
} from "lucide-react";

import { EVIDENCE_SEARCH_PARAMS } from "@/app/(app)/evidence/search-schema";
import {
  AUDIENCE_TARGET_LABELS,
  GEOGRAPHY_LABELS,
  IMPACT_AREA_LABELS as SIGNAL_IMPACT_AREA_LABELS,
  MATCH_OUTCOME_LABELS,
  RELEVANCE_LABELS,
  URGENCY_LABELS,
} from "@/app/(app)/signals/labels";
import {
  EVIDENCE_SOURCE_TYPE_LABELS,
  IMPACT_AREA_LABELS as EVIDENCE_IMPACT_AREA_LABELS,
} from "@/app/(app)/evidence/labels";
import { Kbd } from "@/components/ui/kbd";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type {
  CommandDestination,
  CommandEvidence,
  CommandIndex,
  CommandQuickStart,
  CommandSignal,
} from "@/lib/command/types";
import { cn } from "@/lib/utils";

type Scored<T> = T & {
  score: number;
  href: string;
  searchable: string;
};

type AppIcon =
  | typeof FileTextIcon
  | typeof LandPlotIcon
  | typeof LibraryIcon
  | typeof ListChecksIcon
  | typeof MapPinnedIcon
  | typeof SquarePenIcon
  | typeof UsersIcon;

const DESTINATION_ICONS: Record<string, AppIcon> = {
  signals: ListChecksIcon,
  briefs: FileTextIcon,
  tracker: MapPinnedIcon,
  stakeholders: UsersIcon,
  evidence: LibraryIcon,
  impact: LandPlotIcon,
};

const QUICK_START_ICONS: Record<string, AppIcon> = {
  "new-brief": SquarePenIcon,
  "add-evidence": LibraryIcon,
  "classification-queue": ListChecksIcon,
  "stakeholder-record": UsersIcon,
  "impact-log": LandPlotIcon,
  "field-submission": SquarePenIcon,
};

const EMPTY_SCORE = 100;

export function CommandPalette({
  index,
  triggerClassName,
}: {
  index: CommandIndex;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;

      if (open) {
        setOpen(false);
        return;
      }

      event.preventDefault();
      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const normalizedQuery = normalize(query);
  const hasQuery = normalizedQuery.length > 0;

  const destinations = useMemo(
    () =>
      scoreRows(
        index.destinations,
        normalizedQuery,
        searchableDestination,
        (item) => [item.label],
      )
        .filter((row) => !hasQuery || row.score > 0)
        .slice(0, hasQuery ? 5 : index.destinations.length),
    [hasQuery, index.destinations, normalizedQuery],
  );

  const quickStarts = useMemo(
    () =>
      scoreRows(
        index.quickStarts,
        normalizedQuery,
        searchableQuickStart,
        (item) => [item.label],
      ).filter((row) => !hasQuery || row.score > 0),
    [hasQuery, index.quickStarts, normalizedQuery],
  );

  const signals = useMemo(
    () =>
      scoreRows(index.signals, normalizedQuery, searchableSignal, (item) => [
        item.title,
      ])
        .filter((row) => hasQuery && row.score > 0)
        .slice(0, 6),
    [hasQuery, index.signals, normalizedQuery],
  );

  const evidence = useMemo(
    () =>
      scoreRows(index.evidence, normalizedQuery, searchableEvidence, (item) => [
        item.title,
        item.citationKey,
      ])
        .filter((row) => hasQuery && row.score > 0)
        .slice(0, 6),
    [hasQuery, index.evidence, normalizedQuery],
  );

  const goTo = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  const evidenceSearchHref = hasQuery
    ? `/evidence?${EVIDENCE_SEARCH_PARAMS.query}=${encodeURIComponent(query.trim())}`
    : null;

  return (
    <>
      {/* Two responsive forms of one control. Below `laptop` there is no ⌘K to
          fall back on — a touch device has no meta key — so the trigger becomes
          an icon-only button rather than disappearing, and drops the `Kbd`,
          which would be a lie on that device. Only one is ever visible, so the
          dialog never has two focusable openers in the tab order. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search signals and evidence"
        className="bg-paper border-line rounded-card text-ink-3 hover:text-ink flex size-8 items-center justify-center border transition-colors duration-150 laptop:hidden"
      >
        <SearchIcon aria-hidden="true" className="size-4" />
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "bg-paper border-line rounded-card text-ink-3 laptop:flex hidden h-8 w-[240px] items-center justify-between gap-2 border px-2.5 text-left text-[13px] transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
          triggerClassName,
        )}
      >
        <span className="truncate whitespace-nowrap">
          Search signals &amp; evidence
        </span>
        <Kbd className="bg-stone text-ink-3 shrink-0 font-mono">⌘K</Kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command palette"
        description="Search EviBrief destinations, recent signals, and eligible evidence metadata."
        className="bg-card border-line max-w-[min(640px,calc(100vw-24px))] rounded-modal border shadow-overlay"
      >
        <Command shouldFilter={false} className="bg-card text-ink rounded-modal">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search signals and eligible evidence"
            className="text-[14px]"
          />
          <CommandList className="max-h-[min(520px,calc(100vh-160px))]">
            <CommandEmpty className="text-ink-3 py-8 text-[13px]">
              No matching command in the loaded index.
            </CommandEmpty>

            {destinations.length > 0 ? (
              <CommandGroup heading="Go to">
                {destinations.map((item) => (
                  <DestinationItem
                    key={item.id}
                    item={item}
                    onSelect={() => goTo(item.href)}
                  />
                ))}
              </CommandGroup>
            ) : null}

            {quickStarts.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Start">
                  {quickStarts.map((item) => (
                    <QuickStartItem
                      key={item.id}
                      item={item}
                      onSelect={() => goTo(item.href)}
                    />
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {signals.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Signals">
                  {signals.map((item) => (
                    <SignalItem
                      key={item.id}
                      item={item}
                      onSelect={() => goTo(item.href)}
                    />
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {evidence.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Evidence">
                  {evidence.map((item) => (
                    <EvidenceItem
                      key={item.id}
                      item={item}
                      onSelect={() => goTo(item.href)}
                    />
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {evidenceSearchHref ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Search">
                  <CommandItem
                    value={`search-evidence-${query}`}
                    onSelect={() => goTo(evidenceSearchHref)}
                    className="min-h-12"
                  >
                    <SearchIcon aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        Search eligible evidence for &quot;{query.trim()}&quot;
                      </span>
                      <span className="text-ink-3 block truncate text-[12.5px]">
                        Opens the Evidence Library search page
                      </span>
                    </span>
                    <CommandShortcut className="font-mono tracking-normal">
                      Enter
                    </CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function DestinationItem({
  item,
  onSelect,
}: {
  item: Scored<CommandDestination>;
  onSelect: () => void;
}) {
  const Icon = DESTINATION_ICONS[item.id] ?? ArrowRightIcon;

  return (
    <CommandItem value={`destination-${item.id}`} onSelect={onSelect}>
      <Icon aria-hidden="true" />
      <RowText title={item.label} description={item.description} />
      <CommandShortcut className="font-mono tracking-normal">
        {item.shortcut}
      </CommandShortcut>
    </CommandItem>
  );
}

function QuickStartItem({
  item,
  onSelect,
}: {
  item: Scored<CommandQuickStart>;
  onSelect: () => void;
}) {
  const Icon = QUICK_START_ICONS[item.id] ?? ArrowRightIcon;

  return (
    <CommandItem value={`quick-${item.id}`} onSelect={onSelect}>
      <Icon aria-hidden="true" />
      <RowText title={item.label} description={item.description} />
      <MatchScore score={item.score} />
    </CommandItem>
  );
}

function SignalItem({
  item,
  onSelect,
}: {
  item: Scored<CommandSignal>;
  onSelect: () => void;
}) {
  const metadata = [
    item.sourceName,
    URGENCY_LABELS[item.urgency],
    RELEVANCE_LABELS[item.relevance],
    SIGNAL_IMPACT_AREA_LABELS[item.impactArea],
    GEOGRAPHY_LABELS[item.geography],
    item.audienceTarget ? AUDIENCE_TARGET_LABELS[item.audienceTarget] : null,
    item.latestMatchOutcome
      ? MATCH_OUTCOME_LABELS[item.latestMatchOutcome]
      : "No match run",
    `${item.matchCount} ${item.matchCount === 1 ? "match" : "matches"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <CommandItem value={`signal-${item.id}`} onSelect={onSelect}>
      <ListChecksIcon aria-hidden="true" />
      <RowText title={item.title} description={metadata} />
      <MatchScore score={item.score} />
    </CommandItem>
  );
}

function EvidenceItem({
  item,
  onSelect,
}: {
  item: Scored<CommandEvidence>;
  onSelect: () => void;
}) {
  const metadata = [
    item.citationKey,
    item.year,
    item.country,
    item.impactArea ? EVIDENCE_IMPACT_AREA_LABELS[item.impactArea] : null,
    EVIDENCE_SOURCE_TYPE_LABELS[item.sourceType],
    `${item.embeddedChunkCount} embedded ${item.embeddedChunkCount === 1 ? "chunk" : "chunks"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <CommandItem value={`evidence-${item.id}`} onSelect={onSelect}>
      <LibraryIcon aria-hidden="true" />
      <RowText title={item.title} description={metadata} />
      <MatchScore score={item.score} />
    </CommandItem>
  );
}

function RowText({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13.5px] font-medium">{title}</span>
      <span className="text-ink-3 block truncate text-[12.5px]">
        {description}
      </span>
    </span>
  );
}

function MatchScore({ score }: { score: number }) {
  if (score === EMPTY_SCORE) return null;

  return (
    <CommandShortcut className="font-mono tracking-normal">
      {score}
    </CommandShortcut>
  );
}

function scoreRows<T>(
  rows: readonly T[],
  query: string,
  toSearchable: (row: T) => string,
  toPrimaryFields: (row: T) => string[] = () => [],
): Scored<T>[] {
  return rows
    .map((row, index) => {
      const searchable = normalize(toSearchable(row));
      const primaryScore = Math.max(
        0,
        ...toPrimaryFields(row).map((field) =>
          scorePrimaryField(normalize(field), query),
        ),
      );
      const score =
        query.length === 0
          ? EMPTY_SCORE - index
          : Math.max(primaryScore, scoreMatch(searchable, query));

      return {
        ...row,
        href: rowHref(row),
        searchable,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function rowHref<T>(row: T): string {
  if (typeof row === "object" && row !== null && "href" in row) {
    const href = row.href;
    return typeof href === "string" ? href : "";
  }

  if (isSignal(row)) return `/signals/${row.id}`;

  if (isEvidence(row)) {
    return `/evidence?${EVIDENCE_SEARCH_PARAMS.query}=${encodeURIComponent(row.citationKey)}`;
  }

  return "";
}

function isSignal(row: unknown): row is CommandSignal {
  return (
    typeof row === "object" &&
    row !== null &&
    "kind" in row &&
    row.kind === "signal" &&
    "id" in row &&
    typeof row.id === "string"
  );
}

function isEvidence(row: unknown): row is CommandEvidence {
  return (
    typeof row === "object" &&
    row !== null &&
    "kind" in row &&
    row.kind === "evidence" &&
    "citationKey" in row &&
    typeof row.citationKey === "string"
  );
}

function scoreMatch(searchable: string, query: string): number {
  if (query.length === 0) return EMPTY_SCORE;
  if (searchable === query) return 100;
  if (searchable.startsWith(query)) return 88;
  if (searchable.includes(` ${query}`)) return 76;
  if (searchable.includes(query)) return 64;

  const terms = query.split(/\s+/).filter(Boolean);
  const matchedTerms = terms.filter((term) => searchable.includes(term));

  if (matchedTerms.length === 0) return 0;

  return 30 + Math.round((matchedTerms.length / terms.length) * 20);
}

function scorePrimaryField(field: string, query: string): number {
  if (query.length === 0) return EMPTY_SCORE;
  if (field === query) return 100;
  if (field.startsWith(query)) return 88;
  if (field.includes(query)) return 72;

  return 0;
}

function searchableDestination(item: CommandDestination): string {
  return `${item.label} ${item.description}`;
}

function searchableQuickStart(item: CommandQuickStart): string {
  return `${item.label} ${item.description}`;
}

function searchableSignal(item: CommandSignal): string {
  return [
    item.title,
    item.sourceName,
    URGENCY_LABELS[item.urgency],
    RELEVANCE_LABELS[item.relevance],
    SIGNAL_IMPACT_AREA_LABELS[item.impactArea],
    GEOGRAPHY_LABELS[item.geography],
    item.audienceTarget ? AUDIENCE_TARGET_LABELS[item.audienceTarget] : "",
    item.latestMatchOutcome ? MATCH_OUTCOME_LABELS[item.latestMatchOutcome] : "",
  ].join(" ");
}

function searchableEvidence(item: CommandEvidence): string {
  return [
    item.title,
    item.citationKey,
    item.year?.toString() ?? "",
    item.country ?? "",
    item.impactArea ? EVIDENCE_IMPACT_AREA_LABELS[item.impactArea] : "",
    EVIDENCE_SOURCE_TYPE_LABELS[item.sourceType],
  ].join(" ");
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().trim().replace(/\s+/g, " ");
}
