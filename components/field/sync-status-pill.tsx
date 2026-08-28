import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The sync state of one submission, or of the queue as a whole.
 *
 * A GLYPH PAIRED WITH THE COLOUR, NEVER COLOUR ALONE (design-system.md,
 * governance/sync states). Queued is `stone` with an outlined square; signed-in
 * hold is `watch-surface` with an outlined slate square; synced and review
 * states switch to circular marks on `surface-tint`. Nothing here is red — a
 * queued observation is not an error, it is a phone without a connection (§11.4).
 *
 * The indicators do not animate. §11.10 wants instant state changes under
 * `prefers-reduced-motion`, and a pulsing indicator on a screen whose whole job
 * is to be calm about a bad connection would be the wrong instinct anyway
 * (§11.11).
 */

export type SyncState = "queued" | "sign-in" | "sent" | "waiting-review" | "read";

type StateConfig = {
  label: string;
  surface: string;
  text: string;
  renderGlyph: () => ReactNode;
};

const STATE: Record<SyncState, StateConfig> = {
  queued: {
    label: "Waiting to send",
    surface: "bg-stone border-line",
    text: "text-ink-2",
    renderGlyph: () => (
      <span
        aria-hidden="true"
        className="border-ink-disabled size-2.5 shrink-0 rounded-[2px] border-2 bg-transparent"
      />
    ),
  },
  "sign-in": {
    label: "Sign in again to send",
    surface: "bg-watch-surface border-watch-border",
    text: "text-watch-ink",
    renderGlyph: () => (
      <span
        aria-hidden="true"
        className="border-watch-ink size-2.5 shrink-0 rounded-[2px] border-2 bg-transparent"
      />
    ),
  },
  sent: {
    label: "Sent",
    surface: "bg-surface-tint border-surface-tint-border",
    text: "text-surface-tint-ink",
    renderGlyph: () => (
      <span
        aria-hidden="true"
        className="bg-accent size-2 shrink-0 rounded-full"
      />
    ),
  },
  "waiting-review": {
    label: "With the office",
    surface: "bg-surface-tint border-surface-tint-border",
    text: "text-surface-tint-ink",
    renderGlyph: () => (
      <span
        aria-hidden="true"
        className="border-accent size-2.5 shrink-0 rounded-full border-2 bg-transparent"
      />
    ),
  },
  read: {
    label: "Read by the office",
    surface: "bg-surface-tint border-surface-tint-border",
    text: "text-surface-tint-ink",
    renderGlyph: () => (
      <span
        aria-hidden="true"
        className="bg-accent size-2 shrink-0 rounded-full"
      />
    ),
  },
};

export function SyncStatusPill({
  state,
  className,
}: {
  state: SyncState;
  className?: string;
}) {
  const config = STATE[state];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-medium",
        config.surface,
        config.text,
        className,
      )}
    >
      {config.renderGlyph()}
      {config.label}
    </span>
  );
}

