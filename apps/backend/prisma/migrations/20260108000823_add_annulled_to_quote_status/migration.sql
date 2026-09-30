-- Add ANNULLED value to QuoteStatus enum
-- Note: We cannot update quotes to ANNULLED in the same migration because
-- new enum values must be committed before they can be used in the same transaction.
-- The backfill migration (20260108000824_backfill_annulled_quotes) will handle
-- updating existing quotes to ANNULLED.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'ANNULLED'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'QuoteStatus')
    ) THEN
        ALTER TYPE "QuoteStatus" ADD VALUE 'ANNULLED';
    END IF;
END $$;

