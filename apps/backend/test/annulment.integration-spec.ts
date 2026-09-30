import { execSync } from "node:child_process";
import { join } from "node:path";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../src/common/prisma/prisma.service";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { PaymentAllocationService } from "../src/modules/payments/allocation.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import { OrdersService } from "../src/modules/orders/orders.service";
import { StockMovementsService } from "../src/modules/stock-movements/stock-movements.service";
import { NumberSequenceService } from "../src/modules/number-sequence/number-sequence.service";

/**
 * End-to-end (real Postgres via Testcontainers) coverage for the partial/credit annulment accounting model.
 *
 * These exercise the actual Postgres-only SQL (reverse-waterfall CTE with window frames, enum casts,
 * unnest(...::uuid[])) that an in-memory DB cannot run. Orders are seeded with locationId = null so the
 * inventory-reversal branch is skipped, letting us focus on the money side.
 *
 * Invariants asserted (client requirements):
 *  - The account statement closing balance is NEVER negative.
 *  - No CreditNote rows are ever created (payments are reversed / devolución instead).
 *  - Annulling already-paid goods reverses exactly the overpaid portion.
 */
describe("Order annulment accounting (integration)", () => {
  jest.setTimeout(180_000);

  const BACKEND_DIR = join(__dirname, "..");
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let orders: OrdersService;
  let customers: CustomersService;

  const USER_ID = "00000000-0000-0000-0000-0000000000aa";

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const url = container.getConnectionUri();
    process.env.DATABASE_URL = url;

    // Create the schema in the fresh container using the real Prisma schema.
    execSync("pnpm exec prisma db push --skip-generate --accept-data-loss", {
      cwd: BACKEND_DIR,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "inherit",
    });

    // Provide services only (no controllers) so we don't pull in auth guards.
    // Inventory is skipped (locationId null) so StockMovementsService is a no-op stub.
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        PaymentAllocationService,
        PaymentsService,
        CustomersService,
        OrdersService,
        {
          provide: StockMovementsService,
          useValue: { createSaleAnnulmentMovements: async () => [] },
        },
        {
          provide: NumberSequenceService,
          useValue: { getNextSequence: async () => "TEST-0001" },
        },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    orders = moduleRef.get(OrdersService);
    customers = moduleRef.get(CustomersService);

    await prisma.$connect();

    // The annulment writes createdBy/annulledBy/reversedBy referencing a real User row.
    await prisma.user.create({
      data: { id: USER_ID, email: "annul-test@esli.test" },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await moduleRef?.close();
    await container?.stop();
  });

  // Clean slate between tests (respect FK order).
  afterEach(async () => {
    await prisma.paymentAllocation.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.creditNote.deleteMany({});
    await prisma.orderItemAnnulment.deleteMany({});
    await prisma.orderAdjustment.deleteMany({});
    await prisma.creditInstallment.deleteMany({});
    await prisma.credit.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.person.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
  });

  type InstallmentSeed = { amount: number; paid: number };

  type SeedResult = {
    orderId: string;
    orderItemId: string;
    customerId: string;
    creditId: string;
  };

  /**
   * Seed a COMPLETED credit order with one line item, a credit + installments, and installment payments
   * (with PaymentAllocation rows) matching each installment's paid amount.
   */
  async function seedCreditOrder(opts: {
    unitPrice: number;
    quantity: number;
    installments: InstallmentSeed[];
  }): Promise<SeedResult> {
    const total = opts.unitPrice * opts.quantity;
    const outstanding = opts.installments.reduce(
      (s, i) => s + Math.max(0, i.amount - i.paid),
      0
    );

    const person = await prisma.person.create({
      data: { firstName: "Test", lastName: "Customer" },
    });
    const customer = await prisma.customer.create({
      data: { personId: person.id, creditAllowed: true },
    });
    const product = await prisma.product.create({
      data: { name: "Test Product" },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: "Test Variant",
        costPrice: new Prisma.Decimal(1),
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ESL-TEST-${Date.now()}`,
        customerId: customer.id,
        locationId: null, // skip inventory reversal
        paymentMethod: "CREDIT",
        status: "COMPLETED",
        includeTax: false, // keep totals tax-free so assertions isolate the accounting logic
        subtotal: new Prisma.Decimal(total),
        totalAmount: new Prisma.Decimal(total),
        taxes: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
      },
    });

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productVariantId: variant.id,
        quantity: opts.quantity,
        unitPrice: new Prisma.Decimal(opts.unitPrice),
        discountAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        lineTotal: new Prisma.Decimal(total),
      },
    });

    const now = Date.now();
    const credit = await prisma.credit.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        principalAmount: new Prisma.Decimal(total),
        outstandingAmount: new Prisma.Decimal(outstanding),
        installmentCount: opts.installments.length,
        firstDueDate: new Date(now + 7 * 86_400_000),
        lastDueDate: new Date(now + opts.installments.length * 7 * 86_400_000),
        status: outstanding === 0 ? "PAID" : "ACTIVE",
      },
    });

    for (let i = 0; i < opts.installments.length; i++) {
      const seed = opts.installments[i];
      let status: "PENDING" | "PAID" | "PARTIAL" = "PARTIAL";
      if (seed.paid <= 0) status = "PENDING";
      else if (seed.paid >= seed.amount) status = "PAID";
      const installment = await prisma.creditInstallment.create({
        data: {
          creditId: credit.id,
          installmentNo: i + 1,
          dueDate: new Date(now + (i + 1) * 7 * 86_400_000),
          amount: new Prisma.Decimal(seed.amount),
          paidAmount: new Prisma.Decimal(seed.paid),
          status,
        },
      });

      if (seed.paid > 0) {
        const payment = await prisma.payment.create({
          data: {
            orderId: order.id,
            customerId: customer.id,
            creditInstallmentId: installment.id,
            paymentType: "CASH",
            transactionType: "PAYMENT",
            amount: new Prisma.Decimal(seed.paid),
            status: "POSTED",
          },
        });
        await prisma.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            targetType: "INSTALLMENT",
            creditInstallmentId: installment.id,
            amount: new Prisma.Decimal(seed.paid),
          },
        });
      }
    }

    return {
      orderId: order.id,
      orderItemId: orderItem.id,
      customerId: customer.id,
      creditId: credit.id,
    };
  }

  const sumReversals = async (customerId: string): Promise<number> => {
    const rows = await prisma.payment.findMany({
      where: { customerId, transactionType: "REVERSAL" },
      select: { amount: true },
    });
    return round2(rows.reduce((s, r) => s + Number(r.amount ?? 0), 0));
  };

  const round2 = (n: number): number => Math.round(n * 100) / 100;

  const closingBalance = async (customerId: string): Promise<number> => {
    const statement = await customers.getAccountStatement(customerId, {});
    return Number(statement.summary.closingBalance);
  };

  it("reverses only the paid portion when annulling already-paid goods (net 0, no credit note)", async () => {
    // total 100, fully paid via two 50 installments; annul 1 of 2 units (net 50).
    const seed = await seedCreditOrder({
      unitPrice: 50,
      quantity: 2,
      installments: [
        { amount: 50, paid: 50 },
        { amount: 50, paid: 50 },
      ],
    });

    await orders.annulOrderItem(
      seed.orderId,
      seed.orderItemId,
      { quantity: 1 },
      USER_ID
    );

    const credit = await prisma.credit.findUniqueOrThrow({
      where: { id: seed.creditId },
    });
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: seed.orderId },
    });
    const creditNotes = await prisma.creditNote.count();

    expect(Number(order.totalAmount)).toBeCloseTo(50, 2); // charge reduced
    expect(Number(credit.outstandingAmount)).toBeCloseTo(0, 2);
    expect(await sumReversals(seed.customerId)).toBeCloseTo(50, 2); // devolución
    expect(creditNotes).toBe(0); // client requirement
    const balance = await closingBalance(seed.customerId);
    expect(balance).toBeCloseTo(0, 2);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("only reduces the charge when annulling still-unpaid goods (no reversal, positive balance)", async () => {
    // total 100, nothing paid; annul 1 of 2 units (net 50 <= outstanding 100).
    const seed = await seedCreditOrder({
      unitPrice: 50,
      quantity: 2,
      installments: [
        { amount: 50, paid: 0 },
        { amount: 50, paid: 0 },
      ],
    });

    await orders.annulOrderItem(
      seed.orderId,
      seed.orderItemId,
      { quantity: 1 },
      USER_ID
    );

    const credit = await prisma.credit.findUniqueOrThrow({
      where: { id: seed.creditId },
    });

    expect(Number(credit.outstandingAmount)).toBeCloseTo(50, 2);
    expect(await sumReversals(seed.customerId)).toBeCloseTo(0, 2);
    expect(await prisma.creditNote.count()).toBe(0);
    const balance = await closingBalance(seed.customerId);
    expect(balance).toBeCloseTo(50, 2);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("reverses only the overpaid excess when annulling more than the outstanding", async () => {
    // total 100, paid 80 (inst1 50 PAID, inst2 30/50 PARTIAL), outstanding 20; annul 1 unit (net 50).
    const seed = await seedCreditOrder({
      unitPrice: 50,
      quantity: 2,
      installments: [
        { amount: 50, paid: 50 },
        { amount: 50, paid: 30 },
      ],
    });

    await orders.annulOrderItem(
      seed.orderId,
      seed.orderItemId,
      { quantity: 1 },
      USER_ID
    );

    const credit = await prisma.credit.findUniqueOrThrow({
      where: { id: seed.creditId },
    });

    // paidCoverage = annulled(50) - outstanding(20) = 30 reversed.
    expect(await sumReversals(seed.customerId)).toBeCloseTo(30, 2);
    expect(Number(credit.outstandingAmount)).toBeCloseTo(0, 2);
    expect(await prisma.creditNote.count()).toBe(0);
    const balance = await closingBalance(seed.customerId);
    expect(balance).toBeCloseTo(0, 2);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("voiding all items on a fully-paid order annuls the credit and reverses every payment (no credit note)", async () => {
    const seed = await seedCreditOrder({
      unitPrice: 50,
      quantity: 2,
      installments: [
        { amount: 50, paid: 50 },
        { amount: 50, paid: 50 },
      ],
    });

    await orders.annulOrderItem(
      seed.orderId,
      seed.orderItemId,
      { quantity: 2 }, // all units
      USER_ID
    );

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: seed.orderId },
    });
    const credit = await prisma.credit.findUniqueOrThrow({
      where: { id: seed.creditId },
    });

    expect(order.status).toBe("ANNULLED");
    expect(credit.status).toBe("ANNULLED");
    expect(Number(credit.outstandingAmount)).toBeCloseTo(0, 2);
    expect(await sumReversals(seed.customerId)).toBeCloseTo(100, 2);
    expect(await prisma.creditNote.count()).toBe(0);
    const balance = await closingBalance(seed.customerId);
    expect(balance).toBeCloseTo(0, 2);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("survives a partial annul followed by a full annul on a fully-paid order (annulled-installment reversal is tolerated)", async () => {
    // Regression: a partial annul can leave an installment ANNULLED while it still holds an un-reversed
    // real payment (the waterfall marks it paid). A later reversal (here, the full annul) must NOT throw
    // "Cannot reverse against an annulled installment"; it should just record the ledger reversal.
    const seed = await seedCreditOrder({
      unitPrice: 50,
      quantity: 2, // total 100, fully paid across uneven installments
      installments: [
        { amount: 60, paid: 60 },
        { amount: 40, paid: 40 },
      ],
    });

    // Partial annul of 1 unit (net 50): paidCoverage = 50, forces the waterfall to annul an installment
    // that keeps un-reversed real payment.
    await orders.annulOrderItem(
      seed.orderId,
      seed.orderItemId,
      { quantity: 1 },
      USER_ID
    );

    // Full annul of the whole order must succeed and reverse the remaining money.
    await expect(orders.annul(seed.orderId, USER_ID)).resolves.toBeDefined();

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: seed.orderId },
    });
    const credit = await prisma.credit.findUniqueOrThrow({
      where: { id: seed.creditId },
    });

    expect(order.status).toBe("ANNULLED");
    expect(credit.status).toBe("ANNULLED");
    expect(await sumReversals(seed.customerId)).toBeCloseTo(100, 2); // every payment returned
    expect(await prisma.creditNote.count()).toBe(0);
    const balance = await closingBalance(seed.customerId);
    expect(balance).toBeCloseTo(0, 2);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("annulling one of two orders paid by a single global payment reverses only that order's share (Edith case)", async () => {
    // A single "Pago a Cuenta" of 200 was split across two credit orders of 100 each. Annulling one order
    // must reverse ONLY its 100 share; the other order stays paid and the statement never goes negative.
    const person = await prisma.person.create({
      data: { firstName: "Edith", lastName: "Castillo" },
    });
    const customer = await prisma.customer.create({
      data: { personId: person.id, creditAllowed: true },
    });
    const product = await prisma.product.create({
      data: { name: "Global Pay Product" },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: "GPP Variant",
        costPrice: new Prisma.Decimal(1),
      },
    });

    const globalPayment = await prisma.payment.create({
      data: {
        customerId: customer.id, // account-level payment: no orderId / no installment
        paymentType: "CASH",
        transactionType: "PAYMENT",
        amount: new Prisma.Decimal(200),
        status: "POSTED",
      },
    });

    const orderIds: string[] = [];
    const now = Date.now();
    for (let n = 0; n < 2; n++) {
      const order = await prisma.order.create({
        data: {
          orderNumber: `ESL-GLOBAL-${now}-${n}`,
          customerId: customer.id,
          locationId: null,
          paymentMethod: "CREDIT",
          status: "COMPLETED",
          includeTax: false,
          subtotal: new Prisma.Decimal(100),
          totalAmount: new Prisma.Decimal(100),
          taxes: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
        },
      });
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          productVariantId: variant.id,
          quantity: 1,
          unitPrice: new Prisma.Decimal(100),
          discountAmount: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          lineTotal: new Prisma.Decimal(100),
        },
      });
      const credit = await prisma.credit.create({
        data: {
          orderId: order.id,
          customerId: customer.id,
          principalAmount: new Prisma.Decimal(100),
          outstandingAmount: new Prisma.Decimal(0),
          installmentCount: 1,
          firstDueDate: new Date(now + 7 * 86_400_000),
          lastDueDate: new Date(now + 7 * 86_400_000),
          status: "PAID",
        },
      });
      const installment = await prisma.creditInstallment.create({
        data: {
          creditId: credit.id,
          installmentNo: 1,
          dueDate: new Date(now + 7 * 86_400_000),
          amount: new Prisma.Decimal(100),
          paidAmount: new Prisma.Decimal(100),
          status: "PAID",
        },
      });
      // The global payment covers this installment via an allocation (source of truth for scoping).
      await prisma.paymentAllocation.create({
        data: {
          paymentId: globalPayment.id,
          targetType: "INSTALLMENT",
          creditInstallmentId: installment.id,
          amount: new Prisma.Decimal(100),
        },
      });
      orderIds.push(order.id);
    }

    // Baseline: two 100 debits, one 200 payment => balance 0.
    expect(await closingBalance(customer.id)).toBeCloseTo(0, 2);

    // Annul the first order only.
    await orders.annul(orderIds[0], USER_ID);

    // Only 100 (that order's share) is reversed; the global payment stays POSTED (order 2 still paid).
    expect(await sumReversals(customer.id)).toBeCloseTo(100, 2);
    const refreshedGlobal = await prisma.payment.findUniqueOrThrow({
      where: { id: globalPayment.id },
    });
    expect(refreshedGlobal.status).toBe("POSTED");
    expect(await prisma.creditNote.count()).toBe(0);

    // Statement: order2 debit 100 - global effective credit (200 - 100 reversed) 100 = 0. Never negative.
    const balance = await closingBalance(customer.id);
    expect(balance).toBeCloseTo(0, 2);
    expect(balance).toBeGreaterThanOrEqual(0);

    const order2 = await prisma.order.findUniqueOrThrow({
      where: { id: orderIds[1] },
    });
    expect(order2.status).toBe("COMPLETED");
  });

  it("does not inflate the opening balance of a date-ranged statement for an annulled order reversed in a prior period", async () => {
    // Regression for the opening-balance path (getAccountStatement with a `from` after the annulment):
    // a REVERSAL must NOT be added back as a standalone debit when its original payment was excluded
    // (annulled order). Otherwise the customer wrongly appears to owe the reversed amount.
    const person = await prisma.person.create({
      data: { firstName: "Past", lastName: "Annul" },
    });
    const customer = await prisma.customer.create({
      data: { personId: person.id, creditAllowed: true },
    });

    const jan10 = new Date("2026-01-10T12:00:00.000Z");
    const jan11 = new Date("2026-01-11T12:00:00.000Z");

    const order = await prisma.order.create({
      data: {
        orderNumber: "ESL-PAST-ANNUL",
        customerId: customer.id,
        locationId: null,
        paymentMethod: "CREDIT",
        status: "ANNULLED",
        includeTax: false,
        subtotal: new Prisma.Decimal(100),
        totalAmount: new Prisma.Decimal(100),
        taxes: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        createdAt: jan10,
      },
    });
    const credit = await prisma.credit.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        principalAmount: new Prisma.Decimal(100),
        outstandingAmount: new Prisma.Decimal(0),
        installmentCount: 1,
        firstDueDate: jan10,
        lastDueDate: jan10,
        status: "ANNULLED",
        createdAt: jan10,
      },
    });
    const installment = await prisma.creditInstallment.create({
      data: {
        creditId: credit.id,
        installmentNo: 1,
        dueDate: jan10,
        amount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(100),
        status: "ANNULLED",
      },
    });
    const original = await prisma.payment.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        creditInstallmentId: installment.id,
        paymentType: "CASH",
        transactionType: "PAYMENT",
        amount: new Prisma.Decimal(100),
        status: "REVERSED",
        paidAt: jan10,
      },
    });
    await prisma.paymentAllocation.create({
      data: {
        paymentId: original.id,
        targetType: "INSTALLMENT",
        creditInstallmentId: installment.id,
        amount: new Prisma.Decimal(100),
        reversedAmount: new Prisma.Decimal(100),
      },
    });
    await prisma.payment.create({
      data: {
        customerId: customer.id, // account-level reversal (devolución)
        paymentType: "CASH",
        transactionType: "REVERSAL",
        amount: new Prisma.Decimal(100),
        originalPaymentId: original.id,
        paidAt: jan11,
      },
    });

    // View a statement for a later period: everything above falls into the opening-balance window.
    const statement = await customers.getAccountStatement(customer.id, {
      from: "2026-03-01",
      to: "2026-07-01",
    });
    const balance = Number(statement.summary.closingBalance);
    expect(balance).toBeCloseTo(0, 2);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("fully annulling a credit order reverses a direct order-level payment (no allocation) and nets to zero", async () => {
    // Covers reverseDirectOrderPayments: a down/initial payment recorded at the order level (orderId set,
    // no installment, no PaymentAllocation) must be reversed by the full annul and never leave a credit.
    const person = await prisma.person.create({
      data: { firstName: "Direct", lastName: "Pay" },
    });
    const customer = await prisma.customer.create({
      data: { personId: person.id, creditAllowed: true },
    });
    const product = await prisma.product.create({
      data: { name: "Direct Pay Product" },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: "DPP Variant",
        costPrice: new Prisma.Decimal(1),
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ESL-DIRECT-${Date.now()}`,
        customerId: customer.id,
        locationId: null,
        paymentMethod: "CREDIT",
        status: "COMPLETED",
        includeTax: false,
        subtotal: new Prisma.Decimal(100),
        totalAmount: new Prisma.Decimal(100),
        taxes: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productVariantId: variant.id,
        quantity: 1,
        unitPrice: new Prisma.Decimal(100),
        discountAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        lineTotal: new Prisma.Decimal(100),
      },
    });
    const credit = await prisma.credit.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        principalAmount: new Prisma.Decimal(100),
        outstandingAmount: new Prisma.Decimal(0),
        installmentCount: 1,
        firstDueDate: new Date(Date.now() + 7 * 86_400_000),
        lastDueDate: new Date(Date.now() + 7 * 86_400_000),
        status: "PAID",
      },
    });
    await prisma.creditInstallment.create({
      data: {
        creditId: credit.id,
        installmentNo: 1,
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        amount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(100),
        status: "PAID",
      },
    });
    // Order-level payment: no installment link, no allocation => direct-payment reversal path.
    await prisma.payment.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        paymentType: "CASH",
        transactionType: "PAYMENT",
        amount: new Prisma.Decimal(100),
        status: "POSTED",
      },
    });

    expect(await closingBalance(customer.id)).toBeCloseTo(0, 2);

    await orders.annul(order.id, USER_ID);

    const refreshedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(refreshedOrder.status).toBe("ANNULLED");
    expect(await sumReversals(customer.id)).toBeCloseTo(100, 2);
    expect(await prisma.creditNote.count()).toBe(0);
    const balance = await closingBalance(customer.id);
    expect(balance).toBeCloseTo(0, 2);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("bulk-voiding a fully-paid order reverses all payments and issues no credit note", async () => {
    const seed = await seedCreditOrder({
      unitPrice: 50,
      quantity: 2,
      installments: [
        { amount: 50, paid: 50 },
        { amount: 50, paid: 50 },
      ],
    });

    await orders.bulkAnnulOrderItems(
      seed.orderId,
      { items: [{ orderItemId: seed.orderItemId, quantity: 2 }] },
      USER_ID
    );

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: seed.orderId },
    });
    const credit = await prisma.credit.findUniqueOrThrow({
      where: { id: seed.creditId },
    });

    expect(order.status).toBe("ANNULLED");
    expect(credit.status).toBe("ANNULLED");
    expect(await sumReversals(seed.customerId)).toBeCloseTo(100, 2);
    expect(await prisma.creditNote.count()).toBe(0);
    const balance = await closingBalance(seed.customerId);
    expect(balance).toBeCloseTo(0, 2);
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});
