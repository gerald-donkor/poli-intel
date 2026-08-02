# 16 — Generate from a signal: the matched set becomes a brief

## Goal

Close the flagship path. Spec §5.2 steps 15–17 — *"Officer clicks Generate
brief — selects brief type and primary audience"*, *"System runs Evidence
Matcher and returns top evidence with confidence scores"*, *"Officer reviews
evidence selection, can add/remove items, notes any gaps"* — are the one part of
the core workflow with no implementation. Prompt 13 detects signals, prompt 14
matches evidence to them, prompt 15 renders both. Prompt 09 generates briefs.
Nothing joins the two halves: `Brief.signalId` is nullable and is **null on
every row that exists**, and `evidence-matcher` rule 5 — *"officers can add and
remove matched evidence before generation; the final evidence set used for a
brief is recorded on the brief"* — has no code behind it.

Three things, one body of work:

- **The entry point** — a "Draft a brief from this signal" control on
  `/signals/[id]`, honest about what the matcher did or did not find, that a
  person presses. Detection still triggers the Matcher and stops there
  (`AGENTS.md` §8.4); nothing on this path generates anything automatically.
- **The prefilled generation surface** — `/briefs/new?signal=<id>` with the
  policy context and the matched evidence set already in the form, the matched
  items shown with the relevance scores the matcher actually computed, and the
  officer free to add and remove before pressing Generate.
- **The recorded link** — `Brief.signalId` set by the stage-3 transaction, and
  `BriefEvidence.relevanceScore` populated for the items that came from the
  matcher. `/signals/[id]` lists what has been drafted from it; `/briefs/[id]`
  names where it came from.

**Explicitly out of scope, and named so the boundary is deliberate:**

- **Audience switching and re-generation.** Phase 3, its own prompt, and its own
  Gemini call subject to the gate (`AGENTS.md` §7.8). This prompt does not touch
  `generateBrief`'s prompt assembly or add a second generation path.
- **The morning digest email.** The last unbuilt Phase 2 bullet, and a leaf: it
  consumes what is already on screen and needs Resend, `react-email`, and a
  cadence decision. Deliberately after this, because this unblocks the Impact
  Tracker and the submission tracker and the digest unblocks nothing.
- **Storing the fetched policy document.** The radar keeps a title, a summary
  and a source URL, not a document body. Adding one is a 500MB-budget decision
  (`AGENTS.md` §12.5) that deserves its own justification, and decision 2 below
  gets an honest result without it.
- **Auto-generating on a high-urgency signal.** Forbidden, and not behind a flag
  (§8.2, §8.4).
- **Editing the matched set on the signal detail itself.** Add/remove happens on
  the generation surface, where it is what it says it is: composing *this
  brief's* evidence set. Mutating a signal's stored match set in place would
  overwrite the matcher's own record of what retrieval returned.

## Skills read

- `brief-output` — rule 5 (every brief records its signal, evidence set,
  audience, version and generating model — the first half of which is currently
  unrecorded), the standard structure, and the length targets that are unchanged
  here.
- `evidence-matcher` — rule 1's stored output, rule 4 (a gap is surfaced with a
  real next step, never a blank panel), and rule 5, which this prompt is the
  implementation of.
- `evidence-governance` — call types 4 and 8. The gate's position is unchanged;
  what changes is where the candidate set comes from, and the standing rule that
  a re-read happens per stage rather than once at the top of a flow.
- `gemini-integration` — the per-call assembly's "policy signal context — full
  text of the detected policy document, or the relevant excerpt", which is the
  line decision 2 has to answer honestly.
- `hallucination-guard` — the ordering that must not move: generate → validate →
  fact-check → persist. The pass verifies against the FINAL evidence set after
  add/remove, never raw matcher output.
- `server-actions` — authorise-first, the shared shape-only schema, and the rule
  that optimism is only for operations already known to be permitted (no
  optimism is added here).
- `design-system` — relevance as number **and** bar, never colour alone; the
  five states; the mobile-first breakpoint mechanics.

## Existing code inspected

- `app/(app)/briefs/new/actions.ts` — the three-stage sequence, and the shape
  this prompt threads a signal id through. `startBriefGeneration` re-reads every
  selected id and gates it; `resolveAttempt` re-gates on stages 2 and 3. **None
  of that changes.**
- `app/(app)/briefs/new/schema.ts` — shape-only, shared with the form. Gains one
  optional field.
- `app/(app)/briefs/new/page.tsx` — currently takes no `searchParams` and loads
  `listEligibleEvidence()` plus the pending count.
- `app/(app)/briefs/new/evidence-picker.tsx` — its own comment says *"selection
  is manual, so no relevance score is shown — there is nothing that computed
  one, and a fabricated number in a product about traceability is the wrong
  trade."* That reasoning is exactly right and is why the matched items may now
  show a score: something computed it.
- `app/(app)/briefs/new/generate-form.tsx` — React Hook Form + the shared Zod
  resolver, holding the attempt id so a 429 resumes rather than restarts.
- `lib/db/briefs.ts` — `persistGeneratedBrief`, the only writer of a `Brief` row.
  It does not set `signalId`, and its comment records that `relevanceScore` is
  left null on every row *because manual selection produces no score*. Both
  become conditionally untrue here.
- `lib/db/signal-board.ts` — `findSignalDetail` already reads the eligible
  matched set with its similarity and rerank scores through
  `ELIGIBLE_EVIDENCE_WHERE`.
- `prisma/schema.prisma` — `Brief.signalId` exists, nullable, indexed, with the
  comment explaining why. `BriefEvidence.relevanceScore` exists, nullable.
  **`BriefGeneration` has no signal column** — that is the one migration.

## Decisions and assumptions

1. **One generation surface, prefilled — not a second generator.**
   `/briefs/new?signal=<id>` rather than `/signals/[id]/generate`. A second route
   would be a second copy of the three-stage sequence, the rate-limit resume, and
   the gate re-read, kept in step by hand. The signal is a *source of defaults*
   for a form that already exists.

2. **The policy context is the signal's title and summary, labelled as such and
   editable.** The radar stores no document body, and inventing a column to hold
   one is out of scope. So the textarea is prefilled with the signal's title and
   `summaryText`, above a line saying plainly that this is the radar's summary
   rather than the source document, with the source link beside it so the officer
   can paste the real text if they have it.
   - **A prefill shorter than the schema's 200-character minimum is not an error
     on arrival.** The field renders its own prompt to add the source text and
     validates only on submit, exactly as it does for a manual draft. The minimum
     is not lowered for signal-backed generations: one rule, and a brief written
     off two sentences is not a brief.

3. **The preselected evidence is the eligible matched set, in rank order,
   capped at `GENERATION_EVIDENCE_CONTEXT_SIZE`.** Preselection is presentation:
   `startBriefGeneration` re-reads every id and re-gates it, unchanged. A matched
   item downgraded since the match was written is simply not in the list, and its
   absence is already accounted for by the detail page's
   awaiting-re-classification count.

4. **The picker shows a relevance score for matched items and none for the
   rest.** The rerank score is a number something computed, so showing it is the
   opposite of the fabrication the picker's comment warns against — and showing
   nothing for a hand-added item is the same honesty. Number **and** bar, never
   colour alone (§11.13). A matched item the model omitted from its rerank
   response carries a null score and says "not scored", as it does on the signal
   detail.

5. **`BriefEvidence.relevanceScore` is written from the stored rerank score, and
   only for items that came from this signal's match set.** An item the officer
   added by hand gets null, permanently — the two cases are genuinely different
   and collapsing them would put a score in front of a reader that nothing
   computed. `persistGeneratedBrief`'s comment is corrected rather than deleted.

6. **`BriefGeneration` gains a nullable `signalId`. One migration.** The three
   stages are three separate requests minutes apart; the signal has to survive
   the attempt, and re-deriving it from a query parameter at stage 3 would mean
   trusting the browser for a stored relation. `onDelete: SetNull`, indexed,
   nullable because the manual generator is not going away.

7. **A gap does not block generation, and is not hidden either.** A signal whose
   latest run is `gap`, `failed`, or absent still offers the control — the
   officer may well know exactly which evidence applies — but the control says
   what the matcher found, and the generation surface arrives with nothing
   preselected and says why. Blocking would be the system deciding (§8.8);
   silently offering an empty selection would be worse.

8. **The gap instruction in the generator's prompt is unchanged and is not
   re-litigated here.** `AGENTS.md` §9.8's "state the gap explicitly, never paper
   over it" is already in the system prompt and already covers a thin evidence
   set. This prompt adds no prompt text.

9. **The link is recorded in both directions and rendered in both.**
   `/signals/[id]` lists briefs drafted from it (status, audience, version);
   `/briefs/[id]` names its signal and links back. That pair is what the Impact
   Tracker's evidence → brief → outcome path will read, and it costs two queries
   now versus a schema archaeology exercise later.

10. **Nothing about brief status, approval, or the guard changes.** A brief
    generated from a signal is a `draft` like any other, with the same fact-check
    pass, the same flags, and the same Director-only approval refused while flags
    are open.

## Files likely to change

**New**

- `prisma/migrations/<timestamp>_brief_generation_signal/migration.sql` —
  authored via `npm run db:migrate:new`, SQL read before applying.
- `app/(app)/briefs/new/signal-context.tsx` — the banner naming the signal the
  form was opened from, its urgency and relevance, its source link, and what the
  matcher found.

**Edited**

- `prisma/schema.prisma` — `BriefGeneration.signalId` + relation + index.
- `app/(app)/briefs/new/page.tsx` — read `searchParams.signal`, load the signal
  and its matched set, pass the prefill down. An unknown or malformed id falls
  back to the plain manual form rather than 404ing.
- `app/(app)/briefs/new/generate-form.tsx` — accept the prefill (policy text,
  preselected ids, signal id), render `SignalContext`, carry `signalId` into
  stage 1.
- `app/(app)/briefs/new/evidence-picker.tsx` — matched items first, with their
  scores; the rest below, unchanged.
- `app/(app)/briefs/new/schema.ts` — optional `signalId`.
- `app/(app)/briefs/new/actions.ts` — validate the signal exists, carry it to
  `createBriefGeneration`, pass the matched scores to `persistGeneratedBrief`.
- `lib/db/brief-generation.ts` — `signalId` on create and on the attempt read.
- `lib/db/briefs.ts` — `persistGeneratedBrief` writes `signalId` and per-item
  `relevanceScore`; the comment about null scores is corrected.
- `lib/db/signal-board.ts` — `findSignalDetail` also returns briefs drafted from
  the signal; a new read for the generation prefill.
- `lib/db/index.ts` — the new read surface.
- `app/(app)/signals/[id]/page.tsx` — the generate control and the drafted-briefs
  list.
- `app/(app)/briefs/[id]/page.tsx` — name the originating signal, linked.

## Implementation requirements

1. **The control on the signal detail.** Rendered for `canGenerateBrief` only
   (presentation), linking to `/briefs/new?signal=<id>`. Its supporting line
   states what the matcher found — *"8 matched items will be preselected"*, *"no
   evidence cleared the threshold; you will be choosing the evidence yourself"*,
   *"the matcher has not run for this signal"* — read from the run row, never
   inferred from an empty join.

2. **The prefill read.** One server-side function returning the signal's title,
   summary, source, classification set, and its eligible matched items with
   scores. It carries `ELIGIBLE_EVIDENCE_WHERE` exactly as `findSignalDetail`
   does, and it is capped at `GENERATION_EVIDENCE_CONTEXT_SIZE`.

3. **The signal context banner.** Urgency as eyebrow only, relevance as its own
   badge, the source as an external link with `rel="noreferrer"`. The summary is
   generated prose and stays in the sans (§11.6). Copy never implies the system
   chose the evidence or decided the brief was warranted (§8.8).

4. **The picker's two groups.** Matched items in rank order with score number +
   bar under a heading naming where they came from; everything else below,
   filterable as now. Selecting and deselecting works identically across both —
   a matched item is a default, not a fixture.

5. **Stage 1 validates the signal.** If `signalId` is present it must resolve to
   a real signal; if it does not, that is an `invalid` field error, not a silent
   drop of the association. The gate, the re-read, and the ordering are untouched.

6. **Stage 3 writes the link.** `Brief.signalId` and the per-item
   `relevanceScore` land inside the existing single transaction, alongside the
   brief, its evidence set, version 1, and the flags. No second write, no
   after-the-fact update.

7. **Both directions render.** The signal detail lists its briefs (type,
   audience, status, version, date) or says none have been drafted; the brief
   detail names its signal with a link back, and says "no signal — drafted
   manually" where there is none rather than showing an empty row.

8. **Every page fully responsive**, checked at 390/760/1000/1300/1600px, with no
   horizontal page scroll at any width (§11.15).

## Evidence classification impact

**Touched — call types 4 (generation) and 8 (the fact-check pass) — and the
enforcement point does not move.**

- **The gate is unchanged and is not re-implemented.** `gateEvidenceForGeneration`
  in `lib/ai/evidence-context.ts` stays the only door into the generation
  context, called from `startBriefGeneration` and again from `resolveAttempt` on
  every later stage. What changes is only where the *candidate ids* the officer
  submitted came from — a preselection instead of a hand-selection — and a
  preselection is presentation, re-read and re-partitioned server-side exactly
  like any other list of ids (§7.1, §7.2).
- **The preselection itself is gated at read time.** The prefill query carries
  `ELIGIBLE_EVIDENCE_WHERE`, so an item downgraded since the match was written is
  never offered. Its absence is already surfaced on the signal detail as the
  awaiting-re-classification count; this prompt does not add a second, quieter
  place for it to disappear.
- **A signal is not evidence and carries no classification.** Its summary reaches
  the generator as policy context. That is not a gate bypass: a signal originates
  from a public source the radar fetched, and `summaryText` was *written by* a
  Gemini classification call in the first place, so nothing new is transmitted.
  Stated here so the absence of a classification check on the signal is a
  recorded fact rather than an oversight.
- **`BriefEvidence.relevanceScore` is a number, not text.** No excerpt, no title,
  no body text enters any new payload, log line, or action result. Logging stays
  ids, counts, classifications and stages (§7.6, §13.9).

No bypass, no `force`, no env var, and no anticipatory paid-tier branch is added.

## Hallucination-guard implications

**The pass is unchanged in mechanism, and its input is now traceable to a
signal.** Restated because this is the connection prompt 15 flagged forward:

- The pass still runs **before** any reviewable brief exists — generate →
  validate → fact-check → persist, in that order, in `verifyBriefAction`
  (§9.1). Nothing here persists earlier or checks later.
- It verifies against **the final evidence set after the officer's add and
  remove**, which is what `resolveAttempt` re-reads from the attempt row — never
  the raw matcher output, and never the library.
- Claim extraction, the flag record, anchoring, flag rendering, the pulse, and
  what a flag blocks are all untouched. Unresolved flags still block Programme
  Director approval server-side (§9.5).
- A brief generated from a signal produces flags identically to a manual one. No
  flag is suppressed, downgraded, or pre-resolved because the evidence arrived
  from the matcher rather than by hand — a computed relevance score is not a
  verification, and treating it as one would be exactly the theatre §9 exists to
  prevent.

## Security requirements

- Every Server Action authorises inside the action, server-side, before any work.
  The generate control is hidden for a role that may not generate, and that
  hiding is presentation, never the control (§10.1).
- `signalId` arrives from a query parameter and is treated as untrusted input:
  parsed as a UUID by the shared schema, resolved against the database, never
  interpolated into a query string or a redirect target.
- The signal's `sourceUrl` is external: rendered as a link with `rel="noreferrer"`,
  never fetched, never embedded, never `dangerouslySetInnerHTML`.
- No role name and no predicate enters `schema.ts`, which ships to the browser
  (§10.10).
- No new Route Handler, no client-side Prisma, no model call from browser code.

## Acceptance criteria

1. `/signals/[id]` shows a generate control for a Policy & Advocacy Officer and
   the Programme Director, and not for a Research or Field Officer.
2. Following it opens `/briefs/new` with the policy text prefilled from the
   signal, the matched items preselected in rank order, and a banner naming the
   signal.
3. Matched items render a relevance score as number **and** bar; hand-added items
   render no score rather than a zero.
4. Deselecting a matched item and adding a library item both work; the brief is
   generated from the resulting set.
5. The generated brief has `signalId` set, and `brief_evidence.relevance_score`
   populated for the matched items and null for the hand-added one.
6. A signal whose latest run is `gap` still offers generation, arrives with
   nothing preselected, and says why.
7. `/signals/[id]` lists the brief afterwards; `/briefs/[id]` names the signal
   and links back.
8. A manual generation at `/briefs/new` with no query parameter behaves exactly
   as before, with `signalId` null.
9. A `?signal=` value that is malformed or does not resolve falls back to the
   plain manual form; submitting a non-existent signal id is refused server-side.
10. The fact-check pass runs on a signal-backed generation exactly as on a manual
    one, and flags still block approval.
11. No horizontal page scroll at 390, 760, 1000, 1300 and 1600px.
12. `npm run lint` and `npm run typecheck` are clean apart from the four
    pre-existing errors §19 names.

## Checks to run

- `npm run db:migrate:new -- brief_generation_signal`, then read the generated
  SQL before applying — it must add one nullable column, one foreign key and one
  index, and must not drop either `*_embedding_cosine_idx`
- `npm run db:migrate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Report the exact output of each.

## Manual test steps

1. `npm run dev` and `npm run inngest:dev`. Have at least one signal with a
   `matched` run and one with a `gap` run — trigger a radar run and a match, or
   set them up in `npm run db:studio`.
2. Sign in as a Policy & Advocacy Officer. Open the matched signal's detail and
   confirm the generate control and its line about how many items will be
   preselected.
3. Follow it. Confirm the banner names the signal, the policy text is prefilled
   with the summary and labelled as the radar's summary, and the matched items
   are preselected with scores as number-plus-bar.
4. Deselect one matched item, add one from the library, and generate. Watch the
   three stepper stages.
5. In Studio, confirm the new `brief` row has `signal_id` set, and that
   `brief_evidence` carries a `relevance_score` for the matched items and null
   for the one you added.
6. Confirm `/signals/[id]` now lists that brief, and `/briefs/[id]` names the
   signal and links back.
7. Open the gap signal. Confirm generation is still offered, arrives with nothing
   preselected, and says the matcher found nothing.
8. Open `/briefs/new` with no query parameter and generate as before. Confirm it
   behaves identically and stores `signal_id` null.
9. Visit `/briefs/new?signal=not-a-uuid` and `/briefs/new?signal=<random uuid>`.
   Confirm both fall back to the plain form without an error page.
10. Sign in as a Research Officer. Confirm the generate control is absent, and
    that calling `startBriefGeneration` anyway is refused server-side.
11. Check the signal detail, the generation surface and the brief detail at 390,
    760, 1000, 1300 and 1600px.
