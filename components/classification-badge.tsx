import { Classification } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * The three classification values, rendered as a glyph paired with a colour —
 * never colour alone (design-system.md, "Status pills").
 *
 * All three use a SQUARE, because classification is one axis and the square is
 * its mark: a circle means a hallucination-guard review flag and the two must be
 * distinguishable at a glance and to a colour-blind reader (§11.7). Eligibility
 * is carried by fill, not hue — filled reads as eligible, outline reads as held.
 *
 * Never `destructive`, never red. It is not an error that an item is
 * community-sourced (§11.4).
 */

type ClassificationPresentation = {
  label: string;
  /** Read out after the label, so the badge says what the state means. */
  meaning: string;
  className: string;
  glyphClassName: string;
};

const PRESENTATION: Record<Classification, ClassificationPresentation> = {
  [Classification.public_published]: {
    label: "Public — published",
    meaning: "eligible for the AI pipeline",
    className: "bg-horizon-surface border-horizon-border text-horizon-ink",
    glyphClassName: "bg-horizon border-horizon",
  },
  [Classification.community_sourced]: {
    label: "Community-sourced",
    meaning: "held on Tropenbos infrastructure, never sent to a model",
    className: "bg-watch-surface border-watch-border text-watch-ink",
    glyphClassName: "border-watch",
  },
  [Classification.unpublished_internal]: {
    label: "Unpublished — internal",
    meaning: "awaiting classification, held from the AI pipeline",
    className:
      "bg-immediate-surface border-immediate-border text-immediate-ink",
    glyphClassName: "border-immediate",
  },
};

export function classificationLabel(classification: Classification): string {
  return PRESENTATION[classification].label;
}

export function ClassificationBadge({
  classification,
  className,
}: {
  classification: Classification;
  className?: string;
}) {
  const presentation = PRESENTATION[classification];

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap",
        presentation.className,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-[1px] border-[1.5px]", presentation.glyphClassName)}
      />
      <span className="sr-only">Classification: </span>
      {presentation.label}
      <span className="sr-only"> — {presentation.meaning}</span>
    </span>
  );
}
