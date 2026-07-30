import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";

// Desktop shell for the Director and Officer surfaces. A nested layout rather
// than a second root layout: sibling root layouts force a full page reload when
// navigating between them, and the fonts load once in app/layout.tsx.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="bg-card text-primary border-line rounded-card sr-only px-3 py-2 text-[13px] font-medium no-underline focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:border"
      >
        Skip to content
      </a>
      <AppNav />
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
