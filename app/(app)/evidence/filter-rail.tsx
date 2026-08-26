"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EVIDENCE_SEARCH_MAX_QUERY_CHARS } from "@/lib/evidence/search-limits";
import { cn } from "@/lib/utils";

import {
  EVIDENCE_SEARCH_OPTIONS_ANY,
  EVIDENCE_SOURCE_TYPE_OPTIONS,
  IMPACT_AREA_OPTIONS,
} from "./labels";
import {
  EVIDENCE_SEARCH_PARAMS,
  countActiveFilters,
  hasActiveSearch,
  type EvidenceSearchInput,
} from "./search-schema";

/**
 * Search and filter controls for the Evidence Library.
 *
 * The state lives in the URL and the page re-reads it on the server. Nothing
 * here mutates, so nothing here is a Server Action — a filter change is a
 * navigation (AGENTS.md §5.3).
 *
 * Two renderings of one implementation, because the handoff's Evidence Library
 * grid only has a filter column at `desktop`:
 *   - `EvidenceFilterRail` — the 216px inline rail, `desktop` and above.
 *   - `EvidenceFilterBar` — below `desktop`: the search box stays in the page
 *     (a search you have to open a drawer to reach is a search nobody runs) and
 *     the four filters move into a `Sheet`, per the handoff's responsive table.
 *
 * Only one of the two is visible at any width, so the duplicated search input is
 * never two focusable copies of the same control.
 */

export type FacetOptions = {
  countries: string[];
  years: number[];
};

type ControlsProps = {
  search: EvidenceSearchInput;
  facets: FacetOptions;
};

/** The inline rail. Hidden below `desktop`, where `EvidenceFilterBar` takes over. */
export function EvidenceFilterRail({ search, facets }: ControlsProps) {
  const { navigate, isPending } = useSearchNavigation();
  const activeFilters = countActiveFilters(search);

  return (
    <aside
      aria-label="Search and filter evidence"
      className={cn(
        "hidden desktop:flex desktop:flex-col desktop:gap-5",
        // The pending read is visible without an indeterminate spinner: the rail
        // dims and stops accepting input for the length of the transition.
        isPending && "pointer-events-none opacity-60 transition-opacity duration-150",
      )}
    >
      <SearchForm idPrefix="rail" search={search} navigate={navigate} />
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-ink-3 text-[11.5px] font-semibold tracking-[0.06em] uppercase">
            Filters
          </span>
          {activeFilters > 0 ? (
            <span className="bg-surface-tint border-surface-tint-border text-primary-ink rounded-full border px-2 py-0.5 font-mono text-[11px] leading-tight font-medium">
              {activeFilters} active
            </span>
          ) : null}
        </div>
        <FilterFields
          idPrefix="rail"
          search={search}
          facets={facets}
          navigate={navigate}
        />
      </div>
      <ClearFilters search={search} navigate={navigate} />
    </aside>
  );
}

/** The compact bar. Visible below `desktop`; the filters live behind a `Sheet`. */
export function EvidenceFilterBar({ search, facets }: ControlsProps) {
  const { navigate, isPending } = useSearchNavigation();
  const [open, setOpen] = useState(false);

  const activeFilters = countActiveFilters(search);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 desktop:hidden tablet:flex-row tablet:items-end",
        isPending && "pointer-events-none opacity-60 transition-opacity duration-150",
      )}
    >
      <div className="min-w-0 flex-1">
        <SearchForm idPrefix="bar" search={search} navigate={navigate} />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 gap-1.5"
            />
          }
        >
          Filters
          {activeFilters > 0 ? (
            <span className="bg-surface-tint border-surface-tint-border text-primary-ink ml-1 rounded-full border px-1.5 font-mono text-[11px] leading-[18px]">
              {activeFilters}
            </span>
          ) : null}
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(22rem,90vw)] gap-0">
          <SheetHeader className="border-line border-b pb-3">
            <div className="flex items-center justify-between pr-6">
              <SheetTitle>Filter evidence</SheetTitle>
              {activeFilters > 0 ? (
                <span className="bg-surface-tint border-surface-tint-border text-primary-ink rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium">
                  {activeFilters} active
                </span>
              ) : null}
            </div>
            <SheetDescription className="text-[13px]">
              Filters narrow the eligible library. Untagged evidence stays in the
              classification queue either way.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 overflow-y-auto p-4">
            <FilterFields
              idPrefix="sheet"
              search={search}
              facets={facets}
              navigate={navigate}
            />
            <ClearFilters
              search={search}
              navigate={navigate}
              onCleared={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

type Navigate = (mutate: (params: URLSearchParams) => void) => void;

/**
 * Push the next URL, keeping every parameter this control does not own.
 *
 * `useTransition` keeps the current results on screen while the server renders
 * the next ones — the alternative is a blank panel between two identical
 * layouts, which reads as breakage rather than progress.
 */
function useSearchNavigation(): { navigate: Navigate; isPending: boolean } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const navigate: Navigate = (mutate) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);

    const queryString = params.toString();

    startTransition(() => {
      router.push(queryString.length > 0 ? `${pathname}?${queryString}` : pathname);
    });
  };

  return { navigate, isPending };
}

/**
 * The search box is a real form with a real submit.
 *
 * SUBMIT ONLY, NEVER PER KEYSTROKE. Each submitted query costs one Gemini
 * embedding request against a 15 RPM / ~1,500-per-day budget (`lib/ai/config.ts`),
 * so typing costs nothing and the request is paced by a person pressing Enter.
 */
function SearchForm({
  idPrefix,
  search,
  navigate,
}: {
  idPrefix: string;
  search: EvidenceSearchInput;
  navigate: Navigate;
}) {
  const [prevQuery, setPrevQuery] = useState(search.query);
  const [value, setValue] = useState(search.query ?? "");

  // Sync state if search query changes externally (e.g. "Clear filters")
  if (search.query !== prevQuery) {
    setPrevQuery(search.query);
    setValue(search.query ?? "");
  }

  const id = `${idPrefix}-evidence-query`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next = value.trim();

    navigate((params) => {
      if (next.length > 0) {
        params.set(EVIDENCE_SEARCH_PARAMS.query, next);
      } else {
        params.delete(EVIDENCE_SEARCH_PARAMS.query);
      }
    });
  };

  const handleClear = () => {
    setValue("");
    if (search.query) {
      navigate((params) => {
        params.delete(EVIDENCE_SEARCH_PARAMS.query);
      });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5" role="search">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-ink-2 text-[12px] font-semibold">
          Search the library
        </Label>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-ink-3 hover:text-ink text-[11px] font-medium transition-colors"
          >
            Clear query
          </button>
        ) : null}
      </div>
      {idPrefix === "rail" ? (
        <div className="flex flex-col gap-2">
          <Input
            id={id}
            name={EVIDENCE_SEARCH_PARAMS.query}
            type="search"
            value={value}
            maxLength={EVIDENCE_SEARCH_MAX_QUERY_CHARS}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Words, or a description"
            className="h-9 w-full text-[13px]"
          />
          <Button type="submit" className="h-8.5 w-full text-[13px] font-medium">
            Search
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            name={EVIDENCE_SEARCH_PARAMS.query}
            type="search"
            value={value}
            maxLength={EVIDENCE_SEARCH_MAX_QUERY_CHARS}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Words, or a description"
            className="h-9 min-w-0 flex-1 text-[13px]"
          />
          <Button type="submit" className="h-9 shrink-0">
            Search
          </Button>
        </div>
      )}
      <p className="text-ink-3 text-[12px]">
        Matches wording, and meaning where the evidence has been embedded.
      </p>
    </form>
  );
}

function FilterFields({
  idPrefix,
  search,
  facets,
  navigate,
}: ControlsProps & { idPrefix: string; navigate: Navigate }) {
  const set = (key: string, next: string) => {
    navigate((params) => {
      if (next.length > 0) {
        params.set(key, next);
      } else {
        params.delete(key);
      }
    });
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="sr-only">Filters</legend>

      <FilterField
        id={`${idPrefix}-evidence-type`}
        label="Source type"
        value={search.sourceType ?? ""}
        onChange={(next) => set(EVIDENCE_SEARCH_PARAMS.sourceType, next)}
      >
        {EVIDENCE_SOURCE_TYPE_OPTIONS.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </FilterField>

      <FilterField
        id={`${idPrefix}-evidence-impact`}
        label="Impact area"
        value={search.impactArea ?? ""}
        onChange={(next) => set(EVIDENCE_SEARCH_PARAMS.impactArea, next)}
      >
        {IMPACT_AREA_OPTIONS.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </FilterField>

      <FilterField
        id={`${idPrefix}-evidence-country`}
        label="Country"
        value={search.country ?? ""}
        onChange={(next) => set(EVIDENCE_SEARCH_PARAMS.country, next)}
        emptyHint="No country recorded on any eligible item yet."
        isEmpty={facets.countries.length === 0}
      >
        {facets.countries.map((country) => (
          <NativeSelectOption key={country} value={country}>
            {country}
          </NativeSelectOption>
        ))}
      </FilterField>

      <FilterField
        id={`${idPrefix}-evidence-year`}
        label="Year"
        value={search.year === null ? "" : String(search.year)}
        onChange={(next) => set(EVIDENCE_SEARCH_PARAMS.year, next)}
        emptyHint="No year recorded on any eligible item yet."
        isEmpty={facets.years.length === 0}
      >
        {facets.years.map((year) => (
          <NativeSelectOption key={year} value={String(year)}>
            {year}
          </NativeSelectOption>
        ))}
      </FilterField>
    </fieldset>
  );
}

function FilterField({
  id,
  label,
  value,
  onChange,
  children,
  emptyHint,
  isEmpty = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
  emptyHint?: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-ink-2 text-[12px] font-semibold">
        {label}
      </Label>
      <NativeSelect
        id={id}
        value={value}
        disabled={isEmpty}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full [&>select]:h-9 [&>select]:text-[13px]"
      >
        <NativeSelectOption value="">
          {EVIDENCE_SEARCH_OPTIONS_ANY}
        </NativeSelectOption>
        {children}
      </NativeSelect>
      {isEmpty && emptyHint ? (
        <p className="text-ink-3 text-[12px]">{emptyHint}</p>
      ) : null}
    </div>
  );
}

/** Rendered only when something is set — a permanently visible "Clear" is noise. */
function ClearFilters({
  search,
  navigate,
  onCleared,
}: {
  search: EvidenceSearchInput;
  navigate: Navigate;
  onCleared?: () => void;
}) {
  if (!hasActiveSearch(search)) return null;

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 w-full"
      onClick={() => {
        navigate((params) => {
          for (const key of Object.values(EVIDENCE_SEARCH_PARAMS)) {
            params.delete(key);
          }
        });
        onCleared?.();
      }}
    >
      Clear filters
    </Button>
  );
}
