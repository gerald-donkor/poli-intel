import { Mark, mergeAttributes } from "@tiptap/core";

import { GUARD_FLAG_MARK } from "../document";

/**
 * The hallucination-guard flag, as a Tiptap Mark over the claim it anchors to.
 *
 * THE MARK RENDERS STORED FLAG RECORDS. It never scans text, never regexes,
 * never infers a flag at render time (§9.3). Marks are painted onto the document
 * from `hallucination_flag` rows by `applyFlagMarks`, and read back off at save;
 * they are not stored inside `documentJson`.
 *
 * THE VISUAL CONTRACT, restated because it must not drift (§9.7,
 * `hallucination-guard`):
 *
 *   - Slate, on the WATCH ramp. Never red, never `destructive`, never a toast,
 *     never a blink, never an alarm.
 *   - `animate-flag-mark-pulse` — 900ms, ONCE: background opacity 0 → 0.35 → 0,
 *     settling to a steady 2px underline in `--color-watch-border`. No colour
 *     change during the pulse, no loop, and no re-fire on re-render: ProseMirror
 *     builds this element once per mark instance and keeps it across
 *     transactions, so the CSS animation runs on first mount only.
 *   - `prefers-reduced-motion` gets the settled state instantly, via the global
 *     rule in `globals.css`. This is CSS animation, so that rule is sufficient.
 *
 * A flag is a review prompt, not an error: the title says the claim is not
 * traceable to the supplied evidence, never that it is wrong (§8.8).
 *
 * CLEARING A FLAG IS NOT HERE. Dismissal is a Server Action with server-side
 * role enforcement and ships with the review work (§10.6).
 */

export type GuardFlagAttributes = {
  flagId: string;
  reason: string;
};

const MARK_CLASS =
  "animate-flag-mark-pulse border-b-2 border-b-watch-border cursor-pointer";

export const GuardFlag = Mark.create({
  name: GUARD_FLAG_MARK,

  /** Typing at the edge of a flagged claim must not extend the flag over it. */
  inclusive: false,

  addAttributes() {
    return {
      flagId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-guard-flag"),
        renderHTML: (attributes) => ({
          "data-guard-flag": attributes.flagId as string,
        }),
      },
      reason: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-guard-flag-reason") ?? "",
        renderHTML: (attributes) => ({
          "data-guard-flag-reason": attributes.reason as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-guard-flag]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: MARK_CLASS,
        title: "Not traceable to the supplied evidence — needs checking.",
      }),
      0,
    ];
  },
});
