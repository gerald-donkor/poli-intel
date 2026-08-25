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
    <header className="bg-card border-line border-b sticky top-0 z-40">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 tablet:gap-4 tablet:px-6"
      >
        <NavDrawer pathname={pathname} user={user} />

        <Link
          href="/signals"
          className="flex shrink-0 items-center gap-2 no-underline hover:no-underline cursor-pointer group"
        >
          {/* Abstract structural mark — a bordered square. No leaf, no tree,
              no image asset (AGENTS.md §11.7). */}
          <span
            aria-hidden="true"
            className="border-primary size-[18px] rounded-[2px] border-2 group-hover:border-accent transition-colors duration-150"
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
                    "rounded-card block px-2.5 py-1.5 text-[13px] no-underline transition-colors duration-150 hover:no-underline cursor-pointer",
                    active
                      ? "bg-surface-tint text-primary font-medium"
                      : "text-ink-2 hover:text-ink hover:bg-stone/50",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex shrink-0 items-center gap-2.5 tablet:gap-3">
          <CommandPalette index={commandIndex} />
          <UserMenu user={user} />
        </div>
      </nav>
    </header>
  );
}

const ROLE_LABELS: Record<string, string> = {
  programme_director: "Programme Director",
  policy_advocacy_officer: "Policy & Advocacy Officer",
  research_officer: "Research Officer",
  field_officer: "Field Officer",
};

/**
 * The collapsed form of the navigation, below `tablet` (760px).
 *
 * Six labels at 13px do not fit alongside the wordmark, search and avatar under
 * 760px, so the row moves into a `Sheet` drawer rather than scrolling inside
 * itself behind a hidden scrollbar (design-system.md, responsive rules:
 * "content moves into a `Sheet` drawer"). Same links, same active treatment.
 */
function NavDrawer({ pathname, user }: { pathname: string; user: StaffUserDto }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Open navigation"
            className="text-ink-2 rounded-card hover:text-ink hover:bg-surface-tint flex size-8 shrink-0 items-center justify-center transition-colors duration-150 tablet:hidden cursor-pointer"
          />
        }
      >
        <MenuIcon aria-hidden="true" className="size-[18px]" />
      </SheetTrigger>

      <SheetContent
        side="left"
        className="bg-card border-line w-[min(18rem,84vw)] gap-0 p-0 flex flex-col justify-between"
      >
        <div className="flex flex-col">
          <SheetHeader className="p-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="border-primary size-[18px] rounded-[2px] border-2"
              />
              <SheetTitle className="text-primary text-[13px] font-semibold tracking-[0.12em] uppercase">
                EviBrief
              </SheetTitle>
            </div>
          </SheetHeader>

          <nav aria-label="All sections" className="p-3">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-card flex min-h-11 items-center px-3.5 text-[14px] no-underline transition-colors duration-150 hover:no-underline cursor-pointer",
                        active
                          ? "bg-surface-tint text-primary font-medium"
                          : "text-ink-2 hover:text-ink hover:bg-stone/50",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* User profile footer inside drawer */}
        <div className="border-t border-line p-4 bg-paper/50">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-ink">{user.name}</span>
            <span className="text-[11.5px] text-ink-3 truncate">{user.email}</span>
            <span className="bg-surface-tint border border-surface-tint-border text-primary-ink text-[10.5px] font-medium px-2 py-0.5 rounded-full inline-flex items-center w-fit mt-1">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
