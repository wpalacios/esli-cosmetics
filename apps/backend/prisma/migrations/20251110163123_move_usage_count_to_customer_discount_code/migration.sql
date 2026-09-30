/*
  Warnings:

  - You are about to drop the column `usage_count` on the `discount_codes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "customer_discount_codes" ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "discount_codes" DROP COLUMN "usage_count";
