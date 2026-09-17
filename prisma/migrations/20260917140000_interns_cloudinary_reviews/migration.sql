-- CreateEnum
CREATE TYPE "TeamMemberKind" AS ENUM ('EMPLOYEE', 'INTERN');

-- CreateEnum
CREATE TYPE "ReviewRecipient" AS ENUM ('CLIENT', 'POINT_OF_CONTACT');

-- AlterTable
ALTER TABLE "asset_bills" ADD COLUMN     "cloudinaryPublicId" TEXT,
ADD COLUMN     "cloudinaryResourceType" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "kind" "TeamMemberKind" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE "client_reviews" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "recipient" "ReviewRecipient" NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "whatWentWell" TEXT,
    "couldImprove" TEXT,
    "reviewerName" TEXT,
    "canQuote" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "client_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_reviews_tokenHash_key" ON "client_reviews"("tokenHash");

-- CreateIndex
CREATE INDEX "client_reviews_projectId_idx" ON "client_reviews"("projectId");

-- CreateIndex
CREATE INDEX "client_reviews_submittedAt_idx" ON "client_reviews"("submittedAt");

-- AddForeignKey
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
