-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "parent_order_item_id" UUID;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_parent_order_item_id_fkey" FOREIGN KEY ("parent_order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
