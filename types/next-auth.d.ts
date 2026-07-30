import type { DefaultSession } from "next-auth";

/**
 * Module augmentation rather than `as` casts on the session (AGENTS.md §18 —
 * no `any`).
 *
 * `staffUserId` is the only thing this product puts on the token. The role is
 * deliberately absent: it is re-read from the database on every render pass and
 * every action call (`lib/auth/session.ts`), so a demotion takes effect on the
 * next request rather than at the next token refresh.
 */

declare module "next-auth" {
  interface Session {
    user: {
      staffUserId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    staffUserId?: string;
  }
}
