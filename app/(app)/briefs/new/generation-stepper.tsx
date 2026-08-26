"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * The three-stage generation sequence (AGENTS.md §16.7, spec §5.7).
 *
 * EVERY STAGE HERE IS REAL WORK. The three labels correspond one-to-one with
 * three separately-awaited Server Actions, so a stage is only ever "active" while
 * its request is genuinely in flight, and only ever "complete" once that request
 * has returned. Nothing is faked, and nothing is timed.
 *
 * NO INDETERMINATE SPINNER ANYWHERE. Completed stages fill visibly; the active
 * label breathes 0.85–1.0 over 2s — the only looping animation in the product.
 * `prefers-reduced-motion` gets the settled state, killed by the global CSS rule
 * in `globals.css` (this is CSS animation, not JS, so that rule is sufficient).
 *
 * The step marker is a SQUARE. The circle is reserved for the guard flag (§11.7).
 */

export const GENERATION_STAGES = [
  { id: "retrieving", label: "Reading evidence" },
  { id: "drafting", label: "Drafting" },
  { id: "verifying", label: "Verifying citations" },
] as const;

export type GenerationStageId = (typeof GENERATION_STAGES)[number]["id"];

export function GenerationStepper({
  activeIndex,
  halted,
}: {
  /** Index of the stage in flight. `GENERATION_STAGES.length` means all done. */
  activeIndex: number;
  /**
   * A rate limit or a failure stopped the run. The active stage stops breathing
   * and stops claiming to be working, because it is not.
   */
  halted?: boolean;
}) {
  const completed = Math.min(activeIndex, GENERATION_STAGES.length);
  const percent = Math.round((completed / GENERATION_STAGES.length) * 100);

  return (
    <div
      aria-live="polite"
      className="bg-card border-line rounded-card flex flex-col gap-3 border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
          Generation progress
        </span>
        <span className="text-ink-3 font-mono text-[11px] tabular-nums">
          {percent}%
        </span>
      </div>

      <Progress value={percent} className="w-full" />

      <ol className="flex flex-col gap-2">
        {GENERATION_STAGES.map((stage, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex && !halted;
          const stalled = index === activeIndex && halted === true;

          return (
            <li key={stage.id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-[1px] border-2",
                  complete
                    ? "border-primary bg-primary"
                    : active || stalled
                      ? "border-primary"
                      : "border-sage",
                )}
              />
              <span
                className={cn(
                  "text-[13px]",
                  complete
                    ? "text-ink-2"
                    : active
                      ? "text-ink animate-breathe font-medium"
                      : stalled
                        ? "text-ink font-medium"
                        : "text-ink-disabled",
                )}
              >
                {stage.label}
              </span>
              {complete ? (
                <span className="sr-only">— complete</span>
              ) : active ? (
                <span className="sr-only">— in progress</span>
              ) : stalled ? (
                <span className="sr-only">— paused</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
