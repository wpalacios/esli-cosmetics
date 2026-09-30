/*
  Warnings:

  - You are about to drop the column `slug` on the `brands` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."brands_slug_key";

-- AlterTable
ALTER TABLE "brands" DROP COLUMN "slug";
