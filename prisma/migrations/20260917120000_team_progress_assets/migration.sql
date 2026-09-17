-- CreateEnum
CREATE TYPE "ProjectProgress" AS ENUM ('NOT_STARTED', 'JUST_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "contactPhone" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "completedOn" DATE,
ADD COLUMN     "coordinatorId" TEXT,
ADD COLUMN     "progress" "ProjectProgress" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "progressNotes" TEXT,
ADD COLUMN     "progressPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "designation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "specification" TEXT,
    "serialNumber" TEXT,
    "purchasedOn" DATE,
    "costPaise" BIGINT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_bills" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_members_isActive_idx" ON "team_members"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_nameKey_key" ON "asset_categories"("nameKey");

-- CreateIndex
CREATE INDEX "assets_categoryId_idx" ON "assets"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_bills_assetId_key" ON "asset_bills"("assetId");

-- CreateIndex
CREATE INDEX "projects_progress_idx" ON "projects"("progress");

-- CreateIndex
CREATE INDEX "projects_coordinatorId_idx" ON "projects"("coordinatorId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_bills" ADD CONSTRAINT "asset_bills_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
