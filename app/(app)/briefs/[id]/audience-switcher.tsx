"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AUDIENCE_OPTIONS } from "@/lib/ai/audience-profiles";
import type { BriefAudience } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * The audience switcher — five readers, one brief.
 *
 * `Tabs`, per the handoff's component mapping (line 234). Selecting a tab shows
 * what switching would cost and offers it; IT NEVER STARTS A REFRAME ON HOVER,
 * FOCUS, OR TAB CHANGE (decision 9). A reframe is two Gemini requests on a
 * budget of roughly fifteen a minute, and spending them because a pointer moved
 * would be indefensible. The current audience's tab is selected on arrival and
 * offers nothing — it is where the brief already is.
 *
 * THE CITATION CHIPS ARE THE POINT OF THE COMPONENT. They sit OUTSIDE the tab
 * panels and are never remounted, wrapped in `LayoutGroup` with a `layoutId`
 * each so that when the framing above them changes height they animate to their
 * new position rather than jumping (handoff line 293, `tiptap-editor`). That is
 * the perceptual claim `brief-output` rule 4 makes, rendered: the framing moves,
 * the evidence does not. Remounting them would read as "new document loaded",
 * which is the one thing the rule forbids.
 *
 * `useReducedMotion()` IS REQUIRED, not optional: the global CSS rule in
 * `globals.css` kills CSS animation and does nothing at all to a JS-driven
 * layout animation (`design-system`). With it on, the crossfade and the layout
 * animation are both off and every change is instant.
 *
 * PRESENTATION ONLY. Whether this person may reframe, and whether this brief
 * still can be, are re-answered server-side by the route and again inside every
 * action — a control that is not rendered is not a control that is enforced
 * (§10.1).
 */

const CROSSFADE_SECONDS = 0.26;

export function AudienceSwitcher({
  briefId,
  audience,
  evidence,
  canReframe,
  unavailableReason,
}: {
  briefId: string;
  /** The brief's CURRENT audience. */
  audience: BriefAudience;
  evidence: { id: string; citationKey: string }[];
  canReframe: boolean;
  /** Why not, in a sentence, when `canReframe` is false. */
  unavailableReason: string;
}) {
  const [selected, setSelected] = useState<BriefAudience>(audience);
  const reduceMotion = useReducedMotion();

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: CROSSFADE_SECONDS, ease: [0.2, 0, 0, 1] as const };

  return (
    <LayoutGroup id={`audience-switcher-${briefId}`}>
      <section className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border p-4 tablet:p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
            Written for
          </h2>
          <p className="text-ink-3 max-w-[70ch] text-[12.5px] leading-[1.55]">
            The same evidence, framed for one reader. Choosing another shows what
            reframing would change before anything is saved.
          </p>
        </div>

        <Tabs
          value={selected}
          onValueChange={(value) => setSelected(value as BriefAudience)}
        >
          {/* Wraps rather than scrolls: five long labels do not fit one row at
              320px, and a horizontally scrolling tablist hides options. 44px
              minimum tap target on phones, tightening at `tablet`. */}
          <TabsList
            variant="line"
            aria-label="Audience"
            className="h-auto! w-full flex-wrap justify-start gap-1"
          >
            {AUDIENCE_OPTIONS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="min-h-11 flex-none px-2 text-[12.5px] whitespace-normal tablet:min-h-8"
              >
                {option.label}
                {option.value === audience ? (
                  <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                    Current
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {AUDIENCE_OPTIONS.map((option) => (
            <TabsContent key={option.value} value={option.value}>
              <motion.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition}
                className="flex min-w-0 flex-col gap-3 pt-1"
              >
                <dl className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                      Framing emphasis
                    </dt>
                    <dd className="text-ink-2 text-[12.5px] leading-[1.55]">
                      {option.framingEmphasis}
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
                      Tone
                    </dt>
                    <dd className="text-ink-2 text-[12.5px] leading-[1.55]">
                      {option.tone}
                    </dd>
                  </div>
                </dl>

                {option.value === audience ? (
                  <p className="text-ink-3 text-[12.5px] leading-[1.55]">
                    This brief is written for this reader.
                  </p>
                ) : canReframe ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/briefs/${briefId}/reframe?audience=${option.value}`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "h-11 tablet:h-8",
                      )}
                    >
                      Reframe for {option.label}
                    </Link>
                    <span className="text-ink-3 max-w-[46ch] text-[12.5px] leading-[1.5]">
                      You will see what would change before anything is saved.
                    </span>
                  </div>
                ) : (
                  <p className="text-ink-3 max-w-[60ch] text-[12.5px] leading-[1.55]">
                    {unavailableReason}
                  </p>
                )}
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>

        {evidence.length > 0 ? (
          <div className="border-line flex min-w-0 flex-col gap-2 border-t pt-3">
            <h3 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
              The same {evidence.length === 1 ? "source" : `${evidence.length} sources`},
              whichever reader
            </h3>
            {/* Rendered ONCE, outside the panels. These never remount as the
                framing changes — they animate position, which is the whole
                claim. */}
            <ul className="flex flex-wrap gap-1.5">
              {evidence.map((item) => (
                <motion.li
                  key={item.id}
                  layout={reduceMotion ? false : "position"}
                  layoutId={`citation-${item.id}`}
                  transition={transition}
                  className="border-surface-tint-border bg-surface-tint text-surface-tint-ink flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]"
                >
                  <span
                    aria-hidden="true"
                    className="bg-accent size-1.5 shrink-0 rounded-full"
                  />
                  {item.citationKey}
                </motion.li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </LayoutGroup>
  );
}
