---
name: tiptap-editor
description: Load when working on EviBrief's brief editor — Tiptap setup and SSR, the citation-chip Node linking to evidence items, the hallucination-flag Mark, debounced autosave via Server Action, document diffing for the audience switcher, and export to Word / PDF / Google Docs.
---

# Tiptap editor

Scope: **the brief editor's document model and the two custom extensions that carry EviBrief's traceability contract.**

**There is no vendor skill for Tiptap, and none should be invented** (`AGENTS.md` §6). Tiptap is **not installed** as of writing — no dependency, no editor route. When it lands, **read the installed package's own docs and types** for extension APIs, schema definitions, and the React bindings. Nothing below states a Tiptap API signature, option name, or export path: those must come from the package, not from memory.

Rules: `AGENTS.md` §9 (guard), §16 (output), §8.7 (versioning), §11 (design). Spec: §5.3, §5.5, §5.7, §10.1 Phases 1–3.

Editor work is **desktop-first** (`AGENTS.md` §11.14); grid recipes for `/briefs/[id]/edit` are in `design_handoff_evibrief/design-system.md`.

## Build order

Spec §10.1 sequences this deliberately:

- **Phase 1** — base setup and SSR handling only. **The citation-chip Node and the hallucination-flag Mark do not belong in Phase 1** — don't build them early.
- **Phase 2** — the citation Node and the flag Mark, together, alongside the fact-check pass landing.

**The citation-chip Node and the flag Mark are one body of work with `hallucination-guard`** (`AGENTS.md` §9.9). Load both skills for that task, and do not implement the Mark against a different contract than `hallucination-guard` states. Any disagreement between the two files is a defect.

## SSR

The editor is a client component inside a Server Component route; the route fetches the brief server-side (`AGENTS.md` §5.3 — only Server Components fetch initial page data). Tiptap touches the DOM, so it needs the standard treatment for editors under React 19 / Next 16 App Router: avoid rendering the editor's DOM during SSR, and avoid a hydration mismatch between server-rendered document HTML and the editor's first client render.

Tiptap ships an explicit option for this, and current React 19 behaviour matters here — **check the installed package's SSR guidance rather than reaching for a `useEffect`-plus-`mounted` pattern by reflex.** Read `node_modules/next/dist/docs/01-app/` for the current client-component and streaming rules.

## Document storage

`brief.body_text` holds the document (spec §4.1). Decide once whether that is Tiptap JSON or HTML and stay with it — the export path, the diff, and the flag anchors all depend on the answer, and a mixed corpus is unrecoverable. See `supabase-schema`.

**Every edit to a brief is versioned. Never overwrite a prior version in place** (`AGENTS.md` §8.7). Autosave writes a new version rather than mutating the last one.

## Citation chips

The citation chip is a **custom inline Tiptap extension, not a shadcn component** (`design-system`'s mapping table).

- Each chip **links to an `evidence_item` record** — it carries the identifier, not just display text. A chip that cannot resolve to a real evidence item is not a citation, it's decoration, and this product's whole claim is traceability.
- Visual contract (handoff): pill on `surface-tint` with `surface-tint-border`; **filled dot = verified, hollow dot = pending**.
- **Clicking opens the evidence in a `Sheet` side panel — never a route change** (`design-system`). The officer is mid-sentence; navigating away loses their place.
- Chips are **position-anchored across the audience switch** (see below) — they animate position and stay put rather than remounting.
- The evidence set a brief cites is recorded on the brief (`AGENTS.md` §15.5), so a chip should never reference an item outside that recorded set.
- Quoted source text rendered inside or beside the panel uses the **serif**; the brief's own generated prose stays **sans**. That rule is load-bearing (`AGENTS.md` §11.6) and the editor is exactly where it gets broken.

## The hallucination-flag Mark

A Mark applied over the flagged claim's range, corresponding to a stored flag record. **`hallucination-guard` owns this contract**; restated here only so the two cannot drift:

- Flags are **structured records stored against the brief, anchored to the claim's position** — not embedded in prose and **not inferred at render time**. The Mark renders stored state; it never decides what to flag.
- The anchor must survive ordinary editing around the claim. Position mapping through document transactions is the mechanism; verify the current API against the installed package.
- Render: **slate, a gentle single pulse settling to a steady soft outline. Never red, never a blink, never an alarm, never an error toast** (`AGENTS.md` §9.7). Pulse is 900ms, **once**, then a steady 2px underline. `--destructive` is unmapped; nothing here is red.
- Icon shape: **circle** for a review flag (a square means classification-pending — a different state entirely).
- `prefers-reduced-motion` gets the settled state instantly.
- The flag panel is never the content dropped at a smaller breakpoint; it promotes above the fold (`design-system`).
- Clearing a flag is a **Server Action with server-side role enforcement** — Research Officer or Programme Director only, never the Policy & Advocacy Officer who drafted the brief (`server-actions`, `AGENTS.md` §10.6). The editor's UI may hide the control; hiding is not the enforcement.

## Autosave

**Autosave via a Server Action on debounce** (spec §5.5).

- Server Actions are the only mutation path (`AGENTS.md` §5.3). Autosave does not post to a Route Handler.
- Debounce; don't save per keystroke. Each save is a new version, so the debounce interval is also a decision about version-history density.
- Save state is visible — saved / saving / failed. **Never a silent failure**, which is the same principle as the offline queue in `AGENTS.md` §17.2.
- A failed save must not lose the buffer. This is the same contract as the rate-limit degradation in `gemini-integration`: the user's work survives.
- Autosave does not change brief status. `draft → reviewed → submitted/published` moves only through an explicit human action (`AGENTS.md` §8.3).

## Audience switching is a diff, not a reload

**Switching reframes the same evidence. It must read as "same evidence, reframed", not "new document loaded"** (`AGENTS.md` §16.4, spec §5.7).

- **Diff the new generation against the current draft rather than replacing it wholesale.** A full document swap discards the officer's edits and breaks the perceptual claim the feature makes.
- **Citations stay anchored.** Chips animate position across a 260ms crossfade; shared-layout animation via Motion's `LayoutGroup` / `layoutId`, not a remount (`design-system`).
- Re-generation for a new audience is **still a Gemini call and is not exempt from the classification gate** (`AGENTS.md` §7.8). Load `evidence-governance`.
- It is a new generation, so it runs a **new fact-check pass** and produces new flags — it does not inherit the previous version's cleared flag state (`hallucination-guard`).
- The switcher control is shadcn `Tabs` (`design-system`).

## Translation assist

Twi rendering of key messages, **on demand rather than pre-computed**, shown in an inline `Popover` next to the source text (`AGENTS.md` §16.6, spec §5.3, §5.5). Still a Gemini call, still gated (`evidence-governance`).

## Export

**Tiptap document → `docx` for Word, Pandoc for PDF, plus Google Docs** (`AGENTS.md` §16.8, spec §6).

- Export is a **thin Route Handler** for the download, not a Server Action — it is a response, not a mutation (`AGENTS.md` §5.2).
- Mapping runs from the document model, so the storage-format decision above determines the mapping. Citation chips must survive into the export as readable citations, not as stripped inline noise.
- **Export never bypasses flag state: exporting a brief with unresolved flags carries a visible notice** in the exported document (`AGENTS.md` §16.8). Not a silent export, and not a blocked one either — the notice travels with the file.
- Brief length targets are part of the contract (`AGENTS.md` §16.1); the export should not silently reflow a 1-page stakeholder note into something else.
- Pandoc is an external binary. Confirm it is actually available in the deployment environment before depending on it for PDF, and treat its absence as a handled state rather than a crash.

## Related

- `hallucination-guard` — the flag record and its exact render contract; **ships with this work**
- `design-system` — chip and flag styling, the crossfade, the editor grid
- `server-actions` — autosave, flag dismissal authority, the approval refusal
- `evidence-governance` — re-generation, audience switching, and translation are all gated
- `gemini-integration` — the generation call behind a switch or a re-run
- `supabase-schema` — where the document, versions, and flag anchors live
