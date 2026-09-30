-- Remove unique constraints from product_variants sku and barcode
-- This allows variants to have the same SKU/barcode as their parent product
-- and allows multiple variants within the same product to share SKU/barcode

-- Drop unique constraint on sku if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'product_variants_sku_key' 
    AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants DROP CONSTRAINT product_variants_sku_key;
  END IF;
END $$;

-- Drop unique constraint on barcode if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'product_variants_barcode_key' 
    AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants DROP CONSTRAINT product_variants_barcode_key;
  END IF;
END $$;

