-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "customer_type_id" UUID;

-- CreateTable
CREATE TABLE "customer_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_types_name_key" ON "customer_types"("name");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_customer_type_id_fkey" FOREIGN KEY ("customer_type_id") REFERENCES "customer_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
