-- Backfill migration for annulled credit orders
-- This migration updates existing annulled orders to have the correct credit status,
-- installment statuses, and creates credit notes for payments
-- 
-- This migration is idempotent and can be run multiple times safely

-- Step 1: Update credit status to ANNULLED for credits from annulled orders
-- Also set outstanding_amount to 0 to match the annul logic
UPDATE credits
SET 
  status = 'ANNULLED'::"CreditStatus",
  outstanding_amount = 0
WHERE id IN (
  SELECT credit_id 
  FROM orders 
  WHERE status = 'ANNULLED' 
    AND credit_id IS NOT NULL
)
AND status != 'ANNULLED'::"CreditStatus";

-- Step 2: Update unpaid installments to ANNULLED for credits from annulled orders
-- Only update installments that are not PAID and not already ANNULLED
-- This matches the logic in orders.service.ts annul method
UPDATE credit_installments
SET status = 'ANNULLED'::"CreditInstallmentStatus"
WHERE credit_id IN (
  SELECT credit_id 
  FROM orders 
  WHERE status = 'ANNULLED' 
    AND credit_id IS NOT NULL
)
AND status NOT IN ('PAID'::"CreditInstallmentStatus", 'ANNULLED'::"CreditInstallmentStatus");

-- Step 3: Create credit notes for payments from annulled orders
-- Only create credit notes for payments that don't already have one
-- This matches the logic in orders.service.ts annul method which creates credit notes
-- for all payments (initial payments + installment payments) from the annulled order
INSERT INTO credit_notes (
  id,
  order_id,
  payment_id,
  customer_id,
  credit_installment_id,
  amount,
  description,
  created_at,
  created_by
)
SELECT 
  gen_random_uuid(),
  p.order_id,
  p.id as payment_id,
  o.customer_id,
  p.credit_installment_id,
  COALESCE(p.amount, 0),
  CASE 
    WHEN p.credit_installment_id IS NOT NULL THEN
      'Nota de Crédito - Pago Cuota #' || ci.installment_no::text || ' - Pedido Anulado ' || COALESCE(o.order_number, o.id::text)
    ELSE
      'Nota de Crédito - Pago Inicial - Pedido Anulado ' || COALESCE(o.order_number, o.id::text)
  END as description,
  COALESCE(p.paid_at, NOW()) as created_at,
  p.created_by
FROM payments p
INNER JOIN orders o ON p.order_id = o.id
LEFT JOIN credit_installments ci ON p.credit_installment_id = ci.id
LEFT JOIN credits c ON ci.credit_id = c.id
WHERE o.status = 'ANNULLED'
  AND o.customer_id IS NOT NULL
  AND p.id NOT IN (
    -- Exclude payments that already have a credit note
    SELECT payment_id 
    FROM credit_notes 
    WHERE payment_id IS NOT NULL
  )
  AND (
    -- Include payments directly on the annulled order (initial payments)
    p.order_id = o.id
    OR
    -- Include payments on installments of credits from the annulled order
    (p.credit_installment_id IS NOT NULL 
     AND ci.credit_id = o.credit_id
     AND o.credit_id IS NOT NULL)
  );

