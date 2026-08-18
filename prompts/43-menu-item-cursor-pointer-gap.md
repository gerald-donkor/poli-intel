# 43 — Fix cursor-default gap on menu/option items

## Goal

Prompt 42 (`42-hover-cursor-pointer.md`, commit `83e3842`) added a global `cursor: pointer` rule in `app/globals.css` for standard interactive tags and a handful of custom slots. Auditing the rest of the codebase for section 11.16 compliance found six shadcn/base-ui components whose clickable menu/option items explicitly set `cursor-default`, which overrides the global rule at the element level. These are real click targets (they select a value or fire an action) and must carry `cursor-pointer` on hover per AGENTS.md §11.16.

## Skills read

None needed beyond AGENTS.md §11.16 itself — this is a class-name correction on existing, already-styled components, not a new design decision. No visual, layout, or token change.

## Existing code inspected

Grepped `components/ui/*.tsx` and `app/**/*.tsx` for `cursor-default` and `onClick` on non-semantic elements. Found `cursor-default` on clickable item/option rows in:

- `components/ui/command.tsx:159` — `CommandItem` (command palette results)
- `components/ui/combobox.tsx:143` — combobox option row
- `components/ui/select.tsx:120,160,179` — `SelectItem`, scroll-up/down buttons
- `components/ui/dropdown-menu.tsx:88,113,159,201` — menu item, sub-trigger, radio item, checkbox item
- `components/ui/context-menu.tsx:101,128,166,207` — same shape as dropdown-menu
- `components/ui/menubar.tsx:121,157` — menu item, sub-trigger

Verified `components/ui/accordion.tsx` (`AccordionTrigger` renders a native `<button>`, already covered by the global tag selector) and `components/ui/card.tsx` needed no change. No stray `onClick` handlers found on bare `div`/`span`/`li`/`tr` elements outside these files.

These are the project's own shadcn-generated component files (not `carousel.tsx` / `use-mobile.ts` / `design_handoff_evibrief/support.js`, which AGENTS.md §19 exempts from style fixes) — they are actively used across the app (command palette, selects, dropdown/context menus, menubar) so the fix belongs here, not in a wrapper.

## Decisions or assumptions

- `cursor-default` on these rows is the shadcn/Radix/base-ui upstream default (desktop-menu convention). AGENTS.md §11.16 is explicit and unconditional for this project, so it overrides the upstream default rather than being treated as an exception.
- Non-interactive rows in the same files (`CommandGroup`, `CommandSeparator`, `SelectLabel`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `ContextMenuLabel`/`Separator`, `MenubarLabel`/`Separator`) are unaffected — no `cursor-default` was found on them, and they must stay non-interactive.
- Disabled item rows already carry `data-disabled:pointer-events-none` / `data-[disabled=true]:pointer-events-none`, so `pointer-events: none` wins over any cursor value once disabled — no separate `cursor-not-allowed` override is needed there, consistent with how disabled buttons already behave elsewhere in the app.

## Files likely to change

- `components/ui/command.tsx`
- `components/ui/combobox.tsx`
- `components/ui/select.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/context-menu.tsx`
- `components/ui/menubar.tsx`

## Implementation requirements

In each file, replace `cursor-default` with `cursor-pointer` on every clickable item/trigger/option/scroll-button class string identified above. Leave every other class untouched — this is a single token swap per occurrence, not a restyle.

## Evidence classification impact

None — no evidence data path. This only touches Tailwind class strings on shared UI primitives; no data reads, writes, or transmission.

## Hallucination-guard implications

None — no change to claim extraction, flag storage, or flag rendering. `flag-panel.tsx` and `flag-resolution.tsx` were checked in the earlier `onClick` grep and use `cursor-pointer` already; this prompt does not touch them.

## Security requirements

None beyond the existing pattern — no new data flow, no new client/server boundary crossed.

## Acceptance criteria

- No `cursor-default` remains on any clickable item row in the six files above.
- Disabled items in the same components still show `cursor-not-allowed`-equivalent behavior via existing `pointer-events-none` on the disabled state (verify, don't add new CSS).
- No other class in these files changes.
- `npm run lint` and `npm run typecheck` stay clean (pure class-string edits, no logic change).

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npm run test`

## Manual test steps

1. `npm run dev`, open the command palette (cmdk shortcut) and hover a result row — cursor shows pointer.
2. Open any `Select` (e.g. evidence filter rail) and hover an option — cursor shows pointer; hover the scroll-up/down chevrons when the list overflows — cursor shows pointer.
3. Open a `Combobox` and hover an option row — cursor shows pointer.
4. Right-click to open a `ContextMenu` (if wired anywhere) and hover an item — cursor shows pointer.
5. Open a `DropdownMenu` (e.g. app nav user menu) and hover an item, a submenu trigger, a checkbox item, and a radio item — cursor shows pointer on all four.
6. Hover a disabled item in any of the above — cursor is not a pointer (blocked by `pointer-events: none`).
