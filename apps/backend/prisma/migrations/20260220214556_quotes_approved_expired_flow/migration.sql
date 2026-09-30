-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "annulled_at" TIMESTAMPTZ(6),
ADD COLUMN     "annulled_by" UUID,
ADD COLUMN     "approved_at" TIMESTAMPTZ(6),
ADD COLUMN     "approved_by" UUID;
