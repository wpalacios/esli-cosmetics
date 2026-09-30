-- Must run in a later migration because REVERSAL enum value is introduced
-- in a previous migration and cannot be used safely within the same tx.
CREATE UNIQUE INDEX "payments_original_payment_reversal_unique_idx"
ON "payments"("original_payment_id")
WHERE "transaction_type" = 'REVERSAL';
