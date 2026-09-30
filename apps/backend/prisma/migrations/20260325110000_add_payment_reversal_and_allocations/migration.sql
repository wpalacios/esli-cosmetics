-- Add REVERSAL transaction type
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REVERSAL';

-- New enums for payment lifecycle and allocation target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PaymentLifecycleStatus'
  ) THEN
    CREATE TYPE "PaymentLifecycleStatus" AS ENUM ('POSTED', 'REVERSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PaymentAllocationTargetType'
  ) THEN
    CREATE TYPE "PaymentAllocationTargetType" AS ENUM ('OPENING_BALANCE', 'INSTALLMENT');
  END IF;
END $$;

-- Extend payments table for lifecycle + reversal audit
ALTER TABLE "payments"
ADD COLUMN "status" "PaymentLifecycleStatus" NOT NULL DEFAULT 'POSTED',
ADD COLUMN "reversed_at" TIMESTAMPTZ(6),
ADD COLUMN "reversal_reason" TEXT,
ADD COLUMN "reversed_by" UUID,
ADD COLUMN "original_payment_id" UUID;

CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_original_payment_id_idx" ON "payments"("original_payment_id");

ALTER TABLE "payments"
ADD CONSTRAINT "payments_reversed_by_fkey"
FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_original_payment_id_fkey"
FOREIGN KEY ("original_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment allocation details for reliable reversals
CREATE TABLE "payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "target_type" "PaymentAllocationTargetType" NOT NULL,
  "credit_installment_id" UUID,
  "amount" DECIMAL(12,2) NOT NULL,
  "reversed_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");
CREATE INDEX "payment_allocations_credit_installment_id_idx" ON "payment_allocations"("credit_installment_id");

ALTER TABLE "payment_allocations"
ADD CONSTRAINT "payment_allocations_payment_id_fkey"
FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
ADD CONSTRAINT "payment_allocations_credit_installment_id_fkey"
FOREIGN KEY ("credit_installment_id") REFERENCES "credit_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
