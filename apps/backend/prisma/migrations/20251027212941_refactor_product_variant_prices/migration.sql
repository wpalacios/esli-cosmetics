/*
  Warnings:

  - You are about to drop the column `prices` on the `product_variants` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `price_types` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[priority]` on the table `price_types` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "prices";

-- CreateTable
CREATE TABLE "product_variant_prices" (
    "product_variant_id" UUID NOT NULL,
    "price_type_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "minQuantity" INTEGER NOT NULL,

    CONSTRAINT "product_variant_prices_pkey" PRIMARY KEY ("product_variant_id","price_type_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_types_name_key" ON "price_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "price_types_priority_key" ON "price_types"("priority");

-- AddForeignKey
ALTER TABLE "product_variant_prices" ADD CONSTRAINT "product_variant_prices_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_prices" ADD CONSTRAINT "product_variant_prices_price_type_id_fkey" FOREIGN KEY ("price_type_id") REFERENCES "price_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
