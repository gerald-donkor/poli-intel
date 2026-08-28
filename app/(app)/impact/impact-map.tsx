"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useMemo, useRef, useState } from "react";

import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import type { ImpactMap } from "@/lib/db";

import {
  formatInfluenceDate,
  IMPACT_MAP_COPY,
  impactMapAriaLabel,
  INFLUENCE_EVENT_TYPE_LABELS,
} from "./labels";

gsap.registerPlugin(useGSAP);

/**
 * The impact map — evidence → brief → outcome, with the citation paths drawn.
 *
 * THE ONLY GSAP SURFACE IN THE PRODUCT (§6, §11.9). `gsap` is imported here and
 * in no other module; Motion remains the UI animation library everywhere else
 * and no existing Motion animation was replaced to build this.
 *
 * THE MAP ASSERTS NOTHING THE RECORD DOES NOT ALREADY HOLD. Every node is a
 * stored row and every line is a stored relation — no inference, no clustering,
 * and no model anywhere on this screen. The copy says a path is *recorded*, never
 * that anything was proven or verified by the system (§8.8).
 *
 * NOTHING HERE MUTATES. There is no confirm control on the canvas; verification
 * stays on the rail's `VerifyControl`, behind `canVerifyInfluenceEvent` inside the
 * Server Action. A drawn line must never become a second, unguarded path to
 * marking something confirmed (§10.1).
 *
 * STATES THAT CANNOT OCCUR HERE, stated rather than built (§17.6): this route
 * makes no Gemini call, so there is no rate-limited state; it persists no
 * generation, so there is no flagged state; it is not a Field Officer surface, so
 * there is no offline or sync-pending state; and it reads no `evidence_item`
 * classification, so there is no classification-pending state. The one real state
 * besides the happy path is EMPTY, and the page handles it by not rendering this
 * component at all — `EmptyImpactState` is the screen's answer.
 *
 * NODE SHAPES DELIBERATELY AVOID THE RESERVED GLYPHS. The circle means a
 * hallucination-guard review flag and the square means a classification-pending
 * hold; using either here would make two unrelated things look like one thing.
 * Nodes are labelled rounded rectangles told apart by column position and a
 * column heading (§11.7).
 */

/* --- Canvas geometry. Fixed, deterministic, identical on server and client. -- */

const CANVAS_WIDTH = 860;
const PAD_X = 12;
const COLUMN_WIDTH = 236;
const COLUMN_GAP = 68;
const CONTENT_TOP = 40;
const BOTTOM_PAD = 16;
const NODE_HEIGHT = 48;
const ROW_GAP = 12;
/** Keeps the canvas at the handoff's 460px min-height when the lattice is small. */
const MIN_INNER_HEIGHT = 404;

const COLUMN_X = [
  PAD_X,
  PAD_X + COLUMN_WIDTH + COLUMN_GAP,
  PAD_X + 2 * (COLUMN_WIDTH + COLUMN_GAP),
] as const;

/** ~34 characters fit the 236px node at 12px Inter; the rest goes to `<title>`. */
const PRIMARY_CHARS = 34;
const SECONDARY_CHARS = 38;

type Placed<T> = T & { x: number; y: number };

type MapLine = {
  key: string;
  d: string;
  verified: boolean;
  /** Citation date of the governing outcome — the order the timeline draws in. */
  order: number;
};

export function ImpactMap({ map }: { map: ImpactMap }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const lattice = useMemo(() => buildLattice(map), [map]);

  const { activeNodeIds, activeLineKeys } = useMemo(() => {
    if (!activeNodeId) return { activeNodeIds: null, activeLineKeys: null };

    const nodeIds = new Set<string>([activeNodeId]);
    const lineKeys = new Set<string>();

    // If activeNode is evidence
    for (const link of map.links) {
      if (link.evidenceId === activeNodeId) {
        nodeIds.add(link.briefId);
        lineKeys.add(`${link.evidenceId}->${link.briefId}`);
        for (const outcome of map.outcomes) {
          if (outcome.briefId === link.briefId) {
            nodeIds.add(outcome.id);
            lineKeys.add(`${outcome.briefId}->${outcome.id}`);
          }
        }
      }
    }

    // If activeNode is brief
    for (const link of map.links) {
      if (link.briefId === activeNodeId) {
        nodeIds.add(link.evidenceId);
        lineKeys.add(`${link.evidenceId}->${link.briefId}`);
      }
    }
    for (const outcome of map.outcomes) {
      if (outcome.briefId === activeNodeId) {
        nodeIds.add(outcome.id);
        lineKeys.add(`${outcome.briefId}->${outcome.id}`);
      }
    }

    // If activeNode is outcome
    const matchingOutcome = map.outcomes.find((o) => o.id === activeNodeId);
    if (matchingOutcome) {
      nodeIds.add(matchingOutcome.briefId);
      lineKeys.add(`${matchingOutcome.briefId}->${matchingOutcome.id}`);
      for (const link of map.links) {
        if (link.briefId === matchingOutcome.briefId) {
          nodeIds.add(link.evidenceId);
          lineKeys.add(`${link.evidenceId}->${link.briefId}`);
        }
      }
    }

    return { activeNodeIds: nodeIds, activeLineKeys: lineKeys };
  }, [activeNodeId, map]);

  useGSAP(
    (_context, contextSafe) => {
      const scope = gsap.utils.selector(containerRef);
      const media = gsap.matchMedia();

      media.add(
        {
          // The global CSS `prefers-reduced-motion` rule kills CSS animation and
          // does not touch a JS-driven timeline. This is the case that rule
          // cannot cover, so it is handled here explicitly (§11.10).
          reduceMotion: "(prefers-reduced-motion: reduce)",
          fullMotion: "not (prefers-reduced-motion: reduce)",
        },
        (context) => {
          const reduce = context.conditions?.reduceMotion === true;
          const seconds = (value: number) => (reduce ? 0 : value);

          const evidenceNodes = scope("[data-impact-node='evidence']");
          const briefNodes = scope("[data-impact-node='brief']");
          const outcomeNodes = scope("[data-impact-node='outcome']");
          const verifiedLines = scope("[data-impact-line='verified']");
          const unverifiedLines = scope("[data-impact-line='unverified']");

          const timeline = gsap.timeline({
            defaults: { ease: "power1.out" },
          });

          const appear = (targets: Element[], at: number) => {
            if (targets.length === 0) return;

            timeline.from(
              targets,
              {
                autoAlpha: 0,
                y: reduce ? 0 : 6,
                duration: seconds(0.3),
                stagger: { amount: seconds(0.15) },
              },
              seconds(at),
            );
          };

          const draw = (targets: Element[], at: number) => {
            if (targets.length === 0) return;

            timeline.to(
              targets,
              {
                strokeDashoffset: 0,
                duration: seconds(0.5),
                ease: "power1.inOut",
                stagger: { amount: seconds(0.25) },
              },
              seconds(at),
            );
          };

          // ~1.6s end to end, played once. Sequenced with the position parameter
          // rather than chained delays: evidence, then briefs, then the confirmed
          // paths in citation-date order, then the outcomes, then the unconfirmed
          // dashed paths last.
          appear(evidenceNodes, 0);
          appear(briefNodes, 0.18);
          draw(verifiedLines, 0.35);
          appear(outcomeNodes, 0.7);
          draw(unverifiedLines, 0.85);

          timelineRef.current = timeline;

          return () => {
            timelineRef.current = null;
          };
        },
        containerRef,
      );

      // Replay is wired HERE rather than as an `onClick` prop, which is the
      // documented `contextSafe` pattern: the handler is created inside the
      // hook, so it cannot fire against unmounted nodes, and the ref is never
      // read during render. Its listener is removed in the cleanup below.
      const replay = contextSafe?.(() => {
        timelineRef.current?.restart();
      });
      const button = replayRef.current;

      if (replay) button?.addEventListener("click", replay);

      // matchMedia creates its own context internally, so it is reverted here
      // rather than nested inside another one.
      return () => {
        if (replay) button?.removeEventListener("click", replay);
        media.revert();
      };
    },
    { scope: containerRef },
  );

  const height = CONTENT_TOP + lattice.innerHeight + BOTTOM_PAD;

  return (
    <section
      aria-labelledby="impact-map-heading"
      className="bg-card border-line rounded-card flex min-w-0 flex-col gap-4 border p-4 tablet:p-5 shadow-raised"
      ref={containerRef}
    >
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          {/* An h3: this sits inside the page's "The record" section, so the
              outline stays h1 → h2 → h3 rather than repeating a level. */}
          <h3
            id="impact-map-heading"
            className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
          >
            {IMPACT_MAP_COPY.heading}{" "}
            <span className="font-mono tabular-nums text-ink">
              ({lattice.lines.length})
            </span>
          </h3>

          <button
            type="button"
            ref={replayRef}
            className="border-line text-ink-2 bg-paper hover:border-accent hover:text-ink focus-visible:ring-accent cursor-pointer rounded-full border px-3.5 py-1 text-[13px] font-medium shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
          >
            {IMPACT_MAP_COPY.replay}
          </button>
        </div>

        <p className="text-ink-3 max-w-[72ch] text-[13px] leading-relaxed">
          {IMPACT_MAP_COPY.intro}
        </p>

        {/* The legend states the distinction in words. Solid against dashed
            carries it without colour, and nothing here is red (§11.4, §11.13). */}
        <ul className="text-ink-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12.5px]">
          <li className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              width="26"
              height="8"
              viewBox="0 0 26 8"
              className="shrink-0"
            >
              <line
                x1="0"
                y1="4"
                x2="26"
                y2="4"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
              />
            </svg>
            {IMPACT_MAP_COPY.legendVerified}
          </li>
          <li className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              width="26"
              height="8"
              viewBox="0 0 26 8"
              className="shrink-0"
            >
              <line
                x1="0"
                y1="4"
                x2="26"
                y2="4"
                stroke="var(--color-sage)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            </svg>
            {IMPACT_MAP_COPY.legendUnverified}
          </li>
        </ul>
      </header>

      {/* The one element in the product that does not reflow. It keeps its
          860px min-width and PANS INSIDE THIS CONTAINER; the page itself never
          scrolls horizontally (§11.15). Stacking the nodes is the wrong trade. */}
      <div className="bg-paper/30 border-line rounded-card min-w-0 overflow-x-auto border tablet:min-h-[460px]">
        <svg
          role="img"
          aria-label={impactMapAriaLabel(
            lattice.lines.length,
            map.outcomes.length,
          )}
          viewBox={`0 0 ${CANVAS_WIDTH} ${height}`}
          className="block h-auto w-full min-w-[860px]"
        >
          {/* Subtle topographic contour rings behind paths */}
          <g aria-hidden="true" className="pointer-events-none" opacity="0.35" fill="none" stroke="var(--color-line)">
            <circle cx="-10" cy={height + 30} r="140" strokeWidth="1" />
            <circle cx="-10" cy={height + 30} r="200" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="-10" cy={height + 30} r="260" strokeWidth="1" />
            <circle cx={CANVAS_WIDTH + 20} cy="30" r="120" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={CANVAS_WIDTH + 20} cy="30" r="180" strokeWidth="1" />
          </g>

          <ColumnHeading x={COLUMN_X[0]}>
            {IMPACT_MAP_COPY.columns.evidence}
          </ColumnHeading>
          <ColumnHeading x={COLUMN_X[1]}>
            {IMPACT_MAP_COPY.columns.brief}
          </ColumnHeading>
          <ColumnHeading x={COLUMN_X[2]}>
            {IMPACT_MAP_COPY.columns.outcome}
          </ColumnHeading>

          {/* An unverified path is ALREADY dashed, so sliding its own dash
              offset would move the dashes rather than draw the line. Each one is
              therefore revealed through a mask whose solid stroke is what the
              timeline draws — the visible dash pattern stays put throughout. */}
          <defs>
            {lattice.lines
              .filter((line) => !line.verified)
              .map((line) => (
                <mask
                  key={line.key}
                  id={maskId(line.key)}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width={CANVAS_WIDTH}
                  height={height}
                >
                  <path
                    d={line.d}
                    data-impact-line="unverified"
                    pathLength="1"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="6"
                    // `pathLength="1"` normalises the dash units, so one unit of
                    // offset hides exactly the whole path however long it is.
                    style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
                  />
                </mask>
              ))}
          </defs>

          {/* Lines sit under the nodes, and are rendered in DRAW ORDER so the
              timeline's stagger follows the citation dates without re-sorting. */}
          <g fill="none" strokeWidth="1.5" strokeLinecap="round">
            {lattice.lines.map((line) => {
              const isDimmed = activeLineKeys !== null && !activeLineKeys.has(line.key);
              const lineOpacity = isDimmed ? 0.2 : 1;
              const lineStrokeWidth = activeLineKeys?.has(line.key) ? 2 : 1.5;

              return line.verified ? (
                <path
                  key={line.key}
                  d={line.d}
                  data-impact-line="verified"
                  pathLength="1"
                  stroke="var(--color-accent)"
                  strokeWidth={lineStrokeWidth}
                  style={{
                    strokeDasharray: 1,
                    strokeDashoffset: 1,
                    opacity: lineOpacity,
                    transition: "opacity 150ms ease-out, stroke-width 150ms ease-out",
                  }}
                />
              ) : (
                <path
                  key={line.key}
                  d={line.d}
                  stroke="var(--color-sage)"
                  strokeWidth={lineStrokeWidth}
                  strokeDasharray="4 3"
                  mask={`url(#${maskId(line.key)})`}
                  style={{
                    opacity: lineOpacity,
                    transition: "opacity 150ms ease-out, stroke-width 150ms ease-out",
                  }}
                />
              );
            })}
          </g>

          {lattice.evidence.map((node) => (
            <MapNode
              key={node.id}
              kind="evidence"
              x={node.x}
              y={node.y}
              primary={node.title}
              secondary={node.citationKey}
              secondaryMono
              isDimmed={activeNodeIds !== null && !activeNodeIds.has(node.id)}
              isActive={activeNodeId === node.id}
              onActivate={() => setActiveNodeId(node.id)}
              onDeactivate={() => setActiveNodeId(null)}
            />
          ))}

          {lattice.briefs.map((node) => (
            <MapNode
              key={node.id}
              kind="brief"
              x={node.x}
              y={node.y}
              primary={node.title}
              secondary={`${briefTypeLabel(node.briefType)} · ${audienceLabel(node.audience)}`}
              isDimmed={activeNodeIds !== null && !activeNodeIds.has(node.id)}
              isActive={activeNodeId === node.id}
              onActivate={() => setActiveNodeId(node.id)}
              onDeactivate={() => setActiveNodeId(null)}
            />
          ))}

          {lattice.outcomes.map((node) => (
            <MapNode
              key={node.id}
              kind="outcome"
              x={node.x}
              y={node.y}
              primary={INFLUENCE_EVENT_TYPE_LABELS[node.eventType]}
              secondary={
                node.sourceTitle ?? formatInfluenceDate(node.detectedAt)
              }
              isDimmed={activeNodeIds !== null && !activeNodeIds.has(node.id)}
              isActive={activeNodeId === node.id}
              onActivate={() => setActiveNodeId(node.id)}
              onDeactivate={() => setActiveNodeId(null)}
            />
          ))}
        </svg>
      </div>

      {/* The diagram's information in full, without seeing it. The SVG is never
          the sole carrier of anything on this screen. */}
      <h4 className="sr-only">{IMPACT_MAP_COPY.summaryHeading}</h4>
      <ul className="sr-only">
        {lattice.sentences.map((sentence) => (
          <li key={sentence.key}>{sentence.text}</li>
        ))}
      </ul>
    </section>
  );
}

function ColumnHeading({ x, children }: { x: number; children: string }) {
  return (
    <text
      x={x}
      y={22}
      className="fill-[var(--color-ink-3)] text-[12px] font-semibold tracking-[0.06em] uppercase"
      aria-hidden="true"
    >
      {children}
    </text>
  );
}

/**
 * A labelled rounded rectangle. No circle, no square, no icon asset, and no
 * serif: nothing on this canvas is quoted source material, so all of it is the
 * sans (§11.6).
 */
function MapNode({
  kind,
  x,
  y,
  primary,
  secondary,
  secondaryMono = false,
  isDimmed = false,
  isActive = false,
  onActivate,
  onDeactivate,
}: {
  kind: "evidence" | "brief" | "outcome";
  x: number;
  y: number;
  primary: string;
  secondary: string;
  secondaryMono?: boolean;
  isDimmed?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  onDeactivate?: () => void;
}) {
  const isBrief = kind === "brief";
  const bgFill = isBrief ? "var(--color-surface-tint)" : "var(--color-card)";
  const bgOpacity = isBrief ? "0.35" : "1";
  const strokeColor = isActive
    ? "var(--color-primary)"
    : isBrief
      ? "var(--color-surface-tint-border)"
      : "var(--color-line)";
  const strokeWidth = isActive ? 2 : 1;
  const primaryFill = isBrief ? "var(--color-primary-ink)" : "var(--color-ink)";

  return (
    <g
      data-impact-node={kind}
      tabIndex={0}
      role="button"
      aria-label={`${primary} — ${secondary}`}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className="cursor-pointer focus-visible:outline-none"
      style={{
        opacity: isDimmed ? 0.25 : 1,
        transition: "opacity 150ms ease-out",
      }}
    >
      <title>{`${primary} — ${secondary}`}</title>
      <rect
        x={x}
        y={y}
        width={COLUMN_WIDTH}
        height={NODE_HEIGHT}
        rx="6"
        fill={bgFill}
        fillOpacity={bgOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <text
        x={x + 12}
        y={y + 20}
        fill={primaryFill}
        className="text-[12px] font-semibold"
      >
        {clampText(primary, PRIMARY_CHARS)}
      </text>
      <text
        x={x + 12}
        y={y + 37}
        className={
          secondaryMono
            ? "fill-[var(--color-ink-3)] font-mono text-[12px]"
            : "fill-[var(--color-ink-3)] text-[12px]"
        }
      >
        {clampText(secondary, SECONDARY_CHARS)}
      </text>
    </g>
  );
}

/* ---------------------------------------------------------------------------
 * Layout maths — pure, deterministic, and the same on every render
 * ------------------------------------------------------------------------- */

type Lattice = {
  evidence: Placed<{ id: string; title: string; citationKey: string }>[];
  briefs: Placed<ImpactMap["briefs"][number]>[];
  outcomes: Placed<ImpactMap["outcomes"][number]>[];
  lines: MapLine[];
  sentences: { key: string; text: string }[];
  innerHeight: number;
};

function buildLattice(map: ImpactMap): Lattice {
  const briefById = new Map(map.briefs.map((brief) => [brief.id, brief]));
  const evidenceById = new Map(map.evidence.map((item) => [item.id, item]));

  // Only briefs an outcome names get a node, in the order their first outcome
  // was recorded — so the lattice reads top-left to bottom-right by date.
  const briefOrder: string[] = [];
  for (const outcome of map.outcomes) {
    if (!briefOrder.includes(outcome.briefId)) briefOrder.push(outcome.briefId);
  }

  const evidenceForBrief = new Map<string, string[]>();
  for (const link of map.links) {
    const existing = evidenceForBrief.get(link.briefId);

    if (existing) {
      if (!existing.includes(link.evidenceId)) existing.push(link.evidenceId);
      continue;
    }

    evidenceForBrief.set(link.briefId, [link.evidenceId]);
  }

  const evidenceOrder: string[] = [];
  for (const briefId of briefOrder) {
    for (const evidenceId of evidenceForBrief.get(briefId) ?? []) {
      if (!evidenceOrder.includes(evidenceId)) evidenceOrder.push(evidenceId);
    }
  }

  const innerHeight = Math.max(
    MIN_INNER_HEIGHT,
    Math.max(evidenceOrder.length, briefOrder.length, map.outcomes.length) *
      (NODE_HEIGHT + ROW_GAP) -
      ROW_GAP,
  );

  const yFor = (index: number, count: number) =>
    CONTENT_TOP +
    (innerHeight * (index + 0.5)) / Math.max(count, 1) -
    NODE_HEIGHT / 2;

  const evidence = evidenceOrder.flatMap((id, index) => {
    const item = evidenceById.get(id);

    return item
      ? [{ ...item, x: COLUMN_X[0], y: yFor(index, evidenceOrder.length) }]
      : [];
  });

  const briefs = briefOrder.flatMap((id, index) => {
    const brief = briefById.get(id);

    return brief
      ? [{ ...brief, x: COLUMN_X[1], y: yFor(index, briefOrder.length) }]
      : [];
  });

  const outcomes = map.outcomes.map((outcome, index) => ({
    ...outcome,
    x: COLUMN_X[2],
    y: yFor(index, map.outcomes.length),
  }));

  const centreOf = new Map<string, number>();
  for (const node of [...evidence, ...briefs, ...outcomes]) {
    centreOf.set(node.id, node.y + NODE_HEIGHT / 2);
  }

  /**
   * A brief's own line state. A brief carrying any confirmed outcome draws its
   * evidence side solid; otherwise it stays dashed, and it is ordered by the
   * earliest outcome of that same kind so the draw follows the citation dates.
   */
  const briefState = new Map<string, { verified: boolean; order: number }>();
  for (const outcome of map.outcomes) {
    const at = Date.parse(outcome.detectedAt);
    const existing = briefState.get(outcome.briefId);

    if (!existing) {
      briefState.set(outcome.briefId, { verified: outcome.verified, order: at });
      continue;
    }

    if (outcome.verified && !existing.verified) {
      briefState.set(outcome.briefId, { verified: true, order: at });
      continue;
    }

    if (outcome.verified === existing.verified && at < existing.order) {
      existing.order = at;
    }
  }

  const lines: MapLine[] = [];

  for (const briefId of briefOrder) {
    const state = briefState.get(briefId);
    const briefCentre = centreOf.get(briefId);

    if (!state || briefCentre === undefined) continue;

    for (const evidenceId of evidenceForBrief.get(briefId) ?? []) {
      const evidenceCentre = centreOf.get(evidenceId);

      if (evidenceCentre === undefined) continue;

      lines.push({
        key: `${evidenceId}->${briefId}`,
        d: curve(
          COLUMN_X[0] + COLUMN_WIDTH,
          evidenceCentre,
          COLUMN_X[1],
          briefCentre,
        ),
        verified: state.verified,
        order: state.order,
      });
    }
  }

  for (const outcome of outcomes) {
    const briefCentre = centreOf.get(outcome.briefId);

    if (briefCentre === undefined) continue;

    lines.push({
      key: `${outcome.briefId}->${outcome.id}`,
      d: curve(
        COLUMN_X[1] + COLUMN_WIDTH,
        briefCentre,
        COLUMN_X[2],
        outcome.y + NODE_HEIGHT / 2,
      ),
      verified: outcome.verified,
      order: Date.parse(outcome.detectedAt),
    });
  }

  // Confirmed paths first, in citation-date order; the unconfirmed dashed ones
  // draw last (the handoff's motion table).
  lines.sort(
    (left, right) =>
      Number(right.verified) - Number(left.verified) ||
      left.order - right.order ||
      left.key.localeCompare(right.key),
  );

  return {
    evidence,
    briefs,
    outcomes,
    lines,
    innerHeight,
    sentences: map.outcomes.map((outcome) => {
      const brief = briefById.get(outcome.briefId);
      const cited = (evidenceForBrief.get(outcome.briefId) ?? []).flatMap(
        (id) => {
          const item = evidenceById.get(id);

          return item ? [`${item.title} (${item.citationKey})`] : [];
        },
      );

      // NEVER DROPPED AND NEVER PADDED. An outcome whose brief has no recorded
      // evidence set draws brief → outcome only, and says so in words rather
      // than inventing an evidence node to make the picture symmetrical.
      const evidenceClause =
        cited.length > 0
          ? `Evidence cited: ${cited.join("; ")}.`
          : `Evidence: ${IMPACT_MAP_COPY.noEvidenceRecorded}.`;

      return {
        key: outcome.id,
        text: `${INFLUENCE_EVENT_TYPE_LABELS[outcome.eventType]}${
          outcome.sourceTitle ? ` — ${outcome.sourceTitle}` : ""
        }, recorded ${formatInfluenceDate(outcome.detectedAt)}. ${
          outcome.verified
            ? "Confirmed by the Programme Director."
            : "Not yet confirmed."
        } Brief: ${brief?.title ?? "Untitled brief"}. ${evidenceClause}`,
      };
    }),
  };
}

/** A DOM-safe id for one path's reveal mask. One map per page, so this is stable. */
function maskId(key: string): string {
  return `impact-reveal-${key.replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** A gentle cubic between two column edges — never a straight diagonal. */
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const handle = (x2 - x1) * 0.5;

  return `M ${x1} ${y1} C ${x1 + handle} ${y1}, ${x2 - handle} ${y2}, ${x2} ${y2}`;
}

function clampText(text: string, max: number): string {
  const trimmed = text.trim();

  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}
