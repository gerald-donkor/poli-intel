# 57 — Fix Google Sign-In Continuous Loading

## Goal

Fix the Google Workspace sign-in flow so clicking **Continue with Google** either
redirects to Google and then to the user's role landing page, or returns a clear,
recoverable sign-in error. It must not leave the button and page in a perpetual
pending state when the OAuth callback or `StaffUser` provisioning fails.

The current repository already contains the intended Auth.js v5 route and the
`gmail.com` Hosted Domain fix from prompt 56. The reported symptom is now a
continuously loading page. The implementation must trace the complete flow:

`/signin` form → Server Action → Google authorization → Auth.js callback →
`signIn`/`jwt` callbacks → `StaffUser` provisioning → JWT cookie → `/` role
redirect.

## Skills read

- `server-actions` (project) — Auth.js v5 configuration, Server Action error
  boundaries, and server-side authorisation conventions.
- `supabase-schema` (project) — `StaffUser` persistence and Prisma/Supabase
  connection conventions.

Installed references read:

- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`
- Auth.js/NextAuth v5.0.0-beta.32 installed type and callback implementation
  files under `node_modules/@auth/core/` and `node_modules/next-auth/`.

## Existing code inspected

- `auth.ts` — Google provider, `trustHost`, `hd` handling, `signIn`, `jwt`, and
  `session` callbacks.
- `app/api/auth/[...nextauth]/route.ts` — Auth.js handler export.
- `app/signin/actions.ts` — form Server Action calling `signIn("google")`.
- `app/signin/page.tsx` and `app/signin/landing-hero.tsx` — sign-in rendering,
  error query-param handling, and the form.
- `app/signin/sign-in-button.tsx` — pending-state rendering through
  `useFormStatus`.
- `lib/auth/session.ts` — session resolution and role landing paths.
- `lib/db/staff.ts` and `lib/db/client.ts` — `StaffUser` upsert and Prisma
  connection setup.
- `prisma/schema.prisma` — `StaffUser` model and role default expectations.
- `prompts/56-fix-google-workspace-sso-sign-in.md` — the immediately preceding
  auth fix and its assumptions.
- Recent git history — commit `33993e2` already changed `hd` handling,
  `trustHost`, and callback payload compatibility.

## Decisions or assumptions

1. Preserve Auth.js v5 and the Google-only, domain-restricted architecture. Do
   not switch to Supabase Auth, a credentials provider, a client-side OAuth
   library, or a second backend.
2. Preserve `AUTH_ALLOWED_DOMAIN=gmail.com` compatibility. Do not reintroduce
   `hd` for consumer domains.
3. Treat the indefinite pending state as a symptom of an exception or stalled
   operation in the Server Action/OAuth callback path until verified otherwise.
   Use the smallest targeted instrumentation or tests needed to identify the
   exact failing boundary; do not log secrets, tokens, cookies, full rejected
   email addresses, or evidence text.
4. The database remains the source of truth for role. Successful sign-in must
   still provision/update the user and attach only `staffUserId` to the JWT.
5. Expected authentication failures must return to `/signin` with a stable,
   user-readable error state. Do not expose stack traces or database details to
   the browser.
6. Do not add a timeout that converts a healthy but slow database operation into
   a false rejection unless the installed runtime and error semantics support it
   safely. Prefer fixing the actual callback/action failure and adding bounded
   tests around it.

## Files likely to change

| Path | Purpose |
|---|---|
| `auth.ts` | Correct callback error handling and/or provisioning boundary discovered during diagnosis; preserve domain and JWT security rules. |
| `app/signin/actions.ts` | Ensure the Server Action handles expected Auth.js failures without leaving the form in an unreported pending state. |
| `app/signin/page.tsx` or `app/signin/landing-hero.tsx` | Render a calm, slate, recoverable OAuth/database failure message if the current query-param path does not cover it. |
| `app/signin/sign-in-button.tsx` | Only if needed to ensure pending state is cleared after a returned action result; retain accessible disabled state and no spinner. |
| `lib/db/staff.ts` | Only if diagnosis proves the provisioning query is the failing boundary; preserve idempotent upsert and role protection. |
| `tests/**` | Add focused contract/unit coverage for the failing auth boundary and non-looping error path, following existing test conventions. |

Do not change Prisma schema, migrations, provider choice, environment variable
names, unrelated routes, or the visual design system unless the diagnosis proves
one is directly responsible.

## Implementation requirements

### Authentication callback

- Keep `trustHost: true`, JWT sessions, `/signin` error routing, and the current
  custom-domain-only `hd` behavior.
- Keep server-side verified-domain enforcement and fail closed when
  `AUTH_ALLOWED_DOMAIN` is absent.
- Keep role out of the JWT/session cookie; provision/read the durable staff row
  server-side.
- Ensure an exception in provisioning or callback processing has a defined,
  user-facing failure route rather than an unbounded action request.
- Do not swallow errors. Record only safe, structured diagnostics sufficient to
  distinguish provider rejection, callback failure, and staff provisioning
  failure without personal or sensitive data.

### Server Action and UI state

- The form must remain keyboard-submittable and work without client-side OAuth
  code.
- Pending text may remain `Signing in…`, but it must not be the only possible
  terminal state. Returned failures must render an actionable message and allow
  another attempt.
- Preserve the existing slate/guard visual treatment: no red, destructive
  alert, alarm, or generic success language.
- Preserve the existing calm institutional copy and avoid implying that the
  system approved or verified anything beyond the provider identity check.
- If a retry action is added, it must submit through the existing Server Action
  and not bypass Auth.js.

### Testing

Cover the actual failure boundary found during diagnosis, including as
appropriate:

- successful Google callback provisions a staff user and redirects;
- repeated sign-in updates the name without resetting the role;
- rejected domain and missing allowed domain fail closed;
- provisioning failure does not produce an endlessly pending form and returns a
  safe sign-in error;
- the error state permits a fresh sign-in attempt.

Use mocks/stubs at the Auth.js or data-layer boundary rather than contacting
Google or Supabase in unit/contract tests. Do not add real credentials to tests.

## Evidence classification impact

**none — no evidence data path.** This task touches only authentication,
`StaffUser`, session cookies, and sign-in UI state. It does not read, write,
move, classify, search, embed, generate, translate, or transmit
`EvidenceItem`, `EvidenceChunk`, `Brief`, or `PolicySignal` data, and it makes no
Gemini call. No evidence body text may enter diagnostics as a consequence of
this change.

## Hallucination-guard implications

**none.** This task does not generate briefs, extract claims, store or render
`HallucinationFlag` records, or alter approval blocking. The slate single-pulse
flag visual contract is unchanged.

## Security requirements

- Keep `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and
  `AUTH_ALLOWED_DOMAIN` server-only.
- Never log OAuth tokens, ID tokens, JWT contents, session cookies, database
  URLs, client secrets, or full rejected email addresses.
- Never trust a browser-supplied email or role for authorisation.
- Preserve the verified provider identity and exact allowed-domain check.
- Preserve `StaffUser` upsert idempotency and never reset a role during sign-in.
- Do not reveal whether a database row exists or expose raw Prisma/Auth.js
  errors to unauthenticated users.

## Acceptance criteria

1. Clicking **Continue with Google** no longer leaves the page indefinitely in a
   loading state for any tested terminal outcome.
2. A valid configured Google sign-in reaches `/field` for a newly provisioned
   `field_officer`, or `/signals` for another stored role.
3. A provider/domain rejection returns to `/signin` with a calm, specific,
   non-red message and no session cookie.
4. A callback or `StaffUser` provisioning failure returns to `/signin` with a
   safe retry message; it does not expose internal details or hang.
5. A retry after a failure can submit the Google sign-in action again.
6. No role is added to the JWT or trusted from client state.
7. Existing consumer-domain `gmail.com` behavior remains free of an invalid
   `hd` parameter; custom Workspace domains retain the `hd` hint.
8. `npm run typecheck` passes, and focused auth/routing tests pass without real
   provider credentials.

## Checks to run

```bash
npm run typecheck
npm run lint
npx playwright test tests/contracts/authorisation.spec.ts tests/e2e/public-routing.spec.ts
```

If the repository has a focused auth test command or a new test is added, run it
as well. Run `npm run build` if the changed Server Action or Auth.js route is
affected by the production build.

## Exact manual test steps expected after implementation

1. Confirm `.env.local` has valid `AUTH_SECRET`, `AUTH_URL`, Google credentials,
   `DATABASE_URL`, and `AUTH_ALLOWED_DOMAIN`.
2. Start the app with `npm run dev` and open `http://localhost:3000/signin`.
3. Click **Continue with Google** and verify the browser leaves the sign-in page
   for Google without a Google `400 invalid_request` error.
4. Complete a valid sign-in and verify the app reaches the role-appropriate
   landing route.
5. Sign out, return to `/signin`, and retry sign-in to verify the button is
   usable again.
6. Temporarily use an invalid/missing database connection in a safe local
   environment, click sign-in, and verify the callback returns a safe error
   state rather than loading forever; restore the valid connection afterward.
7. Test a rejected domain (or a test stub) and verify `/signin` shows a slate
   access message with no authenticated app access.
8. Inspect the browser network panel and server log to confirm the flow reaches
   a terminal response; confirm no token, cookie, secret, full rejected email,
   or evidence text is logged.
