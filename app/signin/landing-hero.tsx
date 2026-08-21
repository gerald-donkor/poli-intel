"use client";

import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Lock } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { signInWithGoogle } from "./actions";
import { SignInButton } from "./sign-in-button";

interface LandingHeroProps {
  alert?: {
    title: string;
    description: string;
  } | null;
}

const TELEMETRY_METRICS = [
  {
    value: "100%",
    label: "Traceable Claims",
    detail: "Every paragraph linked to verified evidence chunks",
  },
  {
    value: "5",
    label: "Audience Frames",
    detail: "Ministries, Parliament, CREMAs, Agribusiness, Donors",
  },
  {
    value: "< 3m",
    label: "Signal-to-Brief",
    detail: "Fast turnaround before policy windows close",
  },
  {
    value: "0",
    label: "Ungoverned Entry",
    detail: "Strict 3-way classified evidence gate enforced",
  },
];

export function LandingHero({ alert }: LandingHeroProps) {
  const prefersReduced = useReducedMotion();

  const transition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.2, 0.7, 0.3, 1] as const };

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-10 tablet:px-8 tablet:py-16 laptop:py-20">
      <div className="grid grid-cols-1 items-center gap-10 laptop:grid-cols-12 laptop:gap-14">
        {/* Left Column: Thesis, Product Voice & Telemetry */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="flex flex-col gap-6 laptop:col-span-7"
        >
          {/* Institutional Badge */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-surface-tint-border bg-surface-tint px-3 py-1 text-meta font-medium text-surface-tint-ink">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-accent"
            />
            <span className="font-mono text-[11.5px] uppercase tracking-wider">
              Policy Intelligence · Tropenbos Ghana
            </span>
          </div>

          {/* Heading */}
          <div className="flex flex-col gap-3">
            <h1 className="text-display font-semibold tracking-tight text-ink text-balance tablet:text-[40px] tablet:leading-[1.15]">
              Making landscape knowledge work for forest policy.
            </h1>
            <p className="max-w-[620px] text-body text-ink-2 text-pretty tablet:text-[16px] tablet:leading-relaxed">
              EviBrief continuously monitors Ghanaian and international policy
              windows, matches them directly to verified landscape evidence from{" "}
              <strong className="font-medium text-ink">Juabeso-Bia</strong> and{" "}
              <strong className="font-medium text-ink">Sefwi-Wiawso</strong>, and
              drafts audience-tailored briefs with post-generation fact checks.
            </p>
          </div>

          {/* Telemetry Metrics Bar */}
          <div className="mt-2 grid grid-cols-2 gap-3 tablet:grid-cols-4 tablet:gap-4">
            {TELEMETRY_METRICS.map((metric) => (
              <div
                key={metric.label}
                className="rounded-card border border-line bg-card p-3.5 shadow-raised"
              >
                <div className="font-mono text-h2 font-semibold text-primary">
                  {metric.value}
                </div>
                <div className="mt-1 text-body font-medium text-ink text-[13px]">
                  {metric.label}
                </div>
                <p className="mt-0.5 text-meta text-ink-3 text-[11px] leading-tight">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Governance summary checklist */}
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-meta text-ink-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-accent" />
              <span>EUDR & Forestry Commission Monitoring</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-accent" />
              <span>Three-Way Classification Gate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-accent" />
              <span>Twi Translation Assist for Communities</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: The Elevated Sign-in Card */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...transition,
            delay: prefersReduced ? 0 : 0.1,
          }}
          className="laptop:col-span-5"
        >
          <div className="relative flex w-full flex-col gap-6 rounded-card border border-line bg-card p-6 shadow-overlay tablet:p-8">
            {/* Abstract structural mark: concentric contour rings */}
            <div className="flex justify-center py-4">
              <span
                aria-hidden="true"
                className="size-14 rounded-full border border-sage shadow-[0_0_0_9px_var(--color-paper),0_0_0_10px_var(--color-line),0_0_0_19px_var(--color-card),0_0_0_20px_var(--color-stone)]"
              />
            </div>

            <div className="flex flex-col gap-1.5 text-center">
              <span className="font-mono text-meta font-semibold uppercase tracking-[0.12em] text-primary">
                Staff Workspace
              </span>
              <h2 className="text-h2 font-semibold text-ink">
                Sign in
              </h2>
              <p className="text-body text-ink-2 text-[13.5px]">
                Sign in with your Tropenbos Ghana Workspace account.
              </p>
            </div>

            {alert ? (
              <Alert variant="guard">
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </Alert>
            ) : null}

            <form action={signInWithGoogle} className="flex flex-col gap-4">
              <SignInButton />
            </form>

            {/* Institutional Security Notice */}
            <div className="flex flex-col gap-2 border-t border-line pt-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-meta text-ink-3">
                <Lock className="size-3.5 text-ink-3" />
                <span>Google Workspace SSO · Domain Enforced</span>
              </div>
              <p className="text-meta text-ink-disabled text-[11.5px] leading-normal">
                Field observations, farmer testimonies, and unclassified evidence
                are strictly quarantined until human review.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
