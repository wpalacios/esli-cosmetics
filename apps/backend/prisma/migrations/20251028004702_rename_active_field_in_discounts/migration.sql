/*
  Warnings:

  - You are about to drop the column `active` on the `discount_codes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "discount_codes" DROP COLUMN "active",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
