# 12 — Word export: the document leaves the building, with its flag state attached

## Goal

Give a brief a way **out of EviBrief and onto a desk**, as a `.docx` a staff
member can attach to an email or hand to a ministry official — and make the
hallucination guard travel with it.

Three things, one body of work:

- **The mapping** — the stored Tiptap document → a Word document, running from
  `lib/briefs/document.ts`'s vocabulary. Citation chips survive as **readable
  citations**, not as stripped inline noise (`tiptap-editor`, export).
- **The unresolved-flag notice** — a brief with open flags exports with a
  **visible notice inside the file**. Not silently, and **not blocked either**:
  the notice travels with the document (§16.8).
- **The download** — a thin Route Handler, authorised inside itself, and one
  control on `/briefs/[id]`.

This is the last unbuilt item in the spec's Phase 1 (spec §7: *"basic brief
editor with export to Word and Google Docs"*). Everything else in that phase —
ingestion, the classification gate, keyword and semantic search, the manual
generator, the editor, auth, and now review and approval — is on disk and
committed. After this, a brief can be generated, edited, checked, approved, and
sent, which is the whole Phase 1 loop closed.

**Explicitly out of scope, and named so the boundary is deliberate:**

- **PDF via Pandoc.** Pandoc is an external binary; it is not installed locally
  and will not exist in Vercel's runtime. `tiptap-editor` requires confirming its
  availability before depending on it, and it is not available. **Recorded
  decision, taken with the user on 2026-08-01: PDF gets its own prompt once the
  deployment story is settled** — a container, or a separate service. Nothing in
  Phase 1 is left short by this: spec §7's Phase 1 line names Word and Google
  Docs, not PDF. Do not substitute a JS PDF library here; that contradicts
  `AGENTS.md` §6 and spec §6 and would need its own recorded stack deviation.
- **Google Docs export.** It needs Drive/Docs API scopes on the OAuth client,
  incremental consent, and a persisted access token — and `auth.ts` is
  deliberately trimmed: one provider, no adapter, JWT strategy, `staffUserId` the
  only claim. Reopening that config is its own prompt, immediately after this
  one, where the scope and token storage get the room they need rather than
  riding along. **Recorded decision, same conversation.**
- **Export from the editor route.** The control lives on the brief's own page,
  where the flag panel, the review panel, and the evidence set already are. The
  editor is for writing.
- **Bulk or scheduled export.** No batch download, no emailed attachment, no
  scheduled anything (§8.2).
- **Audience switching, re-generation, translation.** All Gemini calls, all
  gated, all later.

## Skills read

- `brief-output` — rule 8 (the export path and the flag notice), rule 1 (length
  targets are part of the contract, so the export must not silently reflow a
  one-page stakeholder note into something else), rule 2 (the section structure
  the mapping walks)
- `tiptap-editor` — the export section in full: a **thin Route Handler, not a
  Server Action**, because it is a response and not a mutation; the mapping runs
  from the storage-format decision; chips survive as readable citations; the
  notice travels in the file; Pandoc's absence is a handled state, not a crash
- `hallucination-guard` — the export paragraph, and the copy register: a flag
  says a claim is "not traceable to the supplied evidence", never that it is
  wrong, and that register has to hold inside the exported file too
- `server-actions` — why this is the one path that is *not* a Server Action, and
  the authorise-first ordering the handler still owes
- `design-system` — the export control's placement and the no-red rule; the
  control is **never disabled by flag state**
- `evidence-governance` — **read and checked, not applicable**: see the
  classification section below. No Gemini call, no AI entry point, no gate call
  site to add.

## Existing code inspected

- `lib/briefs/document.ts` — the whole vocabulary, and it is deliberately small:
  `heading` levels 1/2/3, `paragraph`, the atomic `citationChip` node carrying
  `{ evidenceItemId, citationKey }`, and the `guardFlag` mark over a claim's
  text run. **There are no other nodes and no formatting marks.** Its own comment
  already names export as one of the three things that index into `bodyText`.
  `buildDocumentFromBodyText` is the fallback for every brief generated before
  the editor existed (`documentJson` null) — the editor already uses it, and the
  export must use the same one rather than inventing a second fallback.
- `lib/briefs/body.ts` — the block contract: blocks separated by one blank line,
  a single-line block is a section divider, a multi-line block is a heading plus
  its prose. Level-2 headings are the brief's sections; level-3 headings are the
  findings.
- `lib/db/briefs.ts` — `findBriefDetail` returns the current version's
  `bodyText`, its flags (now with closure metadata), the evidence set, and the
  status history, but **not `documentJson`**; `findBriefForEdit` returns
  `documentJson` but is shaped around the editor and pulls `classification` it
  does not need here. Neither is quite the export's read.
- `lib/auth/authorize.ts` — no export predicate exists. `canEditBrief`'s comment
  is the precedent for how a new one should explain itself.
- `app/api/inngest/route.ts`, `app/api/uploadthing/route.ts` — the only Route
  Handlers in the codebase, both thin, both for external callers. There is no
  `app/api/briefs/` yet.
- `app/(app)/briefs/[id]/page.tsx` — `PageHeader` already carries "All briefs"
  and a conditional "Edit"; the export control belongs beside them.
- `package.json` — **`docx` is not installed.** No Pandoc anywhere, and `which
  pandoc` returns nothing on this machine.
- `AGENTS.md` §19 — no new npm script is expected, so §19 should not change.

## Decisions and assumptions

1. **A GET Route Handler, not a Server Action.** `AGENTS.md` §5.2 says Route
   Handlers exist for export downloads, and `tiptap-editor` says the same: an
   export is a response, not a mutation. `app/api/briefs/[id]/export/route.ts`.
   **It still authorises inside itself** — "Route Handlers are for external
   callers" is about shape, not about trust, and this one serves the app's own
   signed-in staff.

2. **`?format=docx`, validated, with `docx` the only accepted value today.** The
   parameter exists so prompts 13+ can add `gdoc` without moving the route, and
   an unrecognised value is a 400 with a plain message rather than a silent
   fallback to Word. **This is not a placeholder for a feature that does not
   exist** — nothing in the UI offers a format that the handler cannot produce.

3. **The mapping runs from `documentJson`, falling back to
   `buildDocumentFromBodyText(bodyText)`.** Exactly the editor's fallback, called
   from the same module. A pre-editor brief exports correctly; it simply carries
   no citation chips, because it never had any. No backfill, no migration.

4. **Citation chips export as `[citationKey]` inline, plus a References
   section.** A chip is atomic and renders to nothing in `bodyText`, so left
   alone it would vanish from the file — and a brief whose citations vanished is
   the exact opposite of this product's claim. Inline it becomes the bracketed
   key a reader already sees on the chip; the full record (title, authors, year,
   citation key, source URL) goes in a **References** section at the end, in the
   recorded order of `brief.evidenceSet`, matching `CitationList` on screen.

5. **The unresolved-flag notice is a block at the very top of the file, and the
   flagged claims are listed at the end.** The top block names the count and
   says what it means; a short **"Claims still being checked"** section after the
   references carries each open claim with its reason, so a reader can actually
   find them. The body prose is left clean — no inline highlighting, because
   docx highlighting is easy to strip, easy to miss, and would read as an
   accusation inside a document that may be forwarded.
   **The notice is present whenever the current version has an open flag, at any
   brief status.** Export is never blocked and never silent (§16.8).

6. **A brief with no open flags carries no notice at all.** An "everything is
   fine" banner in an outgoing document is noise, and it would train people to
   skip past the block that matters.

7. **Every status exports, including `draft`.** A draft is exactly what someone
   needs to circulate for comment. The file states the brief's status in its
   header block, so nobody has to guess what they are holding — a `draft`
   exported and forwarded should be legible as a draft.

8. **No invented pagination and no reflow.** The mapping sets Word heading styles
   and paragraph spacing and stops there. Length targets are part of the contract
   (§16.1), so the export must not force page breaks that turn a one-page
   stakeholder note into three. The one exception is a page break before the
   References section, which is a document convention rather than a reflow.

9. **A new `canExportBrief` predicate, not a reused one.** A Field Officer has no
   brief surface at all (§10.5), so they are refused; the other three roles may
   export what they may already read. Reusing `canEditBrief` would be wrong —
   a Research Officer may not edit a brief but may certainly take a copy of one.

10. **The filename is derived server-side from the brief's title and version,
    sanitised to ASCII.** Never taken from a query parameter: a client-supplied
    filename in a `Content-Disposition` header is a header-injection vector.

11. **`docx` is added as a dependency; nothing else is.** No Pandoc, no PDF
    library, no Google API client. One new package, and no new npm script, so
    `AGENTS.md` §19 is untouched.

12. **The serif/sans rule does not cross into the file.** On screen, the serif
    marks quoted material (§11.6). A `.docx` is a Word document with Word's own
    fonts, read outside the product entirely, and forcing EviBrief's typefaces
    into someone else's document would be a worse outcome than losing the
    distinction. The exported document uses Word's default body font throughout;
    the References section is distinguished structurally, by being a section.

## Files likely to change

New:

- `lib/export/docx.ts` — **server-only, pure**: `BriefDocument` + metadata +
  flags + evidence → a `docx` `Document`. No database access, no session, no
  Prisma. It takes what it needs as arguments so it can be reasoned about and
  read on its own.
- `lib/export/filename.ts` — the sanitiser, small and separate because it is the
  security-relevant half (decision 10).
- `app/api/briefs/[id]/export/route.ts` — the thin handler: resolve session →
  authorise → validate the format → read → map → respond.

Changed:

- `lib/db/briefs.ts` — a `findBriefForExport` read returning the current
  version's `documentJson`, `bodyText`, `version`, the brief's type, audience,
  status and `generatedAt`, its flags, and its evidence set. Shaped for this
  route rather than widening `findBriefDetail`, which four other things already
  read.
- `lib/db/index.ts` — the new export
- `lib/auth/authorize.ts` — `canExportBrief`
- `app/(app)/briefs/[id]/page.tsx` — the download control in `PageHeader`
- `app/(app)/briefs/labels.ts` — the exported document's fixed copy, if it does
  not belong inside `lib/export/docx.ts` (prefer keeping it in the export
  module: it is document copy, not UI copy)
- `package.json` / `package-lock.json` — `docx`

## Implementation requirements

### The handler

Order, as everywhere else: **resolve session → authorise → validate → do the
work.**

- Unauthenticated: redirect to `/signin`, or a 401 — not a partial file.
- `canExportBrief(role)` false: **403 with a plain-text body a person can read**,
  never an empty response.
- Brief not found, or no version: 404.
- `format` not `docx`: 400, naming what is available.
- Success: the `.docx` bytes with
  `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  and a `Content-Disposition: attachment` carrying the sanitised filename.
- The handler holds **no mapping logic**. It reads, calls `lib/export/docx.ts`,
  and responds. If it grows past that it has absorbed a layer that is not its own
  (§18).

### The document

Mapping, from the vocabulary and nothing else:

| Document node | Word |
|---|---|
| `heading` level 1 | Title style — the brief's own title |
| `heading` level 2 | Heading 1 — the brief's sections |
| `heading` level 3 | Heading 2 — the findings |
| `paragraph` | Body paragraph |
| `citationChip` | Inline `[citationKey]` at its position |
| `guardFlag` mark | **Nothing inline** — carried by the notice and the list |

Around it, in order:

1. **The header block** — brief type and its length target, audience, status,
   version, generation date, and the drafting model. This is the §16.5 record
   ("every brief records its signal, evidence set, audience, version, and
   generating model") appearing where an outside reader can see it.
2. **The unresolved-flag notice**, when the current version has open flags. Plain
   language, in the guard's register: these claims have not been traced to the
   evidence the draft was generated from, they are not necessarily wrong, and
   they are still being checked. **Never "unverified", never "incorrect", never
   anything implying the system decided or endorsed anything** (§8.8).
3. **The document body**, from the mapping above.
4. **References** — the recorded evidence set, in order, matching what
   `CitationList` renders on screen.
5. **Claims still being checked** — one entry per open flag: the claim, and its
   reason label. Closed flags are not listed; they are settled, and the record of
   who closed them lives in the product, not in an outgoing file.

### The export control

- A link in `PageHeader` on `/briefs/[id]`, beside "All briefs" and "Edit",
  rendered with `buttonVariants({ variant: "outline" })` like its neighbours.
- **Never disabled by flag state, and never red.** Export is not blocked by
  flags; the notice is the mechanism (§16.8). A disabled download would be a
  fifth thing a flag blocks that §9 does not ask for.
- Rendered only for roles that may export — presentation only, the handler
  authorises for itself (§10.1).
- Copy: "Download Word". Not "Export final", not "Publish".
- When the brief has open flags, a quiet line beside or beneath the control says
  the file will carry a notice — so nobody is surprised by what they attached to
  an email. Slate, `text-[12.5px]`, no red, no icon alarm.

### Layout and responsiveness

- `PageHeader`'s controls already wrap; verify at 320px that three controls stack
  without horizontal page scroll and stay reachable.
- Usable at 320, 480, 760, 1000, 1300 and 1600px, no horizontal page scroll at
  any width.

## Evidence classification impact

**No AI data path exists here, and no evidence body text leaves the product.**

- This task makes **no Gemini call** — no embedding, generation, re-generation,
  translation, or fact-check. It adds no entry point to the AI layer, so there is
  **no new gate call site and none is added**. That is why `evidence-governance`
  was read and found not to apply, rather than skipped.
- The export writes **evidence metadata only** — title, authors, year, citation
  key, source URL — the same fields `CitationList` already renders on the same
  screen. **No chunk text, no excerpt, no extracted document body ever enters the
  file.**
- A brief's recorded evidence set passed the classification gate at generation
  (`lib/ai/evidence-context.ts` refuses a selection containing anything that is
  not `public_published`, and the editor's cite control has no other source), so
  the metadata being written out belongs to public, published material. The
  export does **not** re-run the gate, because it makes no model call — but it
  must also **not** widen its read to `classification` or to any chunk table.
- Classification is not read, written, or displayed by anything in this prompt.
- **Logging: brief id, actor id, format, byte length. Never the document, never a
  claim, never a citation, never a filename derived from the title** (§7.6).

## Hallucination-guard implications

**Changed — this is where §16.8's "export never bypasses flag state" is
implemented.**

1. **A new consumer of flag state.** The export reads the **current version's**
   flags and their `status`, exactly as approval does. Open flags produce the
   notice and the list; closed flags produce neither.
2. **What a flag blocks is unchanged.** A flag blocks Programme Director approval
   (§9.5) and nothing else. **It does not block export**, and the download
   control must not be disabled by it — that would be a new rule, invented here,
   that §9 does not state.
3. **The register crosses into the file.** The notice says claims are *not
   traceable to the evidence the draft was generated from* and are *still being
   checked*. It never says unverified, false, or incorrect, and it never implies
   the system checked or approved anything (§8.8, `hallucination-guard`).
4. **The on-screen contract is untouched.** The slate panel, the round glyph, the
   900ms single pulse, `prefers-reduced-motion` — none of it changes, and nothing
   in this prompt should edit `flag-panel.tsx`'s visual classes.

**What does not change:** what gets flagged, how claims are extracted, when the
pass runs, how anchors are stored or mapped, how flags render on screen, who may
clear one, and what clearing one enables.

## Security requirements

- The handler authorises server-side, inside itself, **before reading the
  brief** — not by relying on the control being hidden (§10.1).
- **The filename is derived server-side and sanitised**: ASCII, no path
  separators, no CR/LF, length-capped, with a fixed fallback when the title
  reduces to nothing. A `Content-Disposition` built from unsanitised text is a
  header-injection vector, and a title is officer-authored free text.
- The route is **GET and read-only**. It mutates nothing, writes no status, and
  touches no flag. No Server Action is added.
- No secret, no session token, and no internal id beyond the brief's own reaches
  the file.
- Logging as stated in the classification section: ids and counts only.
- `docx` is a new dependency — pin it as the installer resolves it and do not add
  anything else alongside it.

## Acceptance criteria

1. A Programme Director, Policy & Advocacy Officer, or Research Officer can
   download a `.docx` from `/briefs/[id]`; it opens in Word or LibreOffice
   without a repair prompt.
2. A Field Officer calling the route directly gets a 403 with a readable body —
   verified by calling it, not by reading the UI.
3. The file's headings map as the table above states, and the brief's title is
   the document's title.
4. Every citation chip in the document appears in the file as its bracketed
   citation key, at its position in the sentence; none is dropped, and none
   appears as raw JSON or as an empty gap.
5. The References section lists the brief's recorded evidence set in order, with
   the same fields the on-screen citation list shows.
6. A brief with open flags exports with the notice at the top and each open
   claim listed at the end; a brief with none exports with neither.
7. **Export is not blocked by an open flag and the control is not disabled by
   one** — the notice is the mechanism.
8. A brief generated before the editor existed (`documentJson` null) exports
   correctly from `bodyText`, with no chips and no crash.
9. `?format=pdf` returns 400 naming what is available; no partial file, no
   silent Word fallback.
10. The downloaded filename is derived from the title, ASCII-only, and a brief
    whose title is punctuation-only still yields a usable filename.
11. No claim text, no citation, no document text and no filename appears in the
    dev-server terminal.
12. No horizontal page scroll at 320, 480, 760, 1000, 1300 and 1600px; the header
    controls stack and stay reachable at 320px.
13. `npm run lint`, `npm run typecheck` and `npm run build` pass with no new
    findings in this change's files.

## Checks to run

```
npm run lint
npm run typecheck
npm run build
```

Report exact output. The four known pre-existing lint errors
(`components/ui/carousel.tsx`, `hooks/use-mobile.ts`,
`design_handoff_evibrief/support.js`) are expected and are not to be "fixed".

**No migration.** This prompt reads existing columns and writes none. No new npm
script either, so `AGENTS.md` §19 does not change — if that turns out to be
wrong, the script is added in this same change and §19 updated with it.

## Manual test steps

1. `npm run dev`. Open a brief that has **open flags** as a Programme Director
   and confirm the download control is present, **not disabled**, with the line
   saying the file will carry a notice.
2. Download it. Open the file: the header block names the type, audience, status
   and version; the notice is at the top; the claims are listed at the end.
3. Confirm the citation keys appear inline in the evidence findings and that the
   References section matches the on-screen evidence set exactly.
4. Close every flag (prompt 11's controls) and download again: no notice, no
   claims section, everything else identical.
5. Open the brief as a **Research Officer** and download — it works. Sign in as a
   **Field Officer** and request `/api/briefs/<id>/export?format=docx` directly:
   403, readable body, no file.
6. Request `?format=pdf`: 400, naming Word as what is available.
7. Find or create a brief with `documentJson` null (`npm run db:studio` can null
   it on a test row) and download: it exports from `bodyText`, no chips, no
   crash.
8. Approve a brief and download it: the header block reads Reviewed.
9. Resize 1600px → 320px on `/briefs/[id]`: no horizontal page scroll, the header
   controls stack, the download stays reachable.
10. Read the dev-server terminal for the whole session: brief ids, an actor id, a
    format and a byte count — no claim text, no citation, no title.
