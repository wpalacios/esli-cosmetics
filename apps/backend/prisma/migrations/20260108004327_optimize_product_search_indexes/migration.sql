-- Optimize product search performance with trigram indexes and composite indexes
-- This migration adds indexes to support fast case-insensitive text search on 6k+ records

-- Enable pg_trgm extension for trigram text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN indexes for case-insensitive text search on product_variants
-- These indexes dramatically improve performance for ILIKE and contains operations
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode_gin 
  ON product_variants USING gin (barcode gin_trgm_ops)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_sku_gin 
  ON product_variants USING gin (sku gin_trgm_ops)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_name_gin 
  ON product_variants USING gin (name gin_trgm_ops)
  WHERE name IS NOT NULL;

-- Trigram index for product names (used in nested search)
CREATE INDEX IF NOT EXISTS idx_products_name_gin 
  ON products USING gin (name gin_trgm_ops)
  WHERE name IS NOT NULL;

-- Composite indexes for common filter combinations
-- These indexes speed up queries that filter by isActive and isDeleted
CREATE INDEX IF NOT EXISTS idx_product_variants_active_deleted 
  ON product_variants (is_active, is_deleted) 
  WHERE is_deleted = false AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_deleted 
  ON products (is_active, is_deleted) 
  WHERE is_deleted = false AND is_active = true;
