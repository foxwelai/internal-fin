import { cache } from "react";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { can, forbiddenMessage, type Permission } from "@/lib/permissions";
import type { User, UserRole } from "@/generated/prisma";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * Auth.js v5, email + password against the `users` table, JWT sessions.
 *
 * Accounts are created in the application, not in code: the seed only
 * bootstraps the first owner when the table is empty, and everyone after that
 * is added from the Team page. The token carries an id and nothing else that
 * matters — role and account status are read from the database on every
 * request, so a demotion or a deactivation takes effect immediately rather
 * than whenever the token happens to expire.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

        // Compare against a dummy hash when the account is missing so a wrong
        // email and a wrong password take the same amount of time.
        const hash =
          user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
        const valid = await bcrypt.compare(parsed.data.password, hash);

        if (!user || !valid || !user.isActive) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id as string;
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type CurrentUser = Pick<User, "id" | "email" | "name" | "role" | "isActive">;

/**
 * The signed-in account, read from the database rather than the token.
 *
 * `cache()` makes this one query per request no matter how many components and
 * actions ask for it.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  // Deleted or deactivated since the token was issued.
  if (!user || !user.isActive) return null;
  return user;
});

/**
 * Server-side gate for every protected read and mutation. Server Actions are
 * public HTTP endpoints, so each one calls this before touching the database —
 * middleware alone is not authorization.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** As `requireUser`, and additionally that the role carries `permission`. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new ForbiddenError(forbiddenMessage(user.role, permission));
  }
  return user;
}

export type { Permission, UserRole };
