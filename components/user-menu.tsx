"use client";

import { signOutAction } from "@/app/(app)/auth-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StaffUserDto } from "@/lib/auth/dto";
import type { StaffRole } from "@/lib/generated/prisma/enums";

// Presentation only. The role decides what a person may *do* server-side, in
// `lib/auth/authorize.ts`; this map decides what the label reads. Nothing in
// `lib/auth/` is importable from here (AGENTS.md §10.10).
const ROLE_LABELS: Record<StaffRole, string> = {
  programme_director: "Programme Director",
  policy_advocacy_officer: "Policy & Advocacy Officer",
  research_officer: "Research Officer",
  field_officer: "Field Officer",
};

export function UserMenu({ user }: { user: StaffUserDto }) {
  return (
    <DropdownMenu>
      {/* Base UI's Trigger already renders a real <button> with its own focus
          ring, and Avatar's root is a <span>, so the avatar nests inside it
          directly. No `render` element is needed, and `asChild` is a Radix API
          that would silently do nothing on Base UI. */}
      <DropdownMenuTrigger
        aria-label={`Account menu — ${user.name}`}
        className="rounded-full cursor-pointer transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <Avatar className="size-[30px] border border-line shadow-raised">
          <AvatarFallback className="bg-surface-tint text-primary-ink text-[11.5px] font-semibold">
            {user.initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      {/* The default content width tracks the anchor, which here is a 30px
          avatar. Layout override only — no colour, no type. */}
      <DropdownMenuContent align="end" className="w-auto min-w-[240px] rounded-card border border-line bg-card p-1 shadow-overlay">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex min-w-0 flex-col gap-1 px-2.5 py-2">
            <span className="text-[13.5px] text-ink font-semibold">{user.name}</span>
            <span className="text-ink-3 truncate text-[12px] font-normal">
              {user.email}
            </span>
            <span className="bg-surface-tint border border-surface-tint-border text-primary-ink text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center w-fit mt-0.5">
              {ROLE_LABELS[user.role]}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-line my-1" />

        {/* Sign out is a POST through a Server Action, never a link and never a
            GET URL. Base UI's Item renders a <div> and defaults `nativeButton`
            to false; the render element here *is* a real <button>, so it has to
            say so, or Base UI layers its non-native `role` / `aria-disabled`
            shims on top of native button behaviour. */}
        <form action={signOutAction}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              nativeButton
              render={<button type="submit" />}
              className="w-full justify-start cursor-pointer text-[13px] text-ink font-medium px-2.5 py-1.5 rounded-card hover:bg-stone/50 transition-colors duration-150"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
