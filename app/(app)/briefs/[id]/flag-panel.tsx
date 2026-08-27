"use client";

import { GuardFlagIcon } from "@/components/guard-flag-icon";
import type { BriefDetail, BriefFlag } from "@/lib/db/briefs";
import { FlagStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

import {
  FLAG_REASON_DETAIL,
  FLAG_REASON_LABELS,
  FLAG_STATUS_LABELS,
  formatDecisionAt,
} from "../labels";
import { FlagResolution } from "./flag-resolution";

/**
 * The hallucination-guard panel.
 *
 * A FLAG IS A REVIEW PROMPT, NOT AN ERROR (AGENTS.md §9.7). The visual contract,
 * exactly:
 *
 *   - Slate, on the watch ramp: `bg-watch-surface border-watch-border
 *     text-watch-ink`. Never `destructive`, never red, anywhere in this feature
 *     — including the resolution controls and every validation message they can
 *     produce.
 *   - A ROUND 16px icon — the circle means "review flag", the square means
 *     "classification-pending governance hold", and the shapes are how the two
 *     are told apart by a reader who cannot rely on colour (§11.7). A closed
 *     flag keeps the circle, hollow and at lower emphasis.
 *   - `animate-flag-pulse`: 900ms, ONCE, settling to a steady 2px underline. No
 *     loop, no blink, no colour change during the pulse.
 *   - `prefers-reduced-motion` gets the settled state instantly, via the global
 *     rule in `globals.css`. This is CSS animation, not JS, so that rule is
 *     sufficient.
 *   - Never an error toast.
 *
 * CLEARING ONE FLAG MUST NOT RE-PULSE THE REMAINING ONES. The animated element
 * is the open section itself, and it stays mounted across a resolution — React
 * reconciles the same node, and a CSS animation does not restart on re-render.
 * The list inside it is what changes. Do not move `animate-flag-pulse` onto a
 * per-flag element, and do not key the section by the open count: either would
 * re-fire the pulse every time somebody closed something.
 *
 * The claim itself is set in the SERIF: it is verbatim material quoted back out
 * of the draft, not the product's own voice (§11.6).
 *
 * COPY: a flag says the claim is not traceable to the supplied evidence. It
 * never says the claim is incorrect, and nothing here implies the system
 * verified, approved or decided anything (§8.8). Closing one says a PERSON
 * checked it.
 *
 * SHARED WITH THE EDITOR, extended rather than duplicated. `onSelectFlag` and
 * `activeFlagId` are the editor's pairing between a flagged span in the document
 * and its entry here. `canResolve` is the read-only page's: the review surface
 * is the brief's own page, where the evidence and the history are, so the editor
 * passes it not at all and renders exactly as before. Hiding the control is
 * presentation either way — the action authorises for itself (§10.1).
 */
export function FlagPanel({
  flags,
  evidence,
  onSelectFlag,
  activeFlagId,
  canResolve = false,
}: {
  flags: BriefFlag[];
  evidence: BriefDetail["evidence"];
  onSelectFlag?: (flagId: string) => void;
  activeFlagId?: string | null;
  canResolve?: boolean;
}) {
  const open = flags.filter((flag) => flag.status === FlagStatus.open);
  const closed = flags.filter((flag) => flag.status !== FlagStatus.open);
  const titles = new Map(evidence.map((item) => [item.id, item.title]));

  return (
    <div className="flex flex-col gap-4">
      {open.length === 0 ? (
        <section className="bg-card border-line rounded-card flex flex-col gap-2 border p-4">
          <h2 className="text-ink flex items-center gap-2 text-[13px] font-semibold">
            <span
              aria-hidden="true"
              className="border-sage size-3.5 shrink-0 rounded-full border-2"
            />
            {flags.length === 0 ? "No claims flagged" : "No open flags"}
          </h2>
          <p className="text-ink-3 text-[13px]">
            {flags.length === 0
              ? "Every factual claim in this draft was traced to the evidence it was generated from. It still needs a person to read it."
              : `All ${flags.length} ${flags.length === 1 ? "flag has" : "flags have"} been closed by a reviewer. The draft still needs a person to read it.`}
          </p>
        </section>
      ) : (
        <section
          aria-labelledby="guard-flags-heading"
          className="bg-watch-surface border-watch-border text-watch-ink rounded-card animate-flag-pulse flex flex-col gap-3 border p-4"
        >
          <h2
            id="guard-flags-heading"
            className="border-b-watch flex items-center gap-2 border-b-2 pb-2 text-[13px] font-semibold"
          >
            <GuardFlagIcon />
            {open.length} {open.length === 1 ? "claim needs" : "claims need"}{" "}
            checking
          </h2>

          <p className="text-watch-ink/90 text-[13px]">
            These statements were not traced to the evidence passed to the
            generator. They are not necessarily wrong — they need a person to
            check them against a source before this brief goes anywhere.
          </p>

          <ul className="flex flex-col gap-3">
            {open.map((flag) => (
              <li
                key={flag.id}
                id={`flag-${flag.id}`}
                className={cn(
                  "border-watch-border bg-card/60 rounded-card border p-3 transition-colors duration-150",
                  activeFlagId === flag.id && "border-watch bg-watch-surface",
                )}
              >
                <FlagBody flag={flag} titles={titles} />
                {onSelectFlag === undefined ? null : (
                  <button
                    type="button"
                    onClick={() => onSelectFlag(flag.id)}
                    className="text-watch-ink mt-2 inline-flex cursor-pointer items-center text-[12.5px] font-medium underline-offset-2 hover:underline focus-visible:rounded-[2px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    Find this claim in the document
                  </button>
                )}
                {canResolve ? (
                  <FlagResolution flagId={flag.id} mode="clear" />
                ) : null}
              </li>
            ))}
          </ul>

          {canResolve ? null : (
            <p className="text-watch-ink/80 text-[12.5px]">
              A Research Officer or the Programme Director closes a flag, and
              nobody closes one on a brief they drafted. Until every flag is
              closed, this brief cannot be approved.
            </p>
          )}
        </section>
      )}

      {closed.length > 0 ? (
        <ClosedFlags flags={closed} titles={titles} canResolve={canResolve} />
      ) : null}
    </div>
  );
}

/** What the flag says, identical in both lists so the record does not drift. */
function FlagBody({
  flag,
  titles,
}: {
  flag: BriefFlag;
  titles: Map<string, string>;
}) {
  return (
    <>
      <p className="text-watch-ink text-meta font-semibold tracking-[0.06em] uppercase">
        {FLAG_REASON_LABELS[flag.reason]}
      </p>
      {/* Verbatim from the draft — quoted material, so the serif (§11.6). */}
      <blockquote className="border-watch text-ink text-quote my-2 border-l-2 pl-4 font-serif break-words">
        {flag.claimText}
      </blockquote>
      <p className="text-watch-ink/90 text-[12.5px]">
        {FLAG_REASON_DETAIL[flag.reason]}
      </p>
      {flag.checkedEvidenceItemIds.length > 0 ? (
        <p className="text-watch-ink/80 mt-1.5 text-[12.5px]">
          Checked against:{" "}
          {flag.checkedEvidenceItemIds
            .map((id) => titles.get(id) ?? "an item in this brief's set")
            .join("; ")}
        </p>
      ) : null}
    </>
  );
}

/**
 * Flags a person has closed — the same slate family at lower emphasis, on the
 * card surface, with a HOLLOW CIRCLE and no pulse. Collapsed by default: this is
 * the record, not the work in front of somebody.
 */
function ClosedFlags({
  flags,
  titles,
  canResolve,
}: {
  flags: BriefFlag[];
  titles: Map<string, string>;
  canResolve: boolean;
}) {
  return (
    <details className="bg-card border-line rounded-card border p-4">
      <summary className="text-ink cursor-pointer text-[13px] font-semibold select-none focus-visible:rounded-[2px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-watch-border size-3.5 shrink-0 rounded-full border-2"
          />
          {flags.length} closed {flags.length === 1 ? "flag" : "flags"}
        </span>
      </summary>

      <ul className="mt-3 flex flex-col gap-3">
        {flags.map((flag) => (
          <li
            key={flag.id}
            id={`flag-${flag.id}`}
            className="border-line rounded-card border p-3"
          >
            <p className="text-ink-3 text-meta flex items-center gap-2 font-semibold tracking-[0.06em] uppercase">
              {/* Still a CIRCLE — the shape is what says "review flag" rather
                  than "classification hold". Hollow, and no pulse: this one is
                  settled (§11.7, §9.7). */}
              <span
                aria-hidden="true"
                className="border-watch-border size-3.5 shrink-0 rounded-full border-2"
              />
              {FLAG_STATUS_LABELS[flag.status]}
            </p>
            <FlagBody flag={flag} titles={titles} />
            <p className="text-ink-2 mt-2 text-[12.5px]">
              {flag.resolvedByName ?? "A reviewer"}
              {flag.resolvedAt === null
                ? ""
                : ` · ${formatDecisionAt(flag.resolvedAt)}`}
              {flag.resolutionReason ? ` — ${flag.resolutionReason}` : ""}
            </p>
            {canResolve ? (
              <FlagResolution flagId={flag.id} mode="reopen" />
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
