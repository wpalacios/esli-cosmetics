-- DropForeignKey
ALTER TABLE "public"."product_kit_items" DROP CONSTRAINT "product_kit_items_product_variant_id_fkey";

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
