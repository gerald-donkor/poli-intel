import { AUDIENCE_TARGET_LABELS } from "@/app/(app)/signals/labels";
import type { AudienceTarget } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * A stakeholder's audience type.
 *
 * UNIFORM ACROSS ALL FIVE VALUES, deliberately. The warm→cool ramp carries the
 * urgency taxonomy, and giving audience type its own five colours would either
 * borrow that ramp's meaning or invent a sixth palette (§11.4, `design-system`
 * rule 2). The text is doing the work here, which is also why this is legible
 * without colour at all.
 *
 * Verified pairing from the handoff: `primary-ink` #0B5644 on `surface-tint`
 * #E1F5EE, the citation chip's own combination.
 */
export function AudienceTypeBadge({
  audienceType,
  className,
}: {
  audienceType: AudienceTarget;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-surface-tint border-surface-tint-border text-primary-ink inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap",
        className,
      )}
    >
      {/* Abstract structural mark — a thin-stroke circle, no people or
          address-book iconography (§11.7). */}
      <span
        aria-hidden="true"
        className="border-surface-tint-border size-2 shrink-0 rounded-full border-[1.5px]"
      />
      <span className="sr-only">Audience type: </span>
      {AUDIENCE_TARGET_LABELS[audienceType]}
    </span>
  );
}
