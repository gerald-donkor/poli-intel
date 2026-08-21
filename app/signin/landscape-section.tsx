import { MapPin } from "lucide-react";

import { ContourField } from "./contour-field";
import { LandscapeLocator } from "./landscape-locator";

// `value` is what the server renders and what a visitor without JavaScript
// sees. `countTo` and `suffix` only tell the motion layer where to count from
// and to — the number on screen is never produced by the tween alone.
const LANDSCAPE_STATS = [
  {
    value: "2",
    countTo: 2,
    suffix: "",
    label: "Core Landscapes",
    detail: "Juabeso-Bia & Sefwi-Wiawso",
  },
  {
    value: "14+",
    countTo: 14,
    suffix: "+",
    label: "CREMA Partners",
    detail: "Community Forest Governance",
  },
  {
    value: "10",
    countTo: 10,
    suffix: "",
    label: "Network Countries",
    detail: "Tropenbos International",
  },
  {
    value: "100%",
    countTo: 100,
    suffix: "%",
    label: "Data Consented",
    detail: "Protected Field Evidence",
  },
];

const LANDSCAPES = [
  {
    name: "Juabeso-Bia Landscape",
    description:
      "Focal landscape for cocoa agroforestry, tree tenure registration, and CREMA biodiversity corridors. Home to empirical research supporting national EUDR traceability mechanisms.",
    tags: ["Cocoa Agroforestry", "Tree Tenure Reform"],
  },
  {
    name: "Sefwi-Wiawso Landscape",
    description:
      "Centre for community forest management, wildfire prevention, and degraded land restoration. Focuses on smallholder resilience, VSLAs, and youth capacity building.",
    tags: ["Community Forests", "Wildfire Prevention"],
  },
];

export function LandscapeSection() {
  return (
    <section
      data-anim="landscape"
      className="mx-auto w-full max-w-[1440px] px-4 py-12 tablet:px-8 tablet:py-16"
    >
      <div className="relative isolate overflow-hidden rounded-card border border-line bg-card p-6 shadow-raised tablet:p-10 laptop:p-12">
        {/* Topographic wash behind the card. Decorative and inert (§11.7). */}
        <ContourField className="pointer-events-none absolute -bottom-40 -left-24 -z-10 h-[520px] w-[720px] text-sage/40 [mask-image:radial-gradient(60%_60%_at_35%_60%,black,transparent_100%)]" />

        <div className="grid grid-cols-1 gap-8 laptop:grid-cols-12 laptop:gap-12">
          {/* Left Column: Institutional Quote & Thesis */}
          <div className="flex flex-col justify-between gap-6 laptop:col-span-7">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-meta font-semibold uppercase text-primary">
                  Landscape Grounding
                </span>
                <span className="text-meta text-line">/</span>
                <span className="text-meta text-ink-3">
                  Western North Region
                </span>
              </div>

              {/* Verbatim institutional language — Source Serif 4, per §11.6.
                  The serif is reserved for quoted material only. */}
              <blockquote
                data-anim="landscape-quote"
                className="split-heading font-serif text-[18px] leading-relaxed text-ink italic tablet:text-[22px] tablet:leading-snug">
                &ldquo;The future of tropical forests is locally owned. Better
                policies inform better practices when national regulations
                reflect the lived reality of smallholder farmers and community
                forest governance.&rdquo;
              </blockquote>

              <div className="flex flex-wrap items-center gap-2 pt-2 text-meta text-ink-3">
                <span className="font-medium text-ink">
                  Tropenbos Ghana &amp; Tropenbos International
                </span>
                <span>·</span>
                <span>Kumasi, Ghana</span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div
              data-anim="landscape-stats"
              className="grid grid-cols-2 gap-3 border-t border-line pt-6 tablet:grid-cols-4"
            >
              {LANDSCAPE_STATS.map((stat) => (
                <div key={stat.label}>
                  <div
                    data-anim="counter"
                    data-count-to={stat.countTo}
                    data-count-suffix={stat.suffix}
                    className="font-mono text-h2 font-semibold text-primary"
                  >
                    {stat.value}
                  </div>
                  <div className="text-meta font-medium text-ink">
                    {stat.label}
                  </div>
                  <p className="text-meta text-ink-3">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: The Two Landscapes */}
          <div className="flex flex-col gap-4 laptop:col-span-5">
            <div
              data-anim="locator"
              className="rounded-card border border-line bg-paper p-4"
            >
              <LandscapeLocator className="pointer-events-none h-auto w-full text-ink-2" />
            </div>

            {LANDSCAPES.map((landscape) => (
              <div
                key={landscape.name}
                className="rounded-card border border-line bg-paper p-5"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-primary" />
                  <h3 className="text-h3 font-semibold text-ink">
                    {landscape.name}
                  </h3>
                </div>
                <p className="mt-2 text-body leading-relaxed text-ink-2">
                  {landscape.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-meta text-ink-3">
                  {landscape.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-line bg-stone px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
