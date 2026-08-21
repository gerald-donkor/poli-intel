/**
 * Schematic locator for the two operational landscapes.
 *
 * Abstract geometry only (AGENTS.md §11.7): concentric contour rings, two node
 * markers, a thin connector. Deliberately *not* an outline of Ghana or of the
 * Western North Region — this repository holds no licensed map data, and a
 * traced boundary would be both a rights problem and the terrain illustration
 * the design rules exclude.
 *
 * Decorative and inert: `aria-hidden`, no pointer events. The section's own
 * cards name both landscapes in real text, so nothing here is the only source
 * of that information.
 */
const RING_RADII = [26, 52, 78, 104];

const JUABESO = { cx: 188, cy: 86 };
const SEFWI = { cx: 268, cy: 158 };

export function LandscapeLocator({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 460 260"
      className={className}
    >
      {/* Contour rings */}
      <g fill="none" strokeWidth={1} className="stroke-sage">
        {RING_RADII.map((r) => (
          <circle key={r} cx={230} cy={120} r={r} />
        ))}
      </g>

      {/* Connector between the two landscapes */}
      <path
        d={`M${JUABESO.cx} ${JUABESO.cy} C ${JUABESO.cx + 26} ${JUABESO.cy + 30} ${SEFWI.cx - 26} ${SEFWI.cy - 30} ${SEFWI.cx} ${SEFWI.cy}`}
        fill="none"
        strokeWidth={1.25}
        className="stroke-accent"
      />

      {/* Leader lines */}
      <g fill="none" strokeWidth={1} className="stroke-line">
        <path d={`M${JUABESO.cx} ${JUABESO.cy} L 128 44 L 110 44`} />
        <path d={`M${SEFWI.cx} ${SEFWI.cy} L 330 206 L 348 206`} />
      </g>

      {/* Node markers */}
      <g strokeWidth={1.5}>
        <circle
          cx={JUABESO.cx}
          cy={JUABESO.cy}
          r={5.5}
          className="fill-card stroke-primary"
        />
        <circle
          cx={SEFWI.cx}
          cy={SEFWI.cy}
          r={5.5}
          className="fill-card stroke-primary"
        />
      </g>

      {/* Labels. The serif stays quotation-only (§11.6) — these are mono, the
          data family. */}
      <g className="fill-ink-2 font-mono" fontSize={13}>
        <text x={104} y={48} textAnchor="end">
          Juabeso-Bia
        </text>
        <text x={354} y={210} textAnchor="start">
          Sefwi-Wiawso
        </text>
      </g>
    </svg>
  );
}
