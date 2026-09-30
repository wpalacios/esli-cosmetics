/** Labels for payments / reversals on the account statement and stored references. */

const MAX_TRANSACTION_REFERENCE_LEN = 255;

export type PaymentStatementLabelSource = {
  paymentType?: string | null;
  orderId?: string | null;
  creditInstallmentId?: string | null;
  transactionReference?: string | null;
  order?: { orderNumber: string | null } | null;
  creditInstallment?: {
    installmentNo: number;
    credit?: { order?: { orderNumber: string | null } | null } | null;
  } | null;
};

export function humanReadablePaymentCaption(
  p: PaymentStatementLabelSource
): string {
  if (p.creditInstallmentId && p.creditInstallment) {
    const inst = p.creditInstallment;
    const on = inst.credit?.order?.orderNumber ?? "N/A";
    return `Pago - Cuota #${inst.installmentNo} - Pedido ${on}`;
  }
  if (p.orderId) {
    const on = p.order?.orderNumber ?? "N/A";
    // Matches estado de cuenta: down payments on credit orders use this label (paymentType is often CASH/CARD).
    return `Pago Inicial - Pedido ${on}`;
  }
  const ref = p.transactionReference?.trim();
  if (ref) {
    return ref;
  }
  return "Pago a cuenta";
}

export function buildReversalTransactionReference(
  originalPaymentId: string,
  original: PaymentStatementLabelSource
): string {
  const revId = `REV-${originalPaymentId.slice(0, 8).toUpperCase()}`;
  const caption = humanReadablePaymentCaption(original);
  const combined = `${revId} · ${caption}`;
  return combined.length > MAX_TRANSACTION_REFERENCE_LEN
    ? `${combined.slice(0, MAX_TRANSACTION_REFERENCE_LEN - 1)}…`
    : combined;
}

export function displayReversalStatementReference(input: {
  reversalRef: string | null | undefined;
  originalPaymentId: string | null | undefined;
  originalPayment: PaymentStatementLabelSource | null | undefined;
}): string {
  const base =
    input.reversalRef?.trim() ||
    (input.originalPaymentId
      ? `REV-${input.originalPaymentId.slice(0, 8).toUpperCase()}`
      : "");
  if (!input.originalPayment) {
    return base || "REVERSIÓN";
  }
  if (base.includes(" · ")) {
    return base;
  }
  const caption = humanReadablePaymentCaption(input.originalPayment);
  const combined = `${base} · ${caption}`;
  return combined.length > MAX_TRANSACTION_REFERENCE_LEN
    ? `${combined.slice(0, MAX_TRANSACTION_REFERENCE_LEN - 1)}…`
    : combined;
}
