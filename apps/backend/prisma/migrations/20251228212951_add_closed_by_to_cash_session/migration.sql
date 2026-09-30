-- AlterTable
ALTER TABLE "cash_sessions" ADD COLUMN     "closed_by_id" UUID;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
