-- Step 1: Create new enum type with updated values
CREATE TYPE "StockMovementType_new" AS ENUM (
  'PURCHASE',
  'SALE',
  'POSITIVE_ADJUSTMENT',
  'NEGATIVE_ADJUSTMENT',
  'TRANSFER',
  'ANNULMENT',
  'DAMAGE',
  'RETURN',
  'RESTOCK'
);

-- Step 2: Drop the default constraint temporarily
ALTER TABLE "stock_movements"
  ALTER COLUMN "movement_type" DROP DEFAULT;

-- Step 3: Alter the column to use the new enum type, converting old values to new ones
ALTER TABLE "stock_movements"
  ALTER COLUMN "movement_type" TYPE "StockMovementType_new"
  USING (
    CASE
      WHEN "movement_type"::text = 'ADJUSTMENT' AND "quantity" >= 0 THEN 'POSITIVE_ADJUSTMENT'::text
      WHEN "movement_type"::text = 'ADJUSTMENT' AND "quantity" < 0 THEN 'NEGATIVE_ADJUSTMENT'::text
      WHEN "movement_type"::text = 'INTER_BRANCH_TRANSFER' THEN 'TRANSFER'::text
      WHEN "movement_type"::text = 'WAREHOUSE_TO_STORE' THEN 'TRANSFER'::text
      WHEN "movement_type"::text = 'STORE_TO_WAREHOUSE' THEN 'TRANSFER'::text
      ELSE "movement_type"::text
    END::"StockMovementType_new"
  );

-- Step 4: Restore the default constraint with the new enum type
ALTER TABLE "stock_movements"
  ALTER COLUMN "movement_type" SET DEFAULT 'SALE'::"StockMovementType_new";

-- Step 5: Drop the old enum type
DROP TYPE "StockMovementType";

-- Step 6: Rename the new enum type to the original name
ALTER TYPE "StockMovementType_new" RENAME TO "StockMovementType";

