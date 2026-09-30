/*
  Warnings:

  - A unique constraint covering the columns `[product_id,product_variant_id,location_id]` on the table `stock_levels` will be added. If there are existing duplicate values, this will fail.

*/
-- DropConstraint (was incorrectly trying to drop index)
ALTER TABLE "public"."stock_levels" DROP CONSTRAINT IF EXISTS "stock_levels_product_variant_id_location_id_key";

-- CreateIndex
CREATE INDEX "stock_levels_product_id_idx" ON "public"."stock_levels"("product_id");

-- CreateIndex
CREATE INDEX "stock_levels_location_id_idx" ON "public"."stock_levels"("location_id");

-- CreateIndex
CREATE INDEX "stock_levels_quantity_idx" ON "public"."stock_levels"("quantity");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_product_id_product_variant_id_location_id_key" ON "public"."stock_levels"("product_id", "product_variant_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_product_variant_id_idx" ON "public"."stock_movements"("product_id", "product_variant_id");

-- CreateIndex
CREATE INDEX "stock_movements_from_location_id_idx" ON "public"."stock_movements"("from_location_id");

-- CreateIndex
CREATE INDEX "stock_movements_to_location_id_idx" ON "public"."stock_movements"("to_location_id");

-- CreateIndex
CREATE INDEX "stock_movements_movement_type_created_at_idx" ON "public"."stock_movements"("movement_type", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_created_by_idx" ON "public"."stock_movements"("created_by");

-- CreateIndex
CREATE INDEX "stock_movements_reference_idx" ON "public"."stock_movements"("reference");