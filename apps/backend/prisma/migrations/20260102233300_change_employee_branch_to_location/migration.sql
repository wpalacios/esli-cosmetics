-- AlterTable: Add location_id column
ALTER TABLE "employees" ADD COLUMN "location_id" UUID;

-- Data Migration: Migrate branch_id to location_id
-- For each employee with a branch_id, assign the first location from that branch
UPDATE "employees" e
SET "location_id" = (
  SELECT l.id
  FROM "locations" l
  WHERE l."branch_id" = e."branch_id"
    AND l."is_deleted" = false
  ORDER BY l."created_at" ASC
  LIMIT 1
)
WHERE e."branch_id" IS NOT NULL
  AND e."location_id" IS NULL;

-- DropForeignKey: Remove the old branch foreign key
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_branch_id_fkey";

-- AlterTable: Remove branch_id column
ALTER TABLE "employees" DROP COLUMN "branch_id";

-- AddForeignKey: Add location foreign key
ALTER TABLE "employees" ADD CONSTRAINT "employees_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

