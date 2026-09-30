-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('STANDARD', 'KIT');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "expiration_date" TIMESTAMPTZ(6),
ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "product_kit_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_kit_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "product_kit_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_product_kit_id_fkey" FOREIGN KEY ("product_kit_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
