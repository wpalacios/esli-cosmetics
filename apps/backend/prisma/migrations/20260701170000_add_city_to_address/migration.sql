-- Add free-text city column to customer/person addresses
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "city" VARCHAR(255);
