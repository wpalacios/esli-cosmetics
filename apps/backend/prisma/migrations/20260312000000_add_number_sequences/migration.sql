-- CreateTable
CREATE TABLE "number_sequences" (
    "schema_name" VARCHAR(64) NOT NULL,
    "last_value" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("schema_name")
);

-- Seed sequences for orders and quotes (lastValue 0 => first allocated number will be 1)
INSERT INTO "number_sequences" ("schema_name", "last_value", "updated_at") VALUES
  ('orders', 0, NOW()),
  ('quotes', 0, NOW());
