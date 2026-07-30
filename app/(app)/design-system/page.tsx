import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const metadata = {
  title: "Design system · EviBrief",
};

// Developer surface, not a product feature: it carries no nav link and exists so
// a token, a colour pairing, or a keyframe can be checked in one place. All copy
// here is synthetic and obviously so — no Tropenbos content of any
// classification is used as filler.

const BRAND = [
  { name: "primary", hex: "#0F6E56", className: "bg-primary" },
  { name: "accent", hex: "#1D9E75", className: "bg-accent" },
  { name: "surface-tint", hex: "#E1F5EE", className: "bg-surface-tint" },
  {
    name: "surface-tint-border",
    hex: "#BFDFD3",
    className: "bg-surface-tint-border",
  },
  { name: "surface-tint-ink", hex: "#1A5A49", className: "bg-surface-tint-ink" },
  { name: "primary-hover", hex: "#0B5644", className: "bg-primary-hover" },
];

const NEUTRALS = [
  { name: "paper", hex: "#F7F5F0", className: "bg-paper" },
  { name: "card", hex: "#FDFCF9", className: "bg-card" },
  { name: "stone", hex: "#EFECE4", className: "bg-stone" },
  { name: "line", hex: "#E4E1D8", className: "bg-line" },
  { name: "sage", hex: "#C3D2C8", className: "bg-sage" },
  { name: "ink", hex: "#2C2C2A", className: "bg-ink" },
  { name: "ink-2", hex: "#444441", className: "bg-ink-2" },
  { name: "ink-3", hex: "#6B6B66", className: "bg-ink-3" },
  { name: "ink-disabled", hex: "#8E8B84", className: "bg-ink-disabled" },
];

// Order carries the taxonomy — warm to cool. Never remap fill to meaning
// outside this order, and never red/amber/green (AGENTS.md §11.4).
const URGENCY = [
  {
    stage: "Immediate",
    window: "Window under 4 weeks",
    rule: "border-l-immediate",
    eyebrow: "text-immediate",
    surface: "bg-immediate-surface",
    border: "border-immediate-border",
    ink: "text-immediate-ink",
    hexes: "#8A6032 · #5E4020 · #F3EBE0 · #E0D2BE",
  },
  {
    stage: "Near-term",
    window: "1–3 months",
    rule: "border-l-nearterm",
    eyebrow: "text-nearterm",
    surface: "bg-nearterm-surface",
    border: "border-nearterm-border",
    ink: "text-nearterm-ink",
    hexes: "#67743C · #454E24 · #EDEFE1 · #D6DBC2",
  },
  {
    stage: "Horizon",
    window: "3–6 months",
    rule: "border-l-horizon",
    eyebrow: "text-horizon",
    surface: "bg-horizon-surface",
    border: "border-horizon-border",
    ink: "text-horizon-ink",
    hexes: "#0F6E56 · #0B5644 · #E1F5EE · #BFDFD3",
  },
  {
    stage: "Watch",
    window: "Over 6 months",
    rule: "border-l-watch",
    eyebrow: "text-watch",
    surface: "bg-watch-surface",
    border: "border-watch-border",
    ink: "text-watch-ink",
    hexes: "#496375 · #33495A · #E7EDF2 · #C6D4DF",
  },
];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-ink font-semibold">{title}</h2>
        {note ? <p className="text-ink-3 text-[13px]">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({
  name,
  hex,
  className,
}: {
  name: string;
  hex: string;
  className: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`${className} border-line rounded-card h-14 w-full border`}
      />
      <div className="flex flex-col">
        <span className="text-ink text-[13px] font-medium">{name}</span>
        <span className="text-ink-3 font-mono text-[11.5px]">{hex}</span>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <>
      <PageHeader
        title="Design system"
        subtitle="Token specimen sheet. Developer surface — not linked from the nav."
      />

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-6 py-8">
        <Section title="Brand" note="Tropenbos palette, extended by the handoff's warm neutrals.">
          <div className="grid grid-cols-2 gap-4 tablet:grid-cols-3 desktop:grid-cols-6">
            {BRAND.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </Section>

        <Section
          title="Neutrals"
          note="Warm throughout. There is no clinical white anywhere in the product."
        >
          <div className="grid grid-cols-2 gap-4 tablet:grid-cols-3 desktop:grid-cols-5">
            {NEUTRALS.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </Section>

        <Section
          title="Urgency ramp"
          note="Warm to cool, in this fixed order. Carried by a card's left rule and eyebrow only — never a filled card background."
        >
          <div className="grid gap-4 grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4">
            {URGENCY.map((stage) => (
              <div
                key={stage.stage}
                className={`bg-card rounded-card shadow-raised border border-l-[3px] p-3.5 ${stage.border} ${stage.rule}`}
              >
                <p
                  className={`text-[10.5px] font-semibold tracking-[0.06em] uppercase ${stage.eyebrow}`}
                >
                  {stage.stage}
                </p>
                <p className="text-ink mt-1.5 text-[14px] leading-[1.4] font-semibold">
                  {stage.window}
                </p>
                <div
                  className={`mt-2.5 rounded-card border px-2 py-1 ${stage.surface} ${stage.border} ${stage.ink}`}
                >
                  <span className="text-[11.5px] font-semibold">
                    Surface, border, ink
                  </span>
                </div>
                <p className="text-ink-3 mt-2 font-mono text-[11px]">
                  {stage.hexes}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Relevance"
          note="Independent of urgency — it never shares that ramp. Always paired with a number, never colour alone."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Core</Badge>
            <Badge className="bg-surface-tint text-primary-ink border-surface-tint-border">
              Adjacent
            </Badge>
            <Badge variant="secondary" className="border-line">
              Background
            </Badge>
            <span className="text-ink-3 font-mono text-[11.5px]">0.82</span>
            <div className="bg-stone h-[3px] w-24">
              <div className="bg-primary h-full w-[82%]" />
            </div>
          </div>
        </Section>

        <Section
          title="Governance glyphs"
          note="Shape carries the meaning, not colour: a circle is a review flag, a square is a governance hold. Distinguishable with colour ignored."
        >
          <div className="grid gap-4 tablet:grid-cols-2">
            <div className="bg-watch-surface border-watch-border rounded-card text-watch-ink flex items-start gap-2.5 border p-4">
              <span
                aria-hidden="true"
                className="border-watch mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2"
              >
                <span className="bg-watch size-1.5 rounded-full" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-[13px] font-semibold">
                  Review flag — circle
                </p>
                <p className="text-[13px]">
                  A claim awaiting a person&apos;s review. Slate, never red.
                </p>
              </div>
            </div>
            <div className="bg-immediate-surface border-immediate-border rounded-card text-immediate-ink flex items-start gap-2.5 border p-4">
              <span
                aria-hidden="true"
                className="border-immediate mt-0.5 size-4 shrink-0 rounded-[2px] border-2"
              />
              <div className="flex flex-col gap-1">
                <p className="text-[13px] font-semibold">
                  Governance hold — square
                </p>
                <p className="text-[13px]">
                  Evidence awaiting review, held out of the pipeline entirely.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-immediate-surface border-immediate-border text-immediate-ink inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold">
              <span
                aria-hidden="true"
                className="border-immediate size-2.5 rounded-[1px] border-2"
              />
              6 awaiting review
            </span>
            <span className="bg-surface-tint border-surface-tint-border text-primary-ink inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold">
              <span
                aria-hidden="true"
                className="bg-accent size-[5px] rounded-full"
              />
              Citation chip — verified
            </span>
            <span className="bg-surface-tint border-surface-tint-border text-primary-ink inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold">
              <span
                aria-hidden="true"
                className="border-watch size-[5px] rounded-full border"
              />
              Citation chip — unverified
            </span>
          </div>
        </Section>

        <Section
          title="Typography"
          note="Inter is the product's own voice. Source Serif 4 is quoted or verbatim material only. IBM Plex Mono is data. This distinction is load-bearing."
        >
          <div className="bg-card border-line rounded-card flex flex-col gap-4 border p-6">
            <p className="text-display text-ink font-semibold">
              Display — 32px Inter
            </p>
            <p className="text-h1 text-ink font-semibold">H1 — 24px Inter</p>
            <p className="text-h2 text-ink font-semibold">H2 — 20px Inter</p>
            <p className="text-h3 text-ink font-semibold">H3 — 16px Inter</p>
            <p className="text-body text-ink">
              Body — 14px Inter. Drafted prose is always set in the sans; this
              sample is placeholder text standing in for generated output.
            </p>
            <p className="text-meta text-ink-3 font-semibold uppercase">
              Meta / eyebrow — 12px Inter
            </p>
            <blockquote className="font-serif text-quote text-ink border-accent border-l-2 pl-4">
              Quote — 16px Source Serif 4. Only quoted or verbatim material is
              set in the serif; this stands in for a source excerpt.
              <footer className="text-ink-3 mt-2 text-[11.5px] not-italic">
                Placeholder attribution,{" "}
                <cite className="font-serif italic">Specimen Source</cite>
              </footer>
            </blockquote>
            <p className="text-ink-3 font-mono text-[11.5px]">
              Mono — IBM Plex Mono · EV-0000-000 · 0.82 · 15:00 GMT
            </p>
          </div>
        </Section>

        <Section
          title="Elevation and radius"
          note="Borders before shadows, three steps only. Radius: 3px inputs, 6px cards, 10px modals, full for pills."
        >
          <div className="grid gap-4 tablet:grid-cols-3">
            <div className="bg-card border-line rounded-card border p-4">
              <p className="text-ink text-[13px] font-semibold">Flat</p>
              <p className="text-ink-3 font-mono text-[11.5px]">border only</p>
            </div>
            <div className="bg-card border-line rounded-card shadow-raised border p-4">
              <p className="text-ink text-[13px] font-semibold">Raised</p>
              <p className="text-ink-3 font-mono text-[11.5px]">
                shadow-raised
              </p>
            </div>
            <div className="bg-card border-line rounded-modal shadow-overlay border p-4">
              <p className="text-ink text-[13px] font-semibold">Overlay</p>
              <p className="text-ink-3 font-mono text-[11.5px]">
                shadow-overlay
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {[
              { label: "rounded-input · 3px", cls: "rounded-input" },
              { label: "rounded-card · 6px", cls: "rounded-card" },
              { label: "rounded-modal · 10px", cls: "rounded-modal" },
              { label: "rounded-full · pills", cls: "rounded-full" },
            ].map((r) => (
              <div key={r.cls} className="flex flex-col gap-1.5">
                <div
                  className={`bg-stone border-line size-16 border ${r.cls}`}
                />
                <span className="text-ink-3 font-mono text-[11px]">
                  {r.label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Controls"
          note="Buttons, and the invalid-input treatment. There is no red variant to reach for — invalid sits on the watch ramp."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button>Generate brief</Button>
            <Button variant="outline">Log a signal</Button>
            <Button variant="ghost">Cancel</Button>
            <Button disabled>Approve &amp; submit</Button>
            <span className="text-ink-3 text-[13px]">
              Blocked while a review flag is open.
            </span>
          </div>
          <div className="grid max-w-md gap-4 tablet:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="specimen-valid">Valid input</FieldLabel>
              <Input id="specimen-valid" defaultValue="Ahafo Ano North" />
            </Field>
            <Field data-invalid>
              <FieldLabel htmlFor="specimen-invalid">Invalid input</FieldLabel>
              <Input id="specimen-invalid" aria-invalid defaultValue="—" />
              <FieldDescription>
                Slate, not red — and never nothing.
              </FieldDescription>
            </Field>
          </div>
        </Section>

        <Section
          title="Guard flag"
          note="A review prompt, not an error. One 900ms pulse settling to a steady 2px underline — no blink, no loop, no alarm."
        >
          <Alert variant="guard">
            <AlertTitle className="text-[13px] font-semibold">
              Not traceable to a cited source
            </AlertTitle>
            <AlertDescription className="text-[13px]">
              <span className="bg-watch-surface border-watch animate-flag-pulse border-b-2">
                A placeholder sentence standing in for a flagged claim.
              </span>{" "}
              A person decides what happens next.
            </AlertDescription>
          </Alert>
          <Alert variant="pending">
            <AlertTitle className="text-[13px] font-semibold">
              Evidence awaiting review
            </AlertTitle>
            <AlertDescription className="text-[13px]">
              Untagged items default to the most restrictive setting and are held
              out of the AI pipeline entirely.
            </AlertDescription>
          </Alert>
        </Section>

        <Section
          title="Motion"
          note="Every keyframe in the product. The breath is the only loop; with reduce-motion on, all of these render in their settled state."
        >
          <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
            <div className="bg-card border-line rounded-card animate-rise-in border p-4">
              <p className="text-ink text-[13px] font-semibold">rise-in</p>
              <p className="text-ink-3 font-mono text-[11.5px]">240ms, once</p>
            </div>
            <div className="bg-watch-surface border-watch-border rounded-card animate-flag-pulse border p-4">
              <p className="text-watch-ink text-[13px] font-semibold">
                flag-pulse
              </p>
              <p className="text-watch-ink font-mono text-[11.5px]">
                900ms, once
              </p>
            </div>
            <div className="bg-card border-line rounded-card border p-4">
              <p className="text-ink animate-breathe text-[13px] font-semibold">
                breathe — Drafting
              </p>
              <p className="text-ink-3 font-mono text-[11.5px]">
                2s loop · the only one
              </p>
            </div>
            <div className="bg-card border-line rounded-card animate-slide-down border p-4">
              <p className="text-ink text-[13px] font-semibold">slide-down</p>
              <p className="text-ink-3 font-mono text-[11.5px]">200ms, once</p>
            </div>
          </div>
        </Section>

        <Section
          title="Breakpoints"
          note="Tailwind's defaults remain; these three are where these layouts actually break."
        >
          <p className="text-ink-3 font-mono text-[11.5px]">
            tablet 760px · laptop 1000px · desktop 1300px · frames cap at 1440px
            and centre
          </p>
        </Section>
      </div>
    </>
  );
}
