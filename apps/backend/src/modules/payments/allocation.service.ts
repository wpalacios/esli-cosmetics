import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreditInstallmentStatus, CreditStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface AllocationResult {
  creditId: string;
  installmentAllocations: Array<{
    installmentId: string;
    installmentNo: number;
    amount: number;
    previousPaidAmount: number;
    newPaidAmount: number;
    previousStatus: CreditInstallmentStatus;
    newStatus: CreditInstallmentStatus;
  }>;
  creditOutstandingBefore: number;
  creditOutstandingAfter: number;
  creditStatusBefore: CreditStatus;
  creditStatusAfter: CreditStatus;
}

@Injectable()
export class PaymentAllocationService {
  private readonly logger = new Logger(PaymentAllocationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Allocate a payment amount to installments using waterfall logic
   * @param creditId - The credit ID to allocate payments to
   * @param paymentAmount - The total payment amount to allocate
   * @param tx - Prisma transaction client
   * @returns Allocation result with details of what was allocated
   */
  async allocatePaymentToCredit(
    creditId: string,
    paymentAmount: number,
    tx: Prisma.TransactionClient
  ): Promise<AllocationResult> {
    // Load credit with installments
    const credit = await tx.credit.findUnique({
      where: { id: creditId },
      include: {
        installments: {
          where: {
            status: {
              in: [
                CreditInstallmentStatus.PENDING,
                CreditInstallmentStatus.PARTIAL,
                CreditInstallmentStatus.OVERDUE,
              ],
            },
          },
          orderBy: [{ dueDate: "asc" }, { installmentNo: "asc" }],
        },
      },
    });

    if (!credit) {
      throw new NotFoundException(`Credit with ID ${creditId} not found`);
    }

    // Validate payment amount doesn't exceed outstanding
    const outstandingAmount = Number(credit.outstandingAmount);
    if (paymentAmount > outstandingAmount) {
      throw new BadRequestException(
        `Payment amount (${paymentAmount}) exceeds outstanding amount (${outstandingAmount})`
      );
    }

    if (paymentAmount <= 0) {
      throw new BadRequestException("Payment amount must be greater than 0");
    }

    // Validate that credit has installments
    if (credit.installments.length === 0) {
      throw new BadRequestException(
        `Credit with ID ${creditId} has no installments to allocate payment to`
      );
    }

    const creditOutstandingBefore = outstandingAmount;
    const creditStatusBefore = credit.status;

    // Waterfall allocation
    let remaining = paymentAmount;
    const installmentAllocations: AllocationResult["installmentAllocations"] =
      [];

    for (const installment of credit.installments) {
      if (remaining <= 0) break;

      const installmentAmount = Number(installment.amount);
      const paidAmount = Number(installment.paidAmount);
      const installmentRemaining = installmentAmount - paidAmount;

      if (installmentRemaining <= 0) continue;

      // Round to avoid floating point precision issues
      const applied =
        Math.round(Math.min(installmentRemaining, remaining) * 100) / 100;
      const newPaidAmount = Math.round((paidAmount + applied) * 100) / 100;

      // Determine new status
      let newStatus: CreditInstallmentStatus;
      if (newPaidAmount >= installmentAmount) {
        newStatus = CreditInstallmentStatus.PAID;
      } else if (newPaidAmount > 0) {
        newStatus = CreditInstallmentStatus.PARTIAL;
      } else {
        newStatus = installment.status;
      }

      // Update installment
      await tx.creditInstallment.update({
        where: { id: installment.id },
        data: {
          paidAmount: new Decimal(newPaidAmount),
          status: newStatus,
        },
      });

      installmentAllocations.push({
        installmentId: installment.id,
        installmentNo: installment.installmentNo,
        amount: applied,
        previousPaidAmount: paidAmount,
        newPaidAmount,
        previousStatus: installment.status,
        newStatus,
      });

      remaining = Math.round((remaining - applied) * 100) / 100;
    }

    // Update credit outstanding amount (round to avoid floating point issues)
    const creditOutstandingAfter = Math.max(
      0,
      Math.round((creditOutstandingBefore - paymentAmount) * 100) / 100
    );
    let creditStatusAfter: CreditStatus = creditStatusBefore;

    // Recalculate credit status based on outstanding amount and installment statuses
    // We can determine status from the allocations we just made, no need to query again
    if (creditOutstandingAfter <= 0) {
      creditStatusAfter = CreditStatus.PAID;
    } else {
      // Check installment statuses from allocations
      const allPaid = installmentAllocations.every(
        alloc => alloc.newStatus === CreditInstallmentStatus.PAID
      );
      const hasPartial = installmentAllocations.some(
        alloc => alloc.newStatus === CreditInstallmentStatus.PARTIAL
      );

      if (
        allPaid &&
        credit.installments.length === installmentAllocations.length
      ) {
        // All installments are paid
        creditStatusAfter = CreditStatus.PAID;
      } else if (creditStatusBefore === CreditStatus.PENDING) {
        // Credit was pending, now has payments
        creditStatusAfter = CreditStatus.ACTIVE;
      } else if (hasPartial || creditStatusBefore === CreditStatus.ACTIVE) {
        // Has partial payments or was already active
        creditStatusAfter = CreditStatus.ACTIVE;
      }
      // Otherwise keep existing status
    }

    await tx.credit.update({
      where: { id: creditId },
      data: {
        outstandingAmount: new Decimal(creditOutstandingAfter),
        status: creditStatusAfter,
      },
    });

    // If credit is fully paid, update order status to COMPLETED
    if (creditOutstandingAfter <= 0) {
      const creditWithOrder = await tx.credit.findUnique({
        where: { id: creditId },
        include: { order: true },
      });

      if (creditWithOrder?.order) {
        await tx.order.update({
          where: { id: creditWithOrder.order.id },
          data: {
            status: "COMPLETED",
          },
        });
      }
    }

    return {
      creditId,
      installmentAllocations,
      creditOutstandingBefore,
      creditOutstandingAfter,
      creditStatusBefore,
      creditStatusAfter,
    };
  }

  /**
   * Allocate payment across multiple credits for a customer
   * @param customerId - The customer ID
   * @param paymentAmount - The total payment amount to allocate
   * @param tx - Prisma transaction client
   * @returns Array of allocation results, one per credit
   */
  async allocatePaymentToCustomerCredits(
    customerId: string,
    paymentAmount: number,
    tx: Prisma.TransactionClient
  ): Promise<AllocationResult[]> {
    if (paymentAmount <= 0) {
      throw new BadRequestException("Payment amount must be greater than 0");
    }

    // Load all customer credits with outstanding amounts, ordered by creation date
    const credits = await tx.credit.findMany({
      where: {
        customerId,
        outstandingAmount: {
          gt: 0,
        },
        status: {
          in: [CreditStatus.PENDING, CreditStatus.ACTIVE, CreditStatus.OVERDUE],
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Allow allocation even if no credits (payment might be for opening balance only)
    // The caller should handle opening balance separately
    if (credits.length === 0 && paymentAmount > 0) {
      // Return empty results - payment will be handled by opening balance logic
      return [];
    }

    const results: AllocationResult[] = [];
    let remaining = paymentAmount;

    for (const credit of credits) {
      if (remaining <= 0) break;

      const creditOutstanding = Number(credit.outstandingAmount);
      const amountToAllocate = Math.min(creditOutstanding, remaining);

      const result = await this.allocatePaymentToCredit(
        credit.id,
        amountToAllocate,
        tx
      );

      results.push(result);
      remaining = Math.round((remaining - amountToAllocate) * 100) / 100;
    }

    // If there's remaining payment, it should be handled by the caller
    // (e.g., applied to opening balance). Don't throw error here.
    if (remaining > 0) {
      this.logger.warn(
        `Payment amount (${paymentAmount}) exceeds total outstanding credits. Remaining: ${remaining} will be handled by caller.`
      );
    }

    return results;
  }
}
