-- Backfill migration for annulled quotes
-- This migration updates existing quotes to ANNULLED status for orders that are already annulled
-- 
-- This migration is idempotent and can be run multiple times safely

-- Update quotes that are linked to annulled orders
-- Only update quotes that are not already ANNULLED to avoid unnecessary updates
UPDATE quotes
SET 
  status = 'ANNULLED'::"QuoteStatus"
WHERE id IN (
  SELECT quote_id 
  FROM orders 
  WHERE status = 'ANNULLED' 
    AND quote_id IS NOT NULL
)
AND status != 'ANNULLED'::"QuoteStatus";

