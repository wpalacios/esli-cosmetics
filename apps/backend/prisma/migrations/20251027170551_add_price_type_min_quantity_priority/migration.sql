-- AlterTable
ALTER TABLE "price_types" ADD COLUMN     "minimum_quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 1;
