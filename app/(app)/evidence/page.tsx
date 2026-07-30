import Link from "next/link";

import { ClassificationPendingAlert } from "@/components/classification-pending-alert";
import { PageHeader } from "@/components/page-header";
// A control that navigates is a link, styled as a button — not Base UI's
// `Button`, which claims button semantics and would announce these as buttons
// while suppressing Cmd-click and "open in new tab" (§11.13).
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  EVIDENCE_BROWSE_MAX_ITEMS,
  EVIDENCE_SEARCH_MAX_ITEMS,
} from "@/lib/ai/config";
import { canIngestEvidence } from "@/lib/auth/authorize";
import { requireStaffUser } from "@/lib/auth/session";
import {
  countPendingClassification,
  listEvidenceFacets,
} from "@/lib/db/evidence";
import {
  searchEvidence,
  type EvidenceSearchTruncation,
  type SemanticStatus,
} from "@/lib/evidence/search";

import { EvidenceTable } from "./evidence-table";
import { EvidenceFilterBar, EvidenceFilterRail } from "./filter-rail";
import {
  countActiveFilters,
  hasActiveSearch,
  parseEvidenceSearch,
  type EvidenceSearchInput,
} from "./search-schema";

export const metadata = {
  title: "Evidence · EviBrief",
};

export default async function EvidencePage({
  searchParams,
}: {
  // Next 16.2: `searchParams` is a promise and reading it opts the page into
  // dynamic rendering, which is correct — a search result is request state.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The DAL call, not the layout, is the check that matters: layouts do not
  // re-render on navigation (AGENTS.md §10.1, Next's authentication guide).
  const staffUser = await requireStaffUser();

  // A hand-edited URL is a bad request, not a crash: every field falls back to
  // "not set" individually, and unknown parameters are ignored.
  const search = parseEvidenceSearch(await searchParams);

  const [outcome, pendingCount, facets] = await Promise.all([
    searchEvidence(search),
    countPendingClassification(),
    listEvidenceFacets(),
  ]);

  const mayIngest = canIngestEvidence(staffUser.role);
  const searching = hasActiveSearch(search);
  const showMatch = search.query !== null;

  return (
    <>
      <PageHeader
        title="Evidence"
        subtitle="The research corpus. Only evidence tagged as public and published is listed here — everything else is held at the classification queue."
      >
        {/* Presentation only. The action authorises server-side regardless. */}
        {mayIngest ? (
          <Link href="/evidence/new" className={buttonVariants()}>
            Add evidence
          </Link>
        ) : null}
      </PageHeader>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
        {/* Governance surface: above the fold at every width, never hidden. */}
        <ClassificationPendingAlert pendingCount={pendingCount} />

        <SemanticStatusAlert status={outcome.semantic} />

        {/* The handoff's Evidence Library recipe, split across two components:
            the 216px rail here, the table and its 340px detail panel inside
            `EvidenceTable`. Below `desktop` the rail becomes a Sheet and the
            grid collapses to one column. */}
        <div className="grid min-w-0 grid-cols-1 gap-4 desktop:grid-cols-[216px_minmax(0,1fr)] desktop:gap-6">
          <EvidenceFilterRail search={search} facets={facets} />

          <div className="flex min-w-0 flex-col gap-3">
            <EvidenceFilterBar search={search} facets={facets} />

            {outcome.results.length > 0 ? (
              <>
                <ResultSummary
                  count={outcome.results.length}
                  truncated={outcome.truncated}
                  showMatch={showMatch}
                />
                <EvidenceTable
                  results={outcome.results}
                  showMatch={showMatch}
                />
              </>
            ) : searching ? (
              <NoMatchesState search={search} pendingCount={pendingCount} />
            ) : (
              <EmptyEvidenceState
                pendingCount={pendingCount}
                mayIngest={mayIngest}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The semantic half's state, when it could not run.
 *
 * Slate, on the watch ramp, never `destructive` and never red (AGENTS.md §11.4)
 * — a rate limit is a normal operating condition on the free tier, not a fault.
 * Keyword results are still on the page underneath, which is what the copy says.
 */
function SemanticStatusAlert({ status }: { status: SemanticStatus }) {
  if (status.status !== "unavailable") return null;

  const body =
    status.reason === "rate_limited"
      ? `The daily allowance for meaning-based search is spent for the moment. Try again in about ${formatRetry(status.retryAfterMs)}.`
      : status.reason === "not_configured"
        ? "Meaning-based search is not configured on this deployment."
        : "Meaning-based search did not respond this time.";

  return (
    <Alert variant="guard" className="rounded-card px-3.5 py-3">
      <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
        {/* Circle: the review-and-status glyph, distinct from the square the
            classification hold uses (design-system.md, iconography). */}
        <span
          aria-hidden="true"
          className="border-watch size-3.5 shrink-0 rounded-full border-2"
        />
        Showing wording matches only
      </AlertTitle>
      <AlertDescription className="text-watch-ink/90 text-[13px]">
        <p>{body} Results below still match the words you typed.</p>
      </AlertDescription>
    </Alert>
  );
}

function formatRetry(retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / 60_000);

  if (minutes <= 1) return "a minute";

  return `${minutes} minutes`;
}

/**
 * What is on screen, and which ceiling cut it short if one did. Stated plainly
 * — a truncated list presented as the whole answer is the quiet kind of wrong
 * this product cannot afford.
 */
function ResultSummary({
  count,
  truncated,
  showMatch,
}: {
  count: number;
  truncated: EvidenceSearchTruncation;
  showMatch: boolean;
}) {
  const caps: string[] = [];

  if (truncated.semantic) {
    caps.push(`the ${EVIDENCE_SEARCH_MAX_ITEMS} closest matches`);
  }

  if (truncated.listing) {
    caps.push(`the first ${EVIDENCE_BROWSE_MAX_ITEMS} by wording`);
  }

  return (
    <p aria-live="polite" className="text-ink-3 text-[12.5px]">
      <span className="text-ink font-mono font-medium tabular-nums">{count}</span>{" "}
      {count === 1 ? "item" : "items"}
      {showMatch ? " matched" : " listed"}
      {caps.length > 0
        ? ` — showing ${caps.join(" and ")}. Narrow the filters to see the rest.`
        : "."}
    </p>
  );
}

/**
 * Nothing matched — with a next step chosen from what is actually true, not one
 * generic sentence (AGENTS.md §17.6). The evidence may exist and simply be
 * untagged, which is why the queue is offered when it is not empty.
 */
function NoMatchesState({
  search,
  pendingCount,
}: {
  search: EvidenceSearchInput;
  pendingCount: number;
}) {
  const filterCount = countActiveFilters(search);
  const hasQuery = search.query !== null;

  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      <span
        aria-hidden="true"
        className="mx-4 mt-4 mb-5 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h2 className="text-ink text-[15px] font-semibold">
        Nothing in the eligible library matches
      </h2>
      <ul className="text-ink-3 flex max-w-[62ch] list-disc flex-col gap-1.5 pl-5 text-[13px]">
        {filterCount > 0 ? (
          <li>
            {filterCount === 1 ? "One filter is" : `${filterCount} filters are`}{" "}
            narrowing the library. Clearing them widens the search.
          </li>
        ) : null}
        {hasQuery ? (
          <li>
            Try fewer or broader words. Meaning-based search only reaches
            evidence whose passages have been embedded.
          </li>
        ) : null}
        {pendingCount > 0 ? (
          <li>
            {pendingCount} {pendingCount === 1 ? "item is" : "items are"} still
            awaiting classification. What you are looking for may be held there.
          </li>
        ) : null}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link href="/evidence" className={buttonVariants({ variant: "outline" })}>
          Clear filters
        </Link>
        {pendingCount > 0 ? (
          <Link
            href="/evidence/queue"
            className={buttonVariants({ variant: "outline" })}
          >
            Open the classification queue
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The empty state carries a real next step rather than a blank panel
 * (AGENTS.md §17.6). Which step depends on whether the library is empty or
 * merely un-triaged — those are different problems.
 */
function EmptyEvidenceState({
  pendingCount,
  mayIngest,
}: {
  pendingCount: number;
  mayIngest: boolean;
}) {
  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      {/* Concentric contour rings — an abstract structural mark, no icon asset
          and no leaf (AGENTS.md §11.7). */}
      <span
        aria-hidden="true"
        className="mx-4 mt-4 mb-5 size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
      />
      <h2 className="text-ink text-[15px] font-semibold">
        No evidence is eligible yet
      </h2>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        {pendingCount > 0
          ? "Every ingested item is still waiting for a classification. Tag an item as public and published in the queue and it becomes searchable here."
          : "Nothing has been ingested into the knowledge base yet. Upload a PDF or a plain-text document to get started."}
      </p>
      {pendingCount > 0 ? (
        <Link
          href="/evidence/queue"
          className={buttonVariants({ variant: "outline" })}
        >
          Open the classification queue
        </Link>
      ) : mayIngest ? (
        <Link href="/evidence/new" className={buttonVariants()}>
          Add evidence
        </Link>
      ) : null}
    </div>
  );
}
