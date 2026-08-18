"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";

import { CommandPalette } from "@/components/command-palette";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserMenu } from "@/components/user-menu";
import type { CommandIndex } from "@/lib/command/types";
import type { StaffUserDto } from "@/lib/auth/dto";
import { cn } from "@/lib/utils";

// The six desktop surfaces. `/field` is deliberately absent — it is a separate
// surface with its own chrome, not a tab of this one.
//
// This list is presentation only. Showing or hiding a link here is NOT access
// control: every Server Action authorises its caller server-side
// (AGENTS.md §10.1). Do not treat a hidden link as a permission check.
const NAV_LINKS = [
  { href: "/signals", label: "Signals" },
  { href: "/briefs", label: "Briefs" },
  // Lifecycle order: a window is detected, a brief answers it, the tracker says
  // by when. Spec §5.5's route table folds the tracker into /stakeholders; it
  // sits here instead because its content is signals and briefs, not contacts,
  // and a deadline view buried in the CRM is findable only by someone who
  // already knows it is there. A deliberate divergence, recorded in
  // prompts/25-submission-tracker.md.
  { href: "/tracker", label: "Tracker" },
  // Contacts follow from the thing you send them, so this sits after Briefs.
  { href: "/stakeholders", label: "Stakeholders" },
  { href: "/evidence", label: "Evidence" },
  { href: "/impact", label: "Impact" },
] as const;

function isActive(pathname: string, href: string) {
  // Segment match, so /briefs/abc/edit still marks Briefs active.
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({
  user,
  commandIndex,
}: {
  user: StaffUserDto;
  commandIndex: CommandIndex;
}) {
  const pathname = usePathname();

  return (
    <header className="bg-card border-line border-b">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-6"
      >
        <NavDrawer pathname={pathname} />

        <Link
          href="/signals"
          className="flex shrink-0 items-center gap-2 no-underline hover:no-underline"
        >
          {/* Abstract structural mark — a bordered square. No leaf, no tree,
              no image asset (AGENTS.md §11.7). */}
          <span
            aria-hidden="true"
            className="border-primary size-[18px] rounded-[2px] border-2"
          />
          <span className="text-primary hidden text-[13px] font-semibold tracking-[0.12em] uppercase tablet:inline">
            EviBrief
          </span>
        </Link>

        {/* Centre. The inline row exists from `tablet` up, where all six labels
            fit; below that the drawer above is the navigation. `overflow-x-auto`
            stays as a safety net for an unusually long label at an odd width, so
            the frame never scrolls horizontally — it is no longer the mechanism
            responsiveness relies on. */}
        <ul className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] tablet:flex [&::-webkit-scrollbar]:hidden">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-card block px-2.5 py-1.5 text-[13px] no-underline transition-colors duration-150 hover:no-underline",
                    active
                      ? "bg-surface-tint text-primary font-medium"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <CommandPalette index={commandIndex} />
          <UserMenu user={user} />
        </div>
      </nav>
    </header>
  );
}

/**
 * The collapsed form of the navigation, below `tablet` (760px).
 *
 * Six labels at 13px do not fit alongside the wordmark, search and avatar under
 * 760px, so the row moves into a `Sheet` drawer rather than scrolling inside
 * itself behind a hidden scrollbar (design-system.md, responsive rules:
 * "content moves into a `Sheet` drawer"). Same links, same active treatment.
 */
function NavDrawer({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Open navigation"
            className="text-ink-2 rounded-card hover:text-ink hover:bg-surface-tint flex size-8 shrink-0 items-center justify-center transition-colors duration-150 tablet:hidden"
          />
        }
      >
        <MenuIcon aria-hidden="true" className="size-[18px]" />
      </SheetTrigger>

      <SheetContent
        side="left"
        className="bg-card border-line w-[min(17rem,82vw)] gap-0"
      >
        <SheetHeader>
          <SheetTitle className="text-primary text-[13px] font-semibold tracking-[0.12em] uppercase">
            EviBrief
          </SheetTitle>
        </SheetHeader>

        <nav aria-label="All sections" className="p-2">
          <ul className="flex flex-col gap-0.5">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-card flex min-h-11 items-center px-3 text-[14px] no-underline transition-colors duration-150 hover:no-underline",
                      active
                        ? "bg-surface-tint text-primary font-medium"
                        : "text-ink-2 hover:text-ink hover:bg-paper",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
