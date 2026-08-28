import Link from "next/link";

import { BriefDigestCard, SignalDigestCard } from "@/components/field/digest-card";
import { OfflineBanner } from "@/components/field/offline-banner";
import { FieldServiceWorker } from "@/components/field/sw-register";
import { requireStaffUser } from "@/lib/auth/session";
import { readFieldDigest } from "@/lib/db";

// Its own description, so the root layout's — which uses internal vocabulary —
// is not inherited into this surface's document head.
export const metadata = {
  title: "This week · EviBrief",
  description: "Your weekly update from the office, saved for offline reading.",
};

/**
 * The Field Officer digest.
 *
 * A SERVER COMPONENT READING THE DATABASE DIRECTLY (§5.3). The service worker
 * caches the rendered navigation, so what an officer reads with no connection is
 * the last version of this page they loaded with one — the same words, not a
 * degraded client-rendered stand-in.
 *
 * SINGLE COLUMN AT EVERY WIDTH. The layout caps at 480px and this page never
 * introduces a `tablet:` or `laptop:` variant — a Field Officer on a laptop
 * still gets the digest (§11.14, design-system.md's closing rule).
 *
 * ONE MESSAGE PER CARD, PLAIN LANGUAGE ONLY (§11.12). Every label comes from
 * `lib/field/plain-language.ts`.
 *
 * It re-resolves the caller rather than trusting the layout: Next's own
 * authentication guidance is that layouts do not re-render on navigation.
 */
export default async function FieldPage() {
  await requireStaffUser();

  const digest = await readFieldDigest();
  const empty = digest.signals.length === 0 && digest.briefs.length === 0;

  return (
    <>
      <FieldServiceWorker />

      <header className="bg-primary flex flex-col gap-3 px-5 pt-6 pb-5 text-white">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-surface-tint size-[18px] shrink-0 rounded-[2px] border-2"
          />
          <span className="text-surface-tint text-[13px] font-semibold tracking-[0.12em] uppercase">
            EviBrief
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-h2 font-semibold text-white tracking-tight">This week</h1>
          <p className="text-surface-tint text-[14px] leading-relaxed">
            Your weekly update from the office, saved for offline reading.
          </p>
        </div>
      </header>

      <OfflineBanner savedAt={digest.generatedAt} showQueueSummary />

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        {empty ? (
          /*
            The designed empty state, not a blank column (§17.6). It says what
            will appear and gives the one thing the officer can do right now.
          */
          <div className="bg-card border-line rounded-card shadow-raised border p-5">
            <h2 className="text-ink text-[16px] font-semibold">
              Nothing new yet
            </h2>
            <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">
              When the office has something to pass on, it will appear here, one
              message per card. You can still send an update from the field at
              any time.
            </p>
          </div>
        ) : null}

        {digest.signals.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-ink-3 text-[12px] font-semibold tracking-[0.06em] uppercase">
              Worth knowing
            </h2>
            {digest.signals.map((signal) => (
              <SignalDigestCard key={signal.id} signal={signal} />
            ))}
          </section>
        ) : null}

        {digest.briefs.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-ink-3 text-[12px] font-semibold tracking-[0.06em] uppercase">
              What the office has sent out
            </h2>
            {digest.briefs.map((brief) => (
              <BriefDigestCard key={brief.id} brief={brief} />
            ))}
          </section>
        ) : null}
      </div>

      {/* 48px tap targets, no icon-only controls (design-system.md, §11.12). */}
      <footer className="border-line bg-card flex flex-col gap-3 border-t px-5 py-4">
        <Link
          href="/field/submit"
          className="bg-primary hover:bg-primary-hover active:bg-primary-hover rounded-card shadow-raised flex min-h-[48px] w-full items-center justify-center px-4 text-[16px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 cursor-pointer"
        >
          Send an update from the field
        </Link>
        <Link
          href="/field/sent"
          className="border-line bg-card hover:bg-stone text-ink rounded-card flex min-h-[48px] w-full items-center justify-center border px-4 text-[16px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 cursor-pointer"
        >
          Updates you have sent
        </Link>
        <p className="text-ink-3 text-center text-[14px]">
          Works offline — sends when you are back online.
        </p>
      </footer>
    </>
  );
}

