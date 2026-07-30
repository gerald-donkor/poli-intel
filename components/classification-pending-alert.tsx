import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * The classification-pending queue count (AGENTS.md §7.5).
 *
 * A governance surface: it renders at every screen size, above the fold, and is
 * never what gets hidden when space is tight (design-system.md, responsive
 * rules). It renders at zero too — "nothing is waiting" is information, and a
 * banner that only appears when there is a backlog trains people not to look.
 *
 * The glyph is a SQUARE outline, distinct from the hallucination guard's circle.
 * The banner itself never animates idly.
 */
export function ClassificationPendingAlert({
  pendingCount,
  showQueueLink = true,
}: {
  pendingCount: number;
  showQueueLink?: boolean;
}) {
  const waiting = pendingCount > 0;

  return (
    <Alert variant={waiting ? "pending" : "default"} className="rounded-card px-3.5 py-3">
      <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
        <span
          aria-hidden="true"
          className={`size-3.5 shrink-0 rounded-[2px] border-2 ${
            waiting ? "border-immediate" : "border-sage"
          }`}
        />
        {waiting
          ? `${pendingCount} ${pendingCount === 1 ? "item is" : "items are"} awaiting classification`
          : "Nothing is awaiting classification"}
      </AlertTitle>
      <AlertDescription
        className={`text-[13px] ${waiting ? "text-immediate-ink/90" : "text-ink-3"}`}
      >
        <p>
          {waiting
            ? "Newly ingested evidence is held out of search and out of the AI pipeline until a Research Officer tags it."
            : "Every ingested item has been tagged. New uploads arrive here first."}
          {showQueueLink ? (
            <>
              {" "}
              <Link href="/evidence/queue" className="font-medium">
                Open the classification queue
              </Link>
              .
            </>
          ) : null}
        </p>
      </AlertDescription>
    </Alert>
  );
}
