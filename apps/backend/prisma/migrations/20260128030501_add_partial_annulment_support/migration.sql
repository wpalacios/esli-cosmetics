-- CreateEnum
CREATE TYPE "OrderAdjustmentType" AS ENUM ('REFUND', 'CREDIT_BALANCE_ADJUSTMENT', 'STORE_CREDIT');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "annulled_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "annulled_at" TIMESTAMPTZ(6),
ADD COLUMN     "annulled_by" UUID,
ADD COLUMN     "annulled_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "annulment_reason" TEXT;

-- CreateTable
CREATE TABLE "order_item_annulments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_annulments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "type" "OrderAdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_item_annulments_order_item_id_idx" ON "order_item_annulments"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_annulments_created_at_idx" ON "order_item_annulments"("created_at");

-- CreateIndex
CREATE INDEX "order_adjustments_order_id_idx" ON "order_adjustments"("order_id");

-- CreateIndex
CREATE INDEX "order_adjustments_type_idx" ON "order_adjustments"("type");

-- CreateIndex
CREATE INDEX "order_adjustments_created_at_idx" ON "order_adjustments"("created_at");

-- AddForeignKey
ALTER TABLE "order_item_annulments" ADD CONSTRAINT "order_item_annulments_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_annulments" ADD CONSTRAINT "order_item_annulments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_adjustments" ADD CONSTRAINT "order_adjustments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_adjustments" ADD CONSTRAINT "order_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
