---
name: server-actions
description: Load when writing or changing any EviBrief mutation — Server Action structure and colocation, authorise-first role checks, Zod schemas shared with React Hook Form, error-result shape, useOptimistic on the kanban and evidence selection — and for the trimmed domain-restricted Auth.js v5 + Google Workspace SSO setup, which lives here by deliberate choice.
---

# Server Actions (and Auth.js v5)

Scope: **the mutation path and who is allowed to use it.** Colocation, authorisation, validation, error shape, optimistic updates, and authentication.

There is no vendor skill for Auth.js, and none should be invented (`AGENTS.md` §6). **Auth.js lives in this skill by deliberate choice** — spec §10.1's Phase 1 Auth row routes the Google Workspace SSO setup here rather than to a ninth skill, specifically so nobody rebuilds the generic credentials-provider boilerplate this project excludes. That is a decision, not an oversight; don't "fix" it by splitting it out.

Rules: `AGENTS.md` §5.3 (boundaries), §10 (roles), §8 (humans decide). Spec: §5.5, §4.3, §5.2.

**Not installed yet.** As of writing there is no Auth.js, Zod, or React Hook Form dependency and no `auth.ts`. Next.js is 16.2 with React 19.2. Read the relevant guide in `node_modules/next/dist/docs/01-app/` before writing a Server Action, and read the installed Auth.js package's own docs and types before writing auth config — this version's surface differs substantially from the v4 tutorials that dominate training data (`AGENTS.md` preamble).

## Server Actions are the only mutation path

- **The only mutation path.** UI does not mutate through Route Handlers (`AGENTS.md` §5.3).
- **Colocated with the routes that use them** (spec §5.5, `AGENTS.md` §5.3). The action for `/signals/[id]/generate` lives with that route, not in a global `actions/` barrel.
- Route Handlers stay thin and exist for **external** callers: webhooks, the Inngest serve endpoint, export downloads, WhatsApp/USSD callbacks. No business logic in them.
- Only Server Components fetch initial page data. No client-side data-fetching library on primary read paths; **SWR is allowed solely for the signal dashboard's live polling** (`AGENTS.md` §5.3).
- Actions stay short. Validate, authorise, orchestrate, return. Pipeline work belongs in the AI, data, or job layers — an action that grew a retrieval loop or a Gemini call inline has absorbed a layer that isn't its own (`AGENTS.md` §18 code standards).
- The UI never calls Gemini, LangChain, or any model directly. An action may call the AI layer; the AI layer is reachable only through the governance gate (`evidence-governance`).

## Authorise first, inside the action

**Every Server Action authorises the caller before doing work, server-side, inside the action. UI-level hiding is presentation, never enforcement** (`AGENTS.md` §10.1).

Order, every time: resolve the session → authorise the role for *this* operation on *this* object → validate input → do the work.

Authorise before validating, so an unauthorised caller learns nothing from validation messages about a resource they cannot touch.

### The role matrix

| Role | May |
|---|---|
| **Programme Director** | Full access. **The only role that can approve, send back, or reject a brief**, and the only role that can **submit or publish** an approved brief (`AGENTS.md` §10.2) |
| **Policy & Advocacy Officer** | Monitors signals, generates and refines briefs, manages stakeholder records. **Cannot approve any brief, including their own** (§10.3) |
| **Research Officer** | Ingests evidence, **sets classification**, validates matches, annotates gaps, reviews factual accuracy. **May resolve or dismiss guard flags** (§10.4) |
| **Field Officer** | **Mobile submission only.** May submit field observations and read digests. **No** brief generation, approval, classification, or CRM access (§10.5) |

### The four restrictions that get broken most often

1. **Brief approval** — Programme Director only, and **refused while unresolved hallucination-guard flags exist** (§10.7, §9.5). The action re-reads flag state and returns a refusal; the disabled button is separate and is not the control. See `hallucination-guard`, which must agree with this file.
2. **Flag dismissal** — Research Officer and Programme Director only. **A Policy & Advocacy Officer may not clear a flag on a brief they drafted** (§10.6). Dismissal records actor, timestamp, and reason.
3. **Classification changes** — Research Officer and Programme Director only, **logged with actor and timestamp** (§10.8). This is the enforcement point for `evidence-governance`'s tagging gate.
4. **Status transitions** — `draft → reviewed → submitted/published` only through an explicit human action, recorded with actor and timestamp (§8.3). No auto-publish, no auto-approve, no auto-submit, **not even behind a flag** (§8.2). Signals never auto-advance past `reviewed` (§8.5), and reclassifying a signal logs who changed it and when (§8.6).

Authorisation is object-level, not just role-level: "is a Policy & Advocacy Officer" and "is the officer who drafted this brief" are different questions, and restriction 2 needs both.

## Zod schemas, shared — but never authorisation

**Share Zod schemas between Server Actions and React Hook Form so validation rules exist once** (`AGENTS.md` §10.10, spec §5.5). One schema module per form, imported by both sides.

**Authorisation logic is never expressed in a client-visible shared schema** (§10.10). A shared schema is shipped to the browser. It may describe *shape* — required fields, lengths, enum membership. It may not encode who is allowed to do the thing, which roles exist, or which transitions a role can trigger. Those live in server-only modules.

```
// shared schema:   what a valid brief-generation request looks like
// server-only:     whether this caller may make one
```

Validate on the server regardless of what the client validated. Client validation is a courtesy to the user, never a guarantee to the server.

## Error handling

Return typed results; don't throw across the action boundary for expected outcomes (`AGENTS.md` §18: typed pipeline results, safe error handling, no silent catches).

The outcomes an EviBrief action commonly needs to return, all of them ordinary and all of them user-visible:

- **unauthorised** — role or object-level check failed
- **invalid** — Zod failure, field-mapped for the form
- **refused: ineligible classification** — from the governance gate (`evidence-governance`)
- **refused: unresolved flags** — approval blocked (`hallucination-guard`)
- **rate limited** — with retry timing, draft preserved (`gemini-integration`)
- **gap** — Evidence Matcher found nothing above threshold; carries a real next step, never an empty panel (`AGENTS.md` §15.4)

Each of these has a designed UI state (`AGENTS.md` §17.6, spec §5.2). None of them is a generic error toast. Never swallow one into a silent `catch`, and never log evidence body text while reporting one (`AGENTS.md` §7.6).

## Optimistic updates

`useOptimistic` for the **kanban board** and the **evidence-selection UI**, so drag/reorder and add/remove feel instant ahead of the round-trip (spec §5.5, `AGENTS.md` §3 skill description).

- Optimistic state is presentation. The server result is truth; reconcile to it, and roll back visibly on refusal.
- Never apply an optimistic update to something the server may refuse on authorisation grounds — a Field Officer must not briefly see a brief approved. Optimism is for operations already known to be permitted.
- **Never animate an automatic urgency reclassification.** Silent re-sorting must not surprise someone mid-review (`AGENTS.md` §11.10) — changes queue and apply on next load. That is a hard constraint on how the kanban applies server-pushed changes, not a styling note.
- Drag mechanics are dnd-kit; motion and drop behaviour are in `design-system`.

## Auth.js v5 + Google Workspace SSO

**Authentication is Google Workspace SSO restricted to the Tropenbos domain** (`AGENTS.md` §10.9, spec §4.3). Not Supabase Auth (`AGENTS.md` §6).

The trimmed setup, deliberately:

- **One provider: Google.** No credentials provider, no email/password, no magic links. There is no local-account path to build, secure, or reason about.
- **Domain restriction is enforced server-side at sign-in.** A sign-in whose verified email domain is not `AUTH_ALLOWED_DOMAIN` is rejected. Not hidden in the UI — rejected. Check the domain against the *verified* identity from the provider, not a user-supplied field.
- **Role is server-side data.** Roles come from the database, resolved server-side and re-read in each action. A role claim carried only in a client-readable place is not an authorisation source.
- Session access in Server Components, Server Actions, and Route Handlers goes through the v5 `auth()` helper from the root config module; the route handlers come from the same config's exported handlers. **Verify the exact export names, config keys, and callback signatures against the installed package's types before writing them** — do not reconstruct them from memory or from v4 examples.
- Env vars, all server-only: `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_DOMAIN` (`AGENTS.md` §18). Never `NEXT_PUBLIC_*`, never committed.
- If the chosen session strategy needs database tables, they go through the Prisma schema and a migration like anything else (`supabase-schema`).

### The unauthenticated read path

**The WhatsApp/USSD digest path requires no login, and nothing on that path may mutate state** (`AGENTS.md` §10.9, spec §5.2 Field Officer step 6). It is Route Handler territory, read-only, and it must not reach a Server Action. Verify the inbound request's authenticity via the provider's own signature/token mechanism — no login does not mean no verification.

Field Officer routes are mobile-first with no login friction beyond initial SSO (`AGENTS.md` §17.1), and field submissions enter as `community_sourced` at `unpublished_internal`, blocked from the AI pipeline until a Research Officer reviews them (§17.3). Offline submissions queue locally and sync when connectivity returns — **never a silent failure and never a silent queue** (§17.2).

## Related

- `evidence-governance` — the gate, and who may change a classification
- `hallucination-guard` — the approval refusal and dismissal authority this file must agree with
- `gemini-integration` — what an action calls, and the rate-limit result it must surface
- `supabase-schema` — the tables these actions write, and the audit rows the role rules require
- `design-system` — the UI states each error result renders as
- `node_modules/next/dist/docs/01-app/` — the current Server Action and caching surface
