"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Kbd } from "@/components/ui/kbd";
import { UserMenu } from "@/components/user-menu";
import type { StaffUserDto } from "@/lib/auth/dto";
import { cn } from "@/lib/utils";

// The four desktop surfaces. `/field` is deliberately absent — it is a separate
// surface with its own chrome, not a tab of this one.
//
// This list is presentation only. Showing or hiding a link here is NOT access
// control: every Server Action authorises its caller server-side
// (AGENTS.md §10.1). Do not treat a hidden link as a permission check.
const NAV_LINKS = [
  { href: "/signals", label: "Signals" },
  { href: "/briefs", label: "Briefs" },
  { href: "/evidence", label: "Evidence" },
  { href: "/impact", label: "Impact" },
] as const;

function isActive(pathname: string, href: string) {
  // Segment match, so /briefs/abc/edit still marks Briefs active.
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ user }: { user: StaffUserDto }) {
  const pathname = usePathname();

  return (
    <header className="bg-card border-line border-b">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-6"
      >
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

        {/* Centre. Scrolls within itself on narrow viewports so the frame never
            scrolls horizontally (design-system.md, responsive rules). */}
        <ul className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <div className="flex shrink-0 items-center gap-3">
          {/* Honest placeholder: the command palette is a later prompt, so this
              renders at its final dimensions as a disabled button rather than a
              text input that would silently swallow typing. */}
          <button
            type="button"
            disabled
            className="bg-paper border-line rounded-card text-ink-3 laptop:flex hidden h-8 w-[240px] items-center justify-between gap-2 border px-2.5 text-left text-[13px]"
          >
            <span className="truncate whitespace-nowrap">
              Search signals &amp; evidence
            </span>
            <Kbd className="bg-stone text-ink-3 shrink-0 font-mono">⌘K</Kbd>
          </button>
          <UserMenu user={user} />
        </div>
      </nav>
    </header>
  );
}
