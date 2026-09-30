-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discount_code_value" DECIMAL(12,2),
ADD COLUMN     "items_discount_total" DECIMAL(12,2),
ADD COLUMN     "manual_discount" DECIMAL(12,2);
