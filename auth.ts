import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { provisionStaffUser } from "@/lib/db";

/**
 * Auth.js v5 — Google Workspace SSO, restricted to the Tropenbos domain
 * (AGENTS.md §10.9, spec §4.3).
 *
 * Deliberately trimmed: one provider, no credentials provider, no email or
 * magic-link provider, no adapter. There is no local-account path to build,
 * secure, or reason about.
 *
 * JWT session strategy, matching the `StaffUser` comment in `schema.prisma`:
 * the token carries `staffUserId` only. The role is never a token claim — it is
 * re-read from the database on every render pass and every action call
 * (`lib/auth/session.ts`).
 */

/**
 * Fail closed. A missing `AUTH_ALLOWED_DOMAIN` means "reject everyone", never
 * "allow everyone" (AGENTS.md §18, security requirements).
 */
function allowedDomain(): string | null {
  const domain = process.env.AUTH_ALLOWED_DOMAIN?.trim().toLowerCase();
  return domain ? domain : null;
}

/**
 * The domain restriction, checked against the provider's *verified* identity —
 * never a user-supplied field. An unverified email is rejected even on the
 * right domain.
 */
function isAllowedIdentity(
  email: string | null | undefined,
  emailVerified: boolean | null | undefined,
): boolean {
  const domain = allowedDomain();
  if (!domain) return false;
  if (emailVerified !== true) return false;
  if (!email) return false;

  const emailDomain = email.split("@")[1]?.toLowerCase();
  return emailDomain === domain;
}

// The `hd` hint pre-filters Google's own account chooser. It is a UX nicety and
// never the enforcement — the signIn callback below stands alone and must not
// be made conditional on it.
const googleAuthorizationParams = (() => {
  const domain = allowedDomain();
  return domain ? { params: { hd: domain } } : undefined;
})();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: googleAuthorizationParams })],

  session: { strategy: "jwt" },

  // No default Auth.js UI is ever reachable; both land on the project's screen.
  pages: { signIn: "/signin", error: "/signin" },

  callbacks: {
    signIn({ profile }) {
      const allowed = isAllowedIdentity(profile?.email, profile?.email_verified);

      if (!allowed) {
        // Log the decision, never the identity: no full email address, no
        // token, no id token, no cookie (AGENTS.md §7.6, §18).
        console.warn(
          "[auth] sign-in rejected: identity is not a verified account on the allowed Workspace domain",
        );
      }

      return allowed;
    },

    async jwt({ token, profile }) {
      // `profile` is present only on the sign-in pass, which the callback above
      // has already allowed. Provisioning here is what puts `staffUserId` on
      // the token; a failure throws and the sign-in fails visibly rather than
      // issuing a token with no actor behind it.
      if (profile) {
        const email = profile.email;
        if (!email) return token;

        const staffUser = await provisionStaffUser({
          email,
          name: profile.name?.trim() || email.split("@")[0],
        });

        token.staffUserId = staffUser.id;
        token.email = staffUser.email;
        token.name = staffUser.name;
      }

      return token;
    },

    session({ session, token }) {
      // Narrowed rather than cast — the token is untrusted input shape-wise.
      if (typeof token.staffUserId === "string") {
        session.user.staffUserId = token.staffUserId;
      }

      return session;
    },
  },
});
