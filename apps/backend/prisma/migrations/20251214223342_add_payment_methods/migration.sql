-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'CREDIT_PAYMENT', 'DOWN_PAYMENT');

-- AlterTable: Fix updated_at default (Prisma @updatedAt handles this automatically)
ALTER TABLE "credits" ALTER COLUMN "updated_at" DROP DEFAULT;

-- Drop old indexes if they exist (from previous migration with different naming)
DROP INDEX IF EXISTS "idx_credits_customer_id";
DROP INDEX IF EXISTS "idx_credits_status";
DROP INDEX IF EXISTS "idx_credits_order_id";
DROP INDEX IF EXISTS "idx_credit_installments_credit_id";
DROP INDEX IF EXISTS "idx_credit_installments_due_date";
DROP INDEX IF EXISTS "idx_credit_installments_status";
DROP INDEX IF EXISTS "idx_payments_credit_installment_id";
DROP INDEX IF EXISTS "idx_payments_customer_id";

-- CreateIndex: Create indexes with Prisma's expected naming convention
CREATE INDEX "credits_customer_id_idx" ON "credits"("customer_id");
CREATE INDEX "credits_status_idx" ON "credits"("status");
CREATE INDEX "credits_order_id_idx" ON "credits"("order_id");

-- CreateIndex: Create indexes for credit_installments table
CREATE INDEX "credit_installments_credit_id_idx" ON "credit_installments"("credit_id");
CREATE INDEX "credit_installments_due_date_idx" ON "credit_installments"("due_date");
CREATE INDEX "credit_installments_status_idx" ON "credit_installments"("status");

-- CreateIndex: Create indexes for payments table
CREATE INDEX "payments_credit_installment_id_idx" ON "payments"("credit_installment_id");
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");
