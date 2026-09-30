-- Stock levels: enable atomic UPSERT semantics for the (product_id, product_variant_id, location_id)
-- triplet by switching the unique index to NULLS NOT DISTINCT (PostgreSQL 15+).
--
-- Why:
--   The application updates stock_levels through "find then update or create" code paths.
--   Under concurrent load (e.g. two simultaneous dispatches for the same product+location)
--   both transactions can read "not found" and both try to INSERT, causing one to roll back
--   the entire transaction (movements included). The fix is to switch the application code to
--   a single atomic `INSERT ... ON CONFLICT DO UPDATE` statement, but ON CONFLICT only fires
--   when the conflict target is fully matched. Postgres treats NULL as distinct by default,
--   so products without variants (productVariantId = NULL) currently bypass the unique index
--   and accumulate duplicate rows (266 such "orphan" rows were observed in production).
--
-- This migration:
--   1. Merges duplicate orphan rows (product_id IS NULL AND product_variant_id IS NULL) per
--      location, summing their quantity/reserved into a single canonical row.
--   2. Rebuilds the unique index with NULLS NOT DISTINCT so future ON CONFLICT statements
--      treat NULL identifiers as equal and prevent duplicates from ever forming again.

BEGIN;

-- 1) Rank orphan rows per location so we can keep the lowest-id row and merge the rest.
--    Using a temp table avoids the lack of MIN(uuid) aggregate.
CREATE TEMPORARY TABLE _orphan_ranks ON COMMIT DROP AS
SELECT
    id,
    location_id,
    quantity,
    reserved,
    ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY id) AS rn
FROM stock_levels
WHERE product_id IS NULL
  AND product_variant_id IS NULL
  AND location_id IS NOT NULL;

-- 2) Merge each location's orphan totals onto its canonical (rn = 1) row.
UPDATE stock_levels sl
SET
    quantity = totals.total_quantity,
    reserved = totals.total_reserved,
    updated_at = NOW()
FROM (
    SELECT
        location_id,
        SUM(quantity) AS total_quantity,
        SUM(reserved) AS total_reserved
    FROM _orphan_ranks
    GROUP BY location_id
) AS totals
JOIN _orphan_ranks keep
    ON keep.location_id = totals.location_id
   AND keep.rn = 1
WHERE sl.id = keep.id;

-- 3) Delete the redundant orphan rows we just folded into the canonical row.
DELETE FROM stock_levels sl
USING _orphan_ranks o
WHERE sl.id = o.id
  AND o.rn > 1;

-- 4) Replace the unique index with one that treats NULLs as equal.
DROP INDEX IF EXISTS stock_levels_product_id_product_variant_id_location_id_key;

CREATE UNIQUE INDEX stock_levels_product_id_product_variant_id_location_id_key
    ON stock_levels (product_id, product_variant_id, location_id)
    NULLS NOT DISTINCT;

COMMIT;
