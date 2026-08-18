# 42 — Hover cursor pointer on interactive elements

## Goal

Apply the `cursor-pointer` Tailwind property when hovered on across all pages and interactive UI components (such as buttons, links, switches, custom selectors, checklists, and click targets). Document this rule in `AGENTS.md` under `# 11. Design system and motion` so it is adhered to across every future UI we build.

## Skills read

- `design-system` — §Responsive, design tokens, styling rules.

## Existing code inspected

- `app/globals.css` — base styles for the application, specifically the `@layer base` styles.
- `components/ui/button.tsx` — definition of `buttonVariants`, which styles buttons and interactive links styled like buttons.
- `components/ui/checkbox.tsx` — definition of custom checkbox element.
- `components/ui/switch.tsx` — definition of custom switch element.
- `components/ui/radio-group.tsx` — definition of custom radio-group elements.
- `AGENTS.md` — Section 11 (Design system and motion) for the core rule.

## Decisions / assumptions

- **Global styling is the most efficient and robust implementation mechanism**:
  - By applying `cursor-pointer` (or `cursor: pointer`) to standard HTML interactive tags (`a`, `button`, `summary`, `select`, inputs that act as button types) directly in `@layer base` in `app/globals.css`, we cover the majority of native tags and links.
  - Custom Base UI elements such as checkboxes, switches, radio items, and sliders can be targetted using their custom `data-slot` attributes globally, and specifically enriched with Tailwind's `cursor-pointer` class locally in their respective files (`components/ui/checkbox.tsx`, `components/ui/switch.tsx`, `components/ui/radio-group.tsx`).
  - The `buttonVariants` in `components/ui/button.tsx` will be updated to include `cursor-pointer` so any custom elements (like Next.js `Link`) styled using `buttonVariants` automatically receive the correct pointer state on hover.
  - Disabled states (`disabled:`, `[disabled]`, `[data-disabled]`) must be styled with `cursor-not-allowed` or `cursor-default`, overriding `cursor-pointer`.
- **Note-taking in `AGENTS.md`**:
  - Append point 16 to section 11 (`# 11. Design system and motion`) in `AGENTS.md` specifying: *"All interactive UI elements — including links, buttons, select dropdowns, custom switches, checkboxes, accordion triggers, and custom card actions — must explicitly carry or inherit `cursor-pointer` on hover. Disabled interactive elements must carry or inherit `cursor-not-allowed`."*

## Files likely to change

- `app/globals.css` — Add base CSS styling for interactive tags.
- `components/ui/button.tsx` — Add `cursor-pointer` to `buttonVariants` base.
- `components/ui/checkbox.tsx` — Add `cursor-pointer` to checkbox primitive root styling.
- `components/ui/switch.tsx` — Add `cursor-pointer` to switch primitive root styling.
- `components/ui/radio-group.tsx` — Add `cursor-pointer` to radio primitive root styling.
- `AGENTS.md` — Append rule 16.

## Evidence classification impact

none — no evidence data path.

## Hallucination-guard implications

none — does not alter fact-checking, claims, or flag-rendering styles.

## Security requirements

none.

## Acceptance criteria

- All buttons, links, select menus, accordion summaries, custom switches, checkboxes, and radio buttons across all pages display a hand (`cursor-pointer`) on hover.
- Disabled buttons/inputs display `cursor-not-allowed` or are non-reactive (where pointer-events-none is defined).
- The project compiles successfully without any typescript, build, or linting errors in modified files.
- Tests in `npm run test` pass perfectly.
- A new rule (16) is added to `AGENTS.md` section 11.

## Checks to run

- `npm run lint` — ESLint checks.
- `npm run typecheck` — TypeScript checks.
- `npm run build` — Complete build sanity check.
- `npm run test` — Playwright tests.

## Exact manual test steps expected after implementation

1. Spin up the dev server (`npm run dev`).
2. Open pages such as `/signals`, `/evidence`, `/briefs`, and `/tracker`.
3. Hover over buttons (e.g., "New Signal", "Submit Evidence", filter tags, tabs).
4. Hover over links, checkboxes (e.g. queue items, filters), switches, and list summaries.
5. Verify the cursor changes to a pointer (hand) on hover.
6. Verify disabled controls do not show the pointer cursor.
