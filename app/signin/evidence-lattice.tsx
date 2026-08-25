/**
 * Evidence → Brief → Outcome lattice.
 *
 * Deliberately mirrors the impact map's visual grammar from the handoff's
 * component table — three-column lattice, solid accent links for traceable
 * paths, a dashed sage link for the gap case — so the landing page previews the
 * product's real language instead of inventing a second one.
 *
 * Abstract structural marks only (AGENTS.md §11.7): thin-stroke circles and
 * concentric rings. Decorative and inert — `aria-hidden`, no text, no pointer
 * events. The section's own prose carries the meaning for a screen reader.
 */
const EVIDENCE_NODES = [
  { cx: 44, cy: 44 },
  { cx: 44, cy: 120 },
  { cx: 44, cy: 196 },
];

const OUTCOME_NODES = [
  { cx: 316, cy: 82 },
  { cx: 316, cy: 158 },
];

// Solid links: evidence that cleared the classification gate, and the two
// outcomes the drafted brief traces to.
const TRACED_LINKS = [
  "M56 44 C110 44 128 120 168 120",
  "M56 120 C104 120 120 120 168 120",
  "M192 120 C232 120 250 82 304 82",
  "M192 120 C232 120 250 158 304 158",
];

// Dashed link: the evidence gap. Drawn in sage, never accent — the product
// states a gap explicitly rather than papering over it (AGENTS.md §15).
const GAP_LINK = "M56 196 C110 196 128 120 168 120";

export function EvidenceLattice({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 360 240"
      className={className}
    >
      {/* Underlying base tracks so structural topology remains visible */}
      <g fill="none" strokeWidth={1.25}>
        {TRACED_LINKS.map((d) => (
          <path
            key={`base-${d}`}
            d={d}
            data-anim="lattice-base"
            stroke="currentColor"
            strokeWidth={1.25}
            className="stroke-accent/30"
          />
        ))}
        <path
          d={GAP_LINK}
          data-anim="lattice-gap"
          stroke="currentColor"
          strokeWidth={1.25}
          className="stroke-sage"
          strokeDasharray="4 4"
        />
      </g>

      {/* Active continuous flowing green paths */}
      <g fill="none" strokeLinecap="round">
        {TRACED_LINKS.map((d) => (
          <path
            key={`flow-${d}`}
            d={d}
            data-anim="lattice-flow"
            pathLength="100"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="16 34"
            className="stroke-accent opacity-90"
          />
        ))}
      </g>

      <g fill="none" strokeWidth={1.25}>
        {EVIDENCE_NODES.map((node) => (
          <circle
            key={`evidence-${node.cy}`}
            cx={node.cx}
            cy={node.cy}
            r={7}
            className="fill-card stroke-primary"
          />
        ))}

        {/* Brief: concentric rings, the topographic mark the design system
            reserves for the product's own centre of gravity. */}
        <circle cx={180} cy={120} r={12} className="fill-card stroke-primary" />
        <circle
          cx={180}
          cy={120}
          r={19}
          data-anim="lattice-hub-pulse"
          className="stroke-accent/50"
        />
        <circle cx={180} cy={120} r={3} className="fill-primary stroke-none" />

        {OUTCOME_NODES.map((node) => (
          <rect
            key={`outcome-${node.cy}`}
            x={node.cx - 7}
            y={node.cy - 7}
            width={14}
            height={14}
            rx={1.5}
            className="fill-card stroke-primary"
          />
        ))}
      </g>
    </svg>
  );
}
