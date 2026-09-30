/*
  Warnings:

  - You are about to drop the column `employee_id` on the `orders` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_employee_id_fkey";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "employee_id",
ADD COLUMN     "cashier_id" UUID,
ADD COLUMN     "include_tax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "seller_id" UUID;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
