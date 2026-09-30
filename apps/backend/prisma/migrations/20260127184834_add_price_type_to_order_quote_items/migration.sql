-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "price_type_id" UUID;

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "price_type_id" UUID;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_type_id_fkey" FOREIGN KEY ("price_type_id") REFERENCES "price_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_price_type_id_fkey" FOREIGN KEY ("price_type_id") REFERENCES "price_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
