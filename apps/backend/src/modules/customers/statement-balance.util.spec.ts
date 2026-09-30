import {
  computeStatementBalances,
  StatementLedgerEntry,
} from "./statement-balance.util";

describe("computeStatementBalances", () => {
  const charge = (id: string, amount: number): StatementLedgerEntry => ({
    type: "ORDER",
    debit: amount,
    credit: null,
    metadata: { orderId: id },
  });

  const payment = (
    paymentId: string,
    amount: number
  ): StatementLedgerEntry => ({
    type: "PAYMENT",
    debit: null,
    credit: amount,
    metadata: { paymentId },
  });

  const reversal = (
    originalPaymentId: string,
    amount: number
  ): StatementLedgerEntry => ({
    type: "REFUND",
    debit: amount,
    credit: null,
    metadata: { transactionType: "REVERSAL", originalPaymentId },
  });

  it("applies charges and payments to the running balance", () => {
    const txs: StatementLedgerEntry[] = [charge("o1", 100), payment("p1", 40)];
    const { closingBalance, totalCharges, totalPayments } =
      computeStatementBalances(txs, 0);

    expect(totalCharges).toBe(100);
    expect(totalPayments).toBe(40);
    expect(closingBalance).toBe(60);
    expect(txs[1].balance).toBe(60);
  });

  it("nets a fully reversed payment to zero (credit + reversal debit)", () => {
    const txs: StatementLedgerEntry[] = [
      charge("o1", 100),
      payment("p1", 100),
      reversal("p1", 100),
    ];
    const { closingBalance, totalCharges, totalPayments } =
      computeStatementBalances(txs, 0);

    // Charge stays; the payment credit is netted out entirely by its reversal.
    expect(totalCharges).toBe(100);
    expect(totalPayments).toBe(0);
    expect(closingBalance).toBe(100);
    // The reversal debit line itself must not move the balance.
    expect(txs[2].balance).toBe(100);
  });

  it("only undoes the reversed portion of a partially reversed payment", () => {
    const txs: StatementLedgerEntry[] = [
      charge("o1", 30),
      payment("global", 100),
      reversal("global", 40),
    ];
    const { closingBalance, totalPayments } = computeStatementBalances(txs, 0);

    // Effective payment = 100 - 40 = 60. Closing = 30 - 60 = -30 (still credit in favor here,
    // but the reversed 40 is correctly excluded so it is not -70).
    expect(totalPayments).toBe(60);
    expect(closingBalance).toBe(-30);
  });

  it("reproduces the Edith Castillo case: annulling the paid order removes the negative balance", () => {
    // Ledger after the fix: the C$28,920.07 portion of the global payment that had been applied to the
    // annulled order (ESL-...013746) is reversed. The still-valid portion (C$26,160 -> ESL-...010183)
    // keeps reducing the balance. Orders 010183, 014419 and 018302 remain as charges; 013746 is annulled
    // (excluded, no credit note).
    const txs: StatementLedgerEntry[] = [
      charge("010183", 26160.0),
      charge("014419", 28920.07),
      charge("018302", 20640.23),
      // Global "Pago a Cuenta" recorded against 010183's first installment (historical stamp).
      payment("global", 55080.07),
      // Second payment on 014419.
      payment("p2", 28920.07),
      // Devolución generated when 013746 was annulled (scoped to its portion of the global payment).
      reversal("global", 28920.07),
    ];

    const { closingBalance, totalCharges, totalPayments } =
      computeStatementBalances(txs, 0);

    expect(totalCharges).toBeCloseTo(75720.3, 2);
    // 55,080.07 - 28,920.07 (reversed) + 28,920.07 (p2) = 55,080.07
    expect(totalPayments).toBeCloseTo(55080.07, 2);
    // 75,720.30 - 55,080.07 = 20,640.23 (the genuinely pending order), never negative.
    expect(closingBalance).toBeCloseTo(20640.23, 2);
    expect(closingBalance).toBeGreaterThanOrEqual(0);
  });

  it("would be negative WITHOUT the reversal (regression guard for the original bug)", () => {
    const txs: StatementLedgerEntry[] = [
      charge("010183", 26160.0),
      charge("014419", 28920.07),
      charge("018302", 20640.23),
      payment("global", 55080.07),
      payment("p2", 28920.07),
      // No reversal row -> the historical bug.
    ];

    const { closingBalance } = computeStatementBalances(txs, 0);
    expect(closingBalance).toBeCloseTo(-8279.84, 2);
  });

  // Partial item annulment of a CREDIT order. After the fix the order debit is reduced by the annulled
  // amount, the unpaid portion is cancelled (no ledger row), and the already-paid portion is reversed.
  // Invariant: closingBalance === max(0, outstandingBefore - annulled) and is never negative.
  describe("partial item annulment (credit order)", () => {
    it("annulling already-paid goods reverses only the paid portion and nets to zero", () => {
      // Order total 100, fully paid. Annul net 30 -> reduced charge 70, paidCoverage 30 reversed.
      const txs: StatementLedgerEntry[] = [
        charge("o1", 70), // 100 reduced by 30
        payment("p1", 100),
        reversal("p1", 30), // devolución of the already-paid annulled portion
      ];

      const { closingBalance, totalCharges, totalPayments } =
        computeStatementBalances(txs, 0);

      expect(totalCharges).toBe(70);
      expect(totalPayments).toBe(70); // 100 - 30 reversed
      expect(closingBalance).toBe(0);
      expect(closingBalance).toBeGreaterThanOrEqual(0);
    });

    it("annulling still-unpaid goods only reduces the charge (no reversal, positive balance)", () => {
      // Order total 100, paid 40 (outstanding 60). Annul net 30 <= outstanding -> no payment reversed.
      const txs: StatementLedgerEntry[] = [
        charge("o1", 70), // 100 reduced by 30
        payment("p1", 40),
      ];

      const { closingBalance, totalPayments } = computeStatementBalances(
        txs,
        0
      );

      expect(totalPayments).toBe(40);
      expect(closingBalance).toBe(30); // remaining outstanding, still owed
      expect(closingBalance).toBeGreaterThanOrEqual(0);
    });

    it("annulling more than the outstanding reverses just the overpaid excess", () => {
      // Order total 100, paid 80 (outstanding 20). Annul net 30 -> unpaidCoverage 20, paidCoverage 10.
      const txs: StatementLedgerEntry[] = [
        charge("o1", 70), // 100 reduced by 30
        payment("p1", 80),
        reversal("p1", 10), // only the 10 overpaid beyond the new charge is refunded
      ];

      const { closingBalance, totalPayments } = computeStatementBalances(
        txs,
        0
      );

      expect(totalPayments).toBe(70); // 80 - 10 reversed
      expect(closingBalance).toBe(0);
      expect(closingBalance).toBeGreaterThanOrEqual(0);
    });

    it("voiding all items (fully paid order) excludes the charge and reverses every payment", () => {
      // Order becomes ANNULLED -> its charge is excluded from the statement entirely; all payments reversed.
      const txs: StatementLedgerEntry[] = [
        // no charge row: annulled order is filtered out
        payment("p1", 60),
        payment("p2", 40),
        reversal("p1", 60),
        reversal("p2", 40),
      ];

      const { closingBalance, totalCharges, totalPayments } =
        computeStatementBalances(txs, 0);

      expect(totalCharges).toBe(0);
      expect(totalPayments).toBe(0);
      expect(closingBalance).toBe(0);
    });
  });
});
