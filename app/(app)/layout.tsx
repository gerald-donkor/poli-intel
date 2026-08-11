import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";
import { toStaffUserDto } from "@/lib/auth/dto";
import { requireStaffUser } from "@/lib/auth/session";
import { loadCommandIndex } from "@/lib/command";

// Desktop shell for the Director and Officer surfaces. A nested layout rather
// than a second root layout: sibling root layouts force a full page reload when
// navigating between them, and the fonts load once in app/layout.tsx.
//
// The `requireStaffUser()` below is a convenience redirect, NOT the enforcement
// boundary. Layouts do not re-render on navigation (Next's authentication
// guide), so the real check is the DAL call inside each page and the
// authorisation check inside each Server Action (AGENTS.md §10.1). Never read
// this line as "everything under (app) is protected".
export default async function AppLayout({ children }: { children: ReactNode }) {
  const staffUser = await requireStaffUser();
  const commandIndex = await loadCommandIndex(staffUser);

  return (
    <>
      <a
        href="#main"
        className="bg-card text-primary border-line rounded-card sr-only px-3 py-2 text-[13px] font-medium no-underline focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:border"
      >
        Skip to content
      </a>
      <AppNav user={toStaffUserDto(staffUser)} commandIndex={commandIndex} />
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
