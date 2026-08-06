# 29 — Brief export: PDF via Pandoc

## Goal

Add the third and last export destination named in the contract — **PDF, produced by
Pandoc** (`AGENTS.md` §5.2 and §6, spec §6 line 651, `tiptap-editor` → Export,
`brief-output` §8) — to the existing brief export route.

The gap is explicit in the code today. `app/api/briefs/[id]/export/route.ts:52` reads:

```ts
/** Pandoc PDF is still separate work; `?format=pdf` keeps its 400. */
const SUPPORTED_FORMATS = ["docx", "gdoc"] as const;
```

Every other item on the `AGENTS.md` §1 build list is on disk and committed. This is the
one named deliverable in the architecture's Export layer that has never been built, and
prompt 12's own manual test step 9 (`?format=pdf` → 400 naming Word and Google Docs) is
the marker left for it.

After this prompt a brief has three destinations from one document mapping: a `.docx`
download, a native Google Doc, and a PDF — and all three carry the unresolved-flag
notice, because all three descend from the same rendered bytes.

**This prompt does not** touch the editor, the document model, the flag records, the
approval chain, generation, or any Gemini call. It adds a format to an existing route and
a control to an existing header.

## Skills read

- `tiptap-editor` → **Export** — export is a thin Route Handler, not a Server Action;
  the mapping runs from the document model; citation chips must survive as readable
  citations; export never bypasses flag state — the notice travels with the file, and the
  export is neither silent nor blocked; **"Pandoc is an external binary. Confirm it is
  actually available in the deployment environment before depending on it for PDF, and
  treat its absence as a handled state rather than a crash."** That sentence is the whole
  reason for the configuration design below.
- `brief-output` §8 — `docx` for Word, Pandoc for PDF, plus Google Docs; export never
  bypasses flag state. §1 — brief length targets are part of the contract, so the PDF must
  not silently reflow a 1-page stakeholder note into something else.
- `design-system` — the brief header's control row, `buttonVariants({ variant: "outline" })`
  for a Route Handler anchor, the **watch ramp** (`text-watch-ink`) for the open-flag line,
  never `destructive`, and the responsive rule: the control row must stay usable at 390px
  with no horizontal page scroll.
- `hallucination-guard` (contract inherited, not re-implemented) — the open-flag notice
  and the closing "Claims still being checked" list are already produced by
  `renderBriefDocx`; nothing in this prompt re-decides what a flag is or how it reads.
- Read before implementing, not instead of: `node_modules/next/dist/docs/` for the current
  Route Handler and `NextRequest` surface in Next 16.2, and Pandoc's own current CLI docs
  for `--from`/`--to`/`--pdf-engine`. Do not write a Pandoc flag from memory.

`evidence-governance` is not loaded for this task and the reason is stated under
**Evidence classification impact** below.

## Existing code inspected

- `app/api/briefs/[id]/export/route.ts` — GET, authorises inside itself
  (`getCurrentStaffUser` → `canExportBrief`), validates `format` against
  `SUPPORTED_FORMATS`, resolves any destination prerequisite **before** rendering, calls
  `renderBriefDocx` once, then either responds with bytes or redirects. `refuse(status,
  message)` returns a plain-text body a person can read. Logs ids and counts only.
- `lib/export/docx.ts` (399 lines) — the **single** document mapping. Pure, server-only,
  takes `BriefExportInput` and returns bytes. Emits the header block, the flag notice
  (`COPY.notice`), the body from `lib/briefs/document.ts`'s vocabulary (`citationChip` →
  `[key]`, `guardFlag` → nothing inline), the References section (metadata only — never
  evidence body text), and the closing claims list.
- `lib/export/gdoc.ts` — the precedent this prompt follows exactly: **"ONE DOCUMENT
  MAPPING, NOT TWO."** It takes `renderBriefDocx`'s output and hands it to Drive rather
  than translating the Tiptap document a second time, and it says why — a second mapping
  is a second place for the flag notice to drift or be forgotten. Also the typed
  `{ ok: false; reason: … }` result shape and the status-only log line.
- `lib/export/filename.ts` — `sanitiseFilenameStem` (ASCII-only, header-injection safe),
  `briefExportName(title, version)` shared by both destinations, `briefExportFilename`
  (hard-codes `.docx`), `contentDispositionAttachment`.
- `lib/google/drive-client.ts` — `driveOAuthConfig()` returning **`null` when
  unconfigured**, "the same shape `whatsappConfig()` and `ussdSecret()` use", plus
  `isDriveExportConfigured()` for the page.
- `app/(app)/briefs/[id]/page.tsx:149–186` — the control row: plain anchors (not `Link`)
  because these are Route Handler responses; the Google Docs control is **absent, not
  disabled**, when unconfigured; the open-flag line beneath in `text-watch-ink`, worded to
  cover every destination.
- `.env.example` — the commented, grouped, `— server only` annotated format to extend.

## Decisions and assumptions

**1. Pandoc converts the `.docx` we already render; it does not read the Tiptap document.**
The pipeline is `documentJson → renderBriefDocx → bytes → pandoc -f docx → PDF`. This is
`gdoc.ts`'s argument applied unchanged, and it is the decisive one: a second mapping
(Tiptap → Markdown → Pandoc) would be a second place for the flag notice, the References
section and the citation keys to be expressed, and therefore a second place for a brief to
reach a ministry looking unflagged. Inheriting the guard contract beats controlling the
typography. It also means the PDF is page-for-page the Word file, which is what keeps the
§16.1 length targets honest.

**2. PDF is available only when the deployment declares it, via `PANDOC_BIN`.**
`pandocConfig()` returns `null` unless `PANDOC_BIN` is set to an executable path. No
`which pandoc` probe, no spawn-and-see on every request: the skill says *confirm it is
available*, and an explicit declaration is a confirmation where a probe is a guess that
costs a process spawn per export. Unconfigured behaves exactly like unconfigured Drive —
control absent from the page, readable 400 on the direct URL, Word unaffected.

**3. Vercel does not ship Pandoc, and this prompt does not pretend otherwise.** On the
current hosting target `PANDOC_BIN` will be unset and PDF will simply not be offered;
locally and on any host with the binary it works. Do **not** vendor a Pandoc binary, add a
build step, add a Docker file, or reach for a JS PDF library instead — the contract names
Pandoc, and "absence is a handled state" is the specified behaviour, not a workaround.

**4. The PDF engine is configurable, defaulting to `weasyprint`.** Pandoc's default engine
is `pdflatex`, which pulls in a multi-gigabyte TeX install that a four-person organisation
on free tiers will not have. `weasyprint` renders through HTML/CSS and is a `pip install`.
`PANDOC_PDF_ENGINE` overrides it for a deployment that has LaTeX. The value is passed as a
single `--pdf-engine=` argument, never interpolated into a shell string.

**5. `execFile` with an argument array, never a shell.** Nothing officer-authored reaches
the argument list: the input is bytes on stdin, the output is bytes on stdout, and the only
strings are the two configured values. There is no temp file and therefore no temp-file
cleanup path and no filename on disk derived from a brief title.

**6. Failure is typed and named, never a crash or a truncated file.** `spawn` error →
`unavailable`; non-zero exit → `failed`; wall-clock timeout → `timeout`. Each maps to a
502 that names Word as the destination that still works, in the register the route already
uses. A partial stdout is never sent.

**7. `briefExportFilename` becomes extension-aware.** Today it hard-codes `.docx`. It takes
the extension as an argument so both formats share one sanitiser — the same reason
`briefExportName` is shared with the Doc name.

## Files likely to change

- `lib/export/pandoc.ts` — **new.** `pandocConfig()`, `isPdfExportConfigured()`,
  `renderPdfFromDocx()` and its typed result.
- `lib/export/filename.ts` — extension-aware `briefExportFilename`.
- `app/api/briefs/[id]/export/route.ts` — `"pdf"` in `SUPPORTED_FORMATS`, its
  prerequisite check beside the Drive one, its response branch, its log line, and the
  updated unsupported-format message.
- `app/(app)/briefs/[id]/page.tsx` — a "Download PDF" anchor, rendered only when
  configured.
- `.env.example` — `PANDOC_BIN`, `PANDOC_PDF_ENGINE`.
- `AGENTS.md` §19 — one line recording that PDF export needs a Pandoc binary and a PDF
  engine on the host, in the register of the existing `playwright:install` note.

No schema change, no migration, no new dependency, no new script.

## Implementation requirements

### `lib/export/pandoc.ts`

- `import "server-only"` at the top, as `docx.ts` and `gdoc.ts` do.
- `pandocConfig(): { bin: string; pdfEngine: string } | null` — `null` unless
  `process.env.PANDOC_BIN` is a non-empty string. `pdfEngine` falls back to `weasyprint`.
  This is the **only** place either variable is read.
- `isPdfExportConfigured(): boolean` — for the page, mirroring `isDriveExportConfigured`.
- `renderPdfFromDocx(input: { config; docxBytes: Uint8Array }): Promise<PdfRenderResult>`
  where `PdfRenderResult = { ok: true; bytes: Uint8Array } | { ok: false; reason:
  "unavailable" | "failed" | "timeout" }`.
- Invocation: `execFile`/`spawn` from `node:child_process` with an **argument array** —
  `["--from=docx", "--to=pdf", `--pdf-engine=${pdfEngine}`, "--output=-"]` — writing the
  docx bytes to stdin and collecting stdout as a buffer. Verify the exact flag spelling
  against Pandoc's current docs before writing it; if reading docx from stdin proves
  unsupported by the installed Pandoc, use a scratch file created with `mkdtemp` under
  `os.tmpdir()` and delete it in a `finally` — but prefer stdin.
- A **60-second** wall-clock cap. On timeout, kill the child and return
  `{ ok: false, reason: "timeout" }`. Never resolve with partial stdout.
- Cap collected stdout at a sane ceiling (e.g. 40 MB) and treat an overrun as `failed`
  rather than buffering without bound.
- **Never log stderr verbatim.** Pandoc's diagnostics can echo document content back, and
  a brief's body is document content (§7.6). Log `{ briefId, exitCode }` — an exit code and
  ids, in `gdoc.ts`'s status-only style. Never the title, never the filename, never a byte
  of the document.
- The module knows nothing about briefs, flags, roles, sessions or Prisma. Bytes and a
  config in; bytes or a typed reason out.

### `lib/export/filename.ts`

- `briefExportFilename(title: string, version: number, extension: "docx" | "pdf")`.
- The extension is a literal union, never free text and never a query parameter — the
  header-injection reasoning in that file's own doc comment is the reason.
- Update the doc comment so the "both destinations" note becomes "all three".

### The route

- Add `"pdf"` to `SUPPORTED_FORMATS` and delete the `/** Pandoc PDF is still separate
  work… */` comment above it. Update the unsupported-format 400 to name all three.
- Resolve `pandocConfig()` **before** the brief is read, beside the existing
  `driveOAuthConfig()` check, with the parallel refusal: *"PDF export is not configured on
  this deployment. Word (?format=docx) still works."*
- After `renderBriefDocx`, the `pdf` branch calls `renderPdfFromDocx` and:
  - `ok` → respond with the bytes, `content-type: application/pdf`,
    `contentDispositionAttachment(briefExportFilename(title, version, "pdf"))`, and
    `cache-control: no-store` for the same reason the Word path sets it — a brief's current
    version changes under this URL and a cached copy carries a stale flag notice.
  - `timeout` → 504, naming Word.
  - `unavailable` → 502: the binary at `PANDOC_BIN` could not be started. Name Word.
  - `failed` → 502: Pandoc ran and did not produce a document. Name Word. Do not surface
    Pandoc's own message to the browser.
- Log line `brief.export.downloaded` gains nothing new beyond the existing
  `{ briefId, actorId, format, byteLength, openFlagCount }` — `format` already
  distinguishes it.
- **Authorisation is unchanged and stays inside the handler**: `canExportBrief` first, then
  format validation, then configuration, then the read. A Field Officer hitting
  `?format=pdf` directly gets the same 403 as the other two formats.

### The page

- A `Download PDF` anchor in the existing control row, `buttonVariants({ variant:
  "outline" })`, `href={`/api/briefs/${brief.id}/export?format=pdf`}`, rendered only when
  `isPdfExportConfigured()`. **Absent, not disabled**, when unconfigured — the comment
  already in that file states the rule; extend its reasoning rather than restating it.
- Order: Word, PDF, Google Docs — the two downloads together, then the destination that
  leaves the app.
- The open-flag line beneath already reads "The document carries a notice about…" and
  covers every destination. It needs no wording change; confirm that it still reads
  correctly with three controls above it.
- The row already wraps (`flex flex-wrap items-center gap-2`). Verify a third control at
  390px: no horizontal page scroll, nothing clipped, the flag line still legible at its
  `max-w-[30ch]`.
- No new colour pairing is introduced. If one appears, it is wrong.

### `.env.example`

Two variables in the established commented style, in an "Document export" group:

- `PANDOC_BIN` — absolute path to the Pandoc executable. **Unset means PDF export is not
  offered**, which is the correct state on a host without the binary; Word and Google Docs
  are unaffected — server only.
- `PANDOC_PDF_ENGINE` — the engine Pandoc renders through. Defaults to `weasyprint` when
  unset. `pdflatex` needs a full TeX install — server only.

Neither is `NEXT_PUBLIC_*`.

## Evidence classification impact

**None — no evidence data path, and no AI call.**

This task adds a rendering destination to a document that is already assembled. It reads no
`EvidenceItem` body text, no `EvidenceChunk`, and no embedding; it makes no Gemini call, so
the §7 gate has no entry point here to guard. `renderBriefDocx` already restricts the
References section to metadata — title, authors, year, citation key, country, source URL —
and this prompt does not widen it.

Two §7 obligations do bind and are requirements above, not observations:

- **§7.6 — nothing leaves the machine and nothing reaches a log.** Pandoc runs as a local
  child process; no document byte is sent to a third party. Its stderr is never logged
  verbatim, because a converter's diagnostics can quote the document it was converting.
- The brief's title never becomes a process argument or a log field. It reaches the
  response only through `sanitiseFilenameStem`, in a `Content-Disposition` header.

## Hallucination-guard implications

**None.** This prompt does not change what gets fact-checked, how claims are extracted, how
flags are stored, how flags render on screen, or what a flag blocks. Approval remains
refused server-side while open flags exist, untouched here.

The guard's **export** contract is inherited rather than re-implemented, and that is the
point of decision 1: because the PDF is a conversion of `renderBriefDocx`'s output, a brief
with unresolved flags cannot reach a PDF without `COPY.notice` at the top and the "Claims
still being checked" list at the end. Export is **neither silent nor blocked** — the notice
travels with the file (§16.8, §9.5). Nothing in the PDF path may strip, reorder or shorten
either section, and the on-screen watch-ramp line above the controls continues to say so
before the click.

## Security requirements

- `PANDOC_BIN` and `PANDOC_PDF_ENGINE` are server-only, read in exactly one module, never
  `NEXT_PUBLIC_*`, never imported by a client component (§18).
- **No shell.** `execFile`/`spawn` with an argument array. No `exec`, no template-string
  command, no `shell: true`.
- **No officer-authored string reaches the argument list.** Not the title, not the id, not
  a query parameter. Input is stdin; output is stdout.
- The bounded timeout and the stdout ceiling are the denial-of-service controls: a
  malformed document must not pin a process or exhaust memory.
- Authorisation stays inside the Route Handler, before any work: `canExportBrief`, the same
  gate the other two formats pass.
- The filename comes from `sanitiseFilenameStem` and nowhere else; a client-supplied
  filename would be header injection with the sanitiser skipped.
- No temp file whose name derives from a brief title. If a scratch file proves unavoidable,
  it is `mkdtemp`-random, mode-restricted, and removed in a `finally`.
- No Pandoc stderr, no document text, no title, no filename in any log line, Sentry event
  or PostHog property.

## Acceptance criteria

1. With `PANDOC_BIN` set, `/api/briefs/<id>/export?format=pdf` returns a valid PDF with
   `content-type: application/pdf`, an `attachment` disposition naming
   `<sanitised-title>-v<version>.pdf`, and `cache-control: no-store`.
2. The PDF's content matches the `.docx` — same header block, same body, same citation
   keys, same References section, same flag notice and claims list where flags are open.
3. With `PANDOC_BIN` unset: no PDF control on the brief page, a readable 400 on the direct
   URL, and both Word and Google Docs unaffected.
4. `?format=xlsx` returns a 400 naming Word, PDF and Google Docs.
5. A Field Officer hitting `?format=pdf` directly gets 403, before any conversion runs.
6. A `PANDOC_BIN` pointing at a non-executable path yields a 502 naming Word — not a
   stack trace, not a 500, not a truncated file.
7. No token, title, filename, Pandoc stderr line or document text appears in the dev
   terminal across any of the above.
8. The three-control row and the flag line are correct at 390px, 760px, 1000px, 1300px and
   1600px, with no horizontal page scroll.
9. `npm run lint` shows no new errors beyond the four pre-existing ones recorded in
   `AGENTS.md` §19; `npm run typecheck` is clean; `npm run build` succeeds.

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npm run build` — the route and a Server Component both change
- Report the exact output of each. A pre-existing failure is reported as pre-existing, not
  as passing.

## Exact manual test steps

Prerequisite: Pandoc and a PDF engine installed locally —
`sudo pacman -S pandoc-cli` and `sudo pacman -S python-weasyprint` on this machine (or
`pipx install weasyprint`). Then `PANDOC_BIN=$(which pandoc)` in `.env.local` and a dev
server restart. Confirm the pair works outside the app first:
`pandoc --from=docx --to=pdf --pdf-engine=weasyprint some.docx -o out.pdf`.

Seed prerequisite: at least one brief with a version — the database already carries the
`submitted` brief used by prompts 27 and 28, plus one with an unresolved flag.

1. **Word still works** — open a brief, download Word. Unchanged from prompt 12.
2. **PDF** — click Download PDF. Expect a file named `<title>-v<n>.pdf` that opens in a
   PDF reader.
3. **Compare** — open steps 1 and 2 side by side. Headings, body, citation keys and the
   References section must match.
4. **Flags** — open the brief with an unresolved flag. Confirm the on-screen watch-ramp
   line above the controls, then export PDF and confirm the notice appears at the top and
   the "Claims still being checked" list at the end.
5. **Google Docs still works** — export the same brief to a Doc. Unchanged from prompt 28.
6. **Unconfigured** — comment out `PANDOC_BIN`, restart, reload the brief. Expect no PDF
   control, a readable 400 on `?format=pdf` hit directly, and Word plus Google Docs still
   working.
7. **Broken binary** — set `PANDOC_BIN=/usr/bin/false`, restart, export PDF. Expect a 502
   naming Word, no downloaded file, and no stack trace in the browser.
8. **Missing engine** — restore `PANDOC_BIN`, set `PANDOC_PDF_ENGINE=notarealengine`,
   restart, export PDF. Expect the same readable 502, not a hang and not a 0-byte file.
9. **Unknown format** — `?format=xlsx`. Expect the 400 naming all three formats.
10. **Role** — sign in as a Field Officer and hit `?format=pdf` directly. Expect 403.
11. **Logs** — with the dev terminal visible, repeat steps 2, 4, 7 and 8. Confirm no
    document text, no brief title, no filename and no Pandoc stderr line was written.
12. **Responsive** — at 390px, 760px, 1000px, 1300px and 1600px, confirm the three
    controls wrap without horizontal page scroll and the flag line stays legible.
