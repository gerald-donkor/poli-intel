import { cn } from "@/lib/utils";

/**
 * The hallucination-guard review flag's mark.
 *
 * ROUND, and that is the point. A circle means "review flag"; the square is the
 * classification-pending governance hold (`components/classification-badge.tsx`).
 * The two states are told apart by SHAPE, not by colour alone, so a colour-blind
 * reader can tell them apart at all (design-system.md, iconography; §11.7).
 *
 * 16px, 2px stroke `--color-watch` (#496375), filled centre dot — the handoff's
 * exact specification. Never red, never an alarm glyph, never an error icon
 * (§9.7).
 */
export function GuardFlagIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "border-watch inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2",
        className,
      )}
    >
      <span className="bg-watch size-1 rounded-full" />
    </span>
  );
}
