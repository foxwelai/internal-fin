-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('JUST_SPOKE', 'IN_PROCESS', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadQuality" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('REFERRAL', 'WEBSITE', 'SOCIAL', 'OUTREACH', 'EVENT', 'EXISTING_CLIENT', 'OTHER');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'JUST_SPOKE',
    "quality" "LeadQuality" NOT NULL DEFAULT 'WARM',
    "source" "LeadSource",
    "expectedValuePaise" BIGINT,
    "expectedCloseMonth" DATE,
    "requirement" TEXT,
    "ownerId" TEXT,
    "nextFollowUpOn" DATE,
    "lostReason" TEXT,
    "closedOn" DATE,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

-- CreateIndex
CREATE INDEX "leads_expectedCloseMonth_idx" ON "leads"("expectedCloseMonth");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
