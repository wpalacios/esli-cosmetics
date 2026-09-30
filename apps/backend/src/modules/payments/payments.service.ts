import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentAllocationService } from "./allocation.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import {
  CreditInstallmentStatus,
  CreditStatus,
  PaymentAllocationTargetType,
  PaymentLifecycleStatus,
  Prisma,
  TransactionType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { ReceiptPdfData } from "../reports/types/receipt-types";
import { ReversePaymentDto } from "./dto/reverse-payment.dto";
import { ManualPaymentReversalDto } from "./dto/manual-payment-reversal.dto";
import { buildReversalTransactionReference } from "./payment-label.util";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly OPENING_BALANCE_REFERENCE = "OPENING_BALANCE";
  private readonly LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL_CODE =
    "LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL";
  private readonly OPENING_BALANCE_PAID_AT = new Date(
    "2025-12-31T00:00:00.000Z"
  );
  private readonly legacyReversalInstallmentStrategy: "FIFO" | "LIFO" =
    process.env.LEGACY_REVERSAL_INSTALLMENT_STRATEGY === "FIFO"
      ? "FIFO"
      : "LIFO";

  constructor(
    private readonly prisma: PrismaService,
    private readonly allocationService: PaymentAllocationService
  ) {}

  /**
   * Allocate an existing payment to credit installments
   */
  async allocatePayment(paymentId: string): Promise<{
    paymentId: string;
    allocationResults: Array<{
      creditId: string;
      installmentAllocations: Array<{
        installmentId: string;
        installmentNo: number;
        amount: number;
      }>;
    }>;
  }> {
    return await this.prisma.$transaction(
      async tx => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: {
            creditInstallment: {
              include: {
                credit: true,
              },
            },
            order: {
              include: {
                credit: true,
              },
            },
          },
        });

        if (!payment) {
          throw new NotFoundException(`Payment with ID ${paymentId} not found`);
        }

        if (!payment.amount) {
          throw new BadRequestException("Payment amount is missing");
        }

        const paymentAmount = Number(payment.amount);
        if (paymentAmount <= 0) {
          throw new BadRequestException(
            "Payment amount must be greater than 0"
          );
        }
        const allocationResults: Array<{
          creditId: string;
          installmentAllocations: Array<{
            installmentId: string;
            installmentNo: number;
            amount: number;
          }>;
        }> = [];

        // If payment is linked to a specific credit installment, allocate to that credit
        if (payment.creditInstallmentId && payment.creditInstallment) {
          const creditId = payment.creditInstallment.creditId;
          const result = await this.allocationService.allocatePaymentToCredit(
            creditId,
            paymentAmount,
            tx
          );

          allocationResults.push({
            creditId: result.creditId,
            installmentAllocations: result.installmentAllocations.map(
              alloc => ({
                installmentId: alloc.installmentId,
                installmentNo: alloc.installmentNo,
                amount: alloc.amount,
              })
            ),
          });
        } else if (payment.orderId && payment.order?.credit) {
          // If payment is linked to an order with credit, allocate to that credit
          const creditId = payment.order.credit.id;
          const result = await this.allocationService.allocatePaymentToCredit(
            creditId,
            paymentAmount,
            tx
          );

          allocationResults.push({
            creditId: result.creditId,
            installmentAllocations: result.installmentAllocations.map(
              alloc => ({
                installmentId: alloc.installmentId,
                installmentNo: alloc.installmentNo,
                amount: alloc.amount,
              })
            ),
          });
        } else if (payment.customerId) {
          // If payment is a customer account payment, allocate across all credits
          const results =
            await this.allocationService.allocatePaymentToCustomerCredits(
              payment.customerId,
              paymentAmount,
              tx
            );

          allocationResults.push(
            ...results.map(result => ({
              creditId: result.creditId,
              installmentAllocations: result.installmentAllocations.map(
                alloc => ({
                  installmentId: alloc.installmentId,
                  installmentNo: alloc.installmentNo,
                  amount: alloc.amount,
                })
              ),
            }))
          );
        } else {
          throw new BadRequestException(
            "Payment must be linked to a credit installment, order with credit, or customer"
          );
        }

        return {
          paymentId,
          allocationResults,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );
  }

  /**
   * Create a customer account payment and allocate it
   */
  async createCustomerPayment(
    customerId: string,
    dto: CreatePaymentDto,
    userId?: string
  ): Promise<{
    payment: {
      id: string;
      amount: number;
      paymentType: string;
      customerId: string;
      paidAt: Date;
    };
    allocationResults: Array<{
      creditId: string;
      installmentAllocations: Array<{
        installmentId: string;
        installmentNo: number;
        amount: number;
      }>;
    }>;
  }> {
    return await this.prisma.$transaction(
      async tx => {
        // Verify customer exists
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new NotFoundException(
            `Customer with ID ${customerId} not found`
          );
        }

        // Get customer's opening balance and outstanding credits
        const openingBalance = customer.initialOpeningBalance
          ? Number(customer.initialOpeningBalance)
          : 0;

        // Get total outstanding credits
        const credits = await tx.credit.findMany({
          where: {
            customerId,
            outstandingAmount: {
              gt: 0,
            },
            status: {
              in: ["PENDING", "ACTIVE", "OVERDUE"],
            },
          },
          select: {
            outstandingAmount: true,
          },
        });

        const totalOutstandingCredits = credits.reduce(
          (sum, credit) => sum + Number(credit.outstandingAmount),
          0
        );

        // Calculate total payable (opening balance if positive + outstanding credits)
        const totalPayable =
          (openingBalance > 0 ? openingBalance : 0) + totalOutstandingCredits;

        // Validate payment amount doesn't exceed total payable
        if (dto.amount > totalPayable) {
          throw new BadRequestException(
            `Payment amount (${dto.amount}) exceeds total payable amount (${totalPayable})`
          );
        }

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            customer: { connect: { id: customerId } },
            paymentType: dto.paymentType,
            provider: dto.provider,
            amount: new Decimal(dto.amount),
            transactionReference: dto.transactionReference,
            ...(userId && { creator: { connect: { id: userId } } }),
          },
        });

        let remainingPayment = dto.amount;
        const results: Array<{
          creditId: string;
          installmentAllocations: Array<{
            installmentId: string;
            installmentNo: number;
            amount: number;
          }>;
        }> = [];

        // First, apply payment to opening balance if it exists and is positive
        if (openingBalance > 0 && remainingPayment > 0) {
          const amountToOpeningBalance = Math.min(
            openingBalance,
            remainingPayment
          );
          const newOpeningBalance = Math.max(
            0,
            Math.round((openingBalance - amountToOpeningBalance) * 100) / 100
          );

          await tx.customer.update({
            where: { id: customerId },
            data: {
              initialOpeningBalance: new Decimal(newOpeningBalance),
            },
          });
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              targetType: PaymentAllocationTargetType.OPENING_BALANCE,
              amount: new Decimal(amountToOpeningBalance),
            },
          });

          remainingPayment =
            Math.round((remainingPayment - amountToOpeningBalance) * 100) / 100;
        }

        // Then, allocate remaining payment to customer credits
        if (remainingPayment > 0 && totalOutstandingCredits > 0) {
          const creditResults =
            await this.allocationService.allocatePaymentToCustomerCredits(
              customerId,
              remainingPayment,
              tx
            );

          results.push(
            ...creditResults.map(result => ({
              creditId: result.creditId,
              installmentAllocations: result.installmentAllocations.map(
                alloc => ({
                  installmentId: alloc.installmentId,
                  installmentNo: alloc.installmentNo,
                  amount: alloc.amount,
                })
              ),
            }))
          );

          for (const result of creditResults) {
            for (const alloc of result.installmentAllocations) {
              await tx.paymentAllocation.create({
                data: {
                  paymentId: payment.id,
                  targetType: PaymentAllocationTargetType.INSTALLMENT,
                  creditInstallmentId: alloc.installmentId,
                  amount: new Decimal(alloc.amount),
                },
              });
            }
          }

          // Update payment with first credit installment if applicable
          if (
            creditResults.length > 0 &&
            creditResults[0].installmentAllocations.length > 0
          ) {
            const firstInstallmentId =
              creditResults[0].installmentAllocations[0].installmentId;
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                creditInstallmentId: firstInstallmentId,
              },
            });
          }
        }

        return {
          payment: {
            id: payment.id,
            amount: Number(payment.amount),
            paymentType: payment.paymentType,
            customerId: payment.customerId || "",
            paidAt: payment.paidAt,
          },
          allocationResults: results.map(result => ({
            creditId: result.creditId,
            installmentAllocations: result.installmentAllocations.map(
              alloc => ({
                installmentId: alloc.installmentId,
                installmentNo: alloc.installmentNo,
                amount: alloc.amount,
              })
            ),
          })),
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );
  }

  /**
   * Create a customer refund (money returned to the customer when they have a credit balance).
   * Creates a payment record with no order/installment so it appears as a credit on the statement
   * and reduces the customer's negative balance. Does not allocate to opening balance or credits.
   */
  async createCustomerRefund(
    customerId: string,
    dto: CreatePaymentDto,
    userId?: string
  ): Promise<{
    payment: {
      id: string;
      amount: number;
      paymentType: string;
      customerId: string;
      paidAt: Date;
    };
  }> {
    if (dto.amount <= 0) {
      throw new BadRequestException("Refund amount must be greater than 0");
    }

    return this.prisma.$transaction(async tx => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        throw new NotFoundException(`Customer with ID ${customerId} not found`);
      }

      const payment = await tx.payment.create({
        data: {
          customer: { connect: { id: customerId } },
          orderId: null,
          creditInstallmentId: null,
          paymentType: dto.paymentType,
          transactionType: "REFUND",
          provider: dto.provider,
          amount: new Decimal(dto.amount),
          transactionReference:
            dto.transactionReference?.trim() || `TRX-${Date.now()}`,
          ...(userId && { creator: { connect: { id: userId } } }),
        } as Prisma.PaymentCreateInput,
      });

      this.logger.log(
        `[REFUND] Created refund of ${dto.amount} for customer ${customerId} (payment ${payment.id})`
      );

      return {
        payment: {
          id: payment.id,
          amount: Number(payment.amount),
          paymentType: payment.paymentType,
          customerId: payment.customerId || "",
          paidAt: payment.paidAt,
        },
      };
    });
  }

  async reversePayment(
    paymentId: string,
    dto: ReversePaymentDto,
    userId?: string
  ): Promise<{
    paymentId: string;
    status: PaymentLifecycleStatus;
    reversedAt: Date;
    mode: "AUTOMATIC";
  }> {
    return await this.prisma.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT id FROM payments WHERE id = CAST(${paymentId} AS uuid) FOR UPDATE`;

        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: {
            allocations: true,
            order: { select: { orderNumber: true } },
            creditInstallment: {
              include: {
                credit: {
                  include: { order: { select: { orderNumber: true } } },
                },
              },
            },
          },
        });

        if (!payment) {
          throw new NotFoundException(`Payment with ID ${paymentId} not found`);
        }

        if (payment.status === PaymentLifecycleStatus.REVERSED) {
          throw new BadRequestException("Payment is already reversed");
        }

        if (!payment.amount || Number(payment.amount) <= 0) {
          throw new BadRequestException("Payment amount is missing");
        }

        if (payment.allocations.length === 0) {
          throw new BadRequestException({
            code: this.LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL_CODE,
            message:
              "Legacy payment without allocations cannot be auto-reversed. Use manual accounting reversal.",
          });
        }

        const customerId = await this.resolveCustomerIdForPayment(tx, payment);

        await this.applyReversalEntries(
          tx,
          customerId,
          payment.allocations.map(a => ({
            targetType: a.targetType,
            creditInstallmentId: a.creditInstallmentId ?? undefined,
            amount: Number(a.amount),
          }))
        );
        await this.markAllocationsAsReversed(
          tx,
          payment.allocations,
          payment.allocations.map(a => ({
            targetType: a.targetType,
            creditInstallmentId: a.creditInstallmentId ?? undefined,
            amount: Number(a.amount),
          }))
        );

        const reversedAt = new Date();
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentLifecycleStatus.REVERSED,
            reversedAt,
            reversalReason: dto.reason.trim(),
            reversedBy: userId,
          },
        });

        await tx.payment.create({
          data: {
            customerId,
            paymentType: payment.paymentType,
            provider: payment.provider,
            amount: payment.amount,
            transactionType: TransactionType.REVERSAL,
            transactionReference: buildReversalTransactionReference(
              payment.id,
              {
                paymentType: payment.paymentType,
                orderId: payment.orderId,
                creditInstallmentId: payment.creditInstallmentId,
                transactionReference: payment.transactionReference,
                order: payment.order,
                creditInstallment: payment.creditInstallment,
              }
            ),
            createdBy: userId,
            originalPaymentId: payment.id,
          },
        });

        return {
          paymentId,
          status: PaymentLifecycleStatus.REVERSED,
          reversedAt,
          mode: "AUTOMATIC",
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );
  }

  async manualReversePayment(
    paymentId: string,
    dto: ManualPaymentReversalDto,
    userId?: string
  ): Promise<{
    paymentId: string;
    status: PaymentLifecycleStatus;
    reversedAt: Date;
    mode: "MANUAL";
  }> {
    return await this.prisma.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT id FROM payments WHERE id = CAST(${paymentId} AS uuid) FOR UPDATE`;

        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: {
            allocations: true,
            order: { select: { orderNumber: true } },
            creditInstallment: {
              include: {
                credit: {
                  include: { order: { select: { orderNumber: true } } },
                },
              },
            },
          },
        });

        if (!payment) {
          throw new NotFoundException(`Payment with ID ${paymentId} not found`);
        }

        if (payment.status === PaymentLifecycleStatus.REVERSED) {
          throw new BadRequestException("Payment is already reversed");
        }

        if (!payment.amount || Number(payment.amount) <= 0) {
          throw new BadRequestException("Payment amount is missing");
        }

        if (!dto.entries.length) {
          throw new BadRequestException(
            "Manual reversal requires at least one entry"
          );
        }

        const totalEntries = dto.entries.reduce((sum, e) => sum + e.amount, 0);
        const paymentAmount = Number(payment.amount);
        const roundedEntries = Math.round(totalEntries * 100) / 100;
        const roundedPayment = Math.round(paymentAmount * 100) / 100;
        if (roundedEntries !== roundedPayment) {
          throw new BadRequestException(
            `Manual reversal amount (${roundedEntries}) must equal payment amount (${roundedPayment})`
          );
        }

        const customerId = await this.resolveCustomerIdForPayment(tx, payment);
        const reversalEntries =
          payment.allocations.length === 0
            ? await this.expandInstallmentReversalEntriesToPaidCap(
                tx,
                dto.entries
              )
            : dto.entries;

        await this.applyReversalEntries(tx, customerId, reversalEntries);

        // Persist allocations if they were missing so future audit is explicit.
        if (payment.allocations.length === 0) {
          if (reversalEntries.length > 0) {
            await tx.paymentAllocation.createMany({
              data: reversalEntries.map(entry => ({
                paymentId: payment.id,
                targetType: entry.targetType,
                creditInstallmentId: entry.creditInstallmentId,
                amount: new Decimal(entry.amount),
                reversedAmount: new Decimal(entry.amount),
              })),
            });
          }
        } else {
          await this.markAllocationsAsReversed(
            tx,
            payment.allocations,
            reversalEntries
          );
        }

        const reversedAt = new Date();
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentLifecycleStatus.REVERSED,
            reversedAt,
            reversalReason: dto.reason.trim(),
            reversedBy: userId,
          },
        });

        await tx.payment.create({
          data: {
            customerId,
            paymentType: payment.paymentType,
            provider: payment.provider,
            amount: payment.amount,
            transactionType: TransactionType.REVERSAL,
            transactionReference: buildReversalTransactionReference(
              payment.id,
              {
                paymentType: payment.paymentType,
                orderId: payment.orderId,
                creditInstallmentId: payment.creditInstallmentId,
                transactionReference: payment.transactionReference,
                order: payment.order,
                creditInstallment: payment.creditInstallment,
              }
            ),
            createdBy: userId,
            originalPaymentId: payment.id,
          },
        });

        return {
          paymentId: payment.id,
          status: PaymentLifecycleStatus.REVERSED,
          reversedAt,
          mode: "MANUAL",
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );
  }

  /**
   * Reverse (devolución) the payment portions applied to an order that is being annulled.
   *
   * Scope-aware: uses PaymentAllocation as the source of truth so a single global "Pago a Cuenta"
   * split across several orders only gets the portion tied to THIS order reversed, while the rest keeps
   * paying the still-valid orders. This fixes the historical bug where only the first installment was
   * stamped on the payment, so cross-order account payments were missed when annulling an order.
   *
   * Must be called INSIDE an active transaction and BEFORE the order's installments/credit are marked
   * ANNULLED, because applyReversalEntries rejects reversals against annulled installments.
   *
   * When `maxAmount` is provided, only up to that amount is reversed (used by partial item annulment to
   * refund just the already-paid portion of the annulled goods). When omitted, ALL of the order's
   * payments are reversed (used by full order annulment). Returns the actual amount reversed.
   */
  async reversePaymentAllocationsForOrderAnnulment(
    tx: Prisma.TransactionClient,
    orderId: string,
    reason: string,
    userId?: string,
    maxAmount?: number
  ): Promise<{ reversedPaymentIds: string[]; totalReversed: number }> {
    const trimmedReason = reason?.trim() || "Anulación de pedido";
    const reversedPaymentIds: string[] = [];
    let totalReversed = 0;

    const hasBudget = typeof maxAmount === "number";
    let budget = hasBudget ? Math.round(maxAmount * 100) / 100 : Infinity;
    if (hasBudget && budget <= 0.005) {
      return { reversedPaymentIds, totalReversed };
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        credit: {
          select: { id: true, installments: { select: { id: true } } },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const processedPaymentIds = new Set<string>();

    // 1. Allocation-scoped reversals: installment/customer-account payments applied to this order's credit.
    const scoped = await this.reverseScopedAllocationsForOrder(
      tx,
      order.credit?.installments.map(i => i.id) ?? [],
      processedPaymentIds,
      trimmedReason,
      userId,
      hasBudget ? budget : undefined
    );
    reversedPaymentIds.push(...scoped.reversedPaymentIds);
    totalReversed =
      Math.round((totalReversed + scoped.totalReversed) * 100) / 100;
    if (hasBudget) {
      budget = Math.round((budget - scoped.totalReversed) * 100) / 100;
    }

    // 2. Order-linked payments without allocations (initial down payments / cash payments).
    if (!hasBudget || budget > 0.005) {
      const direct = await this.reverseDirectOrderPayments(
        tx,
        {
          id: orderId,
          customerId: order.customerId,
          orderNumber: order.orderNumber,
        },
        processedPaymentIds,
        trimmedReason,
        userId,
        hasBudget ? budget : undefined
      );
      reversedPaymentIds.push(...direct.reversedPaymentIds);
      totalReversed =
        Math.round((totalReversed + direct.totalReversed) * 100) / 100;
      if (hasBudget) {
        budget = Math.round((budget - direct.totalReversed) * 100) / 100;
      }
    }

    this.logger.log(
      `[ANNUL_REVERSAL] Reversed ${reversedPaymentIds.length} payment(s) totaling ${totalReversed} for annulled order ${
        order.orderNumber || orderId
      }`
    );

    return { reversedPaymentIds, totalReversed };
  }

  /**
   * Reverse the portions of any payments whose PaymentAllocation rows point at the given installments
   * (the annulled order's credit installments). Scoped per allocation so shared/global payments only lose
   * the amount tied to this order.
   */
  private async reverseScopedAllocationsForOrder(
    tx: Prisma.TransactionClient,
    installmentIds: string[],
    processedPaymentIds: Set<string>,
    reason: string,
    userId?: string,
    maxAmount?: number
  ): Promise<{ reversedPaymentIds: string[]; totalReversed: number }> {
    const reversedPaymentIds: string[] = [];
    let totalReversed = 0;
    if (installmentIds.length === 0) {
      return { reversedPaymentIds, totalReversed };
    }

    const allocations = await tx.paymentAllocation.findMany({
      where: {
        targetType: PaymentAllocationTargetType.INSTALLMENT,
        creditInstallmentId: { in: installmentIds },
      },
      select: {
        paymentId: true,
        creditInstallmentId: true,
        amount: true,
        reversedAmount: true,
        payment: { select: { paidAt: true } },
      },
      // Newest payments first: when only part of the paid amount must be refunded
      // (partial annulment), unwind the most recent money received.
      orderBy: { payment: { paidAt: "desc" } },
    });

    const byPayment = new Map<string, typeof allocations>();
    for (const alloc of allocations) {
      const list = byPayment.get(alloc.paymentId) ?? [];
      list.push(alloc);
      byPayment.set(alloc.paymentId, list);
    }

    // Infinity => reverse everything (full annulment). A finite value caps the total reversed.
    const budget: { remaining: number } = {
      remaining: typeof maxAmount === "number" ? maxAmount : Infinity,
    };

    for (const [paymentId, allocs] of byPayment) {
      if (budget.remaining <= 0.005) break;

      const entries = this.buildBudgetedInstallmentEntries(allocs, budget);
      if (entries.length === 0) continue;

      const reversedSum =
        Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100) / 100;

      const applied = await this.reverseSinglePaymentPortion(
        tx,
        paymentId,
        entries,
        reversedSum,
        reason,
        userId
      );
      if (!applied) {
        // Nothing was reversed (payment already fully reversed): return the budget.
        budget.remaining =
          Math.round((budget.remaining + reversedSum) * 100) / 100;
        continue;
      }

      processedPaymentIds.add(paymentId);
      reversedPaymentIds.push(paymentId);
      totalReversed = Math.round((totalReversed + reversedSum) * 100) / 100;
    }

    return { reversedPaymentIds, totalReversed };
  }

  /**
   * Build the reversal entries for one payment's installment allocations, capped by the shared budget.
   * Mutates `budget.remaining` as it consumes it so the caller can stop once the budget is exhausted.
   */
  private buildBudgetedInstallmentEntries(
    allocs: Array<{
      creditInstallmentId: string | null;
      amount: Prisma.Decimal;
      reversedAmount: Prisma.Decimal;
    }>,
    budget: { remaining: number }
  ): Array<{
    targetType: PaymentAllocationTargetType;
    creditInstallmentId?: string;
    amount: number;
  }> {
    const entries: Array<{
      targetType: PaymentAllocationTargetType;
      creditInstallmentId?: string;
      amount: number;
    }> = [];
    for (const a of allocs) {
      if (budget.remaining <= 0.005) break;
      const reversible =
        Math.round((Number(a.amount) - Number(a.reversedAmount)) * 100) / 100;
      if (reversible <= 0.005 || !a.creditInstallmentId) continue;
      const take =
        Math.round(Math.min(reversible, budget.remaining) * 100) / 100;
      if (take <= 0.005) continue;
      entries.push({
        targetType: PaymentAllocationTargetType.INSTALLMENT,
        creditInstallmentId: a.creditInstallmentId,
        amount: take,
      });
      budget.remaining = Math.round((budget.remaining - take) * 100) / 100;
    }
    return entries;
  }

  /**
   * Reverse initial/cash order payments that carry no PaymentAllocation rows (they reduced the order
   * principal directly). Skips any payment already handled by the allocation-scoped path.
   */
  private async reverseDirectOrderPayments(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      customerId: string | null;
      orderNumber: string | null;
    },
    processedPaymentIds: Set<string>,
    reason: string,
    userId?: string,
    maxAmount?: number
  ): Promise<{ reversedPaymentIds: string[]; totalReversed: number }> {
    const reversedPaymentIds: string[] = [];
    let totalReversed = 0;

    const directPayments = await tx.payment.findMany({
      where: {
        orderId: order.id,
        transactionType: TransactionType.PAYMENT,
        status: PaymentLifecycleStatus.POSTED,
      },
      include: { allocations: { select: { id: true } } },
      // Newest first so partial refunds unwind the most recent money received.
      orderBy: { paidAt: "desc" },
    });

    const budget: { remaining: number } = {
      remaining: typeof maxAmount === "number" ? maxAmount : Infinity,
    };

    for (const payment of directPayments) {
      if (budget.remaining <= 0.005) break;
      if (processedPaymentIds.has(payment.id)) continue;
      if (payment.allocations.length > 0) continue; // handled via the allocation path

      const reversed = await this.reverseDirectPaymentWithinBudget(
        tx,
        payment,
        order,
        budget,
        reason,
        userId
      );
      if (reversed <= 0) continue;

      processedPaymentIds.add(payment.id);
      reversedPaymentIds.push(payment.id);
      totalReversed = Math.round((totalReversed + reversed) * 100) / 100;
    }

    return { reversedPaymentIds, totalReversed };
  }

  /**
   * Reverse a single direct order payment up to the remaining budget, tracking prior partial reversals
   * via its REVERSAL rows. Mutates `budget.remaining` and returns the amount reversed (0 when skipped).
   */
  private async reverseDirectPaymentWithinBudget(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      paymentType: string;
      provider: string | null;
      amount: Decimal | null;
      orderId: string | null;
      customerId: string | null;
      creditInstallmentId: string | null;
      transactionReference: string | null;
    },
    order: { customerId: string | null; orderNumber: string | null },
    budget: { remaining: number },
    reason: string,
    userId?: string
  ): Promise<number> {
    const amount = Math.round(Number(payment.amount ?? 0) * 100) / 100;
    if (amount <= 0.005) return 0;

    const customerId = payment.customerId ?? order.customerId;
    if (!customerId) {
      // Walk-in cash sale without a customer: there is no accounts-receivable ledger to reverse.
      this.logger.warn(
        `[ANNUL_REVERSAL] Skipping payment ${payment.id} for order ${order.orderNumber}: no customer to attribute the reversal to`
      );
      return 0;
    }

    // Direct payments carry no allocations, so track prior partial reversals via the REVERSAL rows.
    const alreadyReversed = await this.sumReversalsForPayment(tx, payment.id);
    const reversibleRemaining =
      Math.round((amount - alreadyReversed) * 100) / 100;
    if (reversibleRemaining <= 0.005) return 0;

    const reverseAmount =
      Math.round(Math.min(reversibleRemaining, budget.remaining) * 100) / 100;
    if (reverseAmount <= 0.005) return 0;

    const fullyReversed = reverseAmount >= reversibleRemaining - 0.005;

    await this.reverseDirectOrderPayment(
      tx,
      {
        id: payment.id,
        paymentType: payment.paymentType,
        provider: payment.provider,
        amount: payment.amount,
        orderId: payment.orderId,
        creditInstallmentId: payment.creditInstallmentId,
        transactionReference: payment.transactionReference,
      },
      customerId,
      reason,
      reverseAmount,
      fullyReversed,
      userId
    );

    budget.remaining =
      Math.round((budget.remaining - reverseAmount) * 100) / 100;
    return reverseAmount;
  }

  /**
   * Total amount already reversed against a payment, summed from its REVERSAL ledger rows.
   * Used to compute the remaining reversible amount for direct payments (which have no allocations).
   */
  private async sumReversalsForPayment(
    tx: Prisma.TransactionClient,
    paymentId: string
  ): Promise<number> {
    const rows = await tx.payment.findMany({
      where: {
        originalPaymentId: paymentId,
        transactionType: TransactionType.REVERSAL,
      },
      select: { amount: true },
    });
    const sum = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return Math.round(sum * 100) / 100;
  }

  /**
   * Reverse a scoped set of installment allocation entries for one payment (partial or full).
   * Unwinds the installments/credit, marks the allocations' reversedAmount, writes a REVERSAL ledger row,
   * and flips the payment to REVERSED only when it has no remaining un-reversed allocations.
   * Returns false when there is nothing to reverse (payment already reversed).
   */
  private async reverseSinglePaymentPortion(
    tx: Prisma.TransactionClient,
    paymentId: string,
    entries: Array<{
      targetType: PaymentAllocationTargetType;
      creditInstallmentId?: string;
      amount: number;
    }>,
    reversedSum: number,
    reason: string,
    userId?: string
  ): Promise<boolean> {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        allocations: true,
        order: { select: { orderNumber: true } },
        creditInstallment: {
          include: {
            credit: { include: { order: { select: { orderNumber: true } } } },
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }
    if (payment.status === PaymentLifecycleStatus.REVERSED) {
      return false;
    }

    const customerId = await this.resolveCustomerIdForPayment(tx, payment);

    await this.applyReversalEntries(tx, customerId, entries);
    await this.markAllocationsAsReversed(tx, payment.allocations, entries);

    await tx.payment.create({
      data: {
        customerId,
        paymentType: payment.paymentType,
        provider: payment.provider,
        amount: new Decimal(reversedSum),
        transactionType: TransactionType.REVERSAL,
        transactionReference: buildReversalTransactionReference(payment.id, {
          paymentType: payment.paymentType,
          orderId: payment.orderId,
          creditInstallmentId: payment.creditInstallmentId,
          transactionReference: payment.transactionReference,
          order: payment.order,
          creditInstallment: payment.creditInstallment,
        }),
        createdBy: userId,
        originalPaymentId: payment.id,
      },
    });

    // Flip the source payment to REVERSED only when every allocation is fully reversed.
    const refreshed = await tx.paymentAllocation.findMany({
      where: { paymentId: payment.id },
      select: { amount: true, reversedAmount: true },
    });
    const remaining = refreshed.reduce(
      (s, a) => s + Math.max(0, Number(a.amount) - Number(a.reversedAmount)),
      0
    );
    if (Math.round(remaining * 100) / 100 <= 0.005) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentLifecycleStatus.REVERSED,
          reversedAt: new Date(),
          reversalReason: reason,
          reversedBy: userId,
        },
      });
    }

    return true;
  }

  /**
   * Reverse an initial/cash order payment that has no PaymentAllocation rows. Writes a REVERSAL ledger
   * row and flips the payment to REVERSED. No installment unwind is needed because these payments
   * reduced the order principal directly (the credit/installments are annulled separately).
   */
  private async reverseDirectOrderPayment(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      paymentType: string;
      provider: string | null;
      amount: Decimal | null;
      orderId: string | null;
      creditInstallmentId: string | null;
      transactionReference: string | null;
    },
    customerId: string,
    reason: string,
    reverseAmount: number,
    fullyReversed: boolean,
    userId?: string
  ): Promise<void> {
    const orderRef = payment.orderId
      ? await tx.order.findUnique({
          where: { id: payment.orderId },
          select: { orderNumber: true },
        })
      : null;

    await tx.payment.create({
      data: {
        customerId,
        paymentType: payment.paymentType,
        provider: payment.provider,
        amount: new Decimal(Math.round(reverseAmount * 100) / 100),
        transactionType: TransactionType.REVERSAL,
        transactionReference: buildReversalTransactionReference(payment.id, {
          paymentType: payment.paymentType,
          orderId: payment.orderId,
          creditInstallmentId: payment.creditInstallmentId,
          transactionReference: payment.transactionReference,
          order: orderRef,
          creditInstallment: null,
        }),
        createdBy: userId,
        originalPaymentId: payment.id,
      },
    });

    // Only flip the source payment to REVERSED once it is fully unwound; a partial refund keeps it POSTED
    // so future annulments can still reverse the remaining balance.
    if (fullyReversed) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentLifecycleStatus.REVERSED,
          reversedAt: new Date(),
          reversalReason: reason,
          reversedBy: userId,
        },
      });
    }
  }

  private async markAllocationsAsReversed(
    tx: Prisma.TransactionClient,
    allocations: Array<{
      id: string;
      targetType: PaymentAllocationTargetType;
      creditInstallmentId: string | null;
      amount: Decimal;
      reversedAmount: Decimal;
    }>,
    entries: Array<{
      targetType: PaymentAllocationTargetType;
      creditInstallmentId?: string;
      amount: number;
    }>
  ): Promise<void> {
    const byKey = new Map<
      string,
      Array<{
        id: string;
        reversedAmount: number;
        reversibleAmount: number;
      }>
    >();

    for (const alloc of allocations) {
      const key = `${alloc.targetType}:${alloc.creditInstallmentId ?? ""}`;
      const list = byKey.get(key) ?? [];
      list.push({
        id: alloc.id,
        reversedAmount: Number(alloc.reversedAmount),
        reversibleAmount: Math.max(
          0,
          Math.round(
            (Number(alloc.amount) - Number(alloc.reversedAmount)) * 100
          ) / 100
        ),
      });
      byKey.set(key, list);
    }

    for (const entry of entries) {
      const key = `${entry.targetType}:${entry.creditInstallmentId ?? ""}`;
      const candidates = byKey.get(key) ?? [];
      let remaining = Math.round(entry.amount * 100) / 100;

      for (const candidate of candidates) {
        if (remaining <= 0.005) break;
        if (candidate.reversibleAmount <= 0.005) continue;

        const take =
          Math.round(Math.min(remaining, candidate.reversibleAmount) * 100) /
          100;
        if (take <= 0.005) continue;

        candidate.reversedAmount =
          Math.round((candidate.reversedAmount + take) * 100) / 100;
        candidate.reversibleAmount =
          Math.round((candidate.reversibleAmount - take) * 100) / 100;
        remaining = Math.round((remaining - take) * 100) / 100;
      }

      if (remaining > 0.005) {
        throw new BadRequestException(
          `Reversal entry (${entry.amount}) exceeds unreversed allocation amount for ${entry.targetType}${entry.creditInstallmentId ? ` ${entry.creditInstallmentId}` : ""}`
        );
      }
    }

    const updates = Array.from(byKey.values()).flat();
    for (const update of updates) {
      await tx.paymentAllocation.update({
        where: { id: update.id },
        data: {
          reversedAmount: new Decimal(
            Math.max(0, Math.round(update.reversedAmount * 100) / 100)
          ),
        },
      });
    }
  }

  /**
   * Legacy rows may omit customer_id when order_id or credit_installment_id is set.
   */
  private async resolveCustomerIdForPayment(
    tx: Prisma.TransactionClient,
    payment: {
      customerId: string | null;
      orderId: string | null;
      creditInstallmentId: string | null;
    }
  ): Promise<string> {
    if (payment.customerId) {
      return payment.customerId;
    }
    if (payment.orderId) {
      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
        select: { customerId: true },
      });
      if (order?.customerId) {
        return order.customerId;
      }
    }
    if (payment.creditInstallmentId) {
      const installment = await tx.creditInstallment.findUnique({
        where: { id: payment.creditInstallmentId },
        select: {
          credit: { select: { customerId: true } },
        },
      });
      if (installment?.credit?.customerId) {
        return installment.credit.customerId;
      }
    }
    throw new BadRequestException(
      "Cannot determine customer for this payment. The payment must be linked to a customer, order, or installment."
    );
  }

  /**
   * Legacy payments often linked only to the first cuota while the amount covered several installments
   * (waterfall). When the reversal entry exceeds that cuota's paidAmount, we unwind across all
   * non-annulled installments of the same credit in descending installmentNo (inverse of typical
   * pay-down order). Any remainder still unmatched goes to OPENING_BALANCE.
   */
  private async expandInstallmentReversalEntriesToPaidCap(
    tx: Prisma.TransactionClient,
    entries: Array<{
      targetType: PaymentAllocationTargetType;
      creditInstallmentId?: string;
      amount: number;
    }>
  ): Promise<
    Array<{
      targetType: PaymentAllocationTargetType;
      creditInstallmentId?: string;
      amount: number;
    }>
  > {
    const out: Array<{
      targetType: PaymentAllocationTargetType;
      creditInstallmentId?: string;
      amount: number;
    }> = [];

    for (const entry of entries) {
      if (
        entry.targetType !== PaymentAllocationTargetType.INSTALLMENT ||
        !entry.creditInstallmentId
      ) {
        out.push(entry);
        continue;
      }

      const lead = await tx.creditInstallment.findUnique({
        where: { id: entry.creditInstallmentId },
        select: {
          creditId: true,
          paidAmount: true,
          installmentNo: true,
        },
      });
      if (!lead) {
        out.push(entry);
        continue;
      }

      const paid = Math.round(Number(lead.paidAmount) * 100) / 100;
      const amt = Math.round(entry.amount * 100) / 100;

      if (amt <= paid + 0.005) {
        out.push(entry);
        continue;
      }

      const siblings = await tx.creditInstallment.findMany({
        where: {
          creditId: lead.creditId,
          status: { not: CreditInstallmentStatus.ANNULLED },
        },
        orderBy: {
          installmentNo:
            this.legacyReversalInstallmentStrategy === "FIFO" ? "asc" : "desc",
        },
        select: { id: true, installmentNo: true, paidAmount: true },
      });

      let remaining = amt;
      const split: Array<{
        targetType: PaymentAllocationTargetType;
        creditInstallmentId?: string;
        amount: number;
      }> = [];

      for (const sib of siblings) {
        if (remaining <= 0.005) break;
        const sibPaid = Math.round(Number(sib.paidAmount) * 100) / 100;
        const take = Math.round(Math.min(remaining, sibPaid) * 100) / 100;
        if (take > 0.005) {
          split.push({
            targetType: PaymentAllocationTargetType.INSTALLMENT,
            creditInstallmentId: sib.id,
            amount: take,
          });
          remaining = Math.round((remaining - take) * 100) / 100;
        }
      }

      if (remaining > 0.005) {
        this.logger.warn(
          `[REVERSAL] Credit waterfall placed ${Math.round((amt - remaining) * 100) / 100} of ${amt} on installments; ${remaining} to opening balance`
        );
        split.push({
          targetType: PaymentAllocationTargetType.OPENING_BALANCE,
          amount: remaining,
        });
      }

      if (split.length > 1) {
        this.logger.log(
          `[REVERSAL] Legacy multi-cuota unwind [${this.legacyReversalInstallmentStrategy}]: entry ${amt} on linked cuota #${lead.installmentNo} (paid=${paid}) → ${split.length} legs`
        );
      }

      out.push(...split);
    }

    return out;
  }

  private async applyOpeningBalanceReversalDelta(
    tx: Prisma.TransactionClient,
    customerId: string,
    delta: number
  ): Promise<void> {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { initialOpeningBalance: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const openingBalancePayment = await tx.payment.findFirst({
      where: {
        customerId,
        transactionReference: this.OPENING_BALANCE_REFERENCE,
        orderId: null,
        creditInstallmentId: null,
      },
      select: { id: true, amount: true, paymentType: true, provider: true },
    });

    const current = openingBalancePayment
      ? Number(openingBalancePayment.amount || 0)
      : Number(customer.initialOpeningBalance || 0);
    const next = Math.round((current + delta) * 100) / 100;

    await tx.customer.update({
      where: { id: customerId },
      data: { initialOpeningBalance: new Decimal(next) },
    });

    if (openingBalancePayment) {
      await tx.payment.update({
        where: { id: openingBalancePayment.id },
        data: { amount: new Decimal(next) },
      });
      return;
    }

    await tx.payment.create({
      data: {
        customerId,
        paymentType: "CASH",
        provider: null,
        amount: new Decimal(next),
        transactionReference: this.OPENING_BALANCE_REFERENCE,
        paidAt: this.OPENING_BALANCE_PAID_AT,
      },
    });
  }

  private async applyReversalEntries(
    tx: Prisma.TransactionClient,
    customerId: string | null,
    entries: Array<{
      targetType: PaymentAllocationTargetType;
      creditInstallmentId?: string;
      amount: number;
    }>
  ): Promise<void> {
    if (!customerId) {
      throw new BadRequestException(
        "Customer is required to reverse account/payment allocations"
      );
    }

    const affectedCreditIds = new Set<string>();

    for (const entry of entries) {
      if (entry.amount <= 0) {
        throw new BadRequestException("Reversal entry amount must be positive");
      }
      if (entry.targetType === PaymentAllocationTargetType.OPENING_BALANCE) {
        await this.applyOpeningBalanceReversalDelta(
          tx,
          customerId,
          entry.amount
        );
        continue;
      }

      if (!entry.creditInstallmentId) {
        throw new BadRequestException(
          "creditInstallmentId is required for INSTALLMENT reversal entries"
        );
      }

      const installment = await tx.creditInstallment.findUnique({
        where: { id: entry.creditInstallmentId },
        include: {
          credit: {
            include: {
              order: true,
            },
          },
        },
      });
      if (!installment) {
        throw new NotFoundException(
          `Installment with ID ${entry.creditInstallmentId} not found`
        );
      }
      if (installment.credit.customerId !== customerId) {
        throw new BadRequestException(
          "Installment does not belong to the payment customer"
        );
      }
      if (installment.status === CreditInstallmentStatus.ANNULLED) {
        // The installment's obligation is already cancelled, so there is no outstanding to restore and no
        // paid_amount to unwind here. We intentionally do NOT throw: the caller still records the REVERSAL
        // ledger row and marks the allocation reversed, which returns the money on the statement. This keeps
        // repeated/late annulment reversals robust (e.g. a partial annul that annulled an installment while
        // it still held un-reversed real payments, followed by a full annul of the same order).
        this.logger.warn(
          `[REVERSAL] Skipping installment unwind for annulled installment #${installment.installmentNo} (amount ${entry.amount}); ledger reversal is still recorded by the caller`
        );
        continue;
      }

      const paidAmount = Number(installment.paidAmount);
      if (entry.amount > paidAmount) {
        throw new BadRequestException(
          `Reversal amount (${entry.amount}) exceeds paid amount (${paidAmount}) for installment ${installment.installmentNo}`
        );
      }

      const newPaidAmount = Math.max(
        0,
        Math.round((paidAmount - entry.amount) * 100) / 100
      );
      const installmentAmount = Number(installment.amount);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(installment.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      let newStatus: CreditInstallmentStatus;
      if (newPaidAmount >= installmentAmount) {
        newStatus = CreditInstallmentStatus.PAID;
      } else if (newPaidAmount > 0) {
        newStatus = CreditInstallmentStatus.PARTIAL;
      } else if (dueDate < today) {
        newStatus = CreditInstallmentStatus.OVERDUE;
      } else {
        newStatus = CreditInstallmentStatus.PENDING;
      }

      await tx.creditInstallment.update({
        where: { id: installment.id },
        data: {
          paidAmount: new Decimal(newPaidAmount),
          status: newStatus,
        },
      });

      affectedCreditIds.add(installment.creditId);
    }

    for (const creditId of affectedCreditIds) {
      await this.recalculateCreditAndOrderStatus(tx, creditId);
    }
  }

  private async recalculateCreditAndOrderStatus(
    tx: Prisma.TransactionClient,
    creditId: string
  ): Promise<void> {
    const credit = await tx.credit.findUnique({
      where: { id: creditId },
      include: {
        installments: true,
      },
    });
    if (!credit) return;

    const outstanding = credit.installments.reduce((sum, inst) => {
      const remaining = Number(inst.amount) - Number(inst.paidAmount);
      return sum + Math.max(0, remaining);
    }, 0);
    const roundedOutstanding = Math.round(outstanding * 100) / 100;
    const hasOverdue = credit.installments.some(
      inst =>
        inst.status === CreditInstallmentStatus.OVERDUE ||
        (Number(inst.paidAmount) < Number(inst.amount) &&
          new Date(inst.dueDate) < new Date())
    );

    const nextStatus =
      roundedOutstanding <= 0
        ? CreditStatus.PAID
        : hasOverdue
          ? CreditStatus.OVERDUE
          : CreditStatus.ACTIVE;

    await tx.credit.update({
      where: { id: credit.id },
      data: {
        outstandingAmount: new Decimal(roundedOutstanding),
        status: nextStatus,
      },
    });

    if (nextStatus === CreditStatus.PAID) {
      await tx.order.update({
        where: { id: credit.orderId },
        data: { status: "COMPLETED" },
      });
      return;
    }

    await tx.order.update({
      where: { id: credit.orderId },
      data: { status: "APPROVED" },
    });
  }

  /**
   * Get receipt PDF data for a payment
   */
  async getPaymentReceiptPdfData(paymentId: string): Promise<ReceiptPdfData> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        customer: {
          include: {
            person: true,
          },
        },
        order: {
          include: {
            customer: { include: { person: true } },
            seller: { include: { person: true } },
            cashier: { include: { person: true } },
            branch: true,
            location: true,
            credit: {
              include: {
                installments: {
                  where: {
                    payments: {
                      some: {
                        id: paymentId,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        creditInstallment: {
          include: {
            credit: {
              include: {
                order: {
                  include: {
                    customer: { include: { person: true } },
                    seller: { include: { person: true } },
                    cashier: { include: { person: true } },
                    branch: true,
                    location: true,
                  },
                },
              },
            },
          },
        },
        creator: {
          include: {
            employees: {
              include: {
                person: true,
                location: {
                  include: {
                    branch: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (!payment.amount) {
      throw new BadRequestException("Payment amount is missing");
    }

    const paymentAmount = Number(payment.amount);

    // Determine if this is an account payment or installment payment
    const isAccountPayment =
      payment.customerId && !payment.orderId && !payment.creditInstallmentId;
    const isInstallmentPayment = !!payment.creditInstallmentId;
    const isOrderPayment = !!payment.orderId && !payment.creditInstallmentId;

    let orderNumber = `PAY-${payment.id.slice(0, 8).toUpperCase()}`;
    let customerName = "";
    let branchName = "";
    let locationName = "";
    let cashierName = "";
    let sellerName = "";
    const date = payment.paidAt.toISOString();

    if (isAccountPayment && payment.customer) {
      // Account payment
      customerName = payment.customer.person
        ? `${payment.customer.person.firstName} ${payment.customer.person.lastName}`.trim()
        : "";
      orderNumber = `ACCOUNT-PAY-${payment.id.slice(0, 8).toUpperCase()}`;

      // Try to get location from creator
      if (payment.creator?.employees?.[0]?.location) {
        locationName = payment.creator.employees[0].location.name;
        branchName = payment.creator.employees[0].location.branch?.name || "";
      }
    } else if (isInstallmentPayment && payment.creditInstallment) {
      // Installment payment
      const order = payment.creditInstallment.credit.order;
      orderNumber = `${order.orderNumber}-INST-${payment.creditInstallment.installmentNo}`;
      customerName = order.customer
        ? `${order.customer.person.firstName} ${order.customer.person.lastName}`.trim()
        : "";
      branchName = order.branch ? order.branch.name : "";
      locationName = order.location ? order.location.name : "";
      cashierName = order.cashier
        ? `${order.cashier.person.firstName} ${order.cashier.person.lastName}`.trim()
        : "";
      sellerName = order.seller
        ? `${order.seller.person.firstName} ${order.seller.person.lastName}`.trim()
        : "";
    } else if (isOrderPayment && payment.order) {
      // Order payment
      const order = payment.order;
      orderNumber = order.orderNumber || orderNumber;
      customerName = order.customer
        ? `${order.customer.person.firstName} ${order.customer.person.lastName}`.trim()
        : "";
      branchName = order.branch ? order.branch.name : "";
      locationName = order.location ? order.location.name : "";
      cashierName = order.cashier
        ? `${order.cashier.person.firstName} ${order.cashier.person.lastName}`.trim()
        : "";
      sellerName = order.seller
        ? `${order.seller.person.firstName} ${order.seller.person.lastName}`.trim()
        : "";
    }

    // Build items list
    const items: ReceiptPdfData["items"] = [];

    if (isAccountPayment) {
      items.push({
        parentName: "Pago a Cuenta",
        variantName: `ID Pago: ${payment.id.slice(0, 8).toUpperCase()}`,
        name: "Pago a Cuenta",
        quantity: 1,
        unitPrice: paymentAmount,
        discountAmount: 0,
        totalPrice: paymentAmount,
      });
    } else if (isInstallmentPayment && payment.creditInstallment) {
      const installment = payment.creditInstallment;
      const order = installment.credit.order;
      items.push({
        parentName: `Pago de Cuota ${installment.installmentNo}`,
        variantName: `Orden: ${order.orderNumber}`,
        name: `Cuota ${installment.installmentNo} - Orden ${order.orderNumber}`,
        quantity: 1,
        unitPrice: Number(installment.amount),
        discountAmount: 0,
        totalPrice: paymentAmount,
      });
    } else if (isOrderPayment && payment.order) {
      items.push({
        parentName: "Pago de Factura",
        variantName: `Orden: ${payment.order.orderNumber}`,
        name: `Pago de Orden ${payment.order.orderNumber}`,
        quantity: 1,
        unitPrice: paymentAmount,
        discountAmount: 0,
        totalPrice: paymentAmount,
      });
    }

    return {
      companyName: "Esli Cosmetics",
      branchName,
      locationName,
      orderNumber,
      date,
      cashier: cashierName,
      seller: sellerName,
      customer: customerName,
      items,
      subtotal: paymentAmount,
      itemsDiscountTotal: 0,
      totalDiscount: 0,
      taxes: 0,
      totalAmount: paymentAmount,
      payments: [
        {
          paymentType: payment.paymentType,
          amount: paymentAmount,
          provider: payment.provider || undefined,
          transactionReference: payment.transactionReference || undefined,
          paidAt: payment.paidAt,
        },
      ],
      thankYouMessage: "¡Gracias por su pago!",
      contactMessage: "Para consultas, contáctenos.",
      //   receiptType: "CASH", // Payment receipts don't need "Monto Adeudado" and "Saldo pendiente" fields
    };
  }
}
