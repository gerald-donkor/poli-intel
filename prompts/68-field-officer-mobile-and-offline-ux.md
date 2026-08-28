# 68 — Field Officer mobile and offline UX refinement

## Goal

Refine the already-working `/field` experience into the calm, low-bandwidth Field Officer surface defined by the UI/UX roadmap: a WhatsApp-digest-like weekly update, an unmistakable but non-alarming offline/sync state, and a lightweight submission flow that stays single-column and plain-language at every viewport.

This is a refinement of the committed Field Officer implementation (`98c6989`), not a replacement for it. The data model, IndexedDB queue, service-worker scope, submission action, and notification job already exist and must remain the same. The screen's single job is to help a landscape officer in Juabeso-Bia or Sefwi-Wiawso read the next useful update and safely send an observation when connectivity is unreliable.

Optional photo capture remains deliberately out of scope. Prompt 23 recorded that field photos require a Tropenbos-controlled storage decision; do not put community images in Uploadthing or another third-party store as part of a visual refinement.

## Skills read

- `design-system` — authoritative EviBrief tokens, one-message-per-card Field Officer density, plain-language contract, offline colours, 48px touch targets, single-column rule, and reduced-motion behaviour.
- `frontend-design` — information hierarchy and restrained, subject-specific mobile design judgement. The established EviBrief design system wins wherever it is more specific.
- `shadcn` — reuse installed primitives and compose `Card`, `Alert`, `Badge`, `Button`, `Empty`, `Field`, and `FieldGroup` rather than creating a second component system.
- `server-actions` — preserve the authorise-first, shared-Zod, typed-result Server Action contract for field submission and do not introduce Route Handler mutations.
- `evidence-governance` — preserve the default `unpublished_internal` classification, AI isolation, and community-data egress prohibition on the field submission path.

## Existing code inspected

- `AGENTS.md` — resume procedure, UX roadmap item 60, Field Officer permissions, evidence governance, design, security, and checks requirements.
- `ref/Tropenbos_Policy_Intelligence_Spec_v2.md` — Field Officer workflow, offline cache requirement, and mobile/low-bandwidth design intent.
- `design_handoff_evibrief/design-system.md` and `design_handoff_evibrief/README.md` — tokens, Field Officer card recipe, offline banner motion, responsive rules, and the cached-digest/queue state model.
- `prompts/23-field-officer-routes.md` and commit `98c6989` — the already-executed submission, offline queue, cache, notification, and photo-storage deferral decisions.
- `app/field/layout.tsx`, `app/field/page.tsx`, `app/field/submit/page.tsx`, `app/field/submit/submission-form.tsx`, `app/field/sent/page.tsx`, `app/field/sent/pending-list.tsx`, `app/field/actions.ts`, and `app/field/schema.ts` — current route hierarchy, form action, queue outcomes, and role/security boundary.
- `components/field/digest-card.tsx`, `components/field/offline-banner.tsx`, `components/field/sync-status-pill.tsx`, and `components/field/sw-register.tsx` — digest, system-state, queue, and service-worker UI.
- `lib/field/plain-language.ts`, `lib/field/config.ts`, `lib/field/queue.ts`, `lib/db/field.ts`, `app/api/field/cache/route.ts`, and `public/field-sw.js` — field vocabulary, browser queue, safe digest DTO, route-handler cache boundary, and GET-only `/field` worker scope.
- `app/globals.css`, `components/ui/field.tsx`, and installed `components/ui/*` — current EviBrief token-backed styling and reusable shadcn primitives.

## Decisions and assumptions

1. `/field` remains a narrow `max-w-[480px]`, single-column surface at every width — including laptop and desktop. Do not add the authenticated desktop navigation, sidebars, dashboards, tables, internal filtering, or officer/research taxonomy.
2. The digest stays server-rendered from `readFieldDigest()` and the service worker remains an enhancement only. No SWR, polling, client-side primary data fetch, or new client cache is introduced.
3. The existing service worker is scoped to `/field`, caches only GET navigations and `/api/field/cache`, skips `/api/auth/*`, and never replays/serves POSTs. Preserve those boundaries exactly.
4. One message per card is a product constraint, not merely a smaller card layout. Use active, familiar language: “This week”, “Worth knowing”, “What the office has sent out”, “Send an update”, “Waiting to send”, and “Read by the office”. Never surface “signal”, “urgency”, “relevance”, “classification”, “embedding”, “evidence match”, or brief workflow status vocabulary to this route.
5. Make connection state visible wherever a Field Officer can make or inspect a submission, including `/field/submit` and `/field/sent`; it must name the state in words and must not be a decorative animated dot. Online may be quiet; offline and queued must be persistent, in-flow feedback that cannot cover input or navigation.
6. Preserve the current submission queue semantics: IndexedDB; ordered replay on mount and the browser `online` event; no Background Sync dependency; no dropping a row without an action result containing `evidenceItemId`; visible sign-in-again state when the session expires.
7. Preserve text-only submissions. Do not add image fields, Uploadthing uploads, Supabase Storage, a new migration, raw files, background sync, or new environmental credentials.
8. This authenticated route uses no GSAP. Use only restrained token-backed CSS micro-interactions (150–300ms) where they clarify state. The offline banner's existing 200ms no-bounce entrance is allowed; reduced motion must make it instant. No looping animation.

## Files likely to change

- `app/field/layout.tsx`
- `app/field/page.tsx`
- `app/field/submit/page.tsx`
- `app/field/submit/submission-form.tsx`
- `app/field/sent/page.tsx`
- `app/field/sent/pending-list.tsx`
- `components/field/digest-card.tsx`
- `components/field/offline-banner.tsx`
- `components/field/sync-status-pill.tsx`
- New small `components/field/*` client components only where a shared connection/queue summary avoids duplicating browser-state logic.
- `app/globals.css` only if a missing token-backed, reduced-motion-safe utility is genuinely required.
- Field route tests and/or existing test fixtures where available.

Do not change Prisma schema, migrations, `lib/db/field.ts` select shapes, `lib/field/queue.ts` persistence semantics, `public/field-sw.js` request policy, the Inngest notification job, the field Server Action contract, or unrelated app routes without first updating this prompt.

## Implementation requirements

### Mobile shell and visual hierarchy

1. Keep the primary frame full-height, warm-card based, centred, and capped at 480px with no page-level horizontal scroll from 320px through 1600px.
2. Rework the repeated route headers into a recognisable compact field shell: a calm primary band, an abstract square structural mark (never leaf/tree imagery), `EviBrief`, route title, and only the necessary back action. Do not use a desktop breadcrumb, a hamburger menu, icon-only navigation, or extra account controls.
3. Use the existing palette: primary/surface-tint for the field header, paper/card/stone for body surfaces, accent only for confirmed/synced marks, watch slate for a recoverable refusal, and stone plus an outlined square/label for offline or queued work. No red, amber, green, destructive variant, clinical white, gradients, stock imagery, or ornamental “nature” motifs.
4. Keep Inter for all product prose. Use IBM Plex Mono only for compact timestamp or saved-at metadata when it genuinely improves scanning. Do not use Source Serif because this route does not show quoted source material.
5. Maintain at least 14px standard body text, at least 12px metadata, 48px primary touch targets, 44px secondary touch targets, visible focus rings, `cursor-pointer` on interactive controls, and `cursor-not-allowed` on disabled submit controls.

### Digest

6. Make the digest read as a short weekly handoff, not a dashboard: an immediately actionable “Worth knowing” stream followed by an explicitly separate “What the office has sent out” stream. Retain one message per card, real data only, and present each card's source/date as secondary metadata.
7. Refine `SignalDigestCard` and `BriefDigestCard` with the existing Card composition and token system. Labels must be plain-language output from `lib/field/plain-language.ts`; never render raw enum names. Do not make cards look selectable unless they genuinely navigate somewhere.
8. Make the empty state use the installed `Empty`/`Card` composition when it fits, explain what will appear here, and retain the single real next step: send an update. It must not imply that an automated system has decided anything.
9. Keep the digest's two actions stable at the bottom of the reading surface: “Send an update from the field” is the primary action; “Updates you have sent” is the secondary action. The copy that offline submissions wait safely on the device should remain visible without becoming a generic technical disclaimer.

### Offline and queued-state feedback

10. Turn the current route-specific offline display into one shared, hydration-safe connection/status treatment usable on the digest, submission, and sent routes. Browser state begins only after mount; no server/client mismatch.
11. When offline, show in-flow wording equivalent to “You are offline. Showing the last update saved on this phone [time].” The treatment must use a small square glyph plus text, must never overlay form fields, and must have `role="status"` without announcing repeated state changes noisily.
12. Surface queued-work count in the same shared treatment or immediately adjacent in a way that remains visible on all three screens. It must say how many updates are stored on this phone, distinguish a queued session-expiry state (“Sign in again to send”), and link to `/field/sent` where appropriate. Do not read or render queued observation bodies in a shared banner.
13. Keep the existing `SyncStatusPill` shape-plus-label semantics. Clarify its hierarchy so “Waiting to send”, “Sign in again to send”, “With the office”, and “Read by the office” are distinguishable by words and structural mark, not colour alone.
14. On the sent page, keep locally queued records physically before records that reached the office. Each queued item shows only the officer-supplied title, time if already recorded locally, and the next true action/state; never render observation body text or a server-only status guessed in the browser.
15. On sync, update the UI without an error toast or suspenseful animation. A saved submission may move from the local list only after the action's successful `evidenceItemId` result; preserve the queued item through network loss, reload, and failed/unauthorised replay.

### Submission form

16. Keep the existing shared Zod schema and browser-safe idempotency key. Preserve the action order: resolve session, authorise, validate, mutate, then notify. Do not accept classification, role, staff id, or an AI option from browser input.
17. Recompose form fields with installed shadcn `FieldGroup`/`Field`/`FieldLabel`/`FieldDescription`/`FieldError` and native input/textarea controls as supported by the installed components. Retain the existing accessible ids, date max rule, text limits, and inline field errors. Use `data-invalid` and `aria-invalid` correctly.
18. Preserve its short, plain-language sequence: topic, observation, optional place, optional date, send action. Group optional context together visually without making a two-column phone form. Keep the observation field prominent and do not ask for policy taxonomy, an evidence source type, or a classification.
19. Keep outcome feedback in document flow and persistent until the next meaningful user action: sent, waiting to send, sign in again, and validation/refusal. A successful message must explain that the office receives the observation and reviews it before use; it must not claim validation, approval, publication, or AI analysis.
20. Make submit feedback stable while sending; do not replace the form with a spinner or reset entries before a success/queue result. The disabled button remains labelled and keyboard-accessible enough to communicate current work.

### Accessibility, performance, and responsive behaviour

21. Test 320px, 390px, 760px, 1000px, 1300px, and 1600px. The field shell stays a centred single column at every size; no page-level horizontal scroll, clipped action, tiny text, or hidden offline/queue state.
22. Verify keyboard traversal and touch use through every route. Inputs have visible labels; status announcements are informative but not repetitive; back/navigation links and submit controls have clear focus treatment; status shape is not the only meaning carrier.
23. Respect `prefers-reduced-motion`: status changes and the offline banner render instantly; no pulse, spin, or looping animation is added.
24. Keep browser code small and low-bandwidth: do not add a new data-fetching library, map/chart package, photo library, large icon set, or dependency. Do not cache authenticated pages beyond the established `/field` scope and GET-only worker logic.

## Evidence classification impact

This refinement reads, stores, and displays field-submission state but does not introduce an AI call or alter the classification gate.

Classifications involved: a field observation is stored as `sourceType: field_data` with the Prisma schema default `unpublished_internal`; it may later be manually tagged `public_published`, `community_sourced`, or remain `unpublished_internal`. The exact enforcement point remains `app/field/actions.ts` → `submitFieldObservationAction()` calling `createFieldSubmission()` without accepting or writing a client classification, together with the schema default in `prisma/schema.prisma`. `lib/governance/gate.ts` remains the AI-layer chokepoint; it is not called from `/field`.

Blocked items: every field observation is blocked from embedding, retrieval, matching, generation, translation, summarisation, and fact-checking until an authorised Research Officer explicitly classifies it `public_published`. The Field Officer sees no internal classification vocabulary; the Research Officer's existing Evidence Library governance queue surfaces the pending item/count. This prompt must not add Gemini imports/calls or otherwise transmit the observation to a model.

The browser queue, cached digest, action feedback, server logs, PostHog, Sentry, email notices, and service worker must never carry observation body text outside the current Tropenbos-controlled database/device path. Continue to use identifiers, counts, classifications, and timing only in telemetry. Cached digest DTOs must remain free of `EvidenceItem`/`EvidenceChunk` titles, excerpts, full text, files, embeddings, and guard data.

## Hallucination-guard implications

None. This prompt changes no generated brief, claim extraction, fact-check pass, flag storage, flag rendering, flag resolution, or Programme Director approval gate. Field observations remain blocked from the AI pipeline and the field digest continues not to load brief body text or hallucination-guard records.

## Security requirements

- Preserve `requireStaffUser()` rendering protection and `canSubmitFieldObservation` inside `submitFieldObservationAction`; UI visibility is not authorisation.
- Keep mutations in the existing colocated Server Action. `/api/field/cache` remains a read-only, session-authorised GET endpoint; do not add browser-facing mutation handlers.
- Preserve action idempotency via `submissionKey`; never drop or duplicate a queued observation during sync.
- Keep the service worker `/field`-scoped, GET-only, network-first with fallback, and explicitly outside `/api/auth/*`; never cache or replay a POST, credentials, or response from another app route.
- Do not add a photo/file upload path, third-party storage, public URL, `NEXT_PUBLIC_*` secret, or new external service.
- Do not import Prisma, `server-only`, AI, Inngest internals, credentials, or environment secrets into client components.
- Do not log field observations, queued values, source excerpts, evidence/brief bodies, raw action errors, or user identifiers in Sentry/PostHog/console. Do not weaken existing response select shapes that prevent this data reaching cache storage.
- Do not add auto-classification, auto-approval, auto-submission, auto-publishing, model generation, translation, or a hidden bypass to the evidence gate.

## Acceptance criteria

1. `/field`, `/field/submit`, and `/field/sent` form a recognisable single-column, plain-language Field Officer experience at 320px through 1600px, without internal taxonomy or desktop-app chrome.
2. Digest cards use real stored signal/brief data, one message per card, plain-language labels, and no raw enum/status terminology.
3. Offline state is visibly and accessibly represented on all relevant field routes, includes saved-at context where available, and never overlays or hides content.
4. A queue count and explicit next state are visible whenever locally stored submissions exist; unauthorised replay is distinct from ordinary offline waiting.
5. A queued submission survives reload and network failure, remains title-only in browser UI, syncs automatically on reconnection, and is removed only after a successful `evidenceItemId` action result.
6. The submission form preserves server-side authorisation, shared Zod validation, idempotency, native date restriction, persistent inline outcomes, and no client-exposed classification control.
7. Field submissions still enter as `field_data` and default to `unpublished_internal`; no Gemini call or AI import is introduced on this path.
8. `/api/field/cache` and the service-worker cache remain evidence-body-free and never cache/replay mutations or auth responses.
9. No photo attachment or third-party storage is added; the controlled-storage decision remains explicitly deferred.
10. All new/changed controls have pointer/disabled cursors, visible keyboard focus, sufficient contrast, labelled status/state, and reduced-motion-safe transitions.

## Checks to run

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `rg -n "lib/ai|generateContent|embedContent|GoogleGenAI" app/field components/field lib/field public/field-sw.js`
- `rg -n "fullText|EvidenceChunk|evidenceItem|observation" app/api/field/cache/route.ts lib/db/field.ts public/field-sw.js`

Report exact output. If a check fails due to a pre-existing issue outside these touched files, name it separately and state whether this change introduces a new failure.

## Manual test steps

1. Start the app with `npm run dev`, sign in as a Field Officer, and open `/field`.
2. At 320px, 390px, 760px, 1000px, 1300px, and 1600px, confirm the route remains a centred single column with no horizontal page scroll, 14px+ body copy, and usable 44–48px controls.
3. Confirm the digest uses only plain-language labels and cards; verify it never shows “signal”, “urgency”, “relevance”, “classification”, or a raw brief status.
4. Open `/field/submit` and `/field/sent`; confirm the shared connection/queue treatment is understandable without hiding input, submitted records, or navigation.
5. Submit a valid observation online. Confirm success feedback remains inline, the form resets only after success, and the sent view shows the title and office-review state without the observation body.
6. In browser DevTools, set Network to Offline. Reload a previously visited `/field`; confirm the last digest appears with the offline/saved-data status and no hydration warning.
7. Still offline, submit an observation. Confirm it is stored in IndexedDB, shows “Waiting to send” with text plus structural glyph, survives reload, and appears before the sent list on `/field/sent` without revealing its body.
8. Restore connectivity. Confirm replay happens automatically, the queued entry disappears only after success, and exactly one row exists for the submission key.
9. Repeat with an expired/revoked session or action refusal. Confirm the item remains stored and says “Sign in again to send”; it is not silently discarded or retried in a tight loop.
10. As a Research Officer, inspect the existing evidence governance queue after a field submission. Confirm the item is pending at `unpublished_internal`, cannot appear in ordinary search/matching/generation, and the Field Officer UI did not show classification terminology.
11. Sign out and request `/field` and `/api/field/cache`; confirm the application refuses access. Confirm the worker does not cache `/api/auth/*` and a POST is never replayed.
12. Enable OS/browser reduced motion, go offline, and revisit field routes. Confirm connection/status changes are instant and no looping/pulsing animation appears.
