"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);

/**
 * The scroll narrative for the unauthenticated landing surface.
 *
 * This is the **only** module in the project that imports GSAP outside the
 * impact map, and the carve-out is deliberate and recorded in `AGENTS.md` §6
 * and §11.9. The motion budget exists so authenticated working surfaces stay
 * calm and so governance state — urgency, guard flags, the classification
 * queue — never moves under a reviewer. This surface renders none of that: it
 * is the public front door, with no signal, flag, evidence, or queue count on
 * it. Every authenticated route stays at 150–300ms.
 *
 * Four structural rules hold the whole file together:
 *
 * 1. **Everything is a `.from()`.** The server-rendered markup is already the
 *    finished layout, so a blocked, slow, or broken script leaves the complete
 *    page on screen. No `opacity-0` + reveal-on-scroll, which strands content
 *    permanently when the script fails.
 * 2. **`prefers-reduced-motion` creates nothing.** The CSS rule in
 *    `globals.css` cannot stop JS-driven animation, so the whole build runs
 *    inside `gsap.matchMedia()` and returns early when the query matches — no
 *    tween, no ScrollTrigger, not even a zero-duration stand-in. Since the DOM
 *    is already in its final state, doing nothing is exactly correct.
 * 3. **One system per surface.** Motion (Framer) is gone from `app/signin/`
 *    entirely; two schedulers, two reduced-motion mechanisms, and two cleanup
 *    models fighting over the same nodes is not worth it. Motion stays the
 *    system everywhere else in the product.
 * 4. **Every load starts at the top of the page, and every ScrollTrigger is
 *    created only after webfonts have settled.** Chromium restores scroll
 *    position on hard reload, so a reload landing mid-page could ask a batch
 *    to decide "already entered" for content the visitor hasn't scrolled to
 *    yet — using pre-font-metrics geometry, since fonts load asynchronously.
 *    If the fonts-ready `ScrollTrigger.refresh()` that follows landed *during*
 *    a batch's entrance tween, the recalculated geometry could leave that
 *    tween's target on the wrong side of its trigger with no further hook to
 *    resolve it (`once: true`), stranding it mid-animation forever. Resetting
 *    scroll removes the "already past" precondition entirely; gating creation
 *    on `document.fonts.ready` removes the second, racing geometry pass so
 *    there is only ever one. (The alternative — keep synchronous creation and
 *    prove a mid-tween `ScrollTrigger.refresh(true)` is safe — isn't
 *    documented behavior in the `gsap-scrolltrigger` skill or the GSAP docs
 *    it points at, so it isn't guessed at here.)
 *
 * Cleanup is mostly `useGSAP()`'s: the matchMedia context, every tween, every
 * ScrollTrigger, and every SplitText is reverted on unmount, so signing in and
 * landing on a dashboard route leaves nothing running. `history.scrollRestoration`
 * is the one thing outside that context — restored manually via `useGSAP()`'s
 * own effect-cleanup return, which runs even if the component unmounts before
 * the fonts-ready reveal pass has fired.
 */
export function LandingMotion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    (_context, contextSafeFn) => {
      // `contextSafe` is typed optional on the callback signature but is
      // always supplied by `useGSAP()` itself; the assertion just narrows
      // the type back to what's actually handed to us at runtime.
      const contextSafe = contextSafeFn as NonNullable<typeof contextSafeFn>;

      // Rule 4. Reset before any trigger geometry is computed, so no
      // ScrollTrigger is ever created while the page is pre-scrolled into a
      // section the visitor hasn't reached yet.
      const previousScrollRestoration = history.scrollRestoration;
      history.scrollRestoration = "manual";
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });

      const mm = gsap.matchMedia();

      mm.add(
        {
          // `isBase` is always true. `matchMedia`'s object form only invokes
          // the handler while at least one query matches, so without it a phone
          // with reduced motion off would get no animation at all.
          isBase: "(min-width: 1px)",
          isLaptop: "(min-width: 1000px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isLaptop, reduceMotion } = context.conditions ?? {};

          // Rule 2. Nothing is created, so `ScrollTrigger.getAll()` is empty.
          if (reduceMotion) return;

          /* ---------------------------------------------------------------
           * Hero, on load. ~1.15s end to end.
           *
           * The two SplitText reveals sit outside the timeline on their own
           * delays rather than inside it. `autoSplit` re-splits when a webfont
           * lands or the element is resized and re-syncs the animation it was
           * handed back from `onSplit()`; a tween parked inside a parent
           * timeline cannot be swapped out that way. Coordinated by absolute
           * start times instead.
           * ------------------------------------------------------------- */
          const heroTl = gsap.timeline({
            defaults: { ease: "power2.out" },
          });

          heroTl
            .from(
              '[data-anim="hero-badge"]',
              { y: 8, autoAlpha: 0, duration: 0.35 },
              0,
            )
            .from(
              '[data-anim="hero-metric"]',
              { y: 12, autoAlpha: 0, duration: 0.45, stagger: 0.05 },
              0.3,
            )
            // The sign-in card zooms in as the artwork settles out of its
            // zoom-out — the one paired gesture on the page.
            .from(
              '[data-anim="signin-card"]',
              {
                scale: 0.97,
                y: 14,
                autoAlpha: 0,
                duration: 0.55,
              },
              0.45,
            )
            .from(
              '[data-anim="hero-contour"]',
              { scale: 1.08, duration: 1.1, ease: "none" },
              0,
            );

          SplitText.create('[data-anim="hero-title"]', {
            type: "lines, words",
            mask: "lines",
            autoSplit: true,
            // `aria: "auto"` is the default: the source element keeps an
            // aria-label and every generated span is aria-hidden, so a screen
            // reader reads the heading once, intact.
            onSplit(self) {
              return gsap.from(self.words, {
                yPercent: 110,
                filter: "blur(10px)",
                duration: 0.7,
                stagger: 0.02,
                delay: 0.15,
                ease: "power3.out",
                clearProps: "filter",
              });
            },
          });

          SplitText.create('[data-anim="hero-lede"]', {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit(self) {
              return gsap.from(self.lines, {
                y: 14,
                filter: "blur(6px)",
                autoAlpha: 0,
                duration: 0.6,
                stagger: 0.06,
                delay: 0.35,
                ease: "power2.out",
                clearProps: "filter",
              });
            },
          });

          /* ---------------------------------------------------------------
           * Scroll. Created only once webfonts have settled (Rule 4), inside
           * `contextSafe` since this runs asynchronously — after `useGSAP`'s
           * own synchronous setup has finished — so every ScrollTrigger and
           * timeline tween created here is still tracked by the component's
           * GSAP context and reverted on unmount, even if that unmount
           * happens before fonts resolve. ScrollTriggers are created in page
           * order — hero, pipeline, capabilities, landscape, footer — so
           * refresh order matches layout order and no `refreshPriority`
           * juggling is needed.
           * ------------------------------------------------------------- */
          const createScrollReveals = contextSafe(() => {
            // Parallax on the hero artwork. Laptop and up only: below that
            // there is no room for it, and matchMedia reverts it
            // automatically when the query stops matching.
            if (isLaptop) {
              gsap.to('[data-anim="hero-contour"]', {
                yPercent: -12,
                ease: "none",
                scrollTrigger: {
                  trigger: '[data-anim="hero"]',
                  start: "top top",
                  end: "bottom top",
                  scrub: 1,
                },
              });
            }

            // Header gains its shadow once the hero has scrolled under it.
            ScrollTrigger.create({
              trigger: '[data-anim="hero"]',
              start: "top -80",
              end: "max",
              toggleClass: {
                targets: '[data-anim="header"]',
                className: "is-scrolled",
              },
            });

            // Pipeline: the three stage cards lift, then the lattice draws.
            const pipelineTl = gsap.timeline({
              defaults: { ease: "power2.out" },
              scrollTrigger: {
                trigger: '[data-anim="pipeline"]',
                start: "top 70%",
                toggleActions: "play none none none",
              },
            });

            pipelineTl
              .fromTo(
                '[data-anim="pipeline-stage"]',
                { y: 16, autoAlpha: 0 },
                { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.1 },
              )
              .fromTo(
                '[data-anim="lattice-link"]',
                { drawSVG: "0% 0%" },
                {
                  drawSVG: "0% 100%",
                  duration: 0.5,
                  stagger: 0.1,
                  ease: "none",
                },
                "-=0.1",
              )
              // The gap path draws last, then hands its dash pattern back.
              // DrawSVG works by writing an inline stroke-dasharray, which
              // would otherwise leave the evidence gap rendering as a solid
              // link — exactly the distinction the lattice exists to make.
              // clearProps drops the inline value so the element's own
              // attribute shows again.
              .fromTo(
                '[data-anim="lattice-gap"]',
                { drawSVG: "0% 0%" },
                {
                  drawSVG: "0% 100%",
                  duration: 0.5,
                  ease: "none",
                  clearProps: "strokeDasharray,strokeDashoffset",
                },
              );

            // Capabilities: unified section timeline so all cards animate deterministically together.
            const capabilitiesTl = gsap.timeline({
              defaults: { ease: "power2.out" },
              scrollTrigger: {
                trigger: '[data-anim="capabilities"]',
                start: "top 75%",
                toggleActions: "play none none none",
              },
            });

            capabilitiesTl.fromTo(
              '[data-anim="capability-card"]',
              { y: 20, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.08 },
            );

            // Landscape: the blockquote wipes line by line. It keeps its
            // serif — the serif is quotation-only (AGENTS.md §11.6) and
            // splitting it changes nothing about that.
            SplitText.create('[data-anim="landscape-quote"]', {
              type: "lines",
              mask: "lines",
              autoSplit: true,
              onSplit(self) {
                return gsap.fromTo(
                  self.lines,
                  { yPercent: 100 },
                  {
                    yPercent: 0,
                    duration: 0.7,
                    stagger: 0.09,
                    ease: "power3.out",
                    scrollTrigger: {
                      trigger: '[data-anim="landscape"]',
                      start: "top 75%",
                      once: true,
                    },
                  },
                );
              },
            });

            // Locator: rings scale outward from the centre, then the
            // connector between the two landscapes draws.
            const locatorTl = gsap.timeline({
              defaults: { ease: "power2.out" },
              scrollTrigger: {
                trigger: '[data-anim="locator"]',
                start: "top 80%",
                toggleActions: "play none none none",
              },
            });

            locatorTl
              .fromTo(
                '[data-anim="locator-ring"]',
                { scale: 0.7, autoAlpha: 0 },
                {
                  scale: 1,
                  autoAlpha: 1,
                  // All four rings are concentric, so one shared SVG-space
                  // origin is correct. Never paired with transformOrigin.
                  svgOrigin: "230 120",
                  duration: 0.6,
                  stagger: { each: 0.08, from: "center" },
                },
              )
              .fromTo(
                '[data-anim="locator-connector"]',
                { drawSVG: "0% 0%" },
                { drawSVG: "0% 100%", duration: 0.6, ease: "none" },
                "-=0.2",
              );

            // Counters. These are decorative duplicates: the server-rendered
            // markup already carries the real figure, and the tween counts
            // up to it. A blocked script leaves the correct number on
            // screen.
            gsap.utils
              .toArray<HTMLElement>('[data-anim="counter"]')
              .forEach((el) => {
                const target = Number(el.dataset.countTo);
                if (!Number.isFinite(target)) return;

                const suffix = el.dataset.countSuffix ?? "";
                const value = { current: 0 };

                gsap.to(value, {
                  current: target,
                  duration: 1.1,
                  ease: "power2.out",
                  snap: { current: 1 },
                  onUpdate: () => {
                    el.textContent = `${value.current}${suffix}`;
                  },
                  scrollTrigger: {
                    trigger: '[data-anim="landscape-stats"]',
                    start: "top 85%",
                    once: true,
                  },
                });
              });

            // Footer: unified section timeline
            const footerTl = gsap.timeline({
              defaults: { ease: "power2.out" },
              scrollTrigger: {
                trigger: '[data-anim="footer"]',
                start: "top 90%",
                toggleActions: "play none none none",
              },
            });

            footerTl.fromTo(
              '[data-anim="footer-item"]',
              { y: 16, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.08 },
            );

            ScrollTrigger.refresh();
          });

          // Rule 4. Every ScrollTrigger and timeline above is created only once
          // webfonts have settled — line breaks move when a webfont lands,
          // which moves every trigger below it — so there is exactly one
          // geometry pass, not a synchronous one followed by a racing
          // `refresh()`.
          void document.fonts?.ready.then(createScrollReveals);
        },
        rootRef,
      );

      return () => {
        history.scrollRestoration = previousScrollRestoration;
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
