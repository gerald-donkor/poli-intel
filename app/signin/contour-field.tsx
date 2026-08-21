/**
 * Topographic contour wash — a decorative backdrop for the hero and the
 * landscape card.
 *
 * Abstract structural mark only: concentric contour rings echoing a
 * topographic map (AGENTS.md §11.7, handoff "Iconography"). No leaf, no tree,
 * no terrain illustration, no raster asset. Inline SVG, so there is no network
 * request, no layout shift, and it stays crisp at every density.
 *
 * Every stroke is `currentColor`, so the caller sets the tone with a text
 * colour token (`text-sage`, `text-line`) rather than a hard-coded hex.
 */

// One irregular closed contour, redrawn at descending scales about the centre
// of the viewBox. Scales are literals rather than computed values so server and
// client render byte-identical markup.
const CONTOUR = [
  "M36 214",
  "C68 140 150 92 240 96",
  "C334 100 408 134 474 180",
  "C524 215 560 248 556 278",
  "C552 310 498 332 420 338",
  "C328 345 230 331 150 303",
  "C72 276 18 250 36 214",
  "Z",
].join(" ");

const SCALES = [1, 0.87, 0.75, 0.64, 0.54, 0.45, 0.37, 0.29, 0.22, 0.15];

const CENTRE_X = 300;
const CENTRE_Y = 216;

export function ContourField({
  className,
  "data-anim": dataAnim,
}: {
  className?: string;
  "data-anim"?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      data-anim={dataAnim}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="round">
        {SCALES.map((scale) => (
          <path
            key={scale}
            d={CONTOUR}
            transform={`translate(${CENTRE_X} ${CENTRE_Y}) scale(${scale}) translate(${-CENTRE_X} ${-CENTRE_Y})`}
          />
        ))}
      </g>
    </svg>
  );
}
