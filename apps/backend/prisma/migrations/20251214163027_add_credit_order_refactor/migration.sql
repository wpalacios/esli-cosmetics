-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT');

-- AlterTable: Add payment_method and credit_id to orders
ALTER TABLE "orders" ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "credit_id" UUID;

-- AlterTable: Add credit_installment_id and customer_id to payments
ALTER TABLE "payments" ADD COLUMN     "credit_installment_id" UUID,
ADD COLUMN     "customer_id" UUID,
ALTER COLUMN "payment_type" SET NOT NULL,
ALTER COLUMN "paid_at" SET NOT NULL;

-- AlterTable: Add credit fields to customers (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'credit_allowed') THEN
        ALTER TABLE "customers" ADD COLUMN "credit_allowed" BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'credit_limit') THEN
        ALTER TABLE "customers" ADD COLUMN "credit_limit" DECIMAL(12,2);
    END IF;
END $$;

-- CreateTable: credits
CREATE TABLE "credits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "principal_amount" DECIMAL(12,2) NOT NULL,
    "outstanding_amount" DECIMAL(12,2) NOT NULL,
    "credit_type" VARCHAR(255) NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "payment_frequency" VARCHAR(255) NOT NULL,
    "duration_days" INTEGER,
    "first_due_date" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable: credit_installments
CREATE TABLE "credit_installments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "credit_id" UUID NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(255) NOT NULL,

    CONSTRAINT "credit_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on credits.order_id
CREATE UNIQUE INDEX "credits_order_id_key" ON "credits"("order_id");

-- CreateIndex: Unique constraint on credit_installments (credit_id, installment_no)
CREATE UNIQUE INDEX "credit_installments_credit_id_installment_no_key" ON "credit_installments"("credit_id", "installment_no");

-- CreateIndex: Unique constraint on orders.credit_id
CREATE UNIQUE INDEX "orders_credit_id_key" ON "orders"("credit_id");

-- CreateIndex: Performance indexes for credits
CREATE INDEX "idx_credits_customer_id" ON "credits"("customer_id");
CREATE INDEX "idx_credits_status" ON "credits"("status");
CREATE INDEX "idx_credits_order_id" ON "credits"("order_id");

-- CreateIndex: Performance indexes for credit_installments
CREATE INDEX "idx_credit_installments_credit_id" ON "credit_installments"("credit_id");
CREATE INDEX "idx_credit_installments_due_date" ON "credit_installments"("due_date");
CREATE INDEX "idx_credit_installments_status" ON "credit_installments"("status");

-- CreateIndex: Performance indexes for payments
CREATE INDEX "idx_payments_credit_installment_id" ON "payments"("credit_installment_id");
CREATE INDEX "idx_payments_customer_id" ON "payments"("customer_id");

-- AddForeignKey: credits.order_id -> orders.id
ALTER TABLE "credits" ADD CONSTRAINT "credits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: credits.customer_id -> customers.id
ALTER TABLE "credits" ADD CONSTRAINT "credits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: credit_installments.credit_id -> credits.id
ALTER TABLE "credit_installments" ADD CONSTRAINT "credit_installments_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: payments.credit_installment_id -> credit_installments.id
ALTER TABLE "payments" ADD CONSTRAINT "payments_credit_installment_id_fkey" FOREIGN KEY ("credit_installment_id") REFERENCES "credit_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: payments.customer_id -> customers.id
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: orders.credit_id is kept as a denormalized field for quick lookup
-- The primary relation is credits.order_id -> orders.id (defined above)
-- No foreign key constraint on orders.credit_id to avoid circular dependency

