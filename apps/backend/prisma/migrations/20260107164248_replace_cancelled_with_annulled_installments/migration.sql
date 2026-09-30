-- Add ANNULLED to CreditInstallmentStatus enum
-- Note: CANCELLED never existed in this enum, so we only add ANNULLED
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'ANNULLED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CreditInstallmentStatus')
    ) THEN
        ALTER TYPE "CreditInstallmentStatus" ADD VALUE 'ANNULLED';
    END IF;
END $$;

-- No need to update CANCELLED values since CANCELLED never existed in CreditInstallmentStatus enum
-- The enum originally only had: PENDING, PARTIAL, PAID, OVERDUE
-- ANNULLED is being added as a new value for future use

