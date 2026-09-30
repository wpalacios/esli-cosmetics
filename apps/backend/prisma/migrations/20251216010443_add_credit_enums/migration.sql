/*
  Warnings:

  - The `status` column on the `credit_installments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `credit_type` column on the `credits` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `payment_frequency` column on the `credits` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `credits` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('SHORT_TERM', 'EMPLOYEE_CREDIT', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('WEEKLY', 'BI_WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CreditInstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- AlterTable
ALTER TABLE "credit_installments" DROP COLUMN "status",
ADD COLUMN     "status" "CreditInstallmentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "credits" DROP COLUMN "credit_type",
ADD COLUMN     "credit_type" "CreditType" NOT NULL DEFAULT 'SHORT_TERM',
DROP COLUMN "payment_frequency",
ADD COLUMN     "payment_frequency" "PaymentFrequency" NOT NULL DEFAULT 'WEEKLY',
DROP COLUMN "status",
ADD COLUMN     "status" "CreditStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "credit_installments_status_idx" ON "credit_installments"("status");

-- CreateIndex
CREATE INDEX "credits_status_idx" ON "credits"("status");
