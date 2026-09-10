-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "RecurringInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('PERCENT_OF_RECEIVED', 'FIXED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "billingType" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN     "commissionAmountPaise" BIGINT,
ADD COLUMN     "commissionBasis" "CommissionBasis",
ADD COLUMN     "commissionNotes" TEXT,
ADD COLUMN     "commissionPayee" TEXT,
ADD COLUMN     "commissionRateBps" INTEGER,
ADD COLUMN     "projectUrl" TEXT,
ADD COLUMN     "recurringAmountPaise" BIGINT,
ADD COLUMN     "recurringInterval" "RecurringInterval";

-- CreateTable
CREATE TABLE "commission_payments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "principalPaise" BIGINT NOT NULL,
    "interestRateBps" INTEGER,
    "receivedOn" DATE NOT NULL,
    "dueDate" DATE,
    "reference" TEXT,
    "notes" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_payments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_payments_projectId_idx" ON "commission_payments"("projectId");

-- CreateIndex
CREATE INDEX "commission_payments_paidOn_idx" ON "commission_payments"("paidOn");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "loans_receivedOn_idx" ON "loans"("receivedOn");

-- CreateIndex
CREATE INDEX "loan_payments_loanId_idx" ON "loan_payments"("loanId");

-- CreateIndex
CREATE INDEX "loan_payments_paidOn_idx" ON "loan_payments"("paidOn");

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
