/*
  Warnings:

  - You are about to drop the column `price_type_id` on the `customers` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."customers" DROP CONSTRAINT "customers_price_type_id_fkey";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "price_type_id";

-- CreateTable
CREATE TABLE "customer_prices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "price_type_id" UUID NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_prices_customer_id_price_type_id_key" ON "customer_prices"("customer_id", "price_type_id");

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_price_type_id_fkey" FOREIGN KEY ("price_type_id") REFERENCES "price_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
