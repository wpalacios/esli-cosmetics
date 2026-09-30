/*
  Warnings:

  - You are about to drop the column `cost_price` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the column `retail_price` on the `product_variants` table. All the data in the column will be lost.
  - Made the column `attributes` on table `product_variants` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."product_variants" DROP COLUMN "cost_price",
DROP COLUMN "price",
DROP COLUMN "retail_price",
ADD COLUMN     "prices" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "attributes" SET NOT NULL,
ALTER COLUMN "attributes" SET DEFAULT '{}';
