-- Add last_due_date column as nullable first
ALTER TABLE "credits" ADD COLUMN "last_due_date" TIMESTAMPTZ(6);

-- Calculate last_due_date for existing rows based on first_due_date, installment_count, and payment_frequency
UPDATE "credits"
SET "last_due_date" = CASE
  WHEN "payment_frequency" = 'WEEKLY' THEN
    "first_due_date" + (("installment_count" - 1) * INTERVAL '7 days')
  WHEN "payment_frequency" = 'BI_WEEKLY' THEN
    "first_due_date" + (("installment_count" - 1) * INTERVAL '15 days')
  WHEN "payment_frequency" = 'MONTHLY' THEN
    "first_due_date" + (("installment_count" - 1) * INTERVAL '1 month')
  ELSE
    "first_due_date"
END
WHERE "last_due_date" IS NULL;

-- If there are any rows where last_due_date is still NULL (shouldn't happen, but just in case), set it to first_due_date
UPDATE "credits"
SET "last_due_date" = "first_due_date"
WHERE "last_due_date" IS NULL;

-- Now make the column NOT NULL
ALTER TABLE "credits" ALTER COLUMN "last_due_date" SET NOT NULL;
