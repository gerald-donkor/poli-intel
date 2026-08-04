# 28 — Google Docs export: the brief where the office already works

## Goal

Let a staff member send an approved brief to Google Docs, so the version that
gets commented on and co-edited is the one EviBrief produced (`AGENTS.md` §1's
"brief editor — Tiptap, citation chips, hallucination-flag rendering, **Word and
Google Docs export**", spec §5.7).

Word export shipped. `lib/export/` holds `docx.ts` and `filename.ts`, and
`app/api/briefs/[id]/export/route.ts` hard-codes `SUPPORTED_FORMAT = "docx"`,
refuses anything else with a 400 naming what is available, and says in its own
comment that "Pandoc PDF and Google Docs are separate work". This is the Google
Docs half. It is the **last unbuilt item on `AGENTS.md` §1's build list**.

Three things, and nothing else:

1. **One document mapping, not two.** The Google Doc is the existing
   `renderBriefDocx` output, uploaded to Drive and converted on the way in.
2. **A Drive grant that is separate from sign-in**, requested the first time
   someone exports, scoped to files this app created, and revocable.
3. **The same flag contract as every other export.** A brief with unresolved
   hallucination-guard flags carries its notice into the Doc, because it is the
   same rendered document.

**It does not build PDF export.** Pandoc is a system binary rather than an npm
package, and whether it belongs on Vercel at all is a deployment decision with a
different risk surface from an OAuth grant. `?format=pdf` keeps returning the
400 it returns today. That is prompt 29 or later.

**It does not change how anyone signs in.** See decision 2.

## Skills read

- `tiptap-editor` — the export section: the editor's document model is the
  source for every export format, and export is a Route Handler concern because
  an export is a *response*, not a mutation.
- `server-actions` — the Auth.js v5 section, because this touches Google OAuth
  without touching the sign-in path, and the authorise-first order the export
  route already follows.
- `hallucination-guard` — the export contract specifically: export never
  bypasses flag state (`AGENTS.md` §16, §9.5).
- `evidence-governance` — read because this is a new egress path to a
  third-party host. See the classification section below.

Not loaded, deliberately: `design-system` is loaded only for the one menu item
this adds to the existing export control — no new screen, no new component, no
new token. `gemini-integration` is not loaded: no model call exists on this path.

**Read before implementing, not instead of:** the installed `next-auth`
(`5.0.0-beta.32`) types for anything touching OAuth, `node_modules/next/dist/docs/`
for the current Route Handler and redirect surface, and **Google's own current
Drive API v3 documentation** for the multipart upload shape. Do not write the
upload body's part boundaries, the metadata field names, or the token endpoint's
parameters from memory.

## Existing code inspected

- `app/api/briefs/[id]/export/route.ts` — the route this extends. `GET`,
  authorise-inside-the-handler, `format` query parameter already present
  *specifically* so a second format slots in without moving the route, 400 on an
  unrecognised value with no silent fallback, `cache-control: no-store`, and a
  `console.info` that logs ids and counts but never the filename, because a
  filename is derived from a title and a title is document content.
- `lib/export/docx.ts` — `renderBriefDocx`. Takes `openFlags` and already
  renders both `flagNotice` (line 261) and `openClaims` (line 328). **This is
  the reason the Google Doc is built from the docx and not from a second
  mapping** — see decision 1.
- `lib/export/filename.ts` — `sanitiseFilenameStem`, `briefExportFilename`,
  `contentDispositionAttachment`. The Doc's title reuses the first two.
- `lib/db/briefs.ts` — `findBriefForExport`, which already returns
  `documentJson`, `bodyText`, `evidence` and `openFlags`. **Not widened by this
  prompt**: the Google Doc contains exactly what the Word file contains.
- `auth.ts` — Auth.js v5, one Google provider, `session: { strategy: "jwt" }`,
  **no adapter**. `prisma/schema.prisma:295` states it: "Auth.js v5 runs a JWT
  session strategy, so there are no adapter tables here." There is consequently
  **nowhere in this project to persist a Google token today**, which is the
  single fact that shapes this whole prompt.
- `lib/auth/authorize.ts` — `canExportBrief`, the existing role check.
- `lib/whatsapp/client.ts` and `lib/ussd/client.ts` — the `server-only`,
  returns-`null`-when-unconfigured pattern this prompt's Drive client follows.
- `app/(app)/briefs/[id]/page.tsx:149` — the one export link in the UI,
  `?format=docx`.
- `.env.example` — the canonical variable list this adds to.

## Decisions and assumptions

1. **The Google Doc is the Word file, converted on upload — not a second
   rendering.** Drive's `files.create` accepts a multipart request whose metadata
   names `application/vnd.google-apps.document` as the target `mimeType` while the
   body carries the `.docx` bytes, and imports it as a native Doc.

   The alternative is translating the Tiptap document into Google Docs API
   `batchUpdate` requests. That would be a **second document mapping for the same
   concept** — a second place for headings, citation chips, the flag notice and
   the open-claims list to be expressed, and therefore a second place for them to
   drift (`AGENTS.md` §12.1's spirit, §18's no-duplicate-implementations).

   It also gets the guard contract right for free: `renderBriefDocx` already
   emits `flagNotice` and `openClaims`, so a brief with open flags cannot reach
   Google Docs without its notice. A hand-written Docs mapping would have to
   re-implement that, and forgetting it would be a silent §9.5 breach.

2. **The Drive grant is separate from sign-in, and the sign-in path is not
   touched.** `auth.ts` is deliberately trimmed — one provider, no adapter, no
   credentials path — and widening its `scope` would mean every staff member
   grants Drive access at first sign-in, including the Field Officers who will
   never export anything (§10.5).

   Instead: a dedicated authorisation flow, entered the first time someone
   exports to Google Docs. This is Google's own documented **incremental
   authorization** pattern, and it means the consent screen names Drive at the
   moment the person asked for a Google Doc, which is when it makes sense to
   them.

3. **`drive.file`, and nothing wider.** Per-file access, limited to files this
   application created. It is classified **non-sensitive**: no Google app
   verification, and no CASA security assessment — the paid third-party annual
   audit that `drive` and `drive.readonly` trigger. For a four-person
   organisation on free tiers, that difference is the difference between shipping
   and not.

   `drive.file` is also the correct scope on the merits, not merely the cheap
   one: EviBrief has no business reading anything in anyone's Drive, and this
   scope makes that structural rather than promised.

4. **The refresh token is stored, encrypted, in its own table.** Since there is
   no adapter, this needs a `GoogleDriveGrant` model — `staffUserId` unique,
   the encrypted refresh token, the granted scope, and `grantedAt`.

   **Why store one rather than re-consent per export:** without offline access
   every export becomes an OAuth redirect round-trip, and an app that shows a
   consent screen repeatedly teaches its users to click through consent screens
   without reading them. That is a worse security outcome than one encrypted
   secret at rest.

   **Encrypted at rest, not stored raw.** A refresh token is a long-lived
   credential. A new server-only `DRIVE_TOKEN_ENCRYPTION_KEY` is used with
   AES-256-GCM; the key is never `NEXT_PUBLIC_*` and never logged. If the
   implementer finds the key handling wants its own module, `lib/crypto/` is the
   place — do not scatter cipher calls across the Drive client.

   A grant is revocable: deleting the row is the revocation, and the UI says so.

5. **The Doc lands in the exporter's own Drive, not a shared folder.** Whose
   Drive, which folder, and whether briefs should live in a shared drive is a
   Tropenbos operational decision nobody has made. The person's own Drive is the
   assumption that cannot be wrong for them, and moving a Doc afterwards is one
   drag. **Do not invent a folder structure.**

6. **The export route stays the one entry point.** `?format=gdoc` joins
   `?format=docx` on the existing handler rather than getting a route of its own,
   because it is the same authorisation, the same read, and the same rendering
   with a different destination. `SUPPORTED_FORMAT` becomes a set, and the 400
   keeps naming every format that exists.

7. **A Google Doc export is a redirect, not a download.** `?format=docx`
   responds with bytes; `?format=gdoc` responds with a redirect to the created
   Doc's URL. Two different response kinds on one route is the honest shape here —
   the alternative, returning JSON and having the client open a window, would put
   pipeline state in the UI (§5.3).

8. **No grant, no guessing.** A staff member who has not authorised Drive is
   redirected into the consent flow and returned to the export, once. A refused
   or expired grant is a named, readable refusal — never a generic error, and
   never a silent fall back to downloading a Word file they did not ask for.

## Files likely to change

New:

- `lib/export/gdoc.ts` — `server-only`. Takes the rendered docx bytes and a
  title, performs the Drive multipart upload with conversion, returns the created
  Doc's id and URL. Knows nothing about briefs, flags or roles.
- `lib/google/drive-client.ts` — `server-only`. The one place
  `DRIVE_TOKEN_ENCRYPTION_KEY` is read and the one place a Google access token is
  minted from a stored refresh token. Returns `null` when unconfigured, the same
  shape `whatsappConfig()` and `ussdSecret()` use.
- `lib/crypto/secret-box.ts` — AES-256-GCM seal/open for the stored refresh
  token. Pure apart from reading nothing: the key is passed in.
- `lib/db/google-grants.ts` — the grant's reads and writes, in the data layer
  like everything else that touches Prisma.
- `app/api/auth/google-drive/route.ts` + its callback — the incremental consent
  flow. Thin: state parameter, code exchange, store the sealed refresh token,
  redirect back to the brief.
- `prisma/migrations/<timestamp>_google_drive_grant/migration.sql` — via
  `npm run db:migrate:new`, never `prisma migrate dev`.

Changed:

- `app/api/briefs/[id]/export/route.ts` — `format` becomes a small set; the
  `gdoc` branch renders the same docx, uploads, and redirects.
- `app/(app)/briefs/[id]/page.tsx` — the export control gains a second item.
  One menu, two destinations; no new component and no new token.
- `prisma/schema.prisma` — the `GoogleDriveGrant` model.
- `.env.example` — `DRIVE_TOKEN_ENCRYPTION_KEY`, server-only, with a note that
  `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are reused for the Drive grant and that
  the Drive scope is **not** added to the sign-in request.
- `AGENTS.md` §19 only if a script is added — none is expected.

## Implementation requirements

### The export route

- Authorise first, inside the handler, exactly as it does today: session →
  `canExportBrief` → validate `format` → read → render. A new format does not get
  a new authorisation story.
- `format=gdoc` with no stored grant redirects into the consent flow carrying the
  brief id and format, and returns to the export once. Never a loop: a second
  pass without a grant is a readable refusal, not another redirect.
- The upload is the same `renderBriefDocx` output the Word path produces. If the
  two ever diverge, that is the defect.
- The `console.info` line keeps its current discipline — ids, counts, format, and
  now the Doc id. **Never the title, never the filename, never the Doc's name.**

### The Drive grant

- `access_type=offline` and `prompt=consent` only on the first grant, so a
  refresh token is actually issued; do not re-prompt on every export.
- The `state` parameter is generated server-side, single-use, and verified on
  return. An unverified `state` is a 403 and no code exchange.
- The refresh token is sealed before it reaches Prisma and opened only inside
  `lib/google/drive-client.ts`. It never appears in a log line, a Sentry event, a
  PostHog property, or a response body.
- An access token lives for the duration of one request and is never persisted.
- Revocation is deleting the row, and the UI offers it wherever the grant is
  visible.

### Failure states, all named

- **No grant** — the consent flow, once.
- **Grant revoked at Google** (refresh returns `invalid_grant`) — delete the
  stale row and send the person back through consent, saying that Drive access
  was withdrawn. Never a 500.
- **Drive API failure or quota** — a readable refusal naming Word export as the
  working alternative. The brief is untouched.
- **Unconfigured deployment** (no encryption key) — `?format=gdoc` is refused
  with a 400 that names Word, and the UI does not offer the menu item. A local
  `npm run dev` with no Drive setup must not crash.

## Evidence classification impact

**No Gemini call fires on this path, and no evidence body text reaches it.**

None of `evidence-governance`'s eight gated call types is touched: no embedding,
no summarisation, no classification, no generation, no re-generation, no audience
switch, no translation, no fact-check. Nothing in this prompt's import graph
reaches `lib/ai/` or `lib/governance/`.

The gate is nonetheless load-bearing here as a **data-egress** rule, because this
is a new third-party destination and that deserves an argument rather than an
assumption:

- **A brief body cannot contain ineligible evidence by construction.** Generation
  only ever receives `public_published` evidence — the gate at the AI layer's
  entry is what guarantees it — so a brief's prose and its citations are derived
  from published material. Community-sourced and unpublished-internal items never
  reach a generator, and therefore never reach a rendered brief.
- **The enforcement point is unchanged and upstream.** It is the gate in the AI
  layer, not a new check in the export path. This prompt adds no way for evidence
  to enter a brief, so there is no per-format rule anyone can forget.
- **`findBriefForExport` must not be widened by this prompt.** The Google Doc
  contains exactly what the Word file contains. If a future export wants evidence
  body text, that is a governance decision and a different prompt.
- The destination is the staff member's own Google Workspace Drive — the same
  Workspace that already holds their SSO identity and their mail — not an
  arbitrary third-party host. The `drive.file` scope means this application can
  never read anything else in it.
- No brief content reaches a log line, Sentry, or PostHog (§7.6). That includes
  the Doc's title, because a title is document content.

## Hallucination-guard implications

**The contract is unchanged, and it is inherited rather than re-implemented.**

- Export never bypasses flag state (§16, §9.5). Because the Doc *is* the rendered
  docx, `flagNotice` (`lib/export/docx.ts:261`) and `openClaims` (line 328) apply
  to it identically. A brief with unresolved flags carries its notice into Google
  Docs.
- **This is the strongest argument for decision 1.** A hand-written Google Docs
  mapping would have to re-implement the notice, and omitting it would put an
  unflagged-looking document in front of a reader — the exact failure §9 exists to
  prevent.
- Nothing changes about what is fact-checked, how claims are extracted, how flags
  are stored, how they render in the editor, or what a flag blocks. No flag is
  created, resolved, or dismissed on this path.
- Approval remains blocked server-side while open flags exist. Export is not
  approval and does not become one.

## Security requirements

- `DRIVE_TOKEN_ENCRYPTION_KEY`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are
  server-only; none is `NEXT_PUBLIC_*`, none is imported from a client component,
  none is logged.
- The refresh token is encrypted at rest and decrypted only in the server-only
  Drive client.
- OAuth `state` is server-generated, single-use, and verified; an unverified
  return exchanges no code.
- The requested scope is `drive.file` and nothing wider. Do not add a Drive scope
  to the sign-in request in `auth.ts`.
- The brief id from the URL is validated and the caller authorised for that brief
  before any Drive call — a Drive grant is not a substitute for `canExportBrief`.
- The redirect target after consent is validated against an internal path; never
  an open redirect from a query parameter.

## Acceptance criteria

1. A brief exports to Google Docs and opens as a native Doc — not a `.docx`
   attachment sitting in Drive.
2. Its heading structure, citations, and body match the Word export of the same
   brief and version.
3. A brief with unresolved flags carries its flag notice and open-claims list
   into the Doc.
4. A first export sends the person through consent naming Drive, and returns them
   to the brief with the Doc created.
5. A second export creates a Doc with no consent screen.
6. Revoking the grant and exporting again re-enters consent rather than throwing.
7. `?format=docx` behaves exactly as it does today.
8. `?format=pdf` still returns a 400 naming the formats that exist.
9. A deployment with no `DRIVE_TOKEN_ENCRYPTION_KEY` refuses `gdoc` with a
   readable 400 and does not offer the menu item, and Word export still works.
10. No refresh token, access token, brief title, or Doc name appears in any log
    line.
11. `auth.ts` requests no Drive scope; sign-in is unchanged for every role.
12. A Field Officer cannot reach the export route at all, for either format.

## Checks to run

- `npm run lint` — expect only the 4 known pre-existing errors in
  `components/ui/carousel.tsx`, `hooks/use-mobile.ts`, and
  `design_handoff_evibrief/support.js`.
- `npm run typecheck`
- `npm run build` — routes are added, so the build is affected.
- `npm run db:migrate:new -- google_drive_grant` then `npm run db:migrate` — and
  confirm the generated SQL contains no `DROP INDEX` on either
  `*_embedding_cosine_idx`.

Report the exact output of each.

## Manual test steps

Prerequisite: a Google Cloud project whose OAuth client is the one in
`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, with the Drive API enabled and
`https://localhost:3000/api/auth/google-drive/callback` registered as a redirect
URI. `DRIVE_TOKEN_ENCRYPTION_KEY` set in `.env.local` (32 bytes, e.g.
`openssl rand -base64 32`).

Seed prerequisite: at least one brief with a version. The database currently has
one `submitted` brief created for prompt 27's test pass.

1. **Word still works** — open a brief, export to Word. Unchanged.
2. **First Google Docs export** — choose Google Docs. Expect a consent screen
   naming Drive only, then a redirect to a new Doc. Confirm it opens as a Doc.
3. **Compare** — check headings, citations and body against step 1's file.
4. **Flags** — export a brief with an unresolved flag. Confirm the notice and the
   open-claims list appear in the Doc.
5. **Second export** — export again. Expect no consent screen.
6. **Revoke** — remove EviBrief's access at
   <https://myaccount.google.com/permissions>, then export again. Expect consent,
   not a 500.
7. **Scope check** — at that same page, confirm the grant names per-file access
   and not full Drive access.
8. **Unconfigured** — unset `DRIVE_TOKEN_ENCRYPTION_KEY`, restart, open a brief.
   Expect no Google Docs item, a readable 400 if the URL is hit directly, and
   Word still working.
9. **Unknown format** — `?format=pdf`. Expect the 400 naming Word and Google Docs.
10. **Role** — sign in as a Field Officer and hit the export URL directly for
    both formats. Expect 403 both times.
11. **Logs** — with the dev terminal visible, run steps 2–5 and confirm no token,
    no brief title, and no Doc name is logged.
