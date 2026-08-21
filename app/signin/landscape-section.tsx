import { MapPin } from "lucide-react";

export function LandscapeSection() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-12 tablet:px-8 tablet:py-16">
      <div className="rounded-card border border-line bg-card p-6 shadow-raised tablet:p-10 laptop:p-12">
        <div className="grid grid-cols-1 gap-8 laptop:grid-cols-12 laptop:gap-12">
          {/* Left Column: Institutional Quote & Thesis */}
          <div className="flex flex-col justify-between gap-6 laptop:col-span-7">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-meta font-semibold uppercase tracking-wider text-primary">
                  Landscape Grounding
                </span>
                <span className="text-line text-meta">/</span>
                <span className="text-meta text-ink-3">Western North Region</span>
              </div>

              {/* Research Quote in Source Serif 4 strictly adhering to AGENTS.md §11.6 */}
              <blockquote className="font-serif italic text-[18px] leading-relaxed text-ink tablet:text-[22px] tablet:leading-snug">
                &ldquo;The future of tropical forests is locally owned. Better
                policies inform better practices when national regulations
                reflect the lived reality of smallholder farmers and community
                forest governance.&rdquo;
              </blockquote>

              <div className="flex items-center gap-2 pt-2 text-meta text-ink-3">
                <span className="font-medium text-ink">
                  Tropenbos Ghana & Tropenbos International
                </span>
                <span>·</span>
                <span>Kumasi, Ghana</span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-6 tablet:grid-cols-4">
              <div>
                <div className="font-mono text-h2 font-semibold text-primary">
                  2
                </div>
                <div className="text-meta font-medium text-ink text-[12px]">
                  Core Landscapes
                </div>
                <p className="text-meta text-ink-3 text-[11px]">
                  Juabeso-Bia & Sefwi-Wiawso
                </p>
              </div>

              <div>
                <div className="font-mono text-h2 font-semibold text-primary">
                  14+
                </div>
                <div className="text-meta font-medium text-ink text-[12px]">
                  CREMA Partners
                </div>
                <p className="text-meta text-ink-3 text-[11px]">
                  Community Forest Governance
                </p>
              </div>

              <div>
                <div className="font-mono text-h2 font-semibold text-primary">
                  10
                </div>
                <div className="text-meta font-medium text-ink text-[12px]">
                  Network Countries
                </div>
                <p className="text-meta text-ink-3 text-[11px]">
                  Tropenbos International
                </p>
              </div>

              <div>
                <div className="font-mono text-h2 font-semibold text-primary">
                  100%
                </div>
                <div className="text-meta font-medium text-ink text-[12px]">
                  Data Consented
                </div>
                <p className="text-meta text-ink-3 text-[11px]">
                  Protected Field Evidence
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: The Two Landscapes */}
          <div className="flex flex-col gap-4 laptop:col-span-5">
            <div className="rounded-card border border-line bg-paper p-5">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary shrink-0" />
                <h3 className="text-body font-semibold text-ink text-[15px]">
                  Juabeso-Bia Landscape
                </h3>
              </div>
              <p className="mt-2 text-body text-ink-2 text-[13px] leading-relaxed">
                Focal landscape for cocoa agroforestry, tree tenure registration,
                and CREMA biodiversity corridors. Home to empirical research
                supporting national EUDR traceability mechanisms.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[11px] text-ink-3">
                <span className="rounded bg-stone px-2 py-0.5 border border-line">
                  Cocoa Agroforestry
                </span>
                <span className="rounded bg-stone px-2 py-0.5 border border-line">
                  Tree Tenure Reform
                </span>
              </div>
            </div>

            <div className="rounded-card border border-line bg-paper p-5">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary shrink-0" />
                <h3 className="text-body font-semibold text-ink text-[15px]">
                  Sefwi-Wiawso Landscape
                </h3>
              </div>
              <p className="mt-2 text-body text-ink-2 text-[13px] leading-relaxed">
                Center for community forest management, wildfire prevention, and
                degraded land restoration. Focuses on smallholder resilience,
                VSLAs, and youth capacity building.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[11px] text-ink-3">
                <span className="rounded bg-stone px-2 py-0.5 border border-line">
                  Community Forests
                </span>
                <span className="rounded bg-stone px-2 py-0.5 border border-line">
                  Wildfire Prevention
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
