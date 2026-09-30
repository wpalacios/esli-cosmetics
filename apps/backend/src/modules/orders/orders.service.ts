import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NumberSequenceService } from "../number-sequence/number-sequence.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderDto } from "./dto/order.dto";
import { PayInstallmentDto } from "./dto/pay-installment.dto";
import { PayOrderDto } from "./dto/pay-order.dto";
import { AnnulOrderItemDto, RefundMethod } from "./dto/annul-order-item.dto";
import { BulkAnnulOrderItemsDto } from "./dto/bulk-annul-order-items.dto";
import {
  CreditInstallmentStatus,
  CreditStatus,
  OrderAdjustmentType,
  PaymentAllocationTargetType,
  PaymentFrequency,
  Prisma,
  ProductType,
  QuoteStatus,
  StockMovementType,
} from "@prisma/client";
import { StockMovementsService } from "../stock-movements/stock-movements.service";
import { PaymentsService } from "../payments/payments.service";
import { CreateStockMovementDto } from "../stock-movements/dto/create-stock-movement.dto";
import { ReceiptPdfData } from "../reports/types/receipt-types";
import { DEFAULT_TAX_RATE } from "../../common/constants/tax";
import { Decimal } from "@prisma/client/runtime/library";
import { zonedDayRangeToUtc } from "../../common/date-range/date-range.util";

const orderFullInclude = {
  customer: { include: { person: true } },
  seller: { include: { person: true } },
  cashier: { include: { person: true } },
  branch: true,
  location: true,
  orderItems: {
    include: {
      productVariant: {
        include: {
          product: {
            include: {
              brand: true,
              kitItems: { include: { productVariant: true } },
            },
          },
        },
      },
      annulments: {
        include: {
          creator: {
            include: {
              employees: { include: { person: true }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
  payments: true,
  cashSession: { select: { id: true, status: true, closedAt: true } },
  credit: {
    include: {
      installments: { orderBy: { installmentNo: "asc" as const } },
    },
  },
  adjustments: {
    include: {
      creator: {
        include: {
          employees: { include: { person: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.OrderInclude;

// Relaxed type for mapToDto: base Order scalar fields are typed, but
// relations accept any include shape since call sites vary widely and
// mapToDto guards every relation access with optional chaining.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
type OrderForDto = Prisma.OrderGetPayload<{}> & Record<string, any>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  /**
   * Returns true when the error is safe to retry.
   * Covers Prisma transaction conflicts and common PostgreSQL concurrency errors.
   */
  private isRetryableTransactionError(error: unknown): boolean {
    const errorMessage =
      error instanceof Error ? error.message : String(error ?? "Unknown error");

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma transaction write conflict / serialization failure
      if (error.code === "P2034") {
        this.logger.warn(
          `[TX_RETRY][CLASSIFY] Retryable Prisma error detected. code=${error.code}, message="${errorMessage}"`
        );
        return true;
      }

      // Raw query error from database
      if (error.code === "P2010") {
        const meta = (error.meta ?? {}) as {
          code?: string;
          sqlState?: string;
          message?: string;
        };

        const dbCode = String(meta.code ?? meta.sqlState ?? "");
        const dbMsg = String(meta.message ?? "").toLowerCase();

        const retryable =
          dbCode === "40001" || // serialization_failure
          dbCode === "40P01" || // deadlock_detected
          dbMsg.includes("could not serialize access") ||
          dbMsg.includes("deadlock");

        this.logger.warn(
          `[TX_RETRY][CLASSIFY] Prisma raw DB error detected. prismaCode=${error.code}, dbCode=${dbCode || "N/A"}, retryable=${retryable}, message="${errorMessage}"`
        );

        return retryable;
      }

      this.logger.warn(
        `[TX_RETRY][CLASSIFY] Non-retryable Prisma error detected. code=${error.code}, message="${errorMessage}"`
      );
      return false;
    }

    // Fallback for non-standard error shapes
    const msg = errorMessage.toLowerCase();
    const retryable =
      msg.includes("40001") ||
      msg.includes("40P01") ||
      msg.includes("could not serialize access") ||
      msg.includes("write conflict") ||
      msg.includes("deadlock");

    this.logger.warn(
      `[TX_RETRY][CLASSIFY] Non-Prisma error detected. retryable=${retryable}, message="${errorMessage}"`
    );

    return retryable;
  }

  /**
   * Executes a transaction with retries for retryable concurrency errors.
   * Uses exponential backoff + jitter to reduce collision between concurrent requests.
   */
  private async runWithTxRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 2
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : String(error ?? "Unknown error");
        const retryable = this.isRetryableTransactionError(error);

        // warn log with the received error
        this.logger.warn(
          `[TX_RETRY] Caught error on attempt ${attempt + 1}/${maxRetries + 1}. retryable=${retryable}. message="${errorMessage}"`
        );

        // Non-retryable: fail immediately
        if (!retryable) throw error;

        // Retry budget exhausted: return clear conflict message
        if (attempt === maxRetries) {
          throw new ConflictException(
            "The operation could not be completed because related data is being updated concurrently.  Multiple retry attempts were made. Please try again."
          );
        }

        // Exponential backoff with jitter (capped)
        const backoffMs =
          Math.min(1200, 80 * 2 ** attempt) + Math.floor(Math.random() * 120);

        this.logger.warn(
          `[TX_RETRY] Retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms due to transaction conflict`
        );

        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw new ConflictException("Transaction retry failed unexpectedly.");
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementsService: StockMovementsService,
    private readonly numberSequenceService: NumberSequenceService,
    private readonly paymentsService: PaymentsService
  ) {}

  /**
   * Create a new order with stock validation and movement creation
   */
  async create(
    createOrderDto: CreateOrderDto,
    userId?: string
  ): Promise<OrderDto> {
    this.logger.log("[CREATE] Creating new order");

    this.logger.debug(`order data: ${JSON.stringify(createOrderDto)}`);

    // Validate userId is provided
    if (!userId) {
      this.logger.warn(
        "[CREATE] User ID not provided, stock movements will not have createdBy"
      );
    } else {
      this.logger.debug(`[CREATE] Creating order for user: ${userId}`);
    }

    return await this.prisma.$transaction(
      async tx => {
        // 1. Validate branch and location
        await this.validateBranchAndLocation(
          createOrderDto.branchId,
          createOrderDto.locationId,
          tx
        );

        // 2. Validate customer if provided
        if (createOrderDto.customerId) {
          await this.validateCustomer(createOrderDto.customerId, tx);
        }

        // 3. Validate employees (seller and cashier)
        await this.validateEmployees(
          createOrderDto.sellerId,
          createOrderDto.cashierId,
          tx
        );

        if (createOrderDto.metadata?.fromQuoteId) {
          const qRow = await tx.quote.findFirst({
            where: {
              id: createOrderDto.metadata.fromQuoteId,
              isDeleted: false,
            },
            select: { id: true, status: true },
          });
          if (!qRow) {
            throw new NotFoundException("Cotización no encontrada");
          }
          if (qRow.status === QuoteStatus.CONVERTED) {
            throw new ConflictException(
              "Esta cotización ya fue convertida a pedido"
            );
          }
          if (
            qRow.status === QuoteStatus.ANNULLED ||
            qRow.status === QuoteStatus.EXPIRED
          ) {
            throw new BadRequestException(
              "No se puede vender desde esta cotización (anulada o vencida)"
            );
          }
        }

        // 4. Decompose kits and validate stock availability for all items
        const allVariantIds = createOrderDto.items.map(
          item => item.productVariantId
        );

        const variantsWithKitInfo = await tx.productVariant.findMany({
          where: { id: { in: allVariantIds } },
          include: {
            product: {
              include: {
                kitItems: { include: { productVariant: true } },
              },
            },
          },
        });

        const variantMap = new Map(
          variantsWithKitInfo.map((v: any) => [v.id, v])
        );

        // To get the total phisical quantity needed for each product variant
        const requiredVariants = new Map<string, number>();

        for (const item of createOrderDto.items) {
          const variant = variantMap.get(item.productVariantId);
          if (!variant) {
            throw new NotFoundException(
              `Product variant with ID ${item.productVariantId} not found.`
            );
          }

          if (
            variant.product?.type === ProductType.KIT &&
            variant.product.kitItems?.length > 0
          ) {
            // if the item is a kit, we need to add its components to the requiredVariants Map
            for (const kitItem of variant.product.kitItems) {
              const currentQty =
                requiredVariants.get(kitItem.productVariantId) || 0;
              const totalNeeded = item.quantity * Number(kitItem.quantity);
              requiredVariants.set(
                kitItem.productVariantId,
                currentQty + totalNeeded
              );
            }
          } else {
            // If the item is a standard product, add it to the requiredVariants Map
            const currentQty = requiredVariants.get(item.productVariantId) || 0;
            requiredVariants.set(
              item.productVariantId,
              currentQty + item.quantity
            );
          }
        }

        // Coonvert requiredVariants Map to an array of { productVariantId, quantity } for stock validation
        const itemsToValidate = Array.from(requiredVariants.entries()).map(
          ([id, qty]) => ({
            productVariantId: id,
            quantity: qty,
          })
        );

        // When converting from an APPROVED quote, add back that quote's reservation to "available"
        // (order tx may run before quote tx commits, so release might not be visible yet).
        await this.validateStockAvailability(
          itemsToValidate,
          createOrderDto.locationId,
          tx,
          createOrderDto.metadata?.fromQuoteId &&
            createOrderDto.metadata?.quoteWasApproved
            ? { fromQuoteId: createOrderDto.metadata.fromQuoteId }
            : undefined
        );

        // 5. Validate discount code if provided
        if (createOrderDto.discountCodeId) {
          await this.validateDiscountCode(
            createOrderDto.discountCodeId,
            createOrderDto.customerId,
            tx
          );
        }

        // 6. Calculate order totals using the same logic as frontend
        const discountCodeValue = createOrderDto.discountCodeValue || 0;
        const manualDiscount = createOrderDto.manualDiscount || 0;
        const itemsDiscountTotal = createOrderDto.itemsDiscountTotal || 0;
        const orderDiscount = discountCodeValue + manualDiscount;
        const totalDiscount = orderDiscount + itemsDiscountTotal;

        const { subtotal, taxes, totalAmount } = this.calculateOrderTotals(
          createOrderDto.items,
          discountCodeValue,
          manualDiscount,
          itemsDiscountTotal,
          createOrderDto.includeTax
        );

        // Validate that discounts do not exceed subtotal (prevent negative totals)
        if (totalDiscount > subtotal) {
          throw new BadRequestException(
            `Total discount ($${totalDiscount.toFixed(2)}) exceeds subtotal ($${subtotal.toFixed(
              2
            )}). Discounts cannot exceed the invoice amount.`
          );
        }

        this.logger.debug(
          `[CREATE] Order totals: subtotal=${subtotal}, itemsDiscount=${itemsDiscountTotal}, discountCodeValue=${discountCodeValue}, manualDiscount=${manualDiscount}, orderDiscount=${orderDiscount}, totalDiscount=${totalDiscount}, taxes=${taxes}, total=${totalAmount}`
        );

        // When converting from a quote, use the quote's locked-in totalAmount instead of recalculated total
        // This ensures we honor the price that was quoted to the customer
        const effectiveTotalAmount =
          createOrderDto.quoteTotalAmount ?? totalAmount;

        // 7.5. Validate credit and determine order status if paymentMethod is CREDIT
        let orderStatus: string = "COMPLETED";
        if (createOrderDto.paymentMethod === "CREDIT") {
          if (!createOrderDto.customerId) {
            throw new BadRequestException(
              "Customer is required for credit orders"
            );
          }

          // Validate credit limit
          // When converting from quote, use quote's totalAmount for credit limit validation
          const creditValidation = await this.validateCreditLimit(
            createOrderDto.customerId,
            effectiveTotalAmount,
            tx
          );

          if (!creditValidation.isWithinLimit) {
            orderStatus = "PENDING";
            this.logger.warn(
              `[CREATE] Order will be created as PENDING - credit limit exceeded. Customer: ${createOrderDto.customerId}, Total: ${effectiveTotalAmount}, Limit: ${creditValidation.creditLimit}, Current Outstanding: ${creditValidation.currentOutstanding}`
            );
          } else {
            orderStatus = "APPROVED";
          }

          // Validate credit fields are provided
          if (!createOrderDto.creditType) {
            throw new BadRequestException(
              "Credit type is required for credit orders"
            );
          }
          if (!createOrderDto.paymentFrequency) {
            throw new BadRequestException(
              "Payment frequency is required for credit orders"
            );
          }
          if (!createOrderDto.firstDueDate) {
            throw new BadRequestException(
              "First due date is required for credit orders"
            );
          }
          if (createOrderDto.durationDays === undefined) {
            throw new BadRequestException(
              "Duration days is required for credit orders"
            );
          }
        }

        // 7.6. Validate payment amounts (only for non-credit orders or initial payment for credit orders)
        const paymentMethod = createOrderDto.paymentMethod || "CASH";
        if (paymentMethod === "CREDIT") {
          // For credit orders, validate that initial payment (if provided) doesn't exceed order total
          const initialPayment = createOrderDto.initialPayment || 0;
          const totalPaid = createOrderDto.payments.reduce(
            (sum, payment) => sum + payment.amount,
            0
          );

          if (initialPayment > effectiveTotalAmount) {
            throw new BadRequestException(
              `Initial payment (${initialPayment}) cannot exceed order total (${effectiveTotalAmount})`
            );
          }

          if (totalPaid > effectiveTotalAmount) {
            throw new BadRequestException(
              `Total payments (${totalPaid}) cannot exceed order total (${effectiveTotalAmount})`
            );
          }

          // For credit orders, payments should match the initial payment (if any)
          if (
            initialPayment > 0 &&
            Math.abs(totalPaid - initialPayment) > 0.01
          ) {
            throw new BadRequestException(
              `Payment amount (${totalPaid}) does not match initial payment (${initialPayment})`
            );
          }

          // If no initial payment, there should be no payments
          if (initialPayment === 0 && totalPaid > 0.01) {
            throw new BadRequestException(
              `No payments should be provided when initial payment is 0 for credit orders`
            );
          }
        } else {
          // For cash orders, validate that payments match the order total exactly
          this.validatePayments(createOrderDto.payments, effectiveTotalAmount);
        }

        // 8. Generate sequential order number (12 digits, zero-padded; concurrency-safe via number_sequences)
        const orderNumber = await this.numberSequenceService.getNextNumber(
          tx,
          "orders"
        );

        // 9. Calculate subtotal after all discounts (for proportional tax calculation)
        // Use the same values calculated above for consistency
        const subtotalAfterDiscounts = subtotal - totalDiscount;

        // 10. Validate cash session if provided
        if (createOrderDto.cashSessionId) {
          const cashSession = await tx.cashSession.findUnique({
            where: { id: createOrderDto.cashSessionId },
          });
          if (!cashSession) {
            throw new NotFoundException(
              `Cash session with ID ${createOrderDto.cashSessionId} not found`
            );
          }
          if (cashSession.status !== "open") {
            throw new BadRequestException(
              "Cash session must be open to attach orders"
            );
          }
        }

        // 10.5. Batch fetch all product variants upfront to avoid N queries
        // This logic was moved to step 4 to avoid redundant queries.
        // The 'variantMap' is now created there and reused throughout the transaction since
        // it contains all necessary product variant data for the order items to check stock availability.

        // 11. Create the order
        // Use effectiveTotalAmount (quote's locked-in total if converting from quote, otherwise calculated total)
        const order = await tx.order.create({
          data: {
            orderNumber: `ESL-${orderNumber}`,
            customerId: createOrderDto.customerId,
            branchId: createOrderDto.branchId,
            locationId: createOrderDto.locationId,
            sellerId: createOrderDto.sellerId,
            cashierId: createOrderDto.cashierId,
            cashSessionId: createOrderDto.cashSessionId,
            discountCodeId: createOrderDto.discountCodeId,
            discountCodeValue: createOrderDto.discountCodeValue || 0,
            manualDiscount: createOrderDto.manualDiscount || 0,
            itemsDiscountTotal: createOrderDto.itemsDiscountTotal || 0,
            discountAmount: createOrderDto.discountAmount || 0,
            status: orderStatus,
            paymentMethod: paymentMethod,
            subtotal,
            taxes: createOrderDto.includeTax ? taxes : 0,
            totalAmount: effectiveTotalAmount,
            includeTax: createOrderDto.includeTax,
            metadata: createOrderDto.metadata || {},
          } as any, // Type assertion needed until Prisma types are fully regenerated
          include: {
            customer: {
              include: {
                person: true,
              },
            },
            seller: {
              include: {
                person: true,
              },
            },
            cashier: {
              include: {
                person: true,
              },
            },
            branch: true,
            location: true,
          },
        });

        this.logger.debug(`[CREATE] Order created with ID: ${order.id}`);

        // 11. Create order items with proportional tax calculation
        // Use batch-created variant map instead of individual queries
        // Calculate all order item data first
        const orderItemsData = createOrderDto.items.map(item => {
          const variant = variantMap.get(item.productVariantId);
          if (!variant) {
            throw new NotFoundException(
              `Product variant with ID ${item.productVariantId} not found`
            );
          }

          const itemSubtotal = item.unitPrice * item.quantity;
          const itemDiscount = item.discountAmount || 0;
          const itemNetAmount = itemSubtotal - itemDiscount;

          // Calculate tax proportionally based on item's contribution to subtotal after discounts
          let itemTaxAmount = 0;
          if (createOrderDto.includeTax && subtotalAfterDiscounts > 0) {
            const itemProportion = itemNetAmount / subtotalAfterDiscounts;
            itemTaxAmount = taxes * itemProportion;
          }

          const lineTotal = itemNetAmount + itemTaxAmount;

          return {
            orderId: order.id,
            productVariantId: item.productVariantId,
            productId: variant.productId,
            priceTypeId: item.priceTypeId || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: itemDiscount,
            taxAmount: itemTaxAmount,
            lineTotal,
          };
        });

        // Use createMany for batch insertion (single DB query)
        await tx.orderItem.createMany({
          data: orderItemsData,
        });

        // Fetch the created order items with relations for the response
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        });

        this.logger.debug(`[CREATE] Created ${orderItems.length} order items`);

        // 12. Create payments
        // Prepare payment data for batch insertion
        const paymentsData = createOrderDto.payments.map(payment => ({
          orderId: order.id,
          paymentType: payment.paymentType,
          provider: payment.provider,
          amount: payment.amount,
          transactionReference: payment.transactionReference,
          paidAt: new Date(),
          createdBy: userId,
        }));

        // Use createMany for batch insertion (single DB query)
        await tx.payment.createMany({
          data: paymentsData,
        });

        // Fetch the created payments for the response
        const payments = await tx.payment.findMany({
          where: { orderId: order.id },
        });

        this.logger.debug(`[CREATE] Created ${payments.length} payments`);

        // 12.5. Create credit record if paymentMethod is CREDIT
        let creditId: string | undefined;
        if (
          createOrderDto.paymentMethod === "CREDIT" &&
          createOrderDto.customerId
        ) {
          const initialPayment = createOrderDto.initialPayment || 0;
          const principalAmount = totalAmount - initialPayment;

          if (principalAmount <= 0) {
            throw new BadRequestException(
              "Initial payment cannot be greater than or equal to order total"
            );
          }

          // Calculate installment count based on duration and frequency
          const installmentCount = this.calculateInstallmentCount(
            createOrderDto.durationDays,
            createOrderDto.paymentFrequency
          );

          // Calculate last due date
          const firstDueDate = new Date(createOrderDto.firstDueDate);
          const lastDueDate = this.calculateLastDueDate(
            firstDueDate,
            installmentCount,
            createOrderDto.paymentFrequency
          );

          // Create credit record
          const credit = await tx.credit.create({
            data: {
              orderId: order.id,
              customerId: createOrderDto.customerId,
              principalAmount: new Prisma.Decimal(principalAmount),
              outstandingAmount: new Prisma.Decimal(principalAmount),
              creditType: createOrderDto.creditType,
              installmentCount,
              paymentFrequency: createOrderDto.paymentFrequency,
              durationDays: createOrderDto.durationDays,
              firstDueDate: firstDueDate,
              lastDueDate: lastDueDate,
              status:
                orderStatus === "APPROVED"
                  ? CreditStatus.ACTIVE
                  : CreditStatus.PENDING,
            } as any, // Type assertion needed until Prisma types are fully regenerated
          });

          creditId = credit.id;

          // Generate installments
          await this.generateCreditInstallments(
            creditId,
            principalAmount,
            installmentCount,
            createOrderDto.paymentFrequency,
            new Date(createOrderDto.firstDueDate),
            tx
          );

          this.logger.debug(
            `[CREATE] Created credit record with ${installmentCount} installments`
          );

          // Update order with creditId
          await tx.order.update({
            where: { id: order.id },
            data: { creditId: creditId } as any, // Type assertion needed until Prisma types are fully regenerated
          });
        }

        // 13. Stock: quote reservation release + sale deductions (see releaseQuoteReservationForApprovedQuote)
        const fromQuoteId = createOrderDto.metadata?.fromQuoteId;
        const quoteWasApprovedForConvert =
          createOrderDto.metadata?.quoteWasApproved === true;
        const wantsConsumeReservation =
          createOrderDto.metadata?.consumeReservation === true;
        const shouldConsumeReservation =
          wantsConsumeReservation && quoteWasApprovedForConvert;

        if (orderStatus === "PENDING") {
          if (fromQuoteId && quoteWasApprovedForConvert) {
            await this.releaseQuoteReservationForApprovedQuote(
              tx,
              fromQuoteId,
              createOrderDto.locationId
            );
            await tx.order.update({
              where: { id: order.id },
              data: {
                metadata: {
                  ...createOrderDto.metadata,
                  quoteReservationReleasedOnConvert: true,
                },
              },
            });
            this.logger.log(
              `[CREATE] Released quote ${fromQuoteId} reservation for PENDING order ${orderNumber}`
            );
          }
          this.logger.debug(
            `[CREATE] Skipping stock movements - order status is ${orderStatus}`
          );
        } else {
          this.logger.debug(
            `[CREATE] Generating context-aware movements for order ${orderNumber}`
          );

          if (shouldConsumeReservation && fromQuoteId) {
            await this.releaseQuoteReservationForApprovedQuote(
              tx,
              fromQuoteId,
              createOrderDto.locationId
            );
          }
          const orderItemMap = new Map(
            orderItems.map(oi => [oi.productVariantId, oi.id])
          );
          const stockMovementDtos: CreateStockMovementDto[] = [];

          // 2. Flatten items and kit components in memory
          for (const item of createOrderDto.items) {
            const variant = variantMap.get(item.productVariantId);
            if (!variant) continue;
            const orderItemId = orderItemMap.get(item.productVariantId);
            const isKit =
              variant.product?.type === ProductType.KIT &&
              variant.product.kitItems?.length > 0;

            if (isKit) {
              for (const kitItem of variant.product.kitItems) {
                const componentProductId = kitItem.productVariant?.productId;
                if (!componentProductId) {
                  throw new BadRequestException(
                    `Kit component missing productId for variant ${kitItem.productVariantId}`
                  );
                }
                stockMovementDtos.push({
                  productVariantId: kitItem.productVariantId,
                  productId: componentProductId,
                  fromLocationId: createOrderDto.locationId,
                  toLocationId: null,
                  movementType: StockMovementType.SALE,
                  quantity: item.quantity * Number(kitItem.quantity),
                  reference: orderNumber,
                  note: `Kit Sale Component: ${variant.product.name}`,
                  metadata: {
                    orderId: order.id,
                    orderItemId,
                    isKitComponent: true,
                  },
                });
              }
            } else {
              stockMovementDtos.push({
                productVariantId: item.productVariantId,
                productId: variant.productId,
                fromLocationId: createOrderDto.locationId,
                toLocationId: null,
                movementType: StockMovementType.SALE,
                quantity: item.quantity,
                reference: orderNumber,
                note: `Standard Sale: ${variant.product.name}`,
                metadata: {
                  orderId: order.id,
                  orderItemId,
                  isKitComponent: false,
                },
              });
            }
          }

          if (stockMovementDtos.length > 0) {
            await this.stockMovementsService.createSaleOrderMovements(
              stockMovementDtos,
              tx,
              userId
            );
          } else if (shouldConsumeReservation && fromQuoteId) {
            this.logger.warn(
              `[CREATE] Quote ${fromQuoteId} reservation released but no stock_levels rows matched sale lines for order ${orderNumber}`
            );
          }

          this.logger.debug(
            `[CREATE] Created ${stockMovementDtos.length} stock movements for order ${orderNumber}`
          );
        }

        this.logger.log(`[CREATE] Order ${orderNumber} created successfully`);

        // 14. Increment usageCount for CustomerDiscountCode if discount code was applied
        // ONLY if order is APPROVED - PENDING orders should not increment usage
        if (
          orderStatus !== "PENDING" &&
          createOrderDto.discountCodeId &&
          createOrderDto.customerId
        ) {
          const customerDiscountCode = await tx.customerDiscountCode.findFirst({
            where: {
              customerId: createOrderDto.customerId,
              discountCodeId: createOrderDto.discountCodeId,
              isDeleted: false,
            },
            include: {
              discountCode: true,
            },
          });

          if (customerDiscountCode) {
            const updatedUsageCount =
              (customerDiscountCode.usageCount || 0) + 1;
            const usageLimit =
              customerDiscountCode.discountCode?.usageLimit || 0;
            const isRedeemed =
              usageLimit > 0 && updatedUsageCount >= usageLimit;
            const redeemedAt = isRedeemed ? new Date() : null;

            await tx.customerDiscountCode.update({
              where: {
                id: customerDiscountCode.id,
              },
              data: {
                usageCount: updatedUsageCount,
                isRedeemed: isRedeemed,
                redeemedAt: redeemedAt,
              },
            });
            this.logger.debug(
              `[CREATE] Incremented usageCount for customer discount code`
            );
          }
        }

        if (createOrderDto.metadata?.fromQuoteId) {
          const qid = createOrderDto.metadata.fromQuoteId;
          const finalized = await tx.quote.updateMany({
            where: {
              id: qid,
              status: {
                in: [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.APPROVED],
              },
            },
            data: { status: QuoteStatus.CONVERTED },
          });
          if (finalized.count === 0) {
            this.logger.error(
              `[QUOTE-FINALIZE] Quote ${qid} not updated to CONVERTED after order ${order.id}`
            );
            throw new ConflictException(
              "La proforma no pudo cerrarse (posible conversión simultánea). Verifique pedidos vinculados."
            );
          }
          await tx.order.update({
            where: { id: order.id },
            data: { quoteId: qid },
          });
          this.logger.log(
            `[QUOTE-FINALIZE] Quote ${qid} CONVERTED, order ${order.id} linked`
          );
        }

        // 15. Return complete order data
        return this.mapToDto({
          ...order,
          orderItems,
          payments,
        });
      },
      {
        maxWait: 30000,
        timeout: 90000,
      }
    );
  }

  /**
   * When an APPROVED quote becomes a PENDING credit order, release reservation without deducting quantity.
   */
  private async releaseQuoteReservationForApprovedQuote(
    tx: any,
    quoteId: string,
    locationId: string
  ): Promise<void> {
    const items = await tx.quoteItem.findMany({
      where: { quoteId },
      include: {
        productVariant: {
          include: { product: { include: { kitItems: true } } },
        },
      },
    });
    const variantQtyMap = new Map<string, number>();
    for (const ci of items) {
      const pv = ci.productVariant;
      if (!pv?.product) continue;
      const isKit =
        pv.product.type === ProductType.KIT &&
        (pv.product.kitItems?.length ?? 0) > 0;
      if (isKit && pv.product.kitItems) {
        for (const ki of pv.product.kitItems) {
          const q = ci.quantity * Number(ki.quantity);
          variantQtyMap.set(
            ki.productVariantId,
            (variantQtyMap.get(ki.productVariantId) || 0) + q
          );
        }
      } else if (ci.productVariantId) {
        variantQtyMap.set(
          ci.productVariantId,
          (variantQtyMap.get(ci.productVariantId) || 0) + ci.quantity
        );
      }
    }
    if (variantQtyMap.size === 0) return;
    const stockLevels = await tx.stockLevel.findMany({
      where: {
        productVariantId: { in: [...variantQtyMap.keys()] },
        locationId,
      },
      select: { id: true, productVariantId: true, reserved: true },
    });

    // If a quote is APPROVED, reservation should exist for each component/variant
    // in this location. Failing silently here can hide an inventory integrity issue.
    const missingVariantIds: string[] = [];
    for (const vid of variantQtyMap.keys()) {
      const found = stockLevels.some(sl => sl.productVariantId === vid);
      if (!found) missingVariantIds.push(vid);
    }
    if (missingVariantIds.length > 0) {
      this.logger.error(
        `[RELEASE-PENDING-CREDIT] Missing stock_levels rows for quote=${quoteId} location=${locationId}. Missing variants=${missingVariantIds.join(
          ","
        )}`
      );
      // Hard fail: this indicates inventory reservation integrity drift.
      throw new ConflictException(
        "No existe inventario para liberar reserva de la proforma (inconsistencia de stock)."
      );
    }

    const slByVariant = new Map(
      stockLevels.map((s: { productVariantId: string }) => [
        s.productVariantId,
        s,
      ])
    );
    const ids: string[] = [];
    const qtys: number[] = [];
    for (const [vid, qty] of variantQtyMap.entries()) {
      const sl = slByVariant.get(vid) as
        | { id: string; reserved: unknown }
        | undefined;
      if (!sl) continue;
      const res = Number(sl.reserved);
      if (res < qty) {
        this.logger.warn(
          `[RELEASE-PENDING-CREDIT] variant ${vid} reserved=${res} releaseQty=${qty} quote=${quoteId}`
        );
      }
      ids.push(sl.id);
      qtys.push(qty);
    }
    if (ids.length === 0) return;
    await tx.$executeRaw`
      UPDATE stock_levels
      SET
        reserved = GREATEST(0::numeric, reserved - u.qty::numeric),
        updated_at = NOW()
      FROM (
        SELECT unnest(${ids}::uuid[]) as id, unnest(${qtys}::numeric[]) as qty
      ) as u
      WHERE stock_levels.id = u.id
    `;
    this.logger.log(
      `[RELEASE-PENDING-CREDIT] Released reservation for quote ${quoteId} (${ids.length} rows)`
    );
  }

  /**
   * Validate branch and location exist and are active
   */
  private async validateBranchAndLocation(
    branchId: string | undefined,
    locationId: string,
    tx: any
  ): Promise<void> {
    // Validate branch only if branchId is provided
    if (branchId) {
      const branch = await tx.branch.findFirst({
        where: { id: branchId, isDeleted: false, isActive: true },
      });

      if (!branch) {
        throw new NotFoundException("Branch not found or inactive");
      }
    }

    // Always validate location
    const location = await tx.location.findFirst({
      where: { id: locationId, isDeleted: false },
    });

    if (!location) {
      throw new NotFoundException("Location not found or inactive");
    }
  }

  /**
   * Validate customer exists and is not deleted
   */
  private async validateCustomer(customerId: string, tx: any): Promise<void> {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, isDeleted: false },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
  }

  /**
   * Validate employees (seller and cashier)
   */
  private async validateEmployees(
    sellerId: string | undefined,
    cashierId: string,
    tx: any
  ): Promise<void> {
    // Build array of employee IDs to validate
    const employeeIds = [cashierId];
    if (sellerId) {
      employeeIds.push(sellerId);
    }

    // Fetch all employees in a single query
    const employees = await tx.employee.findMany({
      where: {
        id: { in: employeeIds },
        isDeleted: false,
        isActive: true,
      },
    });

    // Create a map for O(1) lookup
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // Validate cashier exists
    if (!employeeMap.has(cashierId)) {
      throw new NotFoundException("Cashier not found or inactive");
    }

    // Validate seller exists if provided
    if (sellerId && !employeeMap.has(sellerId)) {
      throw new NotFoundException("Seller not found or inactive");
    }
  }

  /**
   * Builds a map of variantId -> quantity reserved by a quote (for order-from-quote conversion).
   * When converting an APPROVED quote to order, that quote's reservation is "ours" so we add it back to available.
   */
  private async getReservedByQuoteMap(
    quoteId: string,
    tx: any
  ): Promise<Map<string, number>> {
    const quoteItems = await tx.quoteItem.findMany({
      where: { quoteId },
      include: {
        productVariant: {
          include: {
            product: { include: { kitItems: true } },
          },
        },
      },
    });
    const map = new Map<string, number>();
    for (const ci of quoteItems) {
      const isKit =
        ci.productVariant?.product?.type === ProductType.KIT &&
        ci.productVariant?.product?.kitItems?.length > 0;
      if (isKit && ci.productVariant?.product?.kitItems) {
        for (const ki of ci.productVariant.product.kitItems) {
          const qty = ci.quantity * Number(ki.quantity);
          map.set(
            ki.productVariantId,
            (map.get(ki.productVariantId) || 0) + qty
          );
        }
      } else {
        map.set(
          ci.productVariantId,
          (map.get(ci.productVariantId) || 0) + ci.quantity
        );
      }
    }
    return map;
  }

  private stockLevelTripletKey(
    productId: string | null | undefined,
    productVariantId: string | null | undefined,
    locationId: string
  ): string {
    return `${productId ?? "null"}-${productVariantId ?? "null"}-${locationId}`;
  }

  /**
   * Validate stock availability for all order items.
   * Formula (must match quotes.service validateStockAvailability): available = physical - reserved + addBack.
   * When options.fromQuoteId is set (order from APPROVED quote conversion), the quote's
   * reserved quantity is added back to "available" so validation passes and we can consume that reservation.
   */
  private async validateStockAvailability(
    items: any[],
    locationId: string,
    tx: any,
    options?: { fromQuoteId?: string }
  ): Promise<void> {
    const variantIds = [...new Set(items.map(item => item.productVariantId))];

    let reservedByQuote = new Map<string, number>();
    if (options?.fromQuoteId) {
      reservedByQuote = await this.getReservedByQuoteMap(
        options.fromQuoteId,
        tx
      );
    }

    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const variantMap = new Map<string, any>(
      variants.map((v: any) => [v.id, v])
    );

    const whereConditions: Array<{
      productId: string;
      productVariantId: string;
      locationId: string;
    }> = [];

    for (const variantId of variantIds) {
      const variant = variantMap.get(variantId);
      if (!variant?.productId) {
        throw new BadRequestException(
          `Product variant ${variantId} is missing productId`
        );
      }
      whereConditions.push({
        productId: variant.productId,
        productVariantId: variantId,
        locationId,
      });
    }

    const stockLevels =
      whereConditions.length > 0
        ? await tx.stockLevel.findMany({
            where: { OR: whereConditions },
            include: {
              productVariant: {
                include: {
                  product: true,
                },
              },
            },
          })
        : [];

    const stockLevelMap = new Map(
      stockLevels.map((sl: any) => [
        this.stockLevelTripletKey(
          sl.productId,
          sl.productVariantId,
          sl.locationId
        ),
        sl,
      ])
    );

    for (const item of items) {
      const variant = variantMap.get(item.productVariantId);
      if (!variant?.productId) {
        throw new BadRequestException(
          `Product variant ${item.productVariantId} is missing productId`
        );
      }

      const stockLevel = stockLevelMap.get(
        this.stockLevelTripletKey(
          variant.productId,
          item.productVariantId,
          locationId
        )
      ) as any;
      const currentQuantity = stockLevel ? Number(stockLevel.quantity) : 0;
      const reservedQuantity = stockLevel ? Number(stockLevel.reserved) : 0;
      const addBack = reservedByQuote.get(item.productVariantId) ?? 0;
      const availableQuantity = currentQuantity - reservedQuantity + addBack;

      if (availableQuantity < item.quantity) {
        const variantName =
          stockLevel?.productVariant?.name ?? variant.name ?? "product";

        throw new ConflictException(
          `Insufficient stock for ${variantName}. Available: ${availableQuantity}, Requested: ${item.quantity}`
        );
      }
    }
  }

  /**
   * Validate discount code
   */
  private async validateDiscountCode(
    discountCodeId: string,
    customerId: string | undefined,
    tx: any
  ): Promise<void> {
    const discountCode = await tx.discountCode.findFirst({
      where: {
        id: discountCodeId,
        isDeleted: false,
        isActive: true,
      },
      include: {
        customerDiscountCodes: customerId
          ? {
              where: {
                customerId,
                isDeleted: false,
              },
            }
          : undefined,
      },
    });

    if (!discountCode) {
      throw new NotFoundException("Discount code not found or inactive");
    }

    // Check if discount code is assigned to customer
    if (customerId && discountCode.customerDiscountCodes.length === 0) {
      throw new BadRequestException(
        "This discount code is not assigned to the customer"
      );
    }

    // Check date validity
    const now = new Date();
    if (discountCode.startDate && new Date(discountCode.startDate) > now) {
      throw new BadRequestException("Discount code is not yet valid");
    }

    if (discountCode.endDate && new Date(discountCode.endDate) < now) {
      throw new BadRequestException("Discount code has expired");
    }

    // Check usage limit using CustomerDiscountCode.usageCount
    if (customerId && discountCode.usageLimit && discountCode.usageLimit > 0) {
      const customerDiscountCode = discountCode.customerDiscountCodes[0];
      if (customerDiscountCode) {
        const currentUsageCount = customerDiscountCode.usageCount || 0;
        if (currentUsageCount >= discountCode.usageLimit) {
          throw new BadRequestException("Discount code usage limit exceeded");
        }
      }
    }
  }

  /**
   * Calculate order totals
   * This matches the frontend calculation exactly:
   * 1. Calculate items subtotal (before discounts)
   * 2. Calculate items discount total (sum of all item-level discounts)
   * 3. Calculate order discount (discount code value + manual order discount)
   * 4. Calculate total discount (order discount + items discount total)
   * 5. Apply all discounts to subtotal
   * 6. Calculate tax on subtotal after all discounts
   * 7. Calculate final total
   */
  private calculateOrderTotals(
    items: any[],
    discountCodeValue: number,
    manualDiscount: number,
    itemsDiscountTotal: number,
    includeTax: boolean
  ): { subtotal: number; taxes: number; totalAmount: number } {
    // 1. Calculate items subtotal (BEFORE discounts) - this is the raw subtotal
    const itemsSubtotal = Number(
      items
        .reduce((sum, item) => {
          return sum + item.unitPrice * item.quantity;
        }, 0)
        .toFixed(2)
    );

    // 2. Items discount total is already calculated and passed in
    // 3. Calculate order discount (discount code value + manual order discount)
    const orderDiscount = Number(
      (discountCodeValue + manualDiscount).toFixed(2)
    );

    // 4. Calculate total discount (order discount + items discount total)
    const totalDiscount = Number(
      (orderDiscount + itemsDiscountTotal).toFixed(2)
    );

    // 5. Apply discounts to subtotal
    const subtotalAfterDiscounts = Number(
      (itemsSubtotal - totalDiscount).toFixed(2)
    );

    // 6. Calculate taxes (15% default) on subtotal after all discounts
    const taxes = includeTax
      ? Number((subtotalAfterDiscounts * DEFAULT_TAX_RATE).toFixed(2))
      : 0;

    // 7. Calculate final total
    const totalAmount = Number((subtotalAfterDiscounts + taxes).toFixed(2));

    return {
      subtotal: itemsSubtotal, // Return raw subtotal for reference
      taxes,
      totalAmount,
    };
  }

  /**
   * Validate that payment amounts match the order total
   */
  private validatePayments(payments: any[], totalAmount: number): void {
    const totalPaid = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      throw new BadRequestException(
        `Payment amount (${totalPaid}) does not match order total (${totalAmount})`
      );
    }
  }

  /**
   * Find all orders with optional filters
   */
  async findAll(filters?: {
    orderNumber?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: OrderDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.orderNumber) {
      where.orderNumber = {
        contains: filters.orderNumber,
        mode: "insensitive" as any,
      };
    }

    if (filters?.locationId) {
      where.locationId = filters.locationId;
    }

    // Interpret YYYY-MM-DD filters in the business time zone so a sale made late
    // at night (e.g. 11 PM in Nicaragua, stored as the next UTC day) is still
    // counted under the local day the user selected.
    const createdAtFilter = zonedDayRangeToUtc(
      filters?.startDate,
      filters?.endDate
    );
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        // Minimal include for list view — full object graph is loaded by findOne()
        include: {
          customer: {
            include: {
              person: { select: { firstName: true, lastName: true } },
            },
          },
          seller: {
            include: {
              person: { select: { firstName: true, lastName: true } },
            },
          },
          branch: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: orders.map(order => this.mapToDto(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Annul an order - revert stock movements, decrement discount code usage, and mark as annulled
   */
  async annul(orderId: string, userId?: string): Promise<OrderDto> {
    this.logger.log(`[ANNUL] Annulling order: ${orderId}`);

    return await this.prisma.$transaction(
      async tx => {
        // 1. Get order with all related data
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            orderItems: {
              include: {
                productVariant: {
                  include: {
                    product: {
                      include: {
                        kitItems: { include: { productVariant: true } },
                      },
                    },
                  },
                },
              },
            },
            customer: {
              include: {
                person: true,
              },
            },
            seller: {
              include: {
                person: true,
              },
            },
            cashier: {
              include: {
                person: true,
              },
            },
            branch: true,
            location: true,
            payments: true,
            credit: {
              include: {
                installments: true,
              },
            },
          },
        });

        if (!order) {
          throw new NotFoundException("Order not found");
        }

        if (order.status === "ANNULLED") {
          throw new BadRequestException("Order is already annulled");
        }

        // Only COMPLETED or APPROVED orders can be annulled
        // APPROVED orders are credit orders that haven't been fully paid yet
        if (order.status !== "COMPLETED" && order.status !== "APPROVED") {
          throw new BadRequestException(
            `Order cannot be annulled. Only completed or approved orders can be annulled. Current status: ${order.status}`
          );
        }
        /**
         * Step 2: Reverse stock movements for order annulment .
         * - Handles an important edge case where the order had prior partial annulments.
         * - Prevents over-restocking by reverting only the non-annulled remainder per item.
         * Edge-case rule:
         * - remainingQuantity = quantity - annulledQuantity
         * - If remainingQuantity <= 0, no additional reversal is generated.
         */

        // Keep only items with required identifiers for stock reversal
        const validItems = order.orderItems.filter(
          (
            item
          ): item is typeof item & {
            productVariantId: string;
            productId: string;
          } => !!(item.productVariantId && item.productId)
        );

        // Log and skip invalid items (missing IDs)
        const invalidItems = order.orderItems.filter(
          item => !item.productVariantId || !item.productId
        );
        for (const item of invalidItems) {
          this.logger.warn(
            `[ANNUL] Skipping item ${item.id} - missing productVariantId or productId`
          );
        }

        // Compute remaining quantity to reverse (prevents double reversal)
        const itemsToRevert = validItems
          .map(item => ({
            ...item,
            remainingQuantity: Math.max(
              0,
              (item.quantity || 0) - (item.annulledQuantity || 0)
            ),
          }))
          .filter(item => item.remainingQuantity > 0);

        // Items already fully reversed are logged and skipped
        const fullyRevertedItems = validItems.filter(
          item => (item.quantity || 0) - (item.annulledQuantity || 0) <= 0
        );
        for (const item of fullyRevertedItems) {
          this.logger.debug(
            `[ANNUL] Skipping item ${item.id} - no remaining quantity to revert (quantity=${item.quantity}, annulled=${item.annulledQuantity || 0})`
          );
        }

        if (itemsToRevert.length > 0) {
          const stockMovementDtos: any[] = [];

          for (const item of itemsToRevert) {
            const variant = item.productVariant;
            const isKit = variant?.product?.type === ProductType.KIT;
            const kitItems = variant?.product?.kitItems || [];

            if (isKit && kitItems.length > 0) {
              this.logger.debug(
                `[ANNUL] Product ${variant.product.name} is a kit. Generating atomic stock reversal movements.`
              );

              // Atomic kit reversal:
              // For each remaining sold kit unit, create one ANNULMENT movement per component.
              for (let i = 0; i < item.remainingQuantity; i++) {
                const kitInstanceNumber = i + 1;

                for (const kitItem of kitItems) {
                  if (kitItem.productVariant) {
                    stockMovementDtos.push({
                      productVariantId: kitItem.productVariantId,
                      productId: kitItem.productVariant.productId,
                      fromLocationId: null,
                      toLocationId: order.locationId,
                      movementType: StockMovementType.ANNULMENT,
                      // Component quantity required for one kit unit
                      quantity: Number(kitItem.quantity),
                      reference: order.orderNumber,
                      note: `Anulación de Kit: ${variant.product.name} (${kitInstanceNumber}/${item.remainingQuantity}) | Comp: ${kitItem.productVariant.name} | (Ref. ${order.orderNumber})`,
                      metadata: {
                        annulledOrderId: order.id,
                        originalOrderItemId: item.id,
                        parentKitVariantId: variant.id,
                        kitInstanceIndex: kitInstanceNumber,
                        kitTotalInstances: item.remainingQuantity,
                      },
                    });
                  } else {
                    this.logger.warn(
                      `[ANNUL] Kit component for item ${item.id} is missing productVariant relation.`
                    );
                  }
                }
              }
            } else {
              // Standard product reversal:
              // Single ANNULMENT movement using only remainingQuantity.
              stockMovementDtos.push({
                productVariantId: item.productVariantId,
                productId: item.productId,
                fromLocationId: null,
                toLocationId: order.locationId,
                movementType: StockMovementType.ANNULMENT,
                quantity: item.remainingQuantity,
                reference: order.orderNumber,
                note: `Anulación Estándar: ${variant.product.name} (Ref. ${order.orderNumber})`,
                metadata: {
                  annulledOrderId: order.id,
                  originalOrderItemId: item.id,
                },
              });
            }
          }

          // Persist all reversal movements in one batch operation
          await this.stockMovementsService.createSaleAnnulmentMovements(
            stockMovementDtos,
            tx,
            userId
          );

          this.logger.debug(
            `[ANNUL] Created reverse stock movements for ${itemsToRevert.length} items`
          );
        }

        // 3. Decrement discount code usage if applicable
        if (order.discountCodeId && order.customerId) {
          const customerDiscountCode = await tx.customerDiscountCode.findFirst({
            where: {
              customerId: order.customerId,
              discountCodeId: order.discountCodeId,
              isDeleted: false,
            },
            include: {
              discountCode: true,
            },
          });

          if (customerDiscountCode) {
            const currentUsageCount = customerDiscountCode.usageCount || 0;
            const newUsageCount = Math.max(0, currentUsageCount - 1);
            const usageLimit =
              customerDiscountCode.discountCode?.usageLimit || 0;
            const isRedeemed = usageLimit > 0 && newUsageCount >= usageLimit;

            await tx.customerDiscountCode.update({
              where: {
                id: customerDiscountCode.id,
              },
              data: {
                usageCount: newUsageCount,
                isRedeemed: isRedeemed,
                redeemedAt: isRedeemed ? customerDiscountCode.redeemedAt : null,
              },
            });

            this.logger.debug(
              `[ANNUL] Decremented usageCount for customer discount code from ${currentUsageCount} to ${newUsageCount}`
            );
          }
        }

        // 3.4. Reverse (devolución) any payments applied to this order BEFORE touching the credit.
        // This uses PaymentAllocation as the source of truth, so a global "Pago a Cuenta" that was
        // split across several orders only gets the portion tied to THIS order reversed (the rest keeps
        // paying the still-valid orders). Doing this before annulling installments matters because
        // reversals cannot be applied against installments that are already ANNULLED.
        //
        // Accounting model: annulling the sale removes the charge and the reversal returns the money
        // (net zero for this order). Because payments are reversed instead of turned into credit notes,
        // the customer account statement can never be pushed into a negative (credit-in-favor) balance
        // by an annulment.
        const reversalResult =
          await this.paymentsService.reversePaymentAllocationsForOrderAnnulment(
            tx,
            order.id,
            `Anulación de pedido ${order.orderNumber || order.id}`,
            userId
          );
        this.logger.debug(
          `[ANNUL] Reversed ${reversalResult.reversedPaymentIds.length} payment(s) totaling ${reversalResult.totalReversed} for order ${
            order.orderNumber || order.id
          }`
        );

        // 3.5. Handle credit records if order is a credit order.
        // Payments were already reversed above (no credit notes are created), so here we just annul the
        // credit and every non-annulled installment to keep an accurate audit trail. The credit is
        // excluded from outstanding-balance calculations and the credit limit is unaffected.
        if (order.credit) {
          await tx.credit.update({
            where: { id: order.credit.id },
            data: {
              status: CreditStatus.ANNULLED,
              outstandingAmount: new Prisma.Decimal(0),
            },
          });

          // Annul every installment that is not already annulled. Payment reversal above restored the
          // paid amounts on formerly-paid installments, so a plain status sweep is correct here.
          await tx.$executeRaw`
            UPDATE credit_installments
            SET status = 'ANNULLED'::"CreditInstallmentStatus"
            WHERE credit_id = ${order.credit.id}::uuid
              AND status <> 'ANNULLED'::"CreditInstallmentStatus"
          `;

          this.logger.debug(
            `[ANNUL] Updated credit status to ANNULLED and outstanding amount to 0 for credit ${order.credit.id}`
          );
        }

        // 5. Mark order as annulled
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: "ANNULLED",
          },
          include: {
            customer: {
              include: {
                person: true,
              },
            },
            seller: {
              include: {
                person: true,
              },
            },
            cashier: {
              include: {
                person: true,
              },
            },
            branch: true,
            location: true,
            orderItems: {
              include: {
                productVariant: {
                  include: {
                    product: {
                      include: {
                        brand: true,
                      },
                    },
                  },
                },
              },
            },
            payments: true,
          },
        });

        // 6. Mark related quote as ANNULLED if order has a quote
        if (order.quoteId) {
          await tx.quote.update({
            where: { id: order.quoteId },
            data: {
              status: QuoteStatus.ANNULLED,
            },
          });

          this.logger.debug(
            `[ANNUL] Updated quote ${order.quoteId} status to ANNULLED`
          );
        }

        this.logger.log(
          `[ANNUL] Order ${order.orderNumber} annulled successfully`
        );

        return this.mapToDto(updatedOrder);
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
        timeout: 30000, // Maximum time the transaction can run (30 seconds)
      }
    );
  }

  /**
   * Apply a partial credit annulment of `totalAnnulledAmount` to an order's credit, keeping the account
   * statement non-negative WITHOUT issuing credit notes.
   *
   * Accounting model (shared by annulOrderItem and bulkAnnulOrderItems):
   *  - unpaidCoverage = min(annulled, outstanding) → cancel the still-owed obligation (reverse waterfall).
   *  - paidCoverage   = max(0, annulled - outstanding) → REVERSE (devolución) that much already-paid money,
   *    because it was paid for goods now returned. This is what prevents the statement from going negative.
   *
   * The reversal runs BEFORE the waterfall so it never hits installments the waterfall has annulled
   * (applyReversalEntries rejects reversals against ANNULLED installments). Must run inside a transaction.
   */
  private async applyCreditPartialAnnulment(
    tx: Prisma.TransactionClient,
    params: {
      credit: { id: string; outstandingAmount: Prisma.Decimal };
      orderId: string;
      totalAnnulledAmount: number;
      reason: string;
      userId?: string;
    }
  ): Promise<{ reversedAmount: number; newOutstanding: number }> {
    const { credit, orderId, totalAnnulledAmount, reason, userId } = params;
    const creditReduction = Math.round(totalAnnulledAmount * 100) / 100;
    const outstandingBefore =
      Math.round(Number(credit.outstandingAmount) * 100) / 100;
    const paidCoverage = Math.max(
      0,
      Math.round((creditReduction - outstandingBefore) * 100) / 100
    );

    // 1. Refund (reverse) only the already-paid portion of the annulled goods, scoped via
    //    PaymentAllocation so shared/global "Pago a Cuenta" payments only lose this order's share.
    let reversedAmount = 0;
    if (paidCoverage > 0.005) {
      const res =
        await this.paymentsService.reversePaymentAllocationsForOrderAnnulment(
          tx,
          orderId,
          reason,
          userId,
          paidCoverage
        );
      reversedAmount = res.totalReversed;
    }

    // 2. Cancel the unpaid obligation for the full annulled amount (reverse waterfall, latest due first).
    //    After step 1 un-paid the refunded installments, their outstanding is available again, so the live
    //    outstanding is always >= creditReduction and the reduction applies exactly.
    await tx.$executeRaw`
      WITH ordered_installments AS (
        SELECT
          id,
          amount,
          paid_amount,
          GREATEST(0, amount - paid_amount) as outstanding,
          ROW_NUMBER() OVER (ORDER BY due_date DESC) as rn
        FROM credit_installments
        WHERE credit_id = ${credit.id}::uuid
          AND status NOT IN ('PAID', 'ANNULLED')
      ),
      reduction_calc AS (
        SELECT
          id,
          amount,
          paid_amount,
          outstanding,
          COALESCE(
            SUM(outstanding) OVER (
              ORDER BY rn
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          ) as cumulative_outstanding_before,
          LEAST(
            outstanding,
            GREATEST(0, ${creditReduction}::numeric - COALESCE(
              SUM(outstanding) OVER (
                ORDER BY rn
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ))
          ) as reduction_to_apply
        FROM ordered_installments
      )
      UPDATE credit_installments ci
      SET
        paid_amount = CASE
          WHEN rc.reduction_to_apply >= rc.outstanding THEN rc.amount
          ELSE rc.paid_amount + rc.reduction_to_apply
        END,
        status = CASE
          WHEN rc.reduction_to_apply >= rc.outstanding THEN 'ANNULLED'::"CreditInstallmentStatus"
          WHEN rc.paid_amount + rc.reduction_to_apply >= rc.amount THEN 'PAID'::"CreditInstallmentStatus"
          WHEN rc.reduction_to_apply > 0 THEN 'PARTIAL'::"CreditInstallmentStatus"
          ELSE ci.status
        END
      FROM reduction_calc rc
      WHERE ci.id = rc.id
        AND rc.cumulative_outstanding_before < ${creditReduction}::numeric
        AND rc.reduction_to_apply > 0
    `;

    // 3. Recompute outstanding from the live installments (source of truth after both operations) and set
    //    the credit status. This guarantees credit.outstandingAmount stays in sync and never goes negative.
    const liveInstallments = await tx.creditInstallment.findMany({
      where: { creditId: credit.id, status: { not: "ANNULLED" } },
      select: { amount: true, paidAmount: true },
    });
    const newOutstanding = Math.max(
      0,
      Math.round(
        liveInstallments.reduce(
          (sum, inst) =>
            sum + Math.max(0, Number(inst.amount) - Number(inst.paidAmount)),
          0
        ) * 100
      ) / 100
    );

    await tx.credit.update({
      where: { id: credit.id },
      data: {
        outstandingAmount: new Prisma.Decimal(newOutstanding),
        status: newOutstanding === 0 ? CreditStatus.PAID : CreditStatus.ACTIVE,
      },
    });

    return { reversedAmount, newOutstanding };
  }

  /**
   * Finalize a credit when the item-annul path has voided the whole order (itemsSubtotal === 0).
   *
   * By the time this runs, applyCreditPartialAnnulment has already reversed every already-paid portion
   * (devolución) and cancelled the outstanding obligation, so there is nothing left to refund. We only
   * flip the credit + any remaining installments to ANNULLED. NO credit notes are created — this keeps the
   * item-annul path aligned with the full-order annul() reversal model (client requirement).
   */
  private async annulCreditForFullyVoidedOrder(
    tx: Prisma.TransactionClient,
    orderId: string
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { credit: { include: { installments: true } } },
    });
    if (!order?.credit) return;

    await tx.credit.update({
      where: { id: order.credit.id },
      data: {
        status: CreditStatus.ANNULLED,
        outstandingAmount: new Prisma.Decimal(0),
      },
    });

    const remainingInstallmentIds = (order.credit.installments || [])
      .filter(inst => inst.status !== CreditInstallmentStatus.ANNULLED)
      .map(inst => inst.id);
    if (remainingInstallmentIds.length > 0) {
      await tx.$executeRaw`
        UPDATE credit_installments ci
        SET status = 'ANNULLED'::"CreditInstallmentStatus"
        FROM ( SELECT unnest(${remainingInstallmentIds}::uuid[]) AS id ) AS updates
        WHERE ci.id = updates.id
      `;
      this.logger.debug(
        `[ANNUL_CREDIT] Annulled ${remainingInstallmentIds.length} installments for fully voided order ${order.orderNumber || order.id}`
      );
    }
  }

  /**
   * Partially annul an order item - reverse inventory, adjust financials, and update credit if applicable
   */
  async annulOrderItem(
    orderId: string,
    orderItemId: string,
    dto: AnnulOrderItemDto,
    userId?: string
  ): Promise<OrderDto> {
    this.logger.log(
      `[ANNUL_ITEM] Partially annulling order item: ${orderItemId} in order: ${orderId}`
    );

    if (!userId) {
      throw new BadRequestException("User ID is required for annulment");
    }

    return await this.prisma.$transaction(
      async tx => {
        // Step 1: Load & Validate
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            orderItems: true,
            credit: {
              include: {
                installments: {
                  orderBy: { dueDate: "desc" },
                },
              },
            },
            cashSession: true,
            location: true,
            payments: true,
          },
        });

        if (!order) {
          throw new NotFoundException(`Order ${orderId} not found`);
        }

        // Validate order status
        if (order.status === "ANNULLED") {
          throw new BadRequestException(
            "Cannot annul items from a fully annulled order"
          );
        }

        if (order.status !== "COMPLETED" && order.status !== "APPROVED") {
          throw new BadRequestException(
            "Only completed or approved orders can have items annulled"
          );
        }

        const orderItem = await tx.orderItem.findUnique({
          where: { id: orderItemId },
          include: {
            product: true,
            productVariant: {
              include: {
                product: {
                  include: { kitItems: { include: { productVariant: true } } },
                },
              },
            },
          },
        });

        if (!orderItem) {
          throw new NotFoundException(`Order item ${orderItemId} not found`);
        }

        if (orderItem.orderId !== orderId) {
          throw new BadRequestException(
            "Order item does not belong to the specified order"
          );
        }

        // Validate quantity
        const itemQuantity = orderItem.quantity || 0;
        if (itemQuantity === 0) {
          throw new BadRequestException(
            "Cannot annul items from an order item with zero quantity"
          );
        }

        const remainingQuantity =
          itemQuantity - (orderItem.annulledQuantity || 0);

        if (dto.quantity <= 0) {
          throw new BadRequestException(
            "Quantity to annul must be greater than 0"
          );
        }

        if (remainingQuantity <= 0) {
          throw new BadRequestException(
            `Cannot annul items. All ${itemQuantity} items have already been annulled`
          );
        }

        if (dto.quantity > remainingQuantity) {
          throw new BadRequestException(
            `Cannot annul ${dto.quantity} items. Only ${remainingQuantity} items remaining (${itemQuantity} total - ${
              orderItem.annulledQuantity || 0
            } already annulled)`
          );
        }

        // Validate product/variant exists
        if (!orderItem.productId || !orderItem.productVariantId) {
          throw new BadRequestException(
            "Order item is missing product or product variant information"
          );
        }

        // Step 2: Calculate annulled amount
        const unitPrice = Number(orderItem.unitPrice || 0);
        const annulledAmount = Number((unitPrice * dto.quantity).toFixed(2));

        // Calculate proportional discount and tax
        // itemQuantity is already validated above to be > 0
        const proportion = dto.quantity / itemQuantity;
        const proportionalDiscount = Number(
          (Number(orderItem.discountAmount || 0) * proportion).toFixed(2)
        );
        const proportionalTax = Number(
          (Number(orderItem.taxAmount || 0) * proportion).toFixed(2)
        );

        // Step 3: Calculate net annulled amount (gross - discount + tax)
        // This is the actual amount to be refunded/adjusted
        // Use toFixed to prevent floating-point precision issues
        const totalAnnulledAmount = Number(
          (annulledAmount - proportionalDiscount + proportionalTax).toFixed(2)
        );

        // Register Annulment
        await tx.orderItemAnnulment.create({
          data: {
            orderItemId: orderItem.id,
            quantity: dto.quantity,
            amount: new Prisma.Decimal(totalAnnulledAmount), // Store net amount for consistency with refunds
            reason: dto.reason,
            createdBy: userId,
          },
        });

        // Update OrderItem annulment tracking
        const newAnnulledQuantity =
          (orderItem.annulledQuantity || 0) + dto.quantity;
        // Use net amount for consistency (gross - discount + tax)
        const newAnnulledAmount =
          Number(orderItem.annulledAmount || 0) + totalAnnulledAmount;

        await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            annulledQuantity: newAnnulledQuantity,
            annulledAmount: new Prisma.Decimal(newAnnulledAmount),
            annulledAt: new Date(),
            annulledBy: userId,
            annulmentReason: dto.reason,
          },
        });

        // Step 4: Inventory Reversal
        if (
          orderItem.productVariantId &&
          orderItem.productId &&
          order.locationId
        ) {
          const stockMovementDtos: any[] = [];
          const variant = orderItem.productVariant;
          const isKit = variant?.product?.type === ProductType.KIT;
          const kitItems = variant?.product?.kitItems || [];

          if (isKit && kitItems.length > 0) {
            // Atomic kit annulments: one loop per annulled kit unit
            for (
              let kitUnitIndex = 0;
              kitUnitIndex < dto.quantity;
              kitUnitIndex++
            ) {
              for (const kitItem of kitItems) {
                if (!kitItem.productVariant) continue;

                stockMovementDtos.push({
                  productVariantId: kitItem.productVariantId,
                  productId: kitItem.productVariant.productId,
                  fromLocationId: null,
                  toLocationId: order.locationId,
                  movementType: StockMovementType.ANNULMENT,
                  quantity: Number(kitItem.quantity),
                  reference: order.orderNumber,
                  note: `Anulación Parcial Kit: ${variant.product.name} (${kitUnitIndex + 1}/${dto.quantity}) | Component: ${kitItem.productVariant.name} | Ref. ${order.orderNumber}`,
                  metadata: {
                    annulledOrderId: order.id,
                    annulledOrderItemId: orderItem.id,
                    parentKitVariantId: variant.id,
                    annulmentReason: dto.reason,
                    kitInstanceIndex: kitUnitIndex + 1,
                    kitTotalInstances: dto.quantity,
                  },
                });
              }
            }
          } else {
            // STANDARD ANNULMENT: Single return movement
            stockMovementDtos.push({
              productVariantId: orderItem.productVariantId,
              productId: orderItem.productId,
              fromLocationId: null,
              toLocationId: order.locationId,
              movementType: StockMovementType.ANNULMENT,
              quantity: dto.quantity,
              reference: order.orderNumber,
              note: `Anulación Parcial - ${dto.quantity} unidad(es) de ${variant?.product?.name}`,
              metadata: {
                annulledOrderId: order.id,
                annulledOrderItemId: orderItem.id,
                annulmentReason: dto.reason,
              },
            });
          }

          // Create stock movement for annulment
          await this.stockMovementsService.createSaleAnnulmentMovements(
            stockMovementDtos,
            tx,
            userId
          );
        }

        // Step 5: Financial Adjustment
        // totalAnnulledAmount already calculated in Step 3

        // For cash orders only, create refund adjustment
        // Credit orders are handled separately in Step 6 (credit balance adjustment)
        if (order.paymentMethod === "CASH") {
          if (dto.refundMethod && dto.refundMethod === RefundMethod.CASH) {
            await tx.orderAdjustment.create({
              data: {
                orderId: order.id,
                type: OrderAdjustmentType.REFUND,
                amount: new Prisma.Decimal(totalAnnulledAmount),
                reason:
                  dto.reason && dto.reason !== ""
                    ? dto.reason
                    : `Anulación Parcial - ${dto.quantity} unidad(es) de ${orderItem.productVariant?.product?.name} | (Ref. ${order.orderNumber}`,
                createdBy: userId,
              },
            });
          }
        }

        // Step 6: Credit Adjustment (if credit order)
        // Cancels the unpaid obligation AND reverses (devolución) any already-paid portion of the
        // annulled goods, so the account statement never goes negative and no credit note is issued.
        if (order.paymentMethod === "CREDIT" && order.credit) {
          const adjustmentReason =
            dto.reason ||
            `Anulación Parcial - ${dto.quantity} unidad(es) de ${orderItem.productVariant?.product?.name} | (Ref. ${order.orderNumber}`;

          await this.applyCreditPartialAnnulment(tx, {
            credit: order.credit,
            orderId: order.id,
            totalAnnulledAmount,
            reason: adjustmentReason,
            userId,
          });

          // Audit trail of the obligation reduction (not shown in the account statement).
          await tx.orderAdjustment.create({
            data: {
              orderId: order.id,
              type: OrderAdjustmentType.CREDIT_BALANCE_ADJUSTMENT,
              amount: new Prisma.Decimal(-totalAnnulledAmount),
              reason: adjustmentReason,
              createdBy: userId,
            },
          });
        }

        // Step 7: Recalculate Order Totals
        // Reload order items with updated annulment data
        const updatedOrderItems = await tx.orderItem.findMany({
          where: { orderId: order.id },
        });

        // Calculate new totals based on non-annulled quantities
        const activeItems = updatedOrderItems.map(item => {
          const activeQuantity =
            (item.quantity || 0) - (item.annulledQuantity || 0);
          const unitPrice = Number(item.unitPrice || 0);
          const itemSubtotal = unitPrice * activeQuantity; // Fixed: Use activeQuantity instead of original quantity
          const itemDiscount = Number(item.discountAmount || 0);
          // Use || 1 to prevent division by zero (should never happen due to validation above)
          const proportion = activeQuantity / (item.quantity || 1) || 0;
          const activeDiscount = itemDiscount * proportion;
          const activeTax = Number(item.taxAmount || 0) * proportion;

          return {
            ...item,
            quantity: activeQuantity,
            unitPrice,
            discountAmount: activeDiscount,
            taxAmount: activeTax,
            lineTotal: itemSubtotal - activeDiscount + activeTax,
          };
        });

        // Recalculate order totals
        const itemsSubtotal = Number(
          activeItems
            .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
            .toFixed(2)
        );

        const itemsDiscountTotal = Number(
          activeItems
            .reduce((sum, item) => sum + (item.discountAmount || 0), 0)
            .toFixed(2)
        );

        // Proportionally reduce order-level discounts based on remaining subtotal
        const originalSubtotal = Number(order.subtotal || 0);
        const proportionRemaining =
          originalSubtotal > 0 ? itemsSubtotal / originalSubtotal : 0;

        const originalDiscountCodeValue = Number(order.discountCodeValue || 0);
        const originalManualDiscount = Number(order.manualDiscount || 0);

        // Validate that discounts are not negative (data integrity check)
        if (originalDiscountCodeValue < 0 || originalManualDiscount < 0) {
          throw new BadRequestException(
            `Order has invalid negative discounts (Code: ${originalDiscountCodeValue}, Manual: ${originalManualDiscount}). Please contact support.`
          );
        }

        const discountCodeValue = Number(
          (originalDiscountCodeValue * proportionRemaining).toFixed(2)
        );
        const manualDiscount = Number(
          (originalManualDiscount * proportionRemaining).toFixed(2)
        );

        // Log proportional discount reduction if any order-level discounts exist
        if (originalDiscountCodeValue > 0 || originalManualDiscount > 0) {
          this.logger.debug(
            `[ANNUL_ITEM] Proportionally reducing order-level discounts for order ${order.orderNumber}: ` +
              `Subtotal ${originalSubtotal} → ${itemsSubtotal} (${(proportionRemaining * 100).toFixed(1)}% remaining), ` +
              `Discount Code ${originalDiscountCodeValue} → ${discountCodeValue}, ` +
              `Manual Discount ${originalManualDiscount} → ${manualDiscount}`
          );
        }

        const orderDiscount = Number(
          (discountCodeValue + manualDiscount).toFixed(2)
        );

        const totalDiscount = Number(
          (orderDiscount + itemsDiscountTotal).toFixed(2)
        );

        // Validate that discounts don't exceed subtotal (should not happen with proportional reduction)
        if (totalDiscount > itemsSubtotal) {
          throw new BadRequestException(
            `Total discount ($${totalDiscount.toFixed(2)}) exceeds subtotal ($${itemsSubtotal.toFixed(2)}) after annulment. This should not happen with proportional discount reduction.`
          );
        }

        const subtotalAfterDiscounts = Number(
          (itemsSubtotal - totalDiscount).toFixed(2)
        );

        // Calculate tax by summing item-level taxes (which are already proportionally adjusted)
        // This ensures consistency with how tax was originally calculated per item
        const itemsTaxTotal = Number(
          activeItems
            .reduce((sum, item) => sum + (item.taxAmount || 0), 0)
            .toFixed(2)
        );

        // Use item-level tax sum if available, otherwise fall back to order-level calculation
        let taxes = 0;
        if (order.includeTax) {
          taxes =
            itemsTaxTotal > 0
              ? itemsTaxTotal
              : Number((subtotalAfterDiscounts * DEFAULT_TAX_RATE).toFixed(2));
        }

        const totalAmount = Number((subtotalAfterDiscounts + taxes).toFixed(2));

        // Validate that total amount is not negative or zero
        if (totalAmount < 0) {
          throw new BadRequestException(
            "Order total cannot be negative after annulment. Please check the annulment quantities and order-level discounts."
          );
        }

        // Check if all items are annulled and auto-annul the order
        if (itemsSubtotal === 0) {
          this.logger.warn(
            `[ANNUL_ITEM] All items have been annulled in order ${order.orderNumber}. Auto-annulling order.`
          );
        }

        // Update order totals with proportionally reduced order-level discounts
        // If all items are annulled, mark the order as ANNULLED
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: new Prisma.Decimal(itemsSubtotal),
            taxes: new Prisma.Decimal(taxes),
            totalAmount: new Prisma.Decimal(totalAmount),
            itemsDiscountTotal: new Prisma.Decimal(itemsDiscountTotal),
            discountAmount: new Prisma.Decimal(totalDiscount),
            discountCodeValue: new Prisma.Decimal(discountCodeValue),
            manualDiscount: new Prisma.Decimal(manualDiscount),
            status: itemsSubtotal === 0 ? "ANNULLED" : order.status,
          },
          include: {
            orderItems: {
              include: {
                productVariant: {
                  include: {
                    product: {
                      include: {
                        brand: true,
                        kitItems: { include: { productVariant: true } },
                      },
                    },
                  },
                },
                product: true,
                priceType: true,
              },
            },
            customer: {
              include: {
                person: true,
              },
            },
            seller: {
              include: {
                person: true,
              },
            },
            cashier: {
              include: {
                person: true,
              },
            },
            branch: true,
            location: true,
            payments: true,
            credit: {
              include: {
                installments: {
                  orderBy: { installmentNo: "asc" },
                },
              },
            },
            cashSession: true,
            discountCode: true,
            adjustments: {
              orderBy: { createdAt: "desc" },
            },
          },
        });

        if (itemsSubtotal === 0 && order.credit) {
          await this.annulCreditForFullyVoidedOrder(tx, orderId);
        }

        this.logger.log(
          `[ANNUL_ITEM] Successfully annulled ${dto.quantity} items from order ${order.orderNumber}`
        );

        return this.mapToDto(updatedOrder);
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );
  }

  /**
   * Bulk annul multiple order items - reverse inventory, adjust financials, and update credit if applicable
   */
  async bulkAnnulOrderItems(
    orderId: string,
    dto: BulkAnnulOrderItemsDto,
    userId?: string
  ): Promise<OrderDto> {
    this.logger.log(
      `[BULK_ANNUL_ITEMS] Bulk annulling ${dto.items.length} items from order: ${orderId}`
    );

    if (!userId) {
      throw new BadRequestException("User ID is required for annulment");
    }

    // Pre-check: Load order to detect full order annulment before starting transaction
    const preCheckOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          select: {
            id: true,
            quantity: true,
            annulledQuantity: true,
          },
        },
      },
    });

    if (!preCheckOrder) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Check if this is a full order annulment
    // If all items are being fully annulled, use the annul method instead
    const isFullOrderAnnulment = preCheckOrder.orderItems.every(orderItem => {
      const itemToAnnul = dto.items.find(i => i.orderItemId === orderItem.id);
      if (!itemToAnnul) {
        // Item not in annulment list, check if already fully annulled
        const remainingQty =
          (orderItem.quantity || 0) - (orderItem.annulledQuantity || 0);
        return remainingQty === 0;
      }
      // Item in annulment list, check if it will be fully annulled
      const remainingQty =
        (orderItem.quantity || 0) - (orderItem.annulledQuantity || 0);
      return itemToAnnul.quantity === remainingQty;
    });

    if (isFullOrderAnnulment) {
      this.logger.log(
        `[BULK_ANNUL_ITEMS] Detected full order annulment. Delegating to annul method for order ${orderId}`
      );
      return await this.annul(orderId, userId);
    }

    // Proceed with partial bulk annulment
    // Execute bulk annulment in a retry wrapper to handle serialization/deadlock conflicts.
    return await this.runWithTxRetry(() =>
      this.prisma.$transaction(
        async tx => {
          // Step 1: Load & Validate Order
          const order = await tx.order.findUnique({
            where: { id: orderId },
            include: {
              orderItems: {
                include: {
                  product: true,
                  productVariant: {
                    include: {
                      product: {
                        include: {
                          brand: true,
                          kitItems: { include: { productVariant: true } },
                        },
                      },
                    },
                  },
                },
              },
              credit: {
                include: {
                  installments: {
                    orderBy: { dueDate: "desc" },
                  },
                },
              },
              cashSession: true,
              location: true,
              payments: true,
            },
          });

          if (!order) {
            throw new NotFoundException(`Order ${orderId} not found`);
          }

          // Validate order status
          if (order.status === "ANNULLED") {
            throw new BadRequestException(
              "Cannot annul items from a fully annulled order"
            );
          }

          if (order.status !== "COMPLETED" && order.status !== "APPROVED") {
            throw new BadRequestException(
              "Only completed or approved orders can have items annulled"
            );
          }

          // Step 2: Validate all items
          const itemsToAnnul = dto.items.map(item => {
            const orderItem = order.orderItems.find(
              oi => oi.id === item.orderItemId
            );

            if (!orderItem) {
              throw new NotFoundException(
                `Order item ${item.orderItemId} not found in order ${orderId}`
              );
            }

            if (orderItem.orderId !== orderId) {
              throw new BadRequestException(
                `Order item ${item.orderItemId} does not belong to order ${orderId}`
              );
            }

            const itemQuantity = orderItem.quantity || 0;
            if (itemQuantity === 0) {
              throw new BadRequestException(
                `Cannot annul order item ${item.orderItemId} with zero quantity`
              );
            }

            const remainingQuantity =
              itemQuantity - (orderItem.annulledQuantity || 0);

            if (item.quantity <= 0) {
              throw new BadRequestException(
                `Quantity to annul must be greater than 0 for item ${item.orderItemId}`
              );
            }

            if (remainingQuantity <= 0) {
              throw new BadRequestException(
                `Cannot annul item ${item.orderItemId}. All ${itemQuantity} items have already been annulled`
              );
            }

            if (item.quantity > remainingQuantity) {
              throw new BadRequestException(
                `Cannot annul ${item.quantity} items from ${item.orderItemId}. Only ${remainingQuantity} items remaining`
              );
            }

            if (!orderItem.productId || !orderItem.productVariantId) {
              throw new BadRequestException(
                `Order item ${item.orderItemId} is missing product or product variant information`
              );
            }

            return {
              orderItem,
              quantityToAnnul: item.quantity,
              remainingQuantity,
            };
          });

          // Step 3: Calculate total annulled amount for all items
          const annulmentRecords: Array<{
            orderItemId: string;
            quantity: number;
            amount: number;
            netAmount: number;
          }> = [];

          for (const { orderItem, quantityToAnnul } of itemsToAnnul) {
            const itemQuantity = orderItem.quantity || 0;
            const unitPrice = Number(orderItem.unitPrice || 0);
            const annulledAmount = unitPrice * quantityToAnnul;

            // Calculate proportional discount and tax
            const proportion = quantityToAnnul / itemQuantity;
            const proportionalDiscount = Number(
              (Number(orderItem.discountAmount || 0) * proportion).toFixed(2)
            );
            const proportionalTax = Number(
              (Number(orderItem.taxAmount || 0) * proportion).toFixed(2)
            );

            // Net amount (gross - discount + tax)
            // Use toFixed to prevent floating-point precision issues
            const netAmount = Number(
              (annulledAmount - proportionalDiscount + proportionalTax).toFixed(
                2
              )
            );

            annulmentRecords.push({
              orderItemId: orderItem.id,
              quantity: quantityToAnnul,
              amount: annulledAmount,
              netAmount,
            });
          }

          // Calculate total with proper rounding to prevent floating-point accumulation errors
          const totalAnnulledAmount = Number(
            annulmentRecords
              .reduce((sum, record) => sum + record.netAmount, 0)
              .toFixed(2)
          );

          // Step 4: Create annulment records in batch
          await tx.orderItemAnnulment.createMany({
            data: annulmentRecords.map(record => ({
              orderItemId: record.orderItemId,
              quantity: record.quantity,
              amount: new Prisma.Decimal(record.netAmount),
              reason: dto.reason,
              createdBy: userId,
            })),
          });

          // Step 5: Update all order items in a single batch query using PostgreSQL arrays
          // This is much faster than individual updates (N queries → 1 query)
          const updateData = annulmentRecords.map(record => ({
            id: record.orderItemId,
            quantityToAdd: record.quantity,
            amountToAdd: record.netAmount,
          }));

          const ids = updateData.map(d => d.id);
          const quantities = updateData.map(d => d.quantityToAdd);
          const amounts = updateData.map(d => d.amountToAdd);

          await tx.$executeRaw`
          UPDATE order_items oi
          SET
            annulled_quantity = COALESCE(oi.annulled_quantity, 0) + updates.quantity_to_add,
            annulled_amount = COALESCE(oi.annulled_amount, 0) + updates.amount_to_add,
            annulled_at = NOW(),
            annulled_by = ${userId}::uuid,
            annulment_reason = ${dto.reason || null}
          FROM (
            SELECT
              unnest(${ids}::uuid[]) AS id,
              unnest(${quantities}::integer[]) AS quantity_to_add,
              unnest(${amounts}::numeric[]) AS amount_to_add
          ) AS updates
          WHERE oi.id = updates.id
        `;

          // Step 6: Create stock movements in batch
          const stockMovementDtos: any[] = [];

          for (const { orderItem, quantityToAnnul } of itemsToAnnul) {
            if (
              !orderItem.productVariantId ||
              !orderItem.productId ||
              !order.locationId
            )
              continue;

            const variant = orderItem.productVariant;
            const isKit = variant?.product?.type === ProductType.KIT;
            const kitItems = variant?.product?.kitItems || [];

            if (isKit && kitItems.length > 0) {
              // Atomic kit annulment: one iteration per annulled kit unit
              for (
                let kitUnitIndex = 0;
                kitUnitIndex < quantityToAnnul;
                kitUnitIndex++
              ) {
                for (const kitItem of kitItems) {
                  if (!kitItem.productVariant) continue;

                  stockMovementDtos.push({
                    productVariantId: kitItem.productVariantId,
                    productId: kitItem.productVariant.productId,
                    fromLocationId: null,
                    toLocationId: order.locationId,
                    movementType: StockMovementType.ANNULMENT,
                    quantity: Number(kitItem.quantity),
                    reference: order.orderNumber,
                    note: `Anulación de Kit: ${variant.product?.name} (#${kitUnitIndex + 1}/${quantityToAnnul}) | Component: ${kitItem.productVariant.name} | Ref. ${order.orderNumber}`,
                    metadata: {
                      annulledOrderId: order.id,
                      annulledOrderItemId: orderItem.id,
                      parentKitVariantId: variant.id,
                      annulmentReason: dto.reason,
                      kitInstanceIndex: kitUnitIndex + 1,
                      kitTotalInstances: quantityToAnnul,
                    },
                  });
                }
              }
            } else {
              // Standard product annulment: Single movement per item
              stockMovementDtos.push({
                productVariantId: orderItem.productVariantId,
                productId: orderItem.productId,
                fromLocationId: null,
                toLocationId: order.locationId,
                movementType: StockMovementType.ANNULMENT,
                quantity: quantityToAnnul,
                reference: order.orderNumber,
                note: `Anulación - ${quantityToAnnul} unidad(es) de ${variant?.product?.name} | (Ref. ${order.orderNumber})`,
                metadata: {
                  annulledOrderId: order.id,
                  annulledOrderItemId: orderItem.id,
                  annulmentReason: dto.reason,
                },
              });
            }
          }

          if (stockMovementDtos.length > 0) {
            await this.stockMovementsService.createSaleAnnulmentMovements(
              stockMovementDtos,
              tx,
              userId
            );
          }

          // Step 7: Financial Adjustment (Cash orders only)
          if (order.paymentMethod === "CASH") {
            if (dto.refundMethod && dto.refundMethod === RefundMethod.CASH) {
              await tx.orderAdjustment.create({
                data: {
                  orderId: order.id,
                  type: OrderAdjustmentType.REFUND,
                  amount: new Prisma.Decimal(totalAnnulledAmount),
                  reason:
                    dto.reason || `Anulación de ${dto.items.length} item(s)`,
                  createdBy: userId,
                },
              });
            }
          }

          // Step 8: Credit Adjustment (if credit order)
          // Cancels the unpaid obligation AND reverses (devolución) any already-paid portion of the
          // annulled goods, so the account statement never goes negative and no credit note is issued.
          if (order.paymentMethod === "CREDIT" && order.credit) {
            const adjustmentReason =
              dto.reason ||
              `Credit balance adjustment due to bulk annulment of ${dto.items.length} item(s)`;

            await this.applyCreditPartialAnnulment(tx, {
              credit: order.credit,
              orderId: order.id,
              totalAnnulledAmount,
              reason: adjustmentReason,
              userId,
            });

            // Audit trail of the obligation reduction (not shown in the account statement).
            await tx.orderAdjustment.create({
              data: {
                orderId: order.id,
                type: OrderAdjustmentType.CREDIT_BALANCE_ADJUSTMENT,
                amount: new Prisma.Decimal(-totalAnnulledAmount),
                reason: adjustmentReason,
                createdBy: userId,
              },
            });
          }

          // Step 9: Recalculate Order Totals
          const updatedOrderItems = await tx.orderItem.findMany({
            where: { orderId: order.id },
          });

          const activeItems = updatedOrderItems.map(item => {
            const activeQuantity =
              (item.quantity || 0) - (item.annulledQuantity || 0);
            const unitPrice = Number(item.unitPrice || 0);
            const itemSubtotal = unitPrice * activeQuantity;
            const itemDiscount = Number(item.discountAmount || 0);
            const proportion = activeQuantity / (item.quantity || 1) || 0;
            const activeDiscount = itemDiscount * proportion;
            const activeTax = Number(item.taxAmount || 0) * proportion;

            return {
              ...item,
              quantity: activeQuantity,
              unitPrice,
              discountAmount: activeDiscount,
              taxAmount: activeTax,
              lineTotal: itemSubtotal - activeDiscount + activeTax,
            };
          });

          const itemsSubtotal = Number(
            activeItems
              .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
              .toFixed(2)
          );

          const itemsDiscountTotal = Number(
            activeItems
              .reduce((sum, item) => sum + (item.discountAmount || 0), 0)
              .toFixed(2)
          );

          // Proportionally reduce order-level discounts based on remaining subtotal
          const originalSubtotal = Number(order.subtotal || 0);
          const proportionRemaining =
            originalSubtotal > 0 ? itemsSubtotal / originalSubtotal : 0;

          const originalDiscountCodeValue = Number(
            order.discountCodeValue || 0
          );
          const originalManualDiscount = Number(order.manualDiscount || 0);

          // Validate that discounts are not negative (data integrity check)
          if (originalDiscountCodeValue < 0 || originalManualDiscount < 0) {
            throw new BadRequestException(
              `Order has invalid negative discounts (Code: ${originalDiscountCodeValue}, Manual: ${originalManualDiscount}). Please contact support.`
            );
          }

          const discountCodeValue = Number(
            (originalDiscountCodeValue * proportionRemaining).toFixed(2)
          );
          const manualDiscount = Number(
            (originalManualDiscount * proportionRemaining).toFixed(2)
          );

          // Log proportional discount reduction if any order-level discounts exist
          if (originalDiscountCodeValue > 0 || originalManualDiscount > 0) {
            this.logger.debug(
              `[BULK_ANNUL_ITEMS] Proportionally reducing order-level discounts for order ${order.orderNumber}: ` +
                `Subtotal ${originalSubtotal} → ${itemsSubtotal} (${(proportionRemaining * 100).toFixed(1)}% remaining), ` +
                `Discount Code ${originalDiscountCodeValue} → ${discountCodeValue}, ` +
                `Manual Discount ${originalManualDiscount} → ${manualDiscount}`
            );
          }

          const orderDiscount = Number(
            (discountCodeValue + manualDiscount).toFixed(2)
          );

          const totalDiscount = Number(
            (orderDiscount + itemsDiscountTotal).toFixed(2)
          );

          // Validate that discounts don't exceed subtotal (should not happen with proportional reduction)
          if (totalDiscount > itemsSubtotal) {
            throw new BadRequestException(
              `Total discount ($${totalDiscount.toFixed(2)}) exceeds subtotal ($${itemsSubtotal.toFixed(2)}) after annulment. This should not happen with proportional discount reduction.`
            );
          }

          const subtotalAfterDiscounts = Number(
            (itemsSubtotal - totalDiscount).toFixed(2)
          );

          const itemsTaxTotal = Number(
            activeItems
              .reduce((sum, item) => sum + (item.taxAmount || 0), 0)
              .toFixed(2)
          );

          let taxes = 0;
          if (order.includeTax) {
            taxes =
              itemsTaxTotal > 0
                ? itemsTaxTotal
                : Number(
                    (subtotalAfterDiscounts * DEFAULT_TAX_RATE).toFixed(2)
                  );
          }

          const totalAmount = Number(
            (subtotalAfterDiscounts + taxes).toFixed(2)
          );

          // Validate that total amount is not negative
          if (totalAmount < 0) {
            throw new BadRequestException(
              "Order total cannot be negative after annulment. Please check the annulment quantities and order-level discounts."
            );
          }

          // Check if all items are annulled and auto-annul the order
          if (itemsSubtotal === 0) {
            this.logger.warn(
              `[BULK_ANNUL_ITEMS] All items have been annulled in order ${order.orderNumber}. Auto-annulling order.`
            );
          }

          // Update order totals with proportionally reduced order-level discounts
          // If all items are annulled, mark the order as ANNULLED
          const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
              subtotal: new Prisma.Decimal(itemsSubtotal),
              taxes: new Prisma.Decimal(taxes),
              totalAmount: new Prisma.Decimal(totalAmount),
              itemsDiscountTotal: new Prisma.Decimal(itemsDiscountTotal),
              discountAmount: new Prisma.Decimal(totalDiscount),
              discountCodeValue: new Prisma.Decimal(discountCodeValue),
              manualDiscount: new Prisma.Decimal(manualDiscount),
              status: itemsSubtotal === 0 ? "ANNULLED" : order.status,
            },
            include: {
              orderItems: {
                include: {
                  productVariant: {
                    include: {
                      product: {
                        include: {
                          kitItems: { include: { productVariant: true } },
                        },
                      },
                    },
                  },
                  product: true,
                  priceType: true,
                },
              },
              customer: {
                include: {
                  person: true,
                },
              },
              seller: {
                include: {
                  person: true,
                },
              },
              cashier: {
                include: {
                  person: true,
                },
              },
              branch: true,
              location: true,
              payments: true,
              credit: {
                include: {
                  installments: {
                    orderBy: { installmentNo: "asc" },
                  },
                },
              },
              cashSession: true,
              discountCode: true,
              adjustments: {
                orderBy: { createdAt: "desc" },
              },
            },
          });

          if (itemsSubtotal === 0 && order.credit) {
            await this.annulCreditForFullyVoidedOrder(tx, orderId);
          }

          this.logger.log(
            `[BULK_ANNUL_ITEMS] Successfully annulled ${dto.items.length} items from order ${order.orderNumber}`
          );

          return this.mapToDto(updatedOrder);
        },
        {
          maxWait: 10000,
          timeout: 30000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      )
    );
  }

  /**
   * Approve a pending order - create stock movements, increment discount code usage, and update credit status
   */
  async approve(orderId: string, userId?: string): Promise<OrderDto> {
    this.logger.log(`[APPROVE] Approving order: ${orderId}`);

    return await this.prisma.$transaction(
      async tx => {
        // 1. Get order with all related data
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            orderItems: {
              include: {
                productVariant: {
                  include: {
                    product: {
                      include: {
                        kitItems: { include: { productVariant: true } },
                      },
                    },
                  },
                },
              },
            },
            customer: {
              include: {
                person: true,
              },
            },
            seller: {
              include: {
                person: true,
              },
            },
            cashier: {
              include: {
                person: true,
              },
            },
            branch: true,
            location: true,
            payments: true,
            credit: true,
          },
        });

        if (!order) {
          throw new NotFoundException("Order not found");
        }

        if (order.status !== "PENDING") {
          throw new BadRequestException(
            `Order cannot be approved. Current status: ${order.status}`
          );
        }

        // 2. Create stock movements for all items in batch
        // A. Log warnings for invalid items (Missing IDs)
        const invalidItems = order.orderItems.filter(
          item => !item.productVariantId || !item.productId
        );

        for (const item of invalidItems) {
          this.logger.warn(
            `[APPROVE] Skipping item ${item.id} - missing productVariantId or productId`
          );
        }

        // B. Filter only valid items to process
        const validItems = order.orderItems.filter(
          (
            item
          ): item is typeof item & {
            productVariantId: string;
            productId: string;
          } => !!(item.productVariantId && item.productId)
        );

        if (validItems.length > 0) {
          const stockMovementDtos: CreateStockMovementDto[] = [];

          for (const item of validItems) {
            const variant = item.productVariant;
            const isKit = variant?.product?.type === ProductType.KIT;
            const kitItems = variant?.product?.kitItems || [];

            if (isKit && kitItems.length > 0) {
              // Atomic kit movements: one loop per sold kit unit
              for (
                let kitUnitIndex = 0;
                kitUnitIndex < item.quantity;
                kitUnitIndex++
              ) {
                for (const kitItem of kitItems) {
                  if (!kitItem.productVariant) {
                    throw new BadRequestException(
                      `Kit component missing variant for order item ${item.id}`
                    );
                  }
                  const componentProductId = kitItem.productVariant.productId;
                  if (!componentProductId) {
                    throw new BadRequestException(
                      `Kit component missing productId for variant ${kitItem.productVariantId}`
                    );
                  }

                  stockMovementDtos.push({
                    productVariantId: kitItem.productVariantId,
                    productId: componentProductId,
                    fromLocationId: order.locationId,
                    toLocationId: null,
                    movementType: StockMovementType.SALE,
                    quantity: Number(kitItem.quantity),
                    reference: order.orderNumber,
                    note: `Venta de Kit: ${variant.product?.name} (#${kitUnitIndex + 1}/${item.quantity}) | Component: ${kitItem.productVariant.name} | Ref. ${order.orderNumber}`,
                    metadata: {
                      orderId: order.id,
                      orderItemId: item.id,
                      parentKitVariantId: variant.id,
                      kitInstanceIndex: kitUnitIndex + 1,
                      kitTotalInstances: item.quantity,
                    },
                  });
                }
              }
            } else {
              // Standard product - simple stock movement
              stockMovementDtos.push({
                productVariantId: item.productVariantId,
                productId: item.productId,
                fromLocationId: order.locationId,
                toLocationId: null,
                movementType: StockMovementType.SALE,
                quantity: item.quantity,
                reference: order.orderNumber,
                note: `Producto Standard: ${variant?.product?.name} | Ref. ${order.orderNumber}`,
                metadata: {
                  orderId: order.id,
                  orderItemId: item.id,
                },
              });
            }
          }

          if (stockMovementDtos.length > 0) {
            const orderMetadata = order.metadata as {
              consumeReservation?: boolean;
              quoteReservationReleasedOnConvert?: boolean;
              fromQuoteId?: string;
            } | null;
            const shouldConsumeReservation =
              orderMetadata?.consumeReservation === true;
            const reservationAlreadyReleased =
              orderMetadata?.quoteReservationReleasedOnConvert === true;

            const quoteIdForReservationRelease = orderMetadata?.fromQuoteId;
            const releaseQuoteReservationBeforeSale =
              shouldConsumeReservation &&
              !reservationAlreadyReleased &&
              Boolean(quoteIdForReservationRelease);

            if (
              releaseQuoteReservationBeforeSale &&
              quoteIdForReservationRelease
            ) {
              await this.releaseQuoteReservationForApprovedQuote(
                tx,
                quoteIdForReservationRelease,
                order.locationId
              );
            }

            const alsoReleaseReserved =
              shouldConsumeReservation &&
              !reservationAlreadyReleased &&
              !orderMetadata?.fromQuoteId;

            await this.stockMovementsService.createSaleOrderMovements(
              stockMovementDtos,
              tx,
              userId,
              { alsoReleaseReserved }
            );
          }
        }

        // 3. Increment discount code usage if applicable
        if (order.discountCodeId && order.customerId) {
          const customerDiscountCode = await tx.customerDiscountCode.findFirst({
            where: {
              customerId: order.customerId,
              discountCodeId: order.discountCodeId,
              isDeleted: false,
            },
            include: {
              discountCode: true,
            },
          });

          if (customerDiscountCode) {
            const updatedUsageCount =
              (customerDiscountCode.usageCount || 0) + 1;
            const usageLimit =
              customerDiscountCode.discountCode?.usageLimit || 0;
            const isRedeemed =
              usageLimit > 0 && updatedUsageCount >= usageLimit;
            const redeemedAt = isRedeemed ? new Date() : null;

            await tx.customerDiscountCode.update({
              where: {
                id: customerDiscountCode.id,
              },
              data: {
                usageCount: updatedUsageCount,
                isRedeemed: isRedeemed,
                redeemedAt: redeemedAt,
              },
            });

            this.logger.debug(
              `[APPROVE] Incremented usageCount for customer discount code`
            );
          }
        }

        // 4. Update credit status to ACTIVE if order has a credit
        if (order.credit) {
          await tx.credit.update({
            where: { id: order.credit.id },
            data: { status: CreditStatus.ACTIVE },
          });

          this.logger.debug(
            `[APPROVE] Updated credit status to ACTIVE for credit ${order.credit.id}`
          );
        }

        // 5. Update order status to APPROVED
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: "APPROVED",
          },
          include: {
            customer: {
              include: {
                person: true,
              },
            },
            seller: {
              include: {
                person: true,
              },
            },
            cashier: {
              include: {
                person: true,
              },
            },
            branch: true,
            location: true,
            orderItems: {
              include: {
                productVariant: {
                  include: {
                    product: {
                      include: {
                        brand: true,
                        kitItems: { include: { productVariant: true } },
                      },
                    },
                  },
                },
              },
            },
            payments: true,
          },
        });

        this.logger.log(
          `[APPROVE] Order ${order.orderNumber} approved successfully`
        );

        return this.mapToDto(updatedOrder);
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
        timeout: 30000, // Maximum time the transaction can run (30 seconds)
      }
    );
  }

  /**
   * Find order by ID
   */
  async findOne(orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderFullInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.mapToDto(order);
  }

  /**
   * Map order to DTO
   */
  private mapToDto(order: OrderForDto): OrderDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      branchId: order.branchId,
      locationId: order.locationId,
      sellerId: order.sellerId,
      cashierId: order.cashierId,
      discountCodeId: order.discountCodeId,
      discountCodeValue: order.discountCodeValue
        ? Number(order.discountCodeValue)
        : 0,
      manualDiscount: order.manualDiscount ? Number(order.manualDiscount) : 0,
      itemsDiscountTotal: order.itemsDiscountTotal
        ? Number(order.itemsDiscountTotal)
        : 0,
      discountAmount: order.discountAmount ? Number(order.discountAmount) : 0,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      subtotal: Number(order.subtotal),
      taxes: order.taxes ? Number(order.taxes) : 0,
      includeTax: order.includeTax,
      paymentMethod: order.paymentMethod || "CASH",
      createdAt: order.createdAt,
      metadata: order.metadata,
      items: order.orderItems?.map((item: any) => ({
        id: item.id,
        productVariantId: item.productVariantId,
        productId: item.productId,
        priceTypeId: item.priceTypeId || undefined,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountAmount: item.discountAmount ? Number(item.discountAmount) : 0,
        taxAmount: item.taxAmount ? Number(item.taxAmount) : 0,
        lineTotal: Number(item.lineTotal),
        annulledQuantity: item.annulledQuantity || 0,
        annulledAmount: item.annulledAmount ? Number(item.annulledAmount) : 0,
        annulledAt: item.annulledAt || null,
        annulledBy: item.annulledBy || null,
        annulmentReason: item.annulmentReason || null,
        annulments:
          item.annulments?.map((annulment: any) => ({
            id: annulment.id,
            quantity: annulment.quantity,
            amount: Number(annulment.amount),
            reason: annulment.reason || null,
            createdAt: annulment.createdAt,
            createdBy: annulment.createdBy,
            creator: annulment.creator
              ? {
                  id: annulment.creator.id,
                  name: annulment.creator.employees?.[0]?.person
                    ? `${annulment.creator.employees[0].person.firstName} ${
                        annulment.creator.employees[0].person.lastName || ""
                      }`.trim()
                    : annulment.creator.email || "Unknown",
                }
              : null,
          })) || [],
        productVariant: item.productVariant
          ? {
              id: item.productVariant.id,
              name: item.productVariant.name,
              type: item.productVariant.product?.type,
              sku: item.productVariant.sku,
              barcode: item.productVariant.barcode,
              product: item.productVariant.product
                ? {
                    id: item.productVariant.product.id,
                    name: item.productVariant.product.name,
                    brand: item.productVariant.product.brand
                      ? {
                          id: item.productVariant.product.brand.id,
                          name: item.productVariant.product.brand.name,
                        }
                      : null,
                    kitItems:
                      item.productVariant.product.kitItems?.map(
                        (kitItem: any) => ({
                          id: kitItem.id,
                          quantity: Number(kitItem.quantity),
                          productVariantId: kitItem.productVariantId ?? null,
                          productVariant: kitItem.productVariant
                            ? {
                                id: kitItem.productVariant.id,
                                name: kitItem.productVariant.name,
                                sku: kitItem.productVariant.sku,
                              }
                            : null,
                        })
                      ) || [],
                  }
                : null,
            }
          : null,
      })),
      payments: order.payments?.map((payment: any) => ({
        id: payment.id,
        paymentType: payment.paymentType,
        provider: payment.provider,
        amount: Number(payment.amount),
        transactionReference: payment.transactionReference,
        creditInstallmentId: payment.creditInstallmentId,
        paidAt: payment.paidAt,
        status: payment.status,
        reversedAt: payment.reversedAt,
      })),
      customer: order.customer
        ? {
            id: order.customer.id,
            name: `${order.customer.person.firstName} ${
              order.customer.person.lastName || ""
            }`.trim(),
            email: order.customer.person.email,
            phone: order.customer.person.phone,
          }
        : null,
      seller: order.seller
        ? {
            id: order.seller.id,
            name: `${order.seller.person.firstName} ${
              order.seller.person.lastName || ""
            }`.trim(),
          }
        : null,
      cashier: order.cashier
        ? {
            id: order.cashier.id,
            name: `${order.cashier.person.firstName} ${
              order.cashier.person.lastName || ""
            }`.trim(),
          }
        : null,
      location: order.location
        ? {
            id: order.location.id,
            name: order.location.name,
          }
        : null,
      branch: order.branch
        ? {
            id: order.branch.id,
            name: order.branch.name,
          }
        : null,
      cashSession: order.cashSession
        ? {
            id: order.cashSession.id,
            status: order.cashSession.status,
            closedAt: order.cashSession.closedAt,
          }
        : null,
      credit: order.credit
        ? {
            id: order.credit.id,
            creditType: order.credit.creditType,
            paymentFrequency: order.credit.paymentFrequency,
            durationDays: order.credit.durationDays,
            installmentCount: order.credit.installmentCount,
            principalAmount: Number(order.credit.principalAmount),
            outstandingAmount: Number(order.credit.outstandingAmount),
            firstDueDate: order.credit.firstDueDate,
            lastDueDate: order.credit.lastDueDate,
            status: order.credit.status,
            installments:
              order.credit.installments?.map((inst: any) => ({
                id: inst.id,
                installmentNo: inst.installmentNo,
                dueDate: inst.dueDate,
                amount: Number(inst.amount),
                paidAmount: Number(inst.paidAmount),
                status: inst.status,
              })) || [],
          }
        : null,
      adjustments:
        order.adjustments?.map((adjustment: any) => ({
          id: adjustment.id,
          type: adjustment.type,
          amount: Number(adjustment.amount),
          reason: adjustment.reason || null,
          createdAt: adjustment.createdAt,
          createdBy: adjustment.createdBy,
          creator: adjustment.creator
            ? {
                id: adjustment.creator.id,
                name: adjustment.creator.employees?.[0]?.person
                  ? `${adjustment.creator.employees[0].person.firstName} ${
                      adjustment.creator.employees[0].person.lastName || ""
                    }`.trim()
                  : adjustment.creator.email || "Unknown",
              }
            : null,
        })) || [],
    };
  }

  // Export data for receipt PDF generation
  // Exclude annulled items and calculate effective quantities and totals
  async getReceiptPdfData(orderId: string): Promise<ReceiptPdfData> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { include: { person: true } },
        seller: { include: { person: true } },
        cashier: { include: { person: true } },
        branch: true,
        location: true,
        orderItems: {
          include: {
            productVariant: {
              include: {
                product: {
                  include: {
                    brand: true,
                    kitItems: {
                      include: {
                        productVariant: {
                          include: { product: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Check if order is annulled
    const isOrderAnnulled = order.status === "ANNULLED";
    // Filter out annulled quantities and calculate effective totals for each item
    const activeItems = order.orderItems
      .map(item => {
        // If order is annulled show all items with original quantities, else calculate effective quantity
        const qtyToShow = isOrderAnnulled
          ? item.quantity
          : item.quantity - (item.annulledQuantity || 0);

        // If there is no quantity to show and order is not fully annulled, skip the item
        if (qtyToShow <= 0 && !isOrderAnnulled) return null;

        const variant = item.productVariant;
        const product = variant?.product;

        const parentName = product?.name ?? "";
        const variantName = variant?.name ?? "";
        const variantSku = variant?.sku ?? "";

        const formattedProductName =
          `${parentName} - ${variantName} - ${variantSku}`.trim();

        return {
          parentName: parentName,
          parentSku: product?.sku ?? variantSku,
          variantName: variantName,
          sku: variantSku,
          name: formattedProductName,
          quantity: qtyToShow,
          unitPrice: Number(item.unitPrice),
          discountAmount: item.discountAmount ? Number(item.discountAmount) : 0,
          totalPrice:
            Number(item.unitPrice) * qtyToShow -
            (item.discountAmount
              ? Number(item.discountAmount) * (qtyToShow / item.quantity || 1)
              : 0),
          isKit: product?.type === ProductType.KIT,
          kitItems:
            product?.type === ProductType.KIT
              ? product?.kitItems?.map(kitItem => ({
                  name: kitItem.productVariant?.name ?? "Componente",
                  sku: kitItem.productVariant?.sku ?? undefined,
                  quantity: Number(kitItem.quantity),
                  totalQuantity: qtyToShow * Number(kitItem.quantity),
                })) || []
              : undefined,
        };
      })
      .filter(item => item !== null);

    return {
      companyName: "Esli Cosmetics",
      branchName: order.branch ? order.branch.name : "",
      locationName: order.location ? order.location.name : "",
      orderNumber: isOrderAnnulled
        ? `${order.orderNumber} - ORDEN ANULADA`
        : order.orderNumber,
      date: order.createdAt ? order.createdAt.toISOString() : "",
      cashier: order.cashier
        ? `${order.cashier.person.firstName} ${order.cashier.person.lastName}`.trim()
        : "",
      seller: order.seller
        ? `${order.seller.person.firstName} ${order.seller.person.lastName}`.trim()
        : "",
      customer: order.customer
        ? `${order.customer.person.firstName} ${order.customer.person.lastName}`.trim()
        : "",
      items: activeItems as any, // using filtered and mapped items
      subtotal: Number(order.subtotal),
      itemsDiscountTotal: Number(order.itemsDiscountTotal ?? 0),
      discountCodeValue: order.discountCodeValue
        ? Number(order.discountCodeValue)
        : undefined,
      manualDiscount: Number(order.manualDiscount ?? 0),
      totalDiscount: Number(order.discountAmount ?? 0),
      taxes: Number(order.taxes ?? 0),
      totalAmount: Number(order.totalAmount),
      payments: order.payments.map(p => ({
        paymentType: p.paymentType,
        amount: Number(p.amount),
      })),
      thankYouMessage: "¡Gracias por su compra!",
      contactMessage: "Para consultas, contáctenos.",
      receiptType: order.paymentMethod as "CREDIT" | "CASH",
    };
  }

  /**
   * Validate credit limit for customer
   * Optimized: Fetches customer and active credits in a single query
   */
  private async validateCreditLimit(
    customerId: string,
    orderTotal: number,
    tx: any
  ): Promise<{
    isWithinLimit: boolean;
    creditLimit: number | null;
    currentOutstanding: number;
  }> {
    // Get customer with active credits in a single query
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: {
        creditAllowed: true,
        creditLimit: true,
        credits: {
          where: {
            status: {
              in: [CreditStatus.ACTIVE, CreditStatus.PENDING],
            },
          },
          select: {
            outstandingAmount: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (!customer.creditAllowed) {
      throw new BadRequestException("Customer does not have credit allowed");
    }

    const creditLimit = customer.creditLimit
      ? Number(customer.creditLimit)
      : null;

    if (!creditLimit) {
      // No credit limit set, allow the order
      return {
        isWithinLimit: true,
        creditLimit: null,
        currentOutstanding: 0,
      };
    }

    // Calculate current outstanding amount from active credits (already fetched)
    const currentOutstanding = customer.credits.reduce(
      (sum: number, credit: any) => sum + Number(credit.outstandingAmount),
      0
    );

    const totalWithNewOrder = currentOutstanding + orderTotal;
    const isWithinLimit = totalWithNewOrder <= creditLimit;

    return {
      isWithinLimit,
      creditLimit,
      currentOutstanding,
    };
  }

  /**
   * Calculate installment count based on duration and frequency
   */
  private calculateInstallmentCount(
    durationDays: number,
    frequency: PaymentFrequency
  ): number {
    switch (frequency) {
      case "WEEKLY":
        return Math.floor(durationDays / 7);
      case "BI_WEEKLY":
        return Math.floor(durationDays / 15);
      case "MONTHLY":
        return Math.floor(durationDays / 30);
      default:
        throw new BadRequestException(
          `Invalid payment frequency: ${frequency}`
        );
    }
  }

  /**
   * Generate credit installments
   */
  private async generateCreditInstallments(
    creditId: string,
    principalAmount: number,
    installmentCount: number,
    frequency: PaymentFrequency,
    firstDueDate: Date,
    tx: any
  ): Promise<void> {
    const installmentAmount = Number(
      (principalAmount / installmentCount).toFixed(2)
    );
    const remainder = Number(
      (principalAmount - installmentAmount * installmentCount).toFixed(2)
    );

    const installments: Array<{
      creditId: string;
      installmentNo: number;
      dueDate: Date;
      amount: number;
      paidAmount: number;
      status: string;
    }> = [];

    for (let i = 0; i < installmentCount; i++) {
      const installmentNo = i + 1;
      let dueDate: Date;

      if (i === 0) {
        dueDate = new Date(firstDueDate);
      } else {
        const previousDueDate = installments[i - 1]?.dueDate || firstDueDate;
        dueDate = this.calculateNextDueDate(previousDueDate, frequency);
      }

      // Add remainder to the last installment
      const amount =
        i === installmentCount - 1
          ? installmentAmount + remainder
          : installmentAmount;

      installments.push({
        creditId,
        installmentNo,
        dueDate,
        amount: Number(amount.toFixed(2)),
        paidAmount: 0,
        status: CreditInstallmentStatus.PENDING,
      });
    }

    // Create all installments
    await tx.creditInstallment.createMany({
      data: installments,
    });
  }

  /**
   * Calculate next due date based on frequency
   */
  private calculateNextDueDate(
    currentDate: Date,
    frequency: PaymentFrequency
  ): Date {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case "WEEKLY":
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case "BI_WEEKLY":
        nextDate.setDate(nextDate.getDate() + 15);
        break;
      case "MONTHLY": {
        // Add one month, handling month-end correctly
        const month = nextDate.getMonth();
        const year = nextDate.getFullYear();
        const day = nextDate.getDate();

        // Calculate next month
        let nextMonth = month + 1;
        let nextYear = year;

        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear = year + 1;
        }

        // Get the last day of the next month
        const lastDayOfNextMonth = new Date(
          nextYear,
          nextMonth + 1,
          0
        ).getDate();

        // Set the day, but don't exceed the last day of the month
        nextDate.setFullYear(
          nextYear,
          nextMonth,
          Math.min(day, lastDayOfNextMonth)
        );
        break;
      }
      default:
        throw new BadRequestException(
          `Invalid payment frequency: ${frequency}`
        );
    }

    return nextDate;
  }

  /**
   * Calculate last due date based on first due date, installment count, and frequency
   */
  private calculateLastDueDate(
    firstDueDate: Date,
    installmentCount: number,
    frequency: PaymentFrequency
  ): Date {
    if (installmentCount <= 1) {
      return new Date(firstDueDate);
    }

    // Calculate the last due date by adding (installmentCount - 1) intervals
    let lastDueDate = new Date(firstDueDate);

    for (let i = 1; i < installmentCount; i++) {
      lastDueDate = this.calculateNextDueDate(lastDueDate, frequency);
    }

    return lastDueDate;
  }

  /**
   * Pay a credit installment
   */
  async payInstallment(
    dto: PayInstallmentDto,
    userId?: string
  ): Promise<OrderDto> {
    return await this.prisma.$transaction(
      async tx => {
        // Get installment with credit and order
        const installment = await tx.creditInstallment.findUnique({
          where: { id: dto.installmentId },
          include: {
            credit: {
              include: {
                order: {
                  include: {
                    customer: true,
                  },
                },
              },
            },
          },
        });

        if (!installment) {
          throw new NotFoundException("Installment not found");
        }

        // Validate that the order is APPROVED
        if (installment.credit.order.status !== "APPROVED") {
          throw new BadRequestException(
            `Order cannot be paid. Only approved orders can be paid. Current status: ${installment.credit.order.status}`
          );
        }

        // Validate that the installment is not annulled
        if (installment.status === CreditInstallmentStatus.ANNULLED) {
          throw new BadRequestException("Cannot pay an annulled installment");
        }

        const remainingAmount =
          Number(installment.amount) - Number(installment.paidAmount);

        // Round to 2 decimal places to avoid floating-point precision issues
        const roundedRemainingAmount = Math.round(remainingAmount * 100) / 100;
        const roundedPaymentAmount = Math.round(dto.amount * 100) / 100;

        if (roundedPaymentAmount > roundedRemainingAmount) {
          throw new BadRequestException(
            `Payment amount (${roundedPaymentAmount}) exceeds remaining amount (${roundedRemainingAmount})`
          );
        }

        if (dto.amount <= 0) {
          throw new BadRequestException(
            "Payment amount must be greater than 0"
          );
        }

        // Update installment paid amount
        const newPaidAmount = new Decimal(
          Number(installment.paidAmount) + dto.amount
        );
        const installmentAmount = new Decimal(Number(installment.amount));

        let newStatus: CreditInstallmentStatus;
        if (newPaidAmount.gte(installmentAmount)) {
          newStatus = CreditInstallmentStatus.PAID;
        } else {
          newStatus = CreditInstallmentStatus.PARTIAL;
        }

        // Update installment
        await tx.creditInstallment.update({
          where: { id: dto.installmentId },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
          },
        });

        // Create payment record
        const createdPayment = await tx.payment.create({
          data: {
            creditInstallmentId: dto.installmentId,
            orderId: installment.credit.orderId,
            customerId: installment.credit.order.customerId,
            paymentType: dto.paymentType,
            provider: dto.provider,
            amount: dto.amount,
            transactionReference: dto.transactionReference,
            createdBy: userId,
          },
        });
        await tx.paymentAllocation.create({
          data: {
            paymentId: createdPayment.id,
            targetType: PaymentAllocationTargetType.INSTALLMENT,
            creditInstallmentId: dto.installmentId,
            amount: new Decimal(dto.amount),
          },
        });

        // Update credit outstanding amount
        const credit = await tx.credit.findUnique({
          where: { id: installment.creditId },
        });

        if (credit) {
          const newOutstanding = new Decimal(
            Math.max(0, Number(credit.outstandingAmount) - dto.amount)
          );
          const newCreditStatus = newOutstanding.lte(0)
            ? CreditStatus.PAID
            : credit.status === CreditStatus.PENDING
              ? CreditStatus.ACTIVE
              : credit.status;

          await tx.credit.update({
            where: { id: installment.creditId },
            data: {
              outstandingAmount: newOutstanding,
              status: newCreditStatus,
            },
          });

          // If credit is fully paid, update order status to COMPLETED
          if (newOutstanding.lte(0)) {
            await tx.order.update({
              where: { id: installment.credit.orderId },
              data: {
                status: "COMPLETED",
              },
            });
          }
        }

        // Return updated order - use tx to read within the transaction
        const updatedOrder = await tx.order.findUnique({
          where: { id: installment.credit.orderId },
          include: orderFullInclude,
        });

        return this.mapToDto(updatedOrder!);
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
        timeout: 30000, // Maximum time the transaction can run (30 seconds)
      }
    );
  }

  /**
   * Pay entire order (all pending/partial/overdue installments)
   */
  async payOrder(
    orderId: string,
    dto: PayOrderDto,
    userId?: string
  ): Promise<OrderDto> {
    return await this.prisma.$transaction(
      async tx => {
        // Get order with credit and installments
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            credit: {
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
                  orderBy: {
                    installmentNo: "asc",
                  },
                },
              },
            },
          },
        });

        if (!order) {
          throw new NotFoundException("Order not found");
        }

        if (!order.credit) {
          throw new BadRequestException("Order does not have credit");
        }

        // Validate that the order is APPROVED
        if (order.status !== "APPROVED") {
          throw new BadRequestException(
            `Order cannot be paid. Only approved orders can be paid. Current status: ${order.status}`
          );
        }

        // Compute outstanding from installments (single source of truth for validation)
        const computedOutstanding = order.credit.installments.reduce(
          (sum, inst) => {
            const remaining = Number(inst.amount) - Number(inst.paidAmount);
            return sum + Math.max(0, remaining);
          },
          0
        );
        const roundedOutstanding = Math.round(computedOutstanding * 100) / 100;

        // Total payment from request
        const totalPayment = dto.payments.reduce((sum, p) => sum + p.amount, 0);
        const roundedTotalPayment = Math.round(totalPayment * 100) / 100;

        if (roundedTotalPayment <= 0) {
          throw new BadRequestException(
            "Payment amount must be greater than 0"
          );
        }

        if (roundedTotalPayment > roundedOutstanding) {
          throw new BadRequestException(
            `Total payment (${roundedTotalPayment}) exceeds outstanding amount (${roundedOutstanding})`
          );
        }

        // Allow partial payments - allocate using waterfall logic
        // Track remaining amounts per payment method to preserve correct paymentType attribution
        const paymentMethodsRemaining = dto.payments.map(p => ({
          ...p,
          remaining: p.amount,
        }));

        // Process payments for each installment
        let remainingPayment = totalPayment;
        for (const installment of order.credit.installments) {
          if (remainingPayment <= 0) break;

          const remainingAmount =
            Number(installment.amount) - Number(installment.paidAmount);
          if (remainingAmount <= 0) continue;

          const paymentAmount = Math.min(remainingPayment, remainingAmount);

          // Distribute this installment's payment across payment methods in order
          let installmentRemaining = paymentAmount;
          for (const pm of paymentMethodsRemaining) {
            if (installmentRemaining <= 0 || pm.remaining <= 0) continue;

            const amountFromMethod = Math.min(
              installmentRemaining,
              pm.remaining
            );
            pm.remaining -= amountFromMethod;
            installmentRemaining -= amountFromMethod;

            const createdPayment = await tx.payment.create({
              data: {
                creditInstallmentId: installment.id,
                orderId: orderId,
                customerId: order.customerId,
                paymentType: pm.paymentType,
                provider: pm.provider,
                amount: amountFromMethod,
                transactionReference: pm.transactionReference,
                createdBy: userId,
              },
            });
            await tx.paymentAllocation.create({
              data: {
                paymentId: createdPayment.id,
                targetType: PaymentAllocationTargetType.INSTALLMENT,
                creditInstallmentId: installment.id,
                amount: new Decimal(amountFromMethod),
              },
            });
          }

          const newPaidAmount = new Decimal(
            Number(installment.paidAmount) + paymentAmount
          );
          const installmentAmount = new Decimal(Number(installment.amount));

          const newStatus = newPaidAmount.gte(installmentAmount)
            ? CreditInstallmentStatus.PAID
            : CreditInstallmentStatus.PARTIAL;

          await tx.creditInstallment.update({
            where: { id: installment.id },
            data: {
              paidAmount: newPaidAmount,
              status: newStatus,
            },
          });

          remainingPayment -= paymentAmount;
        }

        // Update credit outstanding amount
        const credit = await tx.credit.findUnique({
          where: { id: order.credit!.id },
        });

        if (credit) {
          const amountPaid = totalPayment - remainingPayment;
          const newOutstanding = new Decimal(
            Math.max(0, Number(credit.outstandingAmount) - amountPaid)
          );
          const newCreditStatus = newOutstanding.lte(0)
            ? CreditStatus.PAID
            : credit.status === CreditStatus.PENDING
              ? CreditStatus.ACTIVE
              : credit.status;

          await tx.credit.update({
            where: { id: order.credit!.id },
            data: {
              outstandingAmount: newOutstanding,
              status: newCreditStatus,
            },
          });
        }

        // Update order status to COMPLETED only if credit is fully paid
        const updatedCredit = await tx.credit.findUnique({
          where: { id: order.credit!.id },
        });
        if (updatedCredit && Number(updatedCredit.outstandingAmount) <= 0) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: "COMPLETED",
            },
          });
        }

        // Return updated order - use findOne to get fresh data with all relations
        const updatedOrder = await tx.order.findUnique({
          where: { id: orderId },
          include: orderFullInclude,
        });

        return this.mapToDto(updatedOrder!);
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
        timeout: 30000, // Maximum time the transaction can run (30 seconds)
      }
    );
  }

  /**
   * Get receipt PDF data for an installment payment
   */
  async getInstallmentReceiptPdfData(
    installmentId: string
  ): Promise<ReceiptPdfData> {
    const installment = await this.prisma.creditInstallment.findUnique({
      where: { id: installmentId },
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
                orderItems: {
                  include: {
                    productVariant: {
                      include: {
                        product: {
                          include: {
                            brand: true,
                            kitItems: { include: { productVariant: true } },
                          },
                        },
                      },
                    },
                  },
                },
                payments: {
                  where: {
                    creditInstallmentId: installmentId,
                  },
                  orderBy: {
                    paidAt: "desc",
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!installment) {
      throw new NotFoundException("Installment not found");
    }

    const order = installment.credit.order;
    const payment = order.payments[0];

    return {
      companyName: "Esli Cosmetics",
      branchName: order.branch ? order.branch.name : "",
      locationName: order.location ? order.location.name : "",
      orderNumber: `${order.orderNumber}-INST-${installment.installmentNo}`,
      date: payment ? payment.paidAt.toISOString() : new Date().toISOString(),
      cashier: order.cashier
        ? `${order.cashier.person.firstName} ${order.cashier.person.lastName}`.trim()
        : "",
      seller: order.seller
        ? `${order.seller.person.firstName} ${order.seller.person.lastName}`.trim()
        : "",
      customer: order.customer
        ? `${order.customer.person.firstName} ${order.customer.person.lastName}`.trim()
        : "",
      items: [
        {
          parentName: `Pago de Cuota ${installment.installmentNo}`,
          variantName: `Orden: ${order.orderNumber}`,
          name: `Cuota ${installment.installmentNo} - Orden ${order.orderNumber}`,
          quantity: 1,
          unitPrice: Number(installment.amount),
          discountAmount: 0,
          totalPrice: Number(installment.amount),
        },
      ],
      subtotal: Number(installment.amount),
      itemsDiscountTotal: 0,
      totalDiscount: 0,
      taxes: 0,
      totalAmount: Number(installment.amount),
      payments: payment
        ? [
            {
              paymentType: payment.paymentType,
              amount: Number(payment.amount),
              provider: payment.provider || undefined,
              transactionReference: payment.transactionReference || undefined,
              paidAt: payment.paidAt,
            },
          ]
        : [],
      thankYouMessage: "¡Gracias por su pago!",
      contactMessage: "Para consultas, contáctenos.",
      // receiptType: "CASH", // Payment receipts don't need "Monto Adeudado" and "Saldo pendiente" fields
    };
  }
}
