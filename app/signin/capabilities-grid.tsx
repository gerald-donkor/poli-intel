import {
  Radio,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";

const CAPABILITIES = [
  {
    icon: Radio,
    tag: "Continuous Monitoring",
    title: "Policy Radar & Urgency Ramp",
    description:
      "Automated radar tracks Ghana Forestry Commission gazettes, Parliamentary bills, EUDR trade directives, and global climate conferences, classifying windows into a 4-tier urgency ramp.",
    highlights: ["4-Tier Urgency Classification", "Morning Digest Email", "Window Tracking"],
  },
  {
    icon: ShieldCheck,
    tag: "Governance Firewall",
    title: "Three-Way Classified Evidence",
    description:
      "A hard classification gate enforces that only peer-reviewed, verified, and community-consented evidence enters the AI pipeline, protecting local farmers and community ownership.",
    highlights: ["pgvector Semantic Retrieval", "Zero-Retention AI Gate", "Landscape Provenance"],
  },
  {
    icon: Users,
    tag: "Multi-Stakeholder Voice",
    title: "Five-Audience Reframing Engine",
    description:
      "Reframe the same verified evidence instantly for Ministries, Parliamentary Committees, CREMA leadership, Cocoa Agribusiness, and Donors with audience-tailored argumentation.",
    highlights: ["One-Click Reframing", "Twi Translation Assist", "Export to Word & PDF"],
  },
  {
    icon: Smartphone,
    tag: "Field Telemetry",
    title: "Field Officer Mobile Bridge",
    description:
      "A lightweight, offline-first mobile interface allows landscape officers in Juabeso-Bia and Sefwi-Wiawso to log field observations, sync data, and access briefs with low bandwidth.",
    highlights: ["Offline-Ready Queue", "WhatsApp Digest", "USSD Observation Fallback"],
  },
];

export function CapabilitiesGrid() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-12 tablet:px-8 tablet:py-16">
      <div className="flex flex-col gap-8">
        {/* Section Heading */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-meta font-semibold uppercase tracking-wider text-primary">
              Core Capabilities
            </span>
            <span className="text-line text-meta">/</span>
            <span className="text-meta text-ink-3">Institutional Architecture</span>
          </div>
          <h2 className="text-h1 font-semibold text-ink tablet:text-display">
            Built for Evidence-Based Policy Influence
          </h2>
          <p className="max-w-[720px] text-body text-ink-2">
            Every module in EviBrief is engineered specifically for Tropenbos
            Ghana’s mandate: bridging the gap between local landscape reality and
            national policy formulation.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 laptop:grid-cols-4">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="flex flex-col justify-between rounded-card border border-line bg-card p-6 shadow-raised transition-all duration-150 hover:border-accent/40"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-card border border-surface-tint-border bg-surface-tint text-primary">
                      <Icon className="size-5" />
                    </div>
                    <span className="font-mono text-meta font-medium text-ink-3">
                      {cap.tag}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-h3 font-semibold text-ink">
                      {cap.title}
                    </h3>
                    <p className="text-body leading-relaxed text-ink-2">
                      {cap.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-1.5 border-t border-line/60 pt-4">
                  {cap.highlights.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 text-meta text-ink-3"
                    >
                      <span className="size-1 rounded-full bg-accent" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
