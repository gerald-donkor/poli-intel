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
        className="rounded-full"
      >
        <Avatar className="size-[30px]">
          <AvatarFallback className="bg-surface-tint text-primary-ink text-[11.5px] font-semibold">
            {user.initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      {/* The default content width tracks the anchor, which here is a 30px
          avatar. Layout override only — no colour, no type. */}
      <DropdownMenuContent align="end" className="w-auto min-w-[240px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex min-w-0 flex-col gap-0.5 px-1.5 py-1.5">
            <span className="text-body text-ink font-medium">{user.name}</span>
            <span className="text-ink-3 truncate text-[12px] font-normal">
              {user.email}
            </span>
            <span className="text-ink-3 text-[12px] font-normal">
              {ROLE_LABELS[user.role]}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Sign out is a POST through a Server Action, never a link and never a
            GET URL. */}
        <form action={signOutAction}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={<button type="submit" />}
              className="w-full justify-start"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
