# 56 — Fix Google Workspace SSO Sign-In Authentication

## Goal

Fix the Google Workspace SSO sign-in failure so that staff and local developers can authenticate smoothly via Google OAuth and land on their role-appropriate screen.

Specifically:
1. Fix Google authorization parameter generation in `auth.ts` so `hd` (Hosted Domain) is omitted when testing with consumer accounts (`gmail.com`, `googlemail.com`), preventing Google OAuth `400 invalid_request` errors.
2. Ensure `trustHost: true` is explicitly configured in `NextAuth` options in `auth.ts` for reliable host resolution in local dev and preview environments.
3. Harden the `signIn` callback to check both `profile` and `user` for email and verification status, supporting boolean `true`, string `"true"`, and OpenID Connect identity fields.
4. Harden the `jwt` callback to handle both `profile` and `user` payload shapes on the initial sign-in pass, guaranteeing that `provisionStaffUser` executes and attaches `staffUserId` to the session token.

## Why this is next

Authentication is the entry point for all staff roles and role-based access control throughout EviBrief. When sign-in fails or is rejected by Google's OAuth endpoint, staff cannot access `/signals`, `/briefs`, `/evidence`, `/tracker`, `/impact`, or `/field`.

## Skills read

- `server-actions` (project) — Auth.js v5 trimmed domain-restricted setup, JWT session strategy with server-side role resolution from DB, fail-closed domain check.
- `supabase-schema` (project) — `StaffUser` and `StaffRole` entities.
- `gemini-api-dev` / `web-design-guidelines` (vendor).

## Existing code inspected

- `auth.ts` — Root Auth.js v5 configuration, Google provider, `allowedDomain()`, `isAllowedIdentity()`, `googleAuthorizationParams`, `signIn`, `jwt`, and `session` callbacks.
- `app/signin/actions.ts` — `signInWithGoogle()` Server Action calling `signIn("google", { redirectTo: "/" })`.
- `app/signin/page.tsx` & `app/signin/landing-hero.tsx` — Sign-in screen rendering and Google sign-in form.
- `lib/auth/session.ts` — `getSession()`, `getCurrentStaffUser()`, `requireStaffUser()`, `landingPathForRole()`.
- `lib/db/staff.ts` — `findStaffUserById()`, `provisionStaffUser()`.
- `types/next-auth.d.ts` — Session and JWT module augmentations for `staffUserId`.

## Decisions and assumptions

1. **Omit `hd` for consumer Google domains:** Google's `hd` (Hosted Domain) parameter is exclusively supported for custom Google Workspace (G Suite) domains. Passing `hd=gmail.com` or `hd=googlemail.com` triggers Google OAuth `Error 400: invalid_request (Parameter hd not allowed for domain)`. The `hd` parameter will only be passed when `AUTH_ALLOWED_DOMAIN` is set to a custom enterprise domain (not `gmail.com` or `googlemail.com`).
2. **Strict server-side domain validation in `isAllowedIdentity`:** Regardless of `hd`, server-side enforcement in the `signIn` callback remains the hard security boundary: it verifies that the email domain matches `AUTH_ALLOWED_DOMAIN` (case-insensitive) and that the email is verified.
3. **Explicit `trustHost: true`:** Explicitly enable `trustHost: true` in `NextAuth` options in `auth.ts` to prevent `UntrustedHost` errors during redirects in development or behind proxies.
4. **Resilient `jwt` token population:** In the `jwt` callback, inspect both `profile` and `user` objects on initial sign-in to guarantee `provisionStaffUser` is called and `token.staffUserId` is populated.

## Files likely to change

| Path | Purpose |
|---|---|
| `auth.ts` | Fix `googleAuthorizationParams` to avoid `hd: "gmail.com"`, add `trustHost: true`, harden `signIn` and `jwt` callbacks |

## Evidence classification impact

**none — no evidence data path.**
This task touches authentication and `StaffUser` session tokens only. It does not read, write, move, or classify any `EvidenceItem` or `EvidenceChunk`.

## Hallucination-guard implications

**none.**
This task does not touch brief generation, claim extraction, or hallucination detection.

## Security requirements

- Fail closed: If `AUTH_ALLOWED_DOMAIN` is missing or empty, all sign-ins must be rejected.
- Domain check must check verified email identity, never untrusted user input.
- Never log full email addresses, OAuth tokens, JWT secrets, or session cookies on rejection or success (AGENTS.md §7.6, §18).
- Role is never stored in JWT or session cookie; role is always resolved server-side from `StaffUser` in the database.

## Acceptance criteria

1. When `AUTH_ALLOWED_DOMAIN=gmail.com`, clicking "Continue with Google" redirects cleanly to Google's sign-in screen without `400 invalid_request` errors from Google.
2. When `AUTH_ALLOWED_DOMAIN` is a custom Google Workspace domain (e.g. `tropenbosghana.org`), `hd` parameter is included in the authorization URL.
3. Signing in with a verified account on `AUTH_ALLOWED_DOMAIN` provisions or updates the `StaffUser` record, populates `staffUserId` on the token, and redirects to the role's landing route (`/signals` or `/field`).
4. Signing in with an account from any other domain is rejected by the `signIn` callback and redirects back to `/signin` with `?error=AccessDenied`.
5. With `AUTH_ALLOWED_DOMAIN` unset, all sign-ins fail closed.
6. `npm run typecheck` passes without errors.

## Checks to run

```bash
npm run typecheck
npx playwright test tests/contracts/authorisation.spec.ts tests/e2e/public-routing.spec.ts
```

## Exact manual test steps expected after implementation

1. Ensure `.env.local` has `AUTH_ALLOWED_DOMAIN=gmail.com` and valid `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
2. Start the dev server (`npm run dev`) and visit `http://localhost:3000/signin`.
3. Click "Continue with Google".
4. Verify that Google's account chooser / consent screen opens normally (no `400 invalid_request` error).
5. Complete sign-in with your Gmail account.
6. Verify redirection to `/field` (for initial `field_officer` role) or `/signals`.
7. Verify the user menu in the top navigation shows the user's name, email, and role badge.
8. Click "Sign out" and verify redirection back to `/signin`.
