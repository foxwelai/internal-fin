import type { DefaultSession } from "next-auth";

/**
 * The token carries an id and nothing else that grants anything. Role and
 * account status are read from the database on every request (see
 * `getCurrentUser` in src/lib/auth.ts), so a change takes effect immediately
 * instead of whenever the token expires.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
