-- AlterTable: Remove email and phone columns from customers table
-- These fields now come from the person table relation

ALTER TABLE "customers" DROP COLUMN "email";
ALTER TABLE "customers" DROP COLUMN "phone";
