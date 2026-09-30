/**
 * Pure ledger math for the customer account statement.
 *
 * Kept separate from CustomersService so it can be unit-tested in isolation. The key behaviour is how
 * payment reversals net against the balance:
 *
 * - A payment reversal is a ledger row with `metadata.transactionType === "REVERSAL"` and
 *   `metadata.originalPaymentId` set. It is shown as an audit debit line but does NOT move the balance
 *   on its own.
 * - Instead, the amount reversed is subtracted from the credit of the ORIGINAL payment it reverses. This
 *   makes PARTIAL reversals correct: a global "Pago a Cuenta" split across two orders where only one is
 *   later annulled keeps the still-valid portion reducing the balance, and only the annulled portion is
 *   undone. A fully reversed payment nets to zero.
 */

export type StatementLedgerEntry = {
  type: string;
  debit: number | null;
  credit: number | null;
  balance?: number;
  metadata?: {
    paymentId?: string;
    transactionType?: string;
    originalPaymentId?: string | null;
    [key: string]: unknown;
  } | null;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A REVERSAL debit line: audit-only, never applied directly to the running balance. */
export function isPaymentReversalLedgerDebit(t: StatementLedgerEntry): boolean {
  return Boolean(
    t.debit && t.type === "REFUND" && t.metadata?.transactionType === "REVERSAL"
  );
}

/** Map of original payment id -> total amount reversed against it (sum of its REVERSAL debit rows). */
export function buildReversedByPaymentId(
  entries: StatementLedgerEntry[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of entries) {
    if (
      t.metadata?.transactionType === "REVERSAL" &&
      t.metadata?.originalPaymentId &&
      t.debit
    ) {
      const key = t.metadata.originalPaymentId;
      map[key] = round2((map[key] ?? 0) + t.debit);
    }
  }
  return map;
}

/** Credit of an entry minus any amount reversed against that payment (floored at 0). */
export function effectiveCredit(
  t: StatementLedgerEntry,
  reversedByPaymentId: Record<string, number>
): number {
  if (!t.credit) return 0;
  const paymentId = t.metadata?.paymentId;
  const reversed = paymentId ? (reversedByPaymentId[paymentId] ?? 0) : 0;
  return Math.max(0, round2(t.credit - reversed));
}

export type StatementBalances = {
  reversedByPaymentId: Record<string, number>;
  closingBalance: number;
  totalCharges: number;
  totalPayments: number;
};

/**
 * Compute the running balance for each entry (mutates `entry.balance`) and the summary totals.
 * `INITIAL_BALANCE` entries are not applied (already folded into `openingBalance`).
 */
export function computeStatementBalances(
  transactions: StatementLedgerEntry[],
  openingBalance: number
): StatementBalances {
  const reversedByPaymentId = buildReversedByPaymentId(transactions);

  let runningBalance = openingBalance;
  for (const transaction of transactions) {
    if (transaction.type === "INITIAL_BALANCE") {
      transaction.balance = runningBalance;
      continue;
    }
    if (!isPaymentReversalLedgerDebit(transaction) && transaction.debit) {
      runningBalance = round2(runningBalance + transaction.debit);
    }
    if (transaction.credit) {
      runningBalance = round2(
        runningBalance - effectiveCredit(transaction, reversedByPaymentId)
      );
    }
    transaction.balance = runningBalance;
  }

  const totalCharges = transactions
    .filter(t => t.debit && !isPaymentReversalLedgerDebit(t))
    .reduce((sum, t) => sum + (t.debit || 0), 0);

  const totalPayments = transactions
    .filter(t => t.credit)
    .reduce((sum, t) => sum + effectiveCredit(t, reversedByPaymentId), 0);

  return {
    reversedByPaymentId,
    closingBalance: runningBalance,
    totalCharges: round2(totalCharges),
    totalPayments: round2(totalPayments),
  };
}
