/*
  Warnings:

  - You are about to drop the column `type` on the `locations` table. All the data in the column will be lost.
  - The `movement_type` column on the `stock_movements` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."LocationType" AS ENUM ('STORE', 'WAREHOUSE', 'DISTRIBUTION_CENTER', 'POPUP_STORE');

-- CreateEnum
CREATE TYPE "public"."StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'DAMAGE', 'RETURN', 'RESTOCK', 'INTER_BRANCH_TRANSFER', 'WAREHOUSE_TO_STORE', 'STORE_TO_WAREHOUSE');

-- AlterTable
ALTER TABLE "public"."locations" DROP COLUMN "type",
ADD COLUMN     "location_type" "public"."LocationType" NOT NULL DEFAULT 'STORE';

-- AlterTable
ALTER TABLE "public"."stock_movements" DROP COLUMN "movement_type",
ADD COLUMN     "movement_type" "public"."StockMovementType" NOT NULL DEFAULT 'SALE';
