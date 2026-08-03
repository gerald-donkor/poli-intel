import { cn } from "@/lib/utils";

/**
 * The sync state of one submission, or of the queue as a whole.
 *
 * A GLYPH PAIRED WITH THE COLOUR, NEVER COLOUR ALONE (design-system.md,
 * governance/sync states). Queued is `stone` with a grey `#8E8B84` dot; synced
 * switches the dot to `accent`. Nothing here is red — a queued observation is
 * not an error, it is a phone without a connection (§11.4).
 *
 * The dot does not animate. §11.10 wants instant state changes under
 * `prefers-reduced-motion`, and a pulsing indicator on a screen whose whole job
 * is to be calm about a bad connection would be the wrong instinct anyway
 * (§11.11).
 */

export type SyncState = "queued" | "sign-in" | "sent" | "waiting-review" | "read";

const STATE: Record<
  SyncState,
  { label: string; dot: string; surface: string; text: string }
> = {
  queued: {
    label: "Waiting to send",
    dot: "bg-ink-disabled",
    surface: "bg-stone border-line",
    text: "text-ink-2",
  },
  "sign-in": {
    label: "Sign in again to send",
    dot: "bg-ink-disabled",
    surface: "bg-stone border-line",
    text: "text-ink-2",
  },
  sent: {
    label: "Sent",
    dot: "bg-accent",
    surface: "bg-surface-tint border-surface-tint-border",
    text: "text-surface-tint-ink",
  },
  "waiting-review": {
    label: "With the office",
    dot: "bg-accent",
    surface: "bg-surface-tint border-surface-tint-border",
    text: "text-surface-tint-ink",
  },
  read: {
    label: "Read by the office",
    dot: "bg-accent",
    surface: "bg-surface-tint border-surface-tint-border",
    text: "text-surface-tint-ink",
  },
};

export function SyncStatusPill({
  state,
  className,
}: {
  state: SyncState;
  className?: string;
}) {
  const style = STATE[state];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-medium",
        style.surface,
        style.text,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", style.dot)}
      />
      {style.label}
    </span>
  );
}
