"use client";

import { useEffect } from "react";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import * as Sentry from "@sentry/nextjs";

import { FailureAction, FailurePanel } from "@/components/failure-panel";

import "./globals.css";

/**
 * The last boundary: the root layout itself threw, so this file replaces the
 * whole document — `<html>` and `<body>` included.
 *
 * IT RESTATES THE FONTS AND RE-IMPORTS `globals.css` BECAUSE IT HAS TO. Next's
 * docs are explicit that `global-error` renders its own document and inherits
 * neither the root layout's font variables nor its global styles. Without these
 * five lines every token below resolves to nothing and the page renders in a
 * serif fallback — which, in a product where the serif means "quoted material"
 * (§11.6), would be the wrong typeface saying the wrong thing on the one screen
 * nobody wants to be reading.
 *
 * The three families are declared identically to `app/layout.tsx`. `next/font`
 * deduplicates the underlying files, so this is a second reference to the same
 * fonts, not a second download.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

/**
 * `metadata` is not supported in a Client Component, so the title is set with
 * React's `<title>` element instead — per Next's own note on this file.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable} h-full`}
    >
      <body className="bg-paper flex min-h-full flex-col font-sans">
        <title>EviBrief</title>
        <FailurePanel
          title="EviBrief could not be loaded."
          description="Nothing was changed and no draft was lost. Reload the page — if it keeps happening, pass the reference below to whoever is looking after the deployment."
          reference={error.digest}
        >
          <FailureAction onClick={() => unstable_retry()}>Reload</FailureAction>
        </FailurePanel>
      </body>
    </html>
  );
}
