"use client";

import type { ActionRefusal } from "@/lib/auth/authorize";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

/**
 * Saved / saving / failed — visible, always.
 *
 * NEVER A SILENT FAILURE, and never a lost buffer. A save that did not land
 * says so, says what to do, and leaves every word the officer typed on screen —
 * the same contract as the rate-limit degradation and the offline queue
 * (`tiptap-editor`, §17.2). Retry is a real control, not a suggestion to reload.
 *
 * No red anywhere: a failed save uses the immediate (bronze) ramp and a conflict
 * uses watch (slate). `--destructive` is unmapped in this product (§11.4).
 */

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "failed"; refusal: ActionRefusal };

export function SaveStateIndicator({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  if (state.kind === "failed") {
    const conflict = state.refusal.kind === "version-conflict";

    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-card flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border px-3 py-2 text-[12.5px]",
          conflict
            ? "bg-watch-surface border-watch-border text-watch-ink"
            : "bg-immediate-surface border-immediate-border text-immediate-ink",
        )}
      >
        <span className="min-w-0">{refusalCopy(state.refusal)}</span>
        {/* A conflict is not retryable: the version this editor opened from is
            no longer the current one, so the same save would be refused again.
            The text stays on screen and the officer decides what to do with it —
            nothing here reloads the page out from under them. */}
        {conflict ? null : (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-7 cursor-pointer px-2.5 text-[12px]"
          >
            Retry save
          </Button>
        )}
      </div>
    );
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "text-[12.5px] whitespace-nowrap",
        state.kind === "saving" ? "text-ink-2" : "text-ink-3",
      )}
    >
      {state.kind === "saving"
        ? "Saving…"
        : state.kind === "saved"
          ? `Saved ${formatTime(state.at)}`
          : "Every pause saves a new version."}
    </p>
  );
}

function refusalCopy(refusal: ActionRefusal): string {
  switch (refusal.kind) {
    case "version-conflict":
      return `Someone else saved version ${refusal.currentVersion} of this brief while you were editing, so this save was refused rather than written over theirs. Nothing you typed has been lost — it is still on screen. Copy anything you need, then open the brief again to pick up their version.`;
    case "unauthorised":
      return refusal.message;
    case "invalid":
      return (
        refusal.fieldErrors.document?.[0] ??
        "This draft could not be saved. Your text is still on screen."
      );
    default:
      return "This draft was not saved. Your text is still on screen — try again.";
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
