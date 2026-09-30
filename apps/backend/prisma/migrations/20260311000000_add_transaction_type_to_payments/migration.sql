-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT', 'REFUND');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "transaction_type" "TransactionType" NOT NULL DEFAULT 'PAYMENT';

-- Backfill: mark existing refunds (created with REFUND- prefix) so statement logic is correct
UPDATE "payments"
SET "transaction_type" = 'REFUND'::"TransactionType"
WHERE "transaction_reference" IS NOT NULL AND "transaction_reference" LIKE 'REFUND-%';
