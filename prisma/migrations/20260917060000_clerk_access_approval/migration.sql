-- Clerk takes over sign-in; this table keeps deciding access.

-- Rename in place rather than drop-and-recreate, so every existing row keeps
-- its role: the owner becomes the super admin.
ALTER TYPE "UserRole" RENAME VALUE 'OWNER' TO 'SUPER_ADMIN';

ALTER TABLE "users" ADD COLUMN "clerkUserId" TEXT;
ALTER TABLE "users" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "approvedById" TEXT;

-- Passwords now live in Clerk. Kept, not dropped, so no history is destroyed.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Everyone who already had an account was, by definition, approved.
UPDATE "users" SET "approvedAt" = "createdAt" WHERE "approvedAt" IS NULL;

CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");
CREATE INDEX "users_approvedAt_idx" ON "users"("approvedAt");

ALTER TABLE "users" ADD CONSTRAINT "users_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
