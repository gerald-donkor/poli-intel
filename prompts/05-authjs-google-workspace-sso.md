# 05 — Auth.js v5 + Google Workspace SSO and the role authorisation layer

## Goal

Give EviBrief a real session and a real server-side role source, so that every later feature has something to authorise against.

Concretely:

1. Auth.js v5 configured with **one provider (Google)**, domain-restricted to `AUTH_ALLOWED_DOMAIN`, rejected server-side at sign-in.
2. A server-only **session DAL** (`verifySession` / `getCurrentStaffUser`) that resolves the signed-in `StaffUser` row — including its `StaffRole` — from the database on every render pass and every action call.
3. A server-only **authorisation module** expressing the §10 role matrix as named, typed predicates, importable by every future Server Action.
4. A **sign-in screen** and a **user menu with sign out**, built from existing tokens and components.
5. Route-level session gating for `/`, `/(app)/*`, and `/field/*`.

Out of scope, deliberately: no admin/user-management panel (`AGENTS.md` §1 forbids an unrequested one), no credentials provider, no magic links, no Prisma adapter tables, no `proxy.ts`, no per-feature actions (there are no features to authorise yet — this prompt ships the mechanism plus its first two consumers, sign-in and sign-out).

## Why this is next

`AGENTS.md` §10.1 requires every Server Action to authorise its caller server-side, inside the action. `StaffUser` and `StaffRole` already exist in `prisma/schema.prisma` (prompt 04) and every audit row in the schema — `BriefStatusChange.actorId`, `SignalReclassification.actorId`, `EvidenceClassificationChange.actorId` — is a non-nullable FK to `StaffUser` with `onDelete: Restrict`. Nothing that mutates can be built correctly until an actor can be resolved. Evidence ingestion, the classification gate's enforcement point (§7.3, §10.8), brief generation, flag dismissal, and the CRM all depend on this.

## Skills read

- `server-actions` (project) — Auth.js v5 lives here by deliberate choice; the trimmed domain-restricted setup, the role matrix, the four most-broken restrictions, the typed-result error shape, and the rule that authorisation is never in a client-visible shared schema.
- `design-system` (project) — tokens, the no-clinical-white and no-`destructive` rules, the abstract-mark rule, WCAG AA, the `tablet`/`laptop`/`desktop` min-width variants.
- `shadcn` (vendor) — loaded together with `design-system` as `AGENTS.md` §11 requires for UI work. Its critical rules bind this prompt: use existing components before custom markup, built-in variants before custom styles, `className` for layout not styling, `gap-*` not `space-y-*`, `size-*` for equal dimensions, `truncate` shorthand, `cn()` for conditionals, items inside their Group, `Avatar` always needs `AvatarFallback`, callouts use `Alert`, `Separator` not `<hr>`, and `Button` has no `isLoading` prop.
- `design_handoff_evibrief/design-system.md` — read in full: shadcn `:root` aliasing block, the utility-recipe table, colour table with contrast notes, type scale, 8px spacing scale, radius and three-step elevation scale, iconography rule, component→shadcn mapping, breakpoints and grid recipes, motion table and keyframes.
- `design_handoff_evibrief/README.md` — read in full: the two-user framing, the hard anti-patterns, all five screen specs, the five key UX states, and **"Assets: None — all marks in the designs are CSS primitives (bordered squares/circles, concentric `box-shadow` rings for the contour motif)"**.
- `design_handoff_evibrief/EviBrief Design System.dc.html` — read for intent (specimen sheet: palette, urgency ramp, relevance, type, spacing/radius/elevation, component states). Its **primary button specimen** is `13.5px/600`, `#FDFCF9` on `#0F6E56`, `1px` same-colour border, **`6px` radius**, `9px 16px` padding. Cross-checked against the installed `Button`: `--radius-lg → --radius → --radius-card = 6px` and `--primary-foreground → --color-card = #FDFCF9`, so **the installed default variant already matches the prototype exactly**. The only difference is 14px vs 13.5px type, and `design-system.md`'s scale has no 13.5px step (body is 14px) — so the component is correct and must not be restyled. The specimen sheet also confirms **24px card padding** and the disabled-approve treatment (`#8E8B84` on `#F2EFE9`, `cursor: not-allowed`) that §9.5 will need later.
- `design_handoff_evibrief/EviBrief Screens.dc.html` — read for intent, never copied. Source of the contour-ring mark recipe below (line 803) and the impact map's larger background motif (line 715). `README.md` carries the authored intent for all five frames in prose; the HTML was consulted for exact recipes only.
- `design_handoff_evibrief/support.js` — **deliberately not read and deliberately not used.** It is prototype runtime with no place in the application (`AGENTS.md` §2, `README.md`, and §19 which records its two pre-existing lint errors as not-our-code). No file in this prompt imports, adapts, or reformats it. Listing it here is the record that it was consciously excluded, not overlooked.
- **Verified, not assumed: the handoff contains no sign-in/auth screen.** `README.md` enumerates exactly five screens (frames `1a`–`1e`: Signal Dashboard, Brief Editor, Evidence Library, Field Officer view, Impact map) and five states (`1f`–`1j`: empty, rate-limited, generating, flagged, classification-pending). Grepping both `.dc.html` prototypes for sign-in/login/SSO vocabulary returns one incidental "sso" hit each and no screen. So the sign-in screen is **new UI with no reference frame**, and it must be assembled from the handoff's existing idioms rather than invented — the specific borrowings are named below. The `.dc.html` files were read for intent only, never copied; `support.js` is untouched.
- Not loaded, correctly: `evidence-governance`, `gemini-integration`, `hallucination-guard`. This task has no AI data path (see below).

## Existing code inspected

- `prisma/schema.prisma` — `StaffUser` (id, email @unique, name, role, timestamps) and `StaffRole` (`programme_director`, `policy_advocacy_officer`, `research_officer`, `field_officer`). Its comment already states the intent: *"Auth.js v5 runs a JWT session strategy, so there are no adapter tables here… role assignment must survive a session, so it is a row, not a JWT claim."* This prompt honours that literally.
- `lib/db/client.ts`, `lib/db/index.ts` — `import "server-only"`, Prisma 7 + `PrismaPg` driver adapter, hot-reload-safe singleton. `lib/db/index.ts` is the data layer's only public surface and states that nothing outside `lib/db/` constructs a client or writes SQL.
- `prisma.config.ts` — connection URLs live here for Migrate/Studio only.
- `app/layout.tsx` — three `next/font/google` families wired to `--font-*`; `<body className="flex min-h-full flex-col">`.
- `app/(app)/layout.tsx` — skip link, `AppNav`, `<main id="main">`. A nested layout, not a second root layout.
- `app/field/layout.tsx` — single-column `max-w-[480px]`, no desktop nav, never adapted upward.
- `app/page.tsx` — `redirect("/signals")`, with a comment that says this becomes role-dependent when auth lands. It does, here.
- `components/app-nav.tsx` — client component. Already carries the comment *"showing or hiding a link here is NOT access control"*. Ends with a hard-coded `Avatar` / `AvatarFallback` reading `TB` — that placeholder is what this prompt replaces.
- `app/globals.css` — the EviBrief `@theme` block is in place: `primary`, `accent`, `surface-tint`, `paper`, `card`, `stone`, `line`, `ink`/`ink-2`/`ink-3`, the four urgency ramps, `--text-*` scale, `--radius-input|card|modal`, `--shadow-raised|overlay`, `--animate-rise-in`, `--breakpoint-tablet|laptop|desktop`. `--destructive` is deliberately unmapped.
- `components/page-header.tsx`, `components/screen-placeholder.tsx` — existing page-composition patterns.
- `components.json` + `npx shadcn@latest info --json` — **`style: "base-nova"`, `base: "base"` (Base UI, not Radix), `rsc: true`, `tsx: true`, `tailwindVersion: "v4"`, `tailwindCss: app/globals.css`, `iconLibrary: "lucide"`, alias `@/`.** The whole component set is already installed (59 files in `components/ui/`), so **no `shadcn add` is needed and none should be run**.
- `components/ui/alert.tsx` — **already carries this project's own variants and shadcn's red `destructive` variant has been removed**: `default`, `guard` (watch ramp, cites §9.7 "a guard flag is a review prompt, not an error"), `pending` (immediate ramp, cites §7.5). Use these variants; do not hand-write ramp classes.
- `components/ui/button.tsx` — `default` variant is `bg-primary text-primary-foreground hover:bg-primary/80`; sizes `default` = h-8, `lg` = h-9; `aria-invalid` already de-redded onto the `watch` ramp. Focus ring is built in (`focus-visible:border-ring focus-visible:ring-3`).
- `components/ui/dropdown-menu.tsx` — wraps `@base-ui/react/menu`; exports include `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuItem`, `DropdownMenuSeparator`.
- `components/ui/avatar.tsx` — wraps Base UI avatar; `Avatar`, `AvatarImage`, `AvatarFallback`.
- Also already installed and relevant: `separator.tsx`, `spinner.tsx`, `field.tsx`, `empty.tsx`, `toast.tsx` (Base UI toast, **not** sonner).
- `.env.example` — already lists `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_DOMAIN`, all server-only. **No change needed**; do not add a variable.
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — the DAL pattern (§"Creating a Data Access Layer"), the `React.cache` memoisation per render pass, and §"Layouts and auth checks": *layouts do not re-render on navigation, so do the check close to the data source.*
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — **the `middleware` file convention is deprecated and renamed `proxy` in Next 16**, and proxy "should not be used as a full session management or authorization solution."
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/authInterrupts.md` — `unauthorized()` / `forbidden()` are experimental and gated behind `experimental.authInterrupts`.
- `npm view next-auth dist-tags` → `beta: 5.0.0-beta.32`; nothing under `node_modules/next-auth` or `node_modules/@auth` yet.

## Decisions and assumptions

1. **`next-auth@5.0.0-beta.32`** is the version to install (the `beta` dist-tag; v5 has no stable release). Pin the exact version rather than a range — betas break between releases. After install, **read `node_modules/next-auth/`'s own `.d.ts` files and verify every export name, config key, and callback signature before writing `auth.ts`**. Do not write the config from memory or from a v4 tutorial (`AGENTS.md` preamble, `server-actions`). If an API named below does not exist in the installed types, follow the installed types and note the divergence in the implementation report — do not invent a shim.

2. **No `proxy.ts` and no `middleware.ts`.** Enforcement is in the DAL and in each action, per the Next 16 docs' explicit warning and the DAL recommendation. A proxy-level redirect would be an optimistic convenience at best and a false sense of enforcement at worst. Do not create the file.

3. **No `unauthorized()` / `forbidden()`.** They require `experimental.authInterrupts`, and this project does not turn on experimental flags for a convenience. Unauthenticated → `redirect("/signin")`. Wrong role → a rendered, calm "not available for your role" panel, plus the server-side refusal in the action layer.

4. **JWT session strategy, no adapter.** Matches the `StaffUser` comment in the schema. The JWT carries `staffUserId` and `email` only. **Role is never read from the token** — it is re-read from the database in `getCurrentStaffUser()` on every render pass and every action call, so a demotion takes effect immediately rather than at next token refresh. This is the §10 "role is server-side data" rule taken literally.

5. **Domain restriction** is checked in the `signIn` callback against the provider's **verified** email (`profile.email_verified === true` *and* the email's domain matching `AUTH_ALLOWED_DOMAIN`, case-insensitively). An unverified email is rejected even on the right domain. Returning `false` from the callback is the rejection; the sign-in page renders the reason from the error query param. Also pass `hd: AUTH_ALLOWED_DOMAIN` as a Google `authorization.params` hint — a UX nicety, **never the enforcement**; the callback check stands alone and must not be made conditional on it.

6. **First sign-in auto-provisions a `StaffUser` row at the least-privileged role, `field_officer`.** Rationale: the domain check has already established the person is Tropenbos staff, so refusing them entirely would leave no path in, while granting anything above `field_officer` automatically would hand out brief generation or classification authority on the strength of an email domain. `field_officer` grants mobile submission and digest reading only (§10.5).
   - Role is set **explicitly at the single provisioning call site**, not as a `@default` in `schema.prisma`. This keeps prompt 05 free of a migration (and of the `db:migrate:new` HNSW-drop hazard in §19). If a schema-level default is wanted later it is a one-line migration.
   - Promotion to another role is done by a Programme Director via `npm run db:studio` for now. **This is an accepted, documented gap**, recorded in the prompt's manual test steps. A role-management surface is not in §1's build list and is not invented here.
   - Provisioning is an `upsert` on `email` so a name change at Google updates `name` and never touches `role`.

7. **Prisma stays in the data layer.** All `StaffUser` reads and the provisioning upsert live in a new `lib/db/staff.ts`, re-exported from `lib/db/index.ts`. `auth.ts` and `lib/auth/*` call the data layer; they never construct a client (§5.2).

8. **Authorisation predicates are server-only and not Zod.** They live in `lib/auth/authorize.ts` with `import "server-only"`. Nothing in `lib/auth/` may be imported by a client component; the nav receives a plain serialisable DTO (`{ name, email, role, initials }`) as props from the layout, per the authentication guide's "Client Components can't import the DAL".

9. **Role-derived landing.** `app/page.tsx` sends `field_officer` → `/field` and every other role → `/signals`. An unauthenticated visitor → `/signin`.

10. **This project is on Base UI, not Radix** (`base: "base"`). Custom triggers therefore use Base UI's **`render` prop, never Radix's `asChild`** — writing `asChild` here silently does nothing. Feedback is the Base UI `toast` component if ever needed, not `sonner`. Verify any component API against the file in `components/ui/` before use rather than against a Radix-era example.

11. **Reuse the installed primitives and their variants; do not hand-style.** The sign-in button is `Button`, the domain-mismatch callout is `Alert variant="guard"`, the menu divider is `Separator`. Per the `shadcn` rules, `className` carries layout (`w-full`, `max-w-*`, `gap-*`) and never overrides a component's colour or typography. This replaces the hand-written `bg-primary hover:bg-primary-hover …` and `bg-watch-surface border-watch-border …` recipes that an earlier draft of this prompt specified — those duplicated variants that already exist.

12. **`/field` requires a session** (`AGENTS.md` §17.1: "no login friction *beyond initial SSO*" — initial SSO is still required). The read-only WhatsApp/USSD digest path is the only no-login path and it is not in this prompt.

## Files likely to change

**New**

| Path | Purpose |
|---|---|
| `auth.ts` | Root Auth.js v5 config: Google provider, `hd` hint, `signIn` domain+verification callback, `jwt`/`session` callbacks, exported `handlers`, `auth`, `signIn`, `signOut` (names to be confirmed against installed types) |
| `app/api/auth/[...nextauth]/route.ts` | `export const { GET, POST } = handlers` — thin, no logic (§5.3) |
| `lib/db/staff.ts` | `findStaffUserById`, `findStaffUserByEmail`, `provisionStaffUser` (upsert on email, role set only on create) |
| `lib/auth/session.ts` | `server-only`. `getSession()`, `getCurrentStaffUser()` (both `React.cache`-memoised), `requireStaffUser()` (redirects to `/signin`), `requireRole(...roles)` |
| `lib/auth/authorize.ts` | `server-only`. The §10 matrix as named predicates + the typed `AuthzResult` / unauthorised result shape future actions return |
| `lib/auth/dto.ts` | `server-only`. `toStaffUserDto(user)` → the serialisable `{ name, email, role, initials }` the nav gets. No id, no timestamps |
| `app/signin/page.tsx` | The sign-in screen (Server Component); redirects an already-signed-in visitor away |
| `app/signin/actions.ts` | `"use server"`. `signInWithGoogle()` |
| `app/signin/sign-in-button.tsx` | Client component; `useFormStatus`-based pending state on the action |
| `app/(app)/auth-actions.ts` | `"use server"`. `signOutAction()`, colocated with the shell that uses it |
| `components/user-menu.tsx` | Client component: `DropdownMenu` on the existing `Avatar`, showing name, email, role label, and Sign out |

**Modified**

| Path | Change |
|---|---|
| `package.json` | add `next-auth: "5.0.0-beta.32"` to `dependencies` |
| `app/(app)/layout.tsx` | `await requireStaffUser()`, pass the DTO to `AppNav` |
| `components/app-nav.tsx` | accept a `user` prop; replace the hard-coded `TB` avatar with `<UserMenu />`; keep the existing "hiding a link is not access control" comment intact |
| `app/field/layout.tsx` | `await requireStaffUser()` |
| `app/page.tsx` | role-derived landing; replace the "when auth lands" comment with what actually happens |
| `AGENTS.md` §19 | only if a script is added. **None is** — so expect no change; do not touch it otherwise |

**Explicitly not changed:** `.env.example` (already complete), `prisma/schema.prisma` (no migration), `next.config.ts` (no experimental flags), `app/globals.css` (no new tokens needed).

## Evidence classification impact

**None — no evidence data path.** This task reads and writes `StaffUser` only. It touches no `EvidenceItem`, `EvidenceChunk`, `Brief`, or `PolicySignal` row; it makes no Gemini call of any kind; it moves no evidence text anywhere.

It is, however, **the prerequisite for the gate's enforcement point**: `AGENTS.md` §10.8 restricts classification changes to Research Officer and Programme Director and requires them logged with actor and timestamp, and `EvidenceClassificationChange.actorId` is a non-nullable FK. So this prompt ships `canChangeEvidenceClassification(role)` in `lib/auth/authorize.ts` as the named predicate that the later ingestion/classification prompt calls — the predicate exists here; the classification action that consumes it does not, and must not be built here.

One governance rule does bind this task directly: **§7.6 — no evidence body text in logs or error reports.** Nothing here logs evidence, and nothing here may log an OAuth token, an id token, or a session cookie either. On a rejected sign-in, log the domain decision without the full email address.

## Hallucination-guard implications

**None.** This task does not generate anything, does not extract claims, does not create/read/store/render a `HallucinationFlag`, and does not change what a flag blocks. Flag rendering is untouched, so the §9.7 visual contract is not restated here.

Adjacent-but-not-changed, for the record: §9.5's "unresolved flags block Programme Director approval" and §10.6's dismissal authority both need a role check. This prompt ships `canApproveBrief(role)` and `canDismissFlag(role, brief)` as predicates in `lib/auth/authorize.ts` — **`canApproveBrief` is role-only and is explicitly documented in its own doc comment as insufficient on its own**: the approval action must additionally re-read open-flag state server-side and refuse. Shipping the role predicate without that warning is how §9.5 gets quietly lost later.

## Implementation requirements

### Auth config (`auth.ts`)

- Google provider only. No credentials provider, no email provider, no adapter.
- `session: { strategy: "jwt" }`.
- `signIn({ profile })` callback: return `false` unless the profile's email is verified **and** `email.split("@")[1].toLowerCase() === process.env.AUTH_ALLOWED_DOMAIN?.toLowerCase()`. Fail closed if `AUTH_ALLOWED_DOMAIN` is unset — treat a missing domain restriction as "reject everyone", never "allow everyone".
- On a successful `signIn`, call `provisionStaffUser({ email, name })` from the data layer and put the returned `id` on the token in the `jwt` callback. Do **not** put `role` on the token.
- `session` callback exposes `user.staffUserId` and `user.email`. Extend Auth.js's types via module augmentation in a `types/next-auth.d.ts` (or wherever the installed package's types expect it) rather than casting with `as`. No `any` (§18).
- `pages: { signIn: "/signin", error: "/signin" }` so no default Auth.js UI is ever reachable.
- Read the exact key names for all of the above from the installed types first (decision 1).

### Session DAL (`lib/auth/session.ts`)

```
getSession()            // cache()-wrapped auth(); null when unauthenticated
getCurrentStaffUser()   // cache(): session → findStaffUserById → StaffUser | null
requireStaffUser()      // getCurrentStaffUser() ?? redirect("/signin")
requireRole(...roles)   // requireStaffUser() then role membership; redirect or throw a typed refusal
```

- `import "server-only"` at the top of every file in `lib/auth/`.
- Memoise with `React.cache` so a layout and a page in the same render pass share one database round-trip (per the authentication guide).
- A session whose `staffUserId` no longer resolves to a row (deleted user) is treated as unauthenticated → `/signin`. Not a crash, not a silent `null` that a caller may forget to check.

### Authorisation (`lib/auth/authorize.ts`)

Named predicates over `StaffRole`, one per §10 rule, each with a doc comment citing the section:

- `canApproveOrRejectBrief` — `programme_director` only (§10.2). Doc comment must state the flag re-check requirement (§9.5).
- `canSubmitOrPublishBrief` — `programme_director` only (§10.2).
- `canGenerateBrief` — `programme_director`, `policy_advocacy_officer` (§10.3).
- `canManageStakeholders` — `programme_director`, `policy_advocacy_officer` (§10.3, and §10.5's explicit no-CRM for Field Officer).
- `canIngestEvidence` — `programme_director`, `research_officer` (§10.4).
- `canChangeEvidenceClassification` — `programme_director`, `research_officer` (§10.8).
- `canDismissFlag(role, opts)` — `research_officer` or `programme_director`, and object-level: **a `policy_advocacy_officer` may not clear a flag on a brief they drafted** — encoded as a signature that requires the brief's `createdById`, so a caller cannot accidentally do the role-only check (§10.6).
- `canSubmitFieldObservation` — all four roles (§10.5).

Plus the shared refusal type future actions return, matching `server-actions`' error list:

```
type ActionRefusal =
  | { kind: "unauthorised"; message: string }
  | { kind: "invalid"; fieldErrors: Record<string, string[]> }
  ...
```

Ship only the `unauthorised` variant plus the discriminated-union scaffold in this prompt. Do **not** pre-build `refused-ineligible-classification`, `refused-unresolved-flags`, `rate-limited`, or `gap` — those arrive with the features that produce them, and speculatively shaping them now is over-engineering (§18).

No role list, no predicate, and no refusal-authoring logic may appear in a shared Zod schema or any file importable from a client component (§10.10).

### Sign-in screen (`app/signin/page.tsx`)

Composed from existing tokens. Read `design_handoff_evibrief/design-system.md` before writing it.

- **Layout.** `bg-paper` full-height page, single centred card. Use the installed `Card` with its **full composition** (`CardHeader` / `CardTitle` / `CardDescription` / `CardContent`) rather than dumping everything into one node, or a plain `div` if `Card`'s own chrome fights the design — decide by reading `components/ui/card.tsx` first. Surface is the handoff's **card recipe verbatim: `bg-card border border-line rounded-card shadow-raised`** (elevation step 2, "resting card"). Width via `w-full max-w-[400px]`. Vertically centred with generous top/bottom padding so it never clips at 320px. Mobile-first: the base layer *is* the layout; only padding changes at `tablet:`. No fixed pixel width on any container (§11.15).
- **Padding.** `p-6 tablet:p-8` — the handoff sets **card padding at 24px** and an 8px base scale of 4/8/12/16/24/32/48/64. An earlier draft of this prompt said `p-8 tablet:p-10`; 40px is off-scale and 32px is not the card default. Use 24 → 32.
- **Stacking.** `flex flex-col gap-*` on the 8px scale (`gap-2`/`gap-3`/`gap-4`/`gap-6`). **No `space-y-*`** (shadcn rule).
- **Mark — reuse the prototype's actual contour-ring recipe.** The empty state (frame `1f`) is the handoff's only centred single-purpose screen, and its mark is this, read off `EviBrief Screens.dc.html` line 803:

  ```
  width:56px; height:56px; border-radius:50%; border:1px solid #C3D2C8;
  box-shadow: 0 0 0 9px #F7F5F0, 0 0 0 10px #E4E1D8,
              0 0 0 19px #FBFAF6, 0 0 0 20px #EFECE4;
  ```

  A sage-bordered circle with two alternating contour rings — the topographic motif in §11.7. Port it to tokens, not hex: `size-14 rounded-full border border-sage` plus `shadow-[0_0_0_9px_var(--color-paper),0_0_0_10px_var(--color-line),0_0_0_19px_var(--color-card),0_0_0_20px_var(--color-stone)]`. **`#FBFAF6` in the prototype is not a project token** — the nearest is `card` `#FDFCF9`; use the token, since `design-system.md` wins over the HTML (`README.md`). The rings extend 20px past the element's box and do not affect layout, so reserve clear space around it or the outer ring will collide with the heading.
  `aria-hidden`. **Assets: none** — pure CSS, no image, no SVG file, no logo asset (`README.md` "Assets", §11.7).
- **Type.** `EviBrief` wordmark in `text-primary text-[13px] font-semibold tracking-[0.12em] uppercase`, matching `app-nav.tsx` exactly. Heading `text-h2` in `text-ink`. One supporting line at `text-body` in `text-ink-2`, plain and unhurried — e.g. "Sign in with your Tropenbos Ghana Workspace account." **No serif anywhere on this screen** — nothing here is quoted material (§11.6).
- **Button.** The installed `Button`, default variant (already `bg-primary text-primary-foreground`), `size="lg"`, `className="h-11 w-full"`. **Do not restyle its colours or type** — that is what "className for layout, not styling" means, and the primary palette is already correct. The height override is ergonomic, not decorative: `size="lg"` is 36px and the handoff requires a **44px+ tap target** for the equivalent full-width primary action (the `/field` footer button). This is the one and only primary action on the view, matching the handoff's "one primary action per view". Label "Continue with Google", optionally with a lucide icon carrying `data-icon="inline-start"` and **no sizing class** (the component sizes its own icons).
- **Pending state.** `useFormStatus`; label becomes "Signing in…" and the button takes `disabled`. **Deliberately no `Spinner`**, even though the vendor rule offers `Spinner` + `data-icon` as the loading composition — `design-system` forbids an indeterminate spinner in this product. Project convention wins over vendor default (`AGENTS.md` §3). `Button` has no `isLoading`/`isPending` prop; do not invent one.
- **Form.** `<form action={signInWithGoogle}>`. Keyboard-submittable; the navigation works without JS.
- **Error state.** Read the `error` search param (`await searchParams` — Next 16 async params). Render `<Alert variant="guard">` — the existing project variant on the watch ramp. Copy: "That account isn't on the Tropenbos Ghana Workspace domain. Sign in with your work account." Distinct copy for a generic OAuth failure. **Never `destructive`** (it no longer exists in `alert.tsx`), never red, no toast (§11.4).
- **Focus ring — a real divergence to settle, not gloss over.** The handoff's global recipe is `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper`. The installed `Button` ships `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` — same hue (`--ring` aliases to `--color-accent` in the handoff's `:root` block) but 3px at 50% opacity with **no offset**, versus 2px solid with a 2px paper offset. **Keep the component's built-in ring** rather than overriding it per call site: it is already accent-hued, it is visible against `card`, and diverging one button from every other focus ring in the product is worse than a 1px/opacity difference from the handoff. **Verify it clears 3:1 against `card` before accepting it**; if it does not, the fix is the shared `:root`/component layer in a follow-up, not a one-off className here. Never `outline: none` alone, and never strip the ring.
- **Copy register.** The handoff's placeholder copy is realistic scenario content and instructs: replace the content, **keep the register** — calm, institutional, unhurried. No exclamation marks, no "Welcome back!", no startup warmth (§11.8).
- **Motion.** None. `--animate-rise-in` exists and would be on-system, but §11.11 says cut the animation when in doubt, and an auth screen has nothing to explain. Do not add it.
- **Copy.** No wording implying the system decided, verified, or endorsed anything (§8.8).
- **Responsive check at 320, 390, 760, 1000, 1300, 1600px** — no horizontal page scroll, no clipping, nothing below 13px (§11.15).
- Add `export const metadata = { title: "Sign in · EviBrief" }`, matching the existing pages' pattern.
- An already-signed-in visitor is redirected by role (same rule as `app/page.tsx`).

### User menu (`components/user-menu.tsx`)

- Keeps the existing `Avatar` at `size-[30px]` with `AvatarFallback` (**always required**) in `bg-surface-tint text-primary-ink text-[11.5px] font-semibold`; the fallback becomes the user's real initials, computed server-side into the DTO. No `AvatarImage` — Google profile photos are an unnecessary third-party image fetch on every page and the initials treatment is already the design.
- Wrapped in the installed `DropdownMenu` (`@base-ui/react/menu`). The avatar becomes the trigger via **`DropdownMenuTrigger`'s `render` prop — Base UI, so not `asChild`** (decision 10). Trigger has an accessible name ("Account menu" plus the user's name), is keyboard-reachable, and keeps its built-in focus ring. **No manual `z-index`** — the menu handles its own stacking.
- Content: `DropdownMenuLabel` holding name (`text-body text-ink`) and email (`text-meta text-ink-3` + `truncate`, so a long address never widens the nav) and the role label; then `DropdownMenuSeparator`; then the sign-out `DropdownMenuItem` **inside a `DropdownMenuGroup`** (items always live in their Group).
- Role labels: "Programme Director", "Policy & Advocacy Officer", "Research Officer", "Field Officer", from a single `Record<StaffRole, string>` mapping.
- Sign out is a `<form action={signOutAction}>` rendered through the item, not a `Link` and not a `GET`.
- Role labels are presentation. The mapping may live in the client component; **the predicates may not** (decision 8).

### Nav and layouts

- `AppNav` gains a required `user` prop of the DTO type. It stays a client component (it uses `usePathname`); the DTO crosses as props. It must not import from `lib/auth/`.
- Per the authentication guide's layout caveat, the layout's `await requireStaffUser()` is a convenience redirect and **not** the enforcement boundary — the enforcement boundary is the DAL call inside each page/action. Write that in a comment so nobody later reads the layout check as sufficient.
- If the awaited session visibly delays the shell, move the user-menu fetch into a nested Server Component behind `<Suspense>` per the guide's "Auth and streaming". Only do this if it actually matters; do not add a Suspense boundary speculatively.

## Security requirements

- `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_DOMAIN` are **server-only**. No `NEXT_PUBLIC_` prefix, no value committed, no value logged (§18).
- Fail closed: a missing `AUTH_ALLOWED_DOMAIN` rejects all sign-ins.
- The domain check runs against the provider's verified identity, never a user-supplied field or a form input.
- `lib/auth/*` and `lib/db/*` carry `import "server-only"`. Verify no client component transitively imports them — a build error is the intended safety net.
- No role in the JWT, no role in a cookie, no role in `localStorage`.
- Never log tokens, id tokens, cookies, full email addresses on rejection, or any evidence text (§7.6).
- Sign out is POST-only via a Server Action; no GET sign-out URL.
- No `any` casts around the session type — use module augmentation (§18).

## Acceptance criteria

1. `next-auth@5.0.0-beta.32` in `dependencies`; `auth.ts` written against the installed types, with no v4-only key present.
2. A Google sign-in from a `AUTH_ALLOWED_DOMAIN` address succeeds and lands the user on `/signals` (or `/field` for `field_officer`).
3. A Google sign-in from any other domain is **rejected server-side** and returns to `/signin` with the slate domain-mismatch alert. No session cookie is set.
4. With `AUTH_ALLOWED_DOMAIN` unset, all sign-ins are rejected.
5. First sign-in creates exactly one `StaffUser` row with `role = field_officer`; a second sign-in updates `name` if it changed and leaves `role` untouched.
6. Visiting `/signals`, `/briefs`, `/evidence`, `/impact`, `/field`, or `/` unauthenticated redirects to `/signin`.
7. `getCurrentStaffUser()` reads `role` from the database on every call; changing a role in `db:studio` takes effect on the next request without re-signing-in.
8. The nav shows real initials, name, email, and role label; Sign out clears the session and returns to `/signin`.
9. Every predicate in §10's matrix exists in `lib/auth/authorize.ts` with a doc comment citing its rule; `canDismissFlag`'s signature makes the object-level check unskippable; `canApproveOrRejectBrief`'s doc comment states the §9.5 flag re-check.
10. Nothing in `lib/auth/` is reachable from a client component; `AppNav` and `UserMenu` receive only the DTO.
11. No `proxy.ts`, no `middleware.ts`, no experimental flag in `next.config.ts`, no schema change, no migration, no `.env.example` change, no new npm script, and **no `shadcn add`** — the component set is already complete.
12. Sign-in screen has no red anywhere, no serif, no spinner, no leaf/tree imagery, and is clean at 320/390/760/1000/1300/1600px with no horizontal page scroll.
13. shadcn conventions hold in every new file: `Button`/`Alert`/`Separator`/`Avatar` used instead of styled `div`s; `Alert variant="guard"` instead of hand-written watch-ramp classes; `Button`'s default variant not colour-overridden; `render` not `asChild`; `DropdownMenuItem` inside `DropdownMenuGroup`; `AvatarFallback` present; `flex … gap-*` not `space-y-*`; `size-*` for equal dimensions; `truncate` shorthand; `cn()` for conditionals; no sizing class on an icon inside a component; no manual `z-index`.
14. **Handoff fidelity.** Every value on the sign-in screen traces to `design_handoff_evibrief/design-system.md`: the card is the handoff's card recipe, padding and gaps are on the 8px scale (24/32 for card padding), radius is `rounded-card` (6px), elevation is step 2 `shadow-raised`, type is the documented scale (H2 20px/600, body 14px, nothing under 13px), the mark is a CSS primitive with no asset, and the alert is the existing `guard` variant. No value is introduced that isn't in the handoff or already in `globals.css`. Any new colour pairing is contrast-verified before acceptance (§11.13, handoff "re-check any new pairing you introduce").
15. `npm run lint` shows no new errors beyond the 4 known pre-existing ones (§19); `npm run typecheck` and `npm run build` pass.

## Checks to run

```
npm install
npm run typecheck
npm run lint
npm run build
```

Report exact output. `npm run build` is required here — a `server-only` violation or a bad module augmentation surfaces at build, not at typecheck.

## Manual test steps (to hand over after implementation)

**Setup (one-time, done by the user — needs a real Google Cloud OAuth client):**

1. In Google Cloud Console → APIs & Services → Credentials, create an **OAuth 2.0 Client ID** of type *Web application*.
   - Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Authorised JavaScript origin: `http://localhost:3000`
2. In `.env.local` set:
   - `AUTH_SECRET=` → generate with `openssl rand -base64 32`
   - `AUTH_URL=http://localhost:3000`
   - `AUTH_GOOGLE_ID=` / `AUTH_GOOGLE_SECRET=` from step 1
   - `AUTH_ALLOWED_DOMAIN=` the Tropenbos Workspace domain
3. Confirm `DATABASE_URL` and `DIRECT_URL` are set and `npm run db:migrate` has been applied (prompt 04).

**Then:**

4. `npm run dev`. Visit `http://localhost:3000/signals` → expect a redirect to `/signin`.
5. Inspect the sign-in card against the handoff: warm `paper` background (never white), `card` surface with a single hairline `line` border and the faint `shadow-raised`, 6px corners, 24px padding, abstract CSS mark (no image request in the Network tab), wordmark, one supporting line, one full-width primary button at 44px. No red, no serif, no spinner, no animation on load.
6. Resize to 320px and 1600px → no horizontal page scroll, nothing clipped, no text under 13px.
7. Tab through: focus lands on the button with the accent ring; Enter submits.
8. Click **Continue with Google** and sign in with a **non-Workspace** Google account (e.g. a personal gmail). Expect: back on `/signin` with the slate alert, and **no** session cookie in DevTools → Application → Cookies.
9. Sign in with a Workspace-domain account. Expect: land on `/field` (the auto-provisioned role is `field_officer`).
10. `npm run db:studio` → `staff_user` has exactly one row, `role = field_officer`, correct email and name.
11. In Studio, change that row's `role` to `programme_director`. Reload `/` in the browser **without signing out**. Expect: land on `/signals`, and the nav's user menu now reads "Programme Director". This proves role comes from the database, not the token.
12. Open the user menu with the keyboard; check name, truncated email, role label, Sign out. Click Sign out → back on `/signin`, session cookie gone.
13. Visit `/field` while signed out → redirect to `/signin`.
14. Sign in again → the same `staff_user` row is reused (still one row) and `role` is still `programme_director`, not reset to `field_officer`.

**Known gap to confirm as accepted:** role promotion is a `db:studio` edit until a role-management surface is specified (decision 6). If that is not acceptable, say so before execution and it becomes a separate prompt.
