/*
  Warnings:

  - Added the required column `cost_price` to the `product_variants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."product_variants" ADD COLUMN     "cost_price" DECIMAL(12,2) NOT NULL;
