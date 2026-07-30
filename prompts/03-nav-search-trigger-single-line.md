# 03 — Nav search trigger: stop the placeholder wrapping

## Goal

The command-palette placeholder button in the app header renders its label on two
lines ("Search signals, briefs," / "evidence"), which makes the top-right cluster
look cramped and pushes the button taller than the 32px it is supposed to
occupy. Make the trigger read as a single, calm line at every width where it is
visible.

## Skills read

- `design-system` — header chrome recipe, `--text-*` sizing, `rounded-card`,
  `bg-paper` / `border-line` pairing, responsive variants (`laptop:` is a
  `min-width` variant; there is no `mobile:`).
- `design_handoff_evibrief/design-system.md` and
  `design_handoff_evibrief/EviBrief Screens.dc.html` — the handoff prototype
  labels this control **"Search signals & evidence"**, not the three-noun list
  currently in the code.

## Existing code inspected

- `components/app-nav.tsx` — the header. The trigger is the disabled `<button>`
  at lines 80–87.
- `components/ui/kbd.tsx` — vendored shadcn `Kbd`; `inline-flex`, `h-5`,
  `w-fit min-w-5`, no `shrink-0`, so it is shrinkable inside a flex row.

## Diagnosis

`h-8 w-[230px]` is a hard width. The content is a `<span>` of 31 characters at
`text-[13px]` (~190px) plus the `⌘K` Kbd (~30px) plus `px-2.5` (20px) — over
budget. Because the span has no `whitespace-nowrap`, it wraps rather than
overflowing, and `items-center` then centres two lines in a box sized for one.
Two independent faults, both worth fixing:

1. the label is longer than the handoff's,
2. the label is allowed to wrap at all.

## Decisions / assumptions

- Adopt the handoff wording **"Search signals & evidence"**. Shorter, and it is
  what the prototype says; the current string looks like drift, not a decision.
  Evidence is still reachable by the palette — the label is a hint, not a
  contract.
- Keep the control a disabled `<button>`, keep it `laptop:`-and-up only, keep
  `⌘K`. None of that is the bug.
- Widen to `w-[240px]` for breathing room, and guarantee single-line rendering
  structurally so a future copy change cannot silently reintroduce the wrap:
  `whitespace-nowrap` + `truncate` on the label, `shrink-0` on the `Kbd`, and a
  `gap-2` between them so the text never touches the key cap.

## Files likely to change

- `components/app-nav.tsx` (only)

## Implementation requirements

1. In the trigger button, change the label span to
   `Search signals & evidence` wrapped in
   `className="truncate whitespace-nowrap"`.
2. Add `gap-2` to the button and change `w-[230px]` to `w-[240px]`. Height stays
   `h-8`; the button must measure exactly 32px tall again.
3. Add `shrink-0` to the `Kbd` so the key cap keeps its intrinsic width and the
   text truncates instead.
4. Do not touch `components/ui/kbd.tsx` — it is vendored (AGENTS.md §19).
5. No new tokens, no new component, no palette change.

## Evidence classification impact

None — no evidence data path. This is static header chrome: a disabled button,
a hard-coded label, and no data fetching, no Server Action, no Gemini call, and
no `evidence_item` read.

## Hallucination-guard implications

None. Nothing here extracts claims, stores flags, renders flags, or gates
approval.

## Security requirements

None beyond the existing boundary: the trigger stays inert and client-side, and
the nav link list stays presentation-only (AGENTS.md §10.1 — the comment at the
top of the file must survive the edit).

## Acceptance criteria

- The label renders on one line; the button is 32px tall and 240px wide.
- `⌘K` stays flush right and is never compressed.
- At 1000px (the `laptop:` threshold) the header still does not scroll
  horizontally, and the centre nav list keeps its own overflow behaviour.
- Below 1000px the trigger remains hidden, unchanged.

## Checks to run

- `npm run lint`
- `npm run typecheck`

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/signals`.
2. At a ≥1300px window: the search trigger reads "Search signals & evidence" on
   a single line, with `⌘K` right-aligned and even vertical padding.
3. Narrow to ~1000px: still one line, still no page-level horizontal scroll.
4. Narrow to 760px and 390px: the trigger is hidden; logo mark, nav tabs, and
   avatar remain reachable and the page does not scroll sideways.
