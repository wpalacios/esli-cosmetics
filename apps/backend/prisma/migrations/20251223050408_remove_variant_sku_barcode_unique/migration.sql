-- Remove unique constraints from product_variants sku and barcode
-- Add default_variant_only column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "default_variant_only" BOOLEAN NOT NULL DEFAULT false;
