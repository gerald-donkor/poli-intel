# 34 — Command palette

## Goal

Replace the disabled "Search signals & evidence" control in the authenticated app navigation with a usable command palette for fast keyboard navigation and metadata search across EviBrief.

This is the next scope because the section 1 product build list is represented in committed code through prompt 33, and two existing code comments explicitly reserve the command palette for a later prompt:

- `components/app-nav.tsx` renders the final-sized control as disabled until this prompt.
- `lib/evidence/search.ts` notes that the command palette is the intended place for a merged command/search experience.

The palette must help staff move quickly between core surfaces, recent signals, eligible evidence, and common starting points without adding a new product module, an admin panel, or another data-fetching pattern.

## Skills read

- `design-system` (project) — command/search uses the shadcn `Command` primitive, must follow the Tropenbos palette, warm neutrals, structural marks, keyboard accessibility, responsive behavior, and no generic dashboard tone.
- `server-actions` (project) — confirms mutations remain Server Actions, auth is server-side, app forms should not be backed by internal Route Handlers, and reads should stay out of mutation actions where possible.
- `evidence-governance` (project) — evidence results in the palette must come only from `public_published` evidence through the existing eligibility filter; no evidence body text goes to telemetry/logs.
- `shadcn` (vendor) — command palette should compose `Command` inside `Dialog`, keep items inside groups, use existing components first, and preserve accessible dialog title/description.

## Existing code inspected

- `AGENTS.md` — workflow, product list, evidence gate, no overbuild rule, UI rules, command/search component mapping, and command/check expectations.
- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — route table, app surfaces, accessibility requirements, and role workflows.
- `prompts/33-core-regression-test-harness.md` and `git log --oneline -40` — confirms implemented feature sequence through the regression harness.
- `git status --short` — shows an existing unrelated formatting-only modification in `tsconfig.json`; do not touch or revert it.
- `components/app-nav.tsx` — current disabled palette placeholder, nav link order, app-shell client component boundary.
- `app/(app)/layout.tsx` — authenticated app shell already resolves `requireStaffUser()` server-side and passes a DTO to `AppNav`.
- `components/ui/command.tsx` — installed shadcn/cmdk command primitives and `CommandDialog` implementation.
- `design_handoff_evibrief/design-system.md` — command/search recipe, palette, typography, iconography, and responsive constraints.
- `lib/evidence/search.ts` — existing evidence search orchestration, semantic-status handling, and explicit later-prompt note for command palette ranking.
- `lib/db/evidence.ts` — `listEligibleEvidence()` and `loadEvidenceListItems()` reapply `ELIGIBLE_EVIDENCE_WHERE`; `EvidenceListItem` includes an excerpt that the command palette should not preload.
- `lib/db/signal-board.ts` — board and detail data shapes, eligible match count logic, and signal metadata that can power command results.
- `lib/auth/authorize.ts` — role predicates for deciding which quick actions should be visible as presentation only.
- `lib/observability/events.ts` — analytics allowlist has no command-palette event and should not gain one unless every property is non-content metadata.
- `prisma/schema.prisma` — signal and evidence fields/indexes relevant to bounded metadata search.
- `README.md` and `package.json` — available checks and current Playwright setup.

## Decisions and assumptions

1. **Use an app-shell Server Component read, not an internal API route.** `app/(app)/layout.tsx` should fetch a small metadata-only command index and pass it to a client palette. This keeps internal app reads out of Route Handlers and avoids a client-side primary fetch path.
2. **Do not use a Server Action for search.** This is a read, not a mutation. The project comments already distinguish read orchestration from Server Actions in the Evidence Library.
3. **Do not call Gemini from the palette.** The palette should filter a bounded metadata index locally. Selecting "Search eligible evidence for `<query>`" may navigate to `/evidence?query=...`, where the existing governed Evidence Library search performs keyword plus semantic search once on a deliberate page load.
4. **Preload metadata only.** Evidence command results may include title, citation key, year, country, impact area, source type, and embedded-chunk count. Do not preload `fullText`, excerpts, chunk text, source excerpts, brief prose, prompts, completions, translations, stakeholder notes, or field observations.
5. **Bound the index.** Load a conservative number of recent/open signals and eligible evidence items so every authenticated page does not become an unbounded search query. Use existing constants where appropriate or add command-specific constants in a server-only module.
6. **Navigation targets are role-aware presentation, not authorisation.** Hide irrelevant quick actions for Field Officers and roles without a capability, but keep every destination/action protected by its existing server-side checks.
7. **Use local scoring, not fabricated semantic scores.** Every result should expose a simple defensible score based on exact, prefix, substring, and metadata matches. Label it as a match score, not evidence relevance or model confidence.
8. **Keep `/field` out of the desktop nav but available in the palette only for roles that may submit/read field content.** The Field Officer shell remains separate; this palette lives under `(app)`.
9. **No new dependency.** `cmdk` and shadcn `Command` are already installed.

## Files likely to change

**New**

- `lib/command/index.ts` or `lib/db/command.ts` — server-only command index reader returning bounded, serialisable metadata results.
- `components/command-palette.tsx` — client command dialog, keyboard shortcut handling, grouped results, local filtering/scoring, and navigation.
- Optional: `tests/contracts/command-index.spec.ts` — contract tests for evidence eligibility and absence of body/excerpt fields.
- Optional: `tests/e2e/command-palette.spec.ts` — unauthenticated/auth-surface-safe browser checks if feasible without a real session; otherwise extend after seeded auth exists.

**Modified**

- `app/(app)/layout.tsx` — fetch the command index with the existing staff user and pass it to `AppNav`.
- `components/app-nav.tsx` — replace the disabled button with the command-palette trigger and preserve dimensions/responsiveness.
- `lib/db/evidence.ts` — add a bounded metadata-only eligible evidence query if existing list shapes include fields the palette must not carry.
- `lib/db/signal-board.ts` — add a bounded command metadata query for non-archived signals if existing board data is too broad or semantically wrong.
- `tests/contracts/governance.spec.ts` — optional extension asserting the command evidence query uses `ELIGIBLE_EVIDENCE_WHERE`.
- `tests/e2e/public-routing.spec.ts` — optional extension only if the palette can be tested credential-free without adding a test auth bypass.
- `README.md` — only if manual usage or checks materially change. No new command is expected.

Do not modify `tsconfig.json`; it already has unrelated working-tree changes.

## Implementation requirements

### Command index

- Create a server-only command index reader that returns one serialisable object:
  - static destinations: Signals, Briefs, Tracker, Stakeholders, Evidence, Impact;
  - quick starts permitted by role as presentation only, such as New brief, Add evidence, Classification queue, Stakeholder record, Impact log, Field submission;
  - recent non-archived signals, newest first, bounded;
  - eligible evidence items, newest first or recently ingested, bounded.
- Evidence items must be loaded through a query that spreads `ELIGIBLE_EVIDENCE_WHERE` and requires `extractionCompletedAt: { not: null }`.
- The command index must not select or return `fullText`, excerpt, chunk text, matched passages, brief body JSON, flag claim text, translation text, stakeholder notes, field observation text, prompts, completions, or raw provider errors.
- Include only metadata needed for display and navigation:
  - evidence: `id`, `title`, `citationKey`, `year`, `country`, `impactArea`, `sourceType`, `embeddedChunkCount`;
  - signals: `id`, `title`, `sourceName`, `detectedAt`, `urgency`, `relevance`, `impactArea`, `geography`, `audienceTarget`, `matchCount`, `latestMatchOutcome`.
- Keep counts bounded and named, for example `COMMAND_SIGNAL_LIMIT` and `COMMAND_EVIDENCE_LIMIT`, in a server-only file or existing config file.
- Do not introduce a database migration.

### App shell integration

- In `app/(app)/layout.tsx`, fetch the command index after `requireStaffUser()` and pass it to `AppNav`.
- Keep the layout auth comment honest: this is convenience routing and data preparation, not the enforcement boundary.
- Avoid parallel queries that leak role-specific surfaces. Role controls decide which quick starts go into the index for the current user.
- Do not fetch command index data on the public `/signin` route or `/field` root layout.

### Client palette

- Build a client component using the existing `CommandDialog`, `Command`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandEmpty`, `CommandSeparator`, and `CommandShortcut`.
- The trigger replaces the disabled button in `components/app-nav.tsx`, preserving the desktop width, height, `⌘K` affordance, and hidden-under-laptop behavior unless a clean mobile trigger can be added without crowding the nav.
- Open with `Meta+K` and `Ctrl+K`; prevent the browser default only when opening the palette.
- Close on selection and navigate with `router.push()`.
- Use groups:
  - Go to;
  - Start;
  - Signals;
  - Evidence;
  - Search.
- Provide an explicit row for "Search eligible evidence for `<query>`" that navigates to `/evidence?query=<encoded>` when the query is non-empty. This is the path that may run the existing semantic search; the palette itself must not call Gemini.
- Provide an explicit row for "Search signals for `<query>`" only if the target page supports a query. If it does not, omit it rather than inventing a URL parameter the page ignores.
- Use local filtering and scoring over preloaded metadata:
  - exact title/citation match ranks highest;
  - prefix match ranks next;
  - substring match ranks next;
  - metadata matches rank lower;
  - static destinations remain available when the query is empty.
- Render a defensible match score or shortcut for result rows. Do not call it relevance, confidence, or semantic similarity unless it actually comes from that system.
- Do not render evidence excerpts in the palette. A result can name an evidence item and its citation key; reading the evidence belongs on the Evidence Library page.
- Keep all labels in measured research-institutional language. Do not imply the system decided, verified, or endorsed anything.

### Design and accessibility

- Preserve the app-shell dimensions and no-horizontal-scroll behavior.
- Use the existing warm neutral surfaces: `bg-card`, `bg-paper`, `border-line`, `text-ink`, `text-ink-3`, `surface-tint` for selected/active states.
- No red/amber/green status colors. Urgency should use the existing warm-to-cool labels if shown, but not full filled backgrounds.
- No leaf/tree/forest imagery. If a glyph is needed, use abstract squares/circles or lucide icons that are not forest-related.
- `CommandDialog` must retain a dialog title and description for screen readers.
- Every command item must have enough text to be understandable without color.
- Keyboard behavior must support opening, typing, arrowing, Enter selection, and Escape close.
- Respect `prefers-reduced-motion`; do not add Motion or GSAP for this prompt.
- Keep text at or above the project minimum size and prevent long titles from overflowing their row.

### Security, governance, and telemetry

- Do not add command-palette telemetry in this prompt unless there is a clear need. If telemetry is added, use only allowlisted event names and metadata such as result kind/count, never query text or result titles.
- Do not log the command query or selected result label.
- Do not add a route handler, Server Action, or helper that bypasses Auth.js, role checks, or evidence classification.
- Do not send palette queries, evidence metadata, or signal metadata to Gemini, PostHog, Sentry, Resend, Google, Supabase storage, WhatsApp, or any third-party API.
- Do not add a command that mutates state directly. Commands may navigate to a screen where an authorised user can take an explicit action.

## Evidence classification impact

Touches the evidence-classification rule as a **read and display path**.

Classifications involved:

- `public_published`
- `community_sourced`
- `unpublished_internal`

Enforcement point:

- New command evidence query in `lib/command/index.ts`, `lib/db/command.ts`, or a narrowly added DAL function must spread `ELIGIBLE_EVIDENCE_WHERE` from `lib/governance/gate.ts` and require completed extraction.
- If the implementation reuses `lib/db/evidence.ts`, it must not reuse `EvidenceListItem` if doing so would preload excerpts. Prefer a command-specific metadata shape.

Blocked items:

- `community_sourced` and `unpublished_internal` evidence must not appear in palette results, command metadata, facets, search scores, telemetry, logs, or browser props.
- Blocked items are not listed by name. The only backlog signal remains the existing classification queue count/surface elsewhere in the app.

Gemini impact:

- The palette itself must make no Gemini call. Selecting the explicit "Search eligible evidence for `<query>`" row navigates to the existing Evidence Library search path, where the existing query-embedding behavior and failure states apply.

## Hallucination-guard implications

None. This task does not change what gets fact-checked, how claims are extracted, how flags are stored, how flags render, or what a flag blocks.

The palette may navigate to brief, evidence, signal, or impact screens, but it must not render guard-flag claim text or add any new approval/dismissal path.

## Security requirements

- Require the existing authenticated `(app)` layout before any command index data is read.
- Keep all command-index modules server-only.
- Do not expose role predicates or authorisation logic to a shared client schema. Pass only the already-resolved presentation data needed by the palette.
- Do not select or ship evidence body text, excerpts, field observations, brief prose, stakeholder notes, prompts, completions, translation text, or flag claim text.
- Do not log command queries, result titles, selected labels, evidence text, or signal summaries.
- Do not add an internal search Route Handler.
- Do not add a test-only auth bypass or credentials provider.
- Do not mutate state from a command item.
- Keep all code and prompt text ASCII unless preserving existing UI copy requires otherwise.

## Acceptance criteria

1. The app nav's disabled command placeholder is replaced with a working command palette trigger.
2. `Meta+K` and `Ctrl+K` open the palette from authenticated app routes.
3. The palette supports keyboard search, arrow navigation, Enter selection, and Escape close.
4. Static app destinations and role-appropriate quick starts are available.
5. Recent signals appear as bounded metadata results and navigate to their detail pages.
6. Eligible evidence appears as bounded metadata results and navigates to the Evidence Library with a useful query or item-aware URL if one exists.
7. Ineligible evidence never appears because the command evidence query enforces `ELIGIBLE_EVIDENCE_WHERE`.
8. No evidence body, excerpt, chunk text, field observation, brief prose, prompt, completion, translation, or flag claim is returned to the client palette.
9. The palette itself performs no Gemini call and no third-party network call.
10. The UI follows the EviBrief design system, uses the existing shadcn command primitives, avoids red/amber/green, and remains usable without horizontal scroll.
11. Tests cover the command index's evidence eligibility and metadata-only shape. Browser coverage is added only if it can be done without auth bypasses or real credentials.
12. `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` run after implementation.

## Checks to run

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

No database migration is expected. Do not run `prisma migrate dev`.

## Manual test steps

1. Start the app with `npm run dev` and sign in with an allowed Google Workspace account in a configured local environment.
2. Open an authenticated app route such as `/signals`.
3. Click the "Search signals & evidence" trigger and confirm the palette opens with grouped destinations.
4. Press `Escape` and confirm it closes.
5. Press `Ctrl+K` or `Meta+K` and confirm it opens again.
6. Type part of a core destination, a signal title, and an eligible evidence title/citation key; confirm matching rows appear and long labels truncate cleanly.
7. Select a static destination and confirm it navigates.
8. Select a signal result and confirm it navigates to `/signals/<id>`.
9. Select an evidence result or "Search eligible evidence for ..." and confirm it navigates to the Evidence Library without exposing excerpts in the palette.
10. Confirm pending/unpublished/community evidence does not appear in palette results.
11. Confirm no command query or result title appears in the server console, Sentry payloads, or PostHog payloads.
12. Check the nav at narrow, tablet, laptop, desktop, and wide widths; confirm no horizontal page scroll and no text overlap.

## Not in scope

- A full-text live search API.
- Debounced server search while typing.
- Gemini query embedding inside the palette.
- New analytics events for command usage.
- Mutating commands such as approve, classify, re-run matcher, export, send digest, or submit.
- Admin/settings screens.
- Authenticated E2E fixtures or a test login bypass.
- Mobile Field Officer command palette.
- Database migrations or new indexes.
