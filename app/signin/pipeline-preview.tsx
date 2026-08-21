"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Database,
  FileCheck,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceLattice } from "./evidence-lattice";

const STAGES = [
  {
    id: "radar",
    number: "01",
    label: "Policy Radar",
    subtitle: "Signal Detection & Urgency",
    icon: Radio,
  },
  {
    id: "evidence",
    number: "02",
    label: "Evidence Matcher",
    subtitle: "pgvector & Governance Gate",
    icon: Database,
  },
  {
    id: "brief",
    number: "03",
    label: "Brief & Guard",
    subtitle: "Audience Draft & Fact-Check",
    icon: FileCheck,
  },
] as const;

type StageId = (typeof STAGES)[number]["id"];

export function PipelinePreview() {
  const [activeStage, setActiveStage] = useState<StageId>("radar");
  const prefersReduced = useReducedMotion();

  const transition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.2, 0.7, 0.3, 1] as const };

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-12 tablet:px-8 tablet:py-16">
      <div className="flex flex-col gap-8">
        {/* Section Header */}
        <div className="grid grid-cols-1 items-center gap-8 laptop:grid-cols-12">
          <div className="flex flex-col gap-2 laptop:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-meta font-semibold uppercase text-primary">
                Traceability Pipeline
              </span>
              <span className="text-meta text-line">/</span>
              <span className="text-meta text-ink-3">End-to-End Workflow</span>
            </div>
            <h2 className="text-h1 font-semibold text-ink tablet:text-display">
              From Landscape Data to Policy Action
            </h2>
            <p className="max-w-[720px] text-body text-ink-2">
              Every brief produced in EviBrief maintains unbroken provenance
              back to classified field evidence. See how incoming policy signals
              are matched and drafted without hallucinations.
            </p>
          </div>

          {/* Evidence → Brief → Outcome lattice. Solid accent links are
              traceable paths; the dashed sage link is the evidence gap the
              product states rather than papers over. */}
          <div className="laptop:col-span-5">
            <EvidenceLattice className="pointer-events-none mx-auto h-auto w-full max-w-[420px]" />
          </div>
        </div>

        {/* Stage Selector Tabs */}
        <div
          role="tablist"
          aria-label="Pipeline Stages"
          className="grid grid-cols-1 gap-2 rounded-card border border-line bg-stone p-1.5 tablet:grid-cols-3"
        >
          {STAGES.map((stage) => {
            const isActive = activeStage === stage.id;
            const Icon = stage.icon;

            return (
              <button
                key={stage.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveStage(stage.id)}
                className={cn(
                  "relative flex items-center gap-3 rounded-card px-4 py-3 text-left transition-all duration-150 cursor-pointer",
                  isActive
                    ? "bg-card text-ink shadow-raised"
                    : "text-ink-3 hover:bg-card/50 hover:text-ink",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border",
                    isActive
                      ? "border-primary/20 bg-surface-tint text-primary"
                      : "border-line bg-paper text-ink-disabled",
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-meta font-semibold text-primary">
                      {stage.number}
                    </span>
                    <span className="truncate text-body font-semibold">
                      {stage.label}
                    </span>
                  </div>
                  <p className="truncate text-meta text-ink-3">
                    {stage.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stage Content Card with Animated Switch */}
        <div className="relative min-h-[380px] rounded-card border border-line bg-card p-6 shadow-raised tablet:p-8">
          <AnimatePresence mode="wait">
            {activeStage === "radar" && (
              <motion.div
                key="radar"
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
                transition={transition}
                className="flex flex-col gap-6"
              >
                {/* Stage 1: Radar Signal */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-nearterm-border bg-nearterm-surface px-2.5 py-0.5 font-mono text-meta font-semibold text-nearterm-ink">
                      <span className="size-1.5 rounded-full bg-nearterm-ink" />
                      Near-term (1–3 mo)
                    </span>
                    <span className="font-mono text-meta text-ink-3">
                      Signal #SIG-2024-GH-042
                    </span>
                  </div>
                  <span className="font-mono text-meta text-ink-disabled">
                    Detected: Forestry Commission Gazette
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 laptop:grid-cols-12">
                  <div className="flex flex-col gap-3 laptop:col-span-8">
                    <h3 className="text-h2 font-semibold text-ink">
                      EUDR Cocoa Traceability & Land Tenure Framework
                    </h3>
                    <p className="text-body text-ink-2 leading-relaxed">
                      Ghana Forestry Commission and Ministry of Lands & Natural
                      Resources announce technical guidelines on farm-level polygon
                      mapping and tenure certification ahead of the EUDR enforcement
                      deadline. Stakeholder submission window closes in 45 days.
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded border border-line bg-stone px-2 py-0.5 font-mono text-meta text-ink-2">
                        Western North Region
                      </span>
                      <span className="rounded border border-line bg-stone px-2 py-0.5 font-mono text-meta text-ink-2">
                        Cocoa Agroforestry
                      </span>
                      <span className="rounded border border-line bg-stone px-2 py-0.5 font-mono text-meta text-ink-2">
                        Tree Tenure Reform
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-card border border-line bg-stone/50 p-4 laptop:col-span-4">
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-meta font-semibold uppercase tracking-wider text-ink-3">
                        Target Audiences
                      </span>
                      <ul className="flex flex-col gap-1.5 text-body text-ink-2">
                        <li className="flex items-center gap-1.5">
                          <span className="size-1 rounded-full bg-primary" />
                          Ministry of Lands & Natural Resources
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="size-1 rounded-full bg-primary" />
                          Parliamentary Select Committee
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="size-1 rounded-full bg-primary" />
                          Juabeso-Bia & Sefwi CREMA Leaders
                        </li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveStage("evidence")}
                      className="mt-4 flex items-center justify-between rounded border border-surface-tint-border bg-surface-tint px-3 py-2 text-meta font-medium text-surface-tint-ink transition-colors hover:bg-surface-tint/80 cursor-pointer"
                    >
                      <span>Match Landscape Evidence</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeStage === "evidence" && (
              <motion.div
                key="evidence"
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
                transition={transition}
                className="flex flex-col gap-6"
              >
                {/* Stage 2: Evidence Matching */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-tint-border bg-surface-tint px-2.5 py-0.5 font-mono text-meta font-semibold text-surface-tint-ink">
                      <ShieldCheck className="size-3.5 text-primary" />
                      Classified Evidence · AI Eligible
                    </span>
                    <span className="font-mono text-meta text-ink-3">
                      Cosine Similarity: 0.892
                    </span>
                  </div>
                  <span className="font-mono text-meta text-ink-disabled">
                    Embedding: Gemini Embedding 2
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 laptop:grid-cols-12">
                  <div className="flex flex-col gap-3 laptop:col-span-8">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-stone px-2 py-0.5 font-mono text-meta font-semibold text-ink">
                        [TB-GH-2024-03]
                      </span>
                      <h3 className="text-h2 font-semibold text-ink">
                        Juabeso-Bia Agroforestry & Tenure Survey
                      </h3>
                    </div>
                    <p className="text-body text-ink-2 leading-relaxed">
                      Primary empirical survey across 12 CREMA communities in the
                      Juabeso-Bia landscape (Western North Region). Dataset covers 840
                      smallholder cocoa farming households and demonstrates that formal
                      tree registration increases compliance readiness from 23% to 87%.
                    </p>

                    {/* Classification metadata pills */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded border border-line bg-stone/40 p-3 text-meta text-ink-2">
                      <div>
                        <span className="text-ink-3">Source:</span>{" "}
                        <span className="font-medium text-ink">
                          Tropenbos Ghana Field Research
                        </span>
                      </div>
                      <span className="text-line">|</span>
                      <div>
                        <span className="text-ink-3">Landscape:</span>{" "}
                        <span className="font-medium text-ink">Juabeso-Bia</span>
                      </div>
                      <span className="text-line">|</span>
                      <div>
                        <span className="text-ink-3">Classification Gate:</span>{" "}
                        <span className="font-semibold text-primary">
                          Verified & Consented
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-card border border-line bg-stone/50 p-4 laptop:col-span-4">
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-meta font-semibold uppercase tracking-wider text-ink-3">
                        Governance Assertion
                      </span>
                      <p className="text-meta leading-relaxed text-ink-2">
                        Data passed all 3 classification gates: Data Ownership
                        verified, Community Consent confirmed, and Scientific Review
                        cleared.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveStage("brief")}
                      className="mt-4 flex items-center justify-between rounded border border-surface-tint-border bg-surface-tint px-3 py-2 text-meta font-medium text-surface-tint-ink transition-colors hover:bg-surface-tint/80 cursor-pointer"
                    >
                      <span>Draft Audience Brief</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeStage === "brief" && (
              <motion.div
                key="brief"
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
                transition={transition}
                className="flex flex-col gap-6"
              >
                {/* Stage 3: Brief Generation & Guard */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-watch-border bg-watch-surface px-2.5 py-0.5 font-mono text-meta font-medium text-watch-ink">
                      <span className="size-1.5 rounded-full bg-watch" />
                      Hallucination Guard: Cleared (100% Grounded)
                    </span>
                    <span className="font-mono text-meta text-ink-3">
                      Target: Ministry of Lands & Natural Resources
                    </span>
                  </div>
                  <span className="font-mono text-meta text-ink-disabled">
                    Word & PDF Export Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 laptop:grid-cols-12">
                  <div className="flex flex-col gap-4 laptop:col-span-8">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-meta font-semibold uppercase tracking-wider text-primary">
                        Generated Brief Excerpt
                      </span>
                      <h3 className="text-h2 font-semibold text-ink">
                        Securing Smallholder Cocoa Traceability Through Local Tree
                        Tenure Registration
                      </h3>
                    </div>

                    {/* Quoted Text in Source Serif 4 strictly adhering to AGENTS.md §11.6 */}
                    <div className="rounded-card border border-line bg-paper/80 p-5">
                      <blockquote className="font-serif italic text-quote leading-relaxed text-ink">
                        &ldquo;Evidence from 12 CREMA communities in the
                        Juabeso-Bia landscape demonstrates that tree tenure
                        registration directly unlocks EUDR traceability compliance
                        for smallholders, raising baseline compliance readiness from
                        23% to 87% when farmers retain documented ownership of shade
                        trees.&rdquo;
                      </blockquote>

                      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-meta text-ink-3">Citation:</span>
                          <span className="inline-flex items-center rounded border border-surface-tint-border bg-surface-tint px-2 py-0.5 font-mono text-meta font-medium text-surface-tint-ink">
                            [TB-GH-2024-03: §4.2, p. 18]
                          </span>
                        </div>
                        <span className="font-mono text-meta text-accent">
                          ✓ Verified Source Match
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-card border border-line bg-stone/50 p-4 laptop:col-span-4">
                    <div className="flex flex-col gap-3">
                      <span className="font-mono text-meta font-semibold uppercase tracking-wider text-ink-3">
                        Audience Reframing
                      </span>
                      <p className="text-meta leading-relaxed text-ink-2">
                        Switch this brief in 1-click for:
                      </p>
                      <div className="flex flex-col gap-1 text-meta text-ink">
                        <span className="rounded bg-card px-2 py-1 border border-line">
                          • Parliamentary Select Committee (Legislative reform)
                        </span>
                        <span className="rounded bg-card px-2 py-1 border border-line">
                          • CREMA Leadership (Twi Key Messages)
                        </span>
                        <span className="rounded bg-card px-2 py-1 border border-line">
                          • Cocoa Exporters / Agribusiness (Supply security)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveStage("radar")}
                      className="mt-4 flex items-center justify-between rounded border border-line bg-card px-3 py-2 text-meta font-medium text-ink transition-colors hover:bg-stone cursor-pointer"
                    >
                      <span>Restart Pipeline Walkthrough</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
