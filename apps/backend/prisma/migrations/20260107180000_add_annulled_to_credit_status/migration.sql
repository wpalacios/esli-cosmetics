-- Add ANNULLED value to CreditStatus enum
-- Note: We cannot update REJECTED to ANNULLED in the same migration because
-- new enum values must be committed before they can be used in the same transaction.
-- The backfill migration (20260107195500_backfill_annulled_credit_orders) will handle
-- updating existing REJECTED credits to ANNULLED.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'ANNULLED'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditStatus')
    ) THEN
        ALTER TYPE "CreditStatus" ADD VALUE 'ANNULLED';
    END IF;
END $$;
