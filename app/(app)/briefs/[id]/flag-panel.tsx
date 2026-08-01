"use client";

import { GuardFlagIcon } from "@/components/guard-flag-icon";
import type { BriefDetail, BriefFlag } from "@/lib/db/briefs";
import { FlagStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

import { FLAG_REASON_DETAIL, FLAG_REASON_LABELS } from "../labels";

/**
 * The hallucination-guard panel.
 *
 * A FLAG IS A REVIEW PROMPT, NOT AN ERROR (AGENTS.md §9.7). The visual contract,
 * exactly:
 *
 *   - Slate, on the watch ramp: `bg-watch-surface border-watch-border
 *     text-watch-ink`. Never `destructive`, never red, anywhere in this feature.
 *   - A ROUND 16px icon — the circle means "review flag", the square means
 *     "classification-pending governance hold", and the shapes are how the two
 *     are told apart by a reader who cannot rely on colour (§11.7).
 *   - `animate-flag-pulse`: 900ms, ONCE, settling to a steady 2px underline. No
 *     loop, no blink, no colour change during the pulse, and no re-fire on
 *     re-render — this is a Server Component, so the animation runs when the
 *     page renders and never again.
 *   - `prefers-reduced-motion` gets the settled state instantly, via the global
 *     rule in `globals.css`. This is CSS animation, not JS, so that rule is
 *     sufficient.
 *   - Never an error toast.
 *
 * The claim itself is set in the SERIF: it is verbatim material quoted back out
 * of the draft, not the product's own voice (§11.6).
 *
 * COPY: a flag says the claim is not traceable to the supplied evidence. It
 * never says the claim is incorrect, and nothing here implies the system
 * verified, approved or decided anything (§8.8).
 *
 * RESOLVING a flag is not built here — the dismissal action and the approval
 * refusal ship with the review work. There is deliberately no disabled control
 * with nothing behind it; the panel says so in words instead.
 *
 * SHARED WITH THE EDITOR, extended rather than duplicated. `onSelectFlag` and
 * `activeFlagId` are the editor's pairing between a flagged span in the document
 * and its entry here; the read-only page passes neither and renders exactly as
 * before. The entries carry stable `flag-<id>` element ids so the editor can
 * scroll one into view from the other direction. Nothing about the visual
 * contract changes with them — selecting a flag is navigation, not resolution.
 */
export function FlagPanel({
  flags,
  evidence,
  onSelectFlag,
  activeFlagId,
}: {
  flags: BriefFlag[];
  evidence: BriefDetail["evidence"];
  onSelectFlag?: (flagId: string) => void;
  activeFlagId?: string | null;
}) {
  const open = flags.filter((flag) => flag.status === FlagStatus.open);

  if (open.length === 0) {
    return (
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
    );
  }

  const titles = new Map(evidence.map((item) => [item.id, item.title]));

  return (
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
        These statements were not traced to the evidence passed to the generator.
        They are not necessarily wrong — they need a person to check them against
        a source before this brief goes anywhere.
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
            <p className="text-watch-ink text-meta font-semibold tracking-[0.06em] uppercase">
              {FLAG_REASON_LABELS[flag.reason]}
            </p>
            {/* Verbatim from the draft — quoted material, so the serif (§11.6). */}
            <blockquote className="border-watch text-ink text-quote font-serif my-2 border-l-2 pl-4">
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
            {onSelectFlag === undefined ? null : (
              <button
                type="button"
                onClick={() => onSelectFlag(flag.id)}
                className="text-watch-ink mt-2 cursor-pointer text-[12.5px] font-medium underline-offset-2 hover:underline"
              >
                Find this claim in the document
              </button>
            )}
          </li>
        ))}
      </ul>

      <p className="text-watch-ink/80 text-[12.5px]">
        Clearing a flag, and the approval it blocks, arrive with the review
        screen. Until then a flag stays open and this brief stays a draft.
      </p>
    </section>
  );
}
