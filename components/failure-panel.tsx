import type { ReactNode } from "react";

/**
 * The body every error boundary composes, so a crashed screen looks the same
 * whichever segment threw.
 *
 * NOTHING HERE IS RED. `--destructive` is deliberately unmapped in this product
 * (§11.4, design-system rule 2), and a crash is not an emergency to a reader —
 * it is a screen that did not load. The treatment is the WATCH end of the
 * urgency ramp: slate, quiet, factual.
 *
 * IT MUST NOT LOOK LIKE A GUARD FLAG. The hallucination guard's flag shares the
 * slate ramp, but its circle glyph and its 900ms single pulse are its own
 * contract (`hallucination-guard`, §9.7). This panel borrows neither: a plain
 * rule, no glyph, no motion at all. A crashed screen is not a review prompt and
 * the two must stay distinguishable at a glance.
 *
 * NO MOTION, FULL STOP. §11.11 — if in doubt, cut the animation — and a screen
 * that just failed is the least appropriate place in the product for a
 * flourish. That also means there is nothing here for `prefers-reduced-motion`
 * to switch off.
 *
 * UNMARKED, NOT `"use client"`. Error boundaries must be Client Components, so
 * importing this from one pulls it into that client bundle; `not-found.tsx` is
 * a Server Component and renders the same file on the server. One definition,
 * either side of the boundary, no `"use client"` directive forcing it onto the
 * client where it does not need to be.
 */
export function FailurePanel({
  eyebrow = "Not loaded",
  title,
  description,
  reference,
  children,
}: {
  /** Small-caps label above the heading. Two words at most. */
  eyebrow?: string;
  title: string;
  description: string;
  /** The error digest — a hash, safe to show, matchable against the logs. */
  reference?: string;
  /** The recovery control. */
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-1 items-start justify-center p-5 tablet:p-8">
      <div className="rounded-card border-line bg-card border-l-watch w-full max-w-[520px] border border-l-[3px] px-5 py-5 tablet:px-6 tablet:py-6">
        <p className="text-watch-ink text-meta font-semibold tracking-[0.06em] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-ink mt-2 text-[17px] leading-snug font-semibold tablet:text-h2">
          {title}
        </h1>
        <p className="text-ink-3 mt-2 text-[14px] leading-relaxed">{description}</p>

        {children ? <div className="mt-5 flex flex-wrap gap-2">{children}</div> : null}

        {reference ? (
          <p className="border-line text-ink-disabled mt-5 border-t pt-3 font-mono text-[11.5px] break-all">
            Reference {reference}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The recovery control, shared so the three boundaries do not each re-derive a
 * button. A real `<button>` — focusable, keyboard-operable, and carrying the
 * global focus ring rather than an `outline: none`.
 */
export function FailureAction({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-primary hover:bg-primary-hover focus-visible:ring-accent/50 focus-visible:ring-offset-card rounded-input inline-flex h-9 items-center justify-center px-4 text-[13px] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
