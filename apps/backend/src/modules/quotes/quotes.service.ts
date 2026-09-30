import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ProductType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NumberSequenceService } from "../number-sequence/number-sequence.service";
import { CreateOrderDto } from "../orders/dto/create-order.dto";
import { OrdersService } from "../orders/orders.service";
import { QuotePdfData, QuotePdfType } from "../reports/types/quote-types";
import { ConvertQuoteToOrderDto } from "./dto/convert-quote-to-order.dto";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { PaginatedQuotesDto, QuoteDto } from "./dto/quote.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";
import { zonedDayRangeToUtc } from "../../common/date-range/date-range.util";
import { DEFAULT_TAX_RATE } from "../../common/constants/tax";

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly numberSequenceService: NumberSequenceService
  ) {}

  private stockLevelTripletKey(
    productId: string | null | undefined,
    productVariantId: string | null | undefined,
    locationId: string
  ): string {
    return `${productId ?? "null"}-${productVariantId ?? "null"}-${locationId}`;
  }

  /**
   * Validates stock availability.
   * Formula (must match orders.service validateStockAvailability): available = physical - totalReserved + quoteReservation.
   * Returns a bundle of pre-calculated data to prevent redundant processing in subsequent methods.
   */
  private async validateStockAvailability(
    items: any[],
    locationId: string,
    tx: any,
    variantIdsToFetch?: string[],
    skipValidation: boolean = false,
    excludeQuoteId?: string
  ): Promise<{
    variantMap: Map<string, any>;
    variantQtyMap: Map<string, number>;
    stockLevelMap: Map<string, any>;
  }> {
    // 1. Bulk fetch variants and kit structures
    const variantIds =
      variantIdsToFetch || items.map(item => item.productVariantId);

    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: {
          include: {
            kitItems: { include: { productVariant: true } },
          },
        },
      },
    });

    const variantMap = new Map<string, any>(variants.map(v => [v.id, v]));

    // 2. Flatten requirements: Decompose Kits into individual components once
    const variantQtyMap = new Map<string, number>();

    for (const item of items) {
      const variant = variantMap.get(item.productVariantId);
      if (!variant) continue;

      const isKit = variant.product?.type === ProductType.KIT;
      const kitItems = variant.product?.kitItems || [];

      if (isKit && kitItems.length > 0) {
        for (const kitItem of kitItems) {
          const totalComponentQty = item.quantity * Number(kitItem.quantity);
          const currentTotal = variantQtyMap.get(kitItem.productVariantId) || 0;
          variantQtyMap.set(
            kitItem.productVariantId,
            currentTotal + totalComponentQty
          );
        }
      } else {
        const currentTotal = variantQtyMap.get(item.productVariantId) || 0;
        variantQtyMap.set(item.productVariantId, currentTotal + item.quantity);
      }
    }

    // 3. Ensure variantMap includes kit components referenced in variantQtyMap
    const missingVariantIds = Array.from(variantQtyMap.keys()).filter(
      id => !variantMap.has(id)
    );
    if (missingVariantIds.length > 0) {
      const kitComponentVariants = await tx.productVariant.findMany({
        where: { id: { in: missingVariantIds } },
        include: {
          product: {
            include: {
              kitItems: { include: { productVariant: true } },
            },
          },
        },
      });
      for (const v of kitComponentVariants) {
        variantMap.set(v.id, v);
      }
    }

    const whereConditions: Array<{
      productId: string;
      productVariantId: string;
      locationId: string;
    }> = [];

    for (const variantId of variantQtyMap.keys()) {
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
            select: {
              id: true,
              productId: true,
              productVariantId: true,
              quantity: true,
              reserved: true,
            },
          })
        : [];

    const stockLevelByTriplet = new Map<string, any>(
      stockLevels.map((sl: any) => [
        this.stockLevelTripletKey(
          sl.productId,
          sl.productVariantId,
          locationId
        ),
        sl,
      ])
    );

    const stockLevelMap = new Map<string, any>();
    for (const variantId of variantQtyMap.keys()) {
      const variant = variantMap.get(variantId);
      if (!variant?.productId) continue;
      const stockLevel = stockLevelByTriplet.get(
        this.stockLevelTripletKey(variant.productId, variantId, locationId)
      );
      if (stockLevel) {
        stockLevelMap.set(variantId, stockLevel);
      }
    }

    // 4. Validation using in-memory maps (O(N))
    if (!skipValidation) {
      // 4.1 Only for APPROVED quotes being edited: subtract this quote's reservation from "others".
      // DRAFT lines are not in stock_levels.reserved — using excludeQuoteId for DRAFT inflated availability.
      const alreadyReserved = new Map<string, number>();
      if (excludeQuoteId) {
        const currentItems = await tx.quoteItem.findMany({
          where: { quoteId: excludeQuoteId },
          include: {
            productVariant: {
              include: { product: { include: { kitItems: true } } },
            },
          },
        });
        // Decompose current quote items into their component requirements to calculate what is currently reserved by this quote.
        // Logic must match orders.service getReservedByQuoteMap and quote-page-client getReservedByQuoteMap.
        for (const ci of currentItems) {
          const isKit =
            ci.productVariant?.product?.type === ProductType.KIT &&
            (ci.productVariant?.product?.kitItems?.length ?? 0) > 0;
          if (isKit && ci.productVariant?.product?.kitItems) {
            for (const ki of ci.productVariant.product.kitItems) {
              const qty = ci.quantity * Number(ki.quantity);
              alreadyReserved.set(
                ki.productVariantId,
                (alreadyReserved.get(ki.productVariantId) || 0) + qty
              );
            }
          } else {
            alreadyReserved.set(
              ci.productVariantId,
              (alreadyReserved.get(ci.productVariantId) || 0) + ci.quantity
            );
          }
        }
      }

      for (const [variantId, requiredQty] of variantQtyMap.entries()) {
        const stockLevel = stockLevelMap.get(variantId);
        const physical = stockLevel ? Number(stockLevel.quantity) : 0;
        const totalReserved = stockLevel ? Number(stockLevel.reserved) : 0;

        // CRITICAL LOGIC: Available = Physical - (Reserved by others)
        // Reserved by others = Total Reserved - Reserved by this quote
        const quoteReservation = alreadyReserved.get(variantId) || 0;
        const reservedByOthers = totalReserved - quoteReservation;
        const availableForMe = physical - reservedByOthers;

        if (availableForMe < requiredQty) {
          const variantName = variantMap.get(variantId)?.name || "Unknown";
          throw new ConflictException(
            `Insufficient stock for component: ${variantName}. Available: ${availableForMe}, Requested: ${requiredQty}`
          );
        }
      }
    }
    return { variantMap, variantQtyMap, stockLevelMap };
  }

  /**
   * OPTIMIZED: Synchronizes inventory reservations using precomputed maps.
   * * - Prevents redundant kit decomposition by receiving flattened requirement maps.
   * - Eliminates N+1 read queries by using a pre-loaded stockLevelMap.
   * - Implements Delta Logic: (New Qty - Previous Qty) to handle updates, additions, and removals.
   * - Executes all database updates in parallel via Promise.all for maximum throughput.
   */
  private async reserveQuoteInventory(
    variantQtyMap: Map<string, number>,
    stockLevelMap: Map<string, any>,
    tx: any,
    existingVariantQtyMap?: Map<string, number>
  ): Promise<void> {
    const priorKeyCount = existingVariantQtyMap?.size ?? 0;
    this.logger.debug(
      `[RESERVE] Starting bulk inventory update (new keys: ${variantQtyMap.size}, prior keys: ${priorKeyCount})...`
    );

    const ids: string[] = [];
    const deltas: number[] = [];

    // 1. Calculate deltas in memory (O(N))
    // Union keys: removals drop out of variantQtyMap but must still release reservation
    // (previous-only variants need currentQty=0 → negative diff).
    const allVariantIds = new Set<string>([
      ...variantQtyMap.keys(),
      ...(existingVariantQtyMap?.keys() ?? []),
    ]);

    for (const variantId of allVariantIds) {
      const currentQty = variantQtyMap.get(variantId) || 0;
      const previousQty = existingVariantQtyMap?.get(variantId) || 0;
      const diff = currentQty - previousQty;

      if (diff === 0) continue;

      const stockLevel = stockLevelMap.get(variantId);
      if (!stockLevel) {
        if (diff > 0) {
          throw new BadRequestException(
            `No hay nivel de stock en esta ubicación para la variante ${variantId}. Cree el registro de stock en esta ubicación antes de reservar o aprobar la proforma.`
          );
        }
        this.logger.warn(
          `[RESERVE] Variant ${variantId} has no stock record; skipping release delta ${diff}.`
        );
        continue;
      }

      ids.push(stockLevel.id);
      deltas.push(diff);
    }

    if (ids.length === 0) return;

    // 2. Execute a SINGLE SQL QUERY to update the entire batch
    // This reduces 75 round-trips to just 1.
    await tx.$executeRaw`
      UPDATE stock_levels
      SET
        reserved = reserved + updates.delta,
        updated_at = NOW()
      FROM (
        SELECT
          unnest(${ids}::uuid[]) as id,
          unnest(${deltas}::numeric[]) as delta
      ) as updates
      WHERE stock_levels.id = updates.id
    `;

    this.logger.log(
      `[RESERVE] Synchronized ${ids.length} components in a single batch.`
    );
  }

  /**
   * Releases inventory reservations using a single Raw SQL query.
   * Reduces 50+ round-trips to exactly 1.
   */
  private async releaseQuoteInventory(
    variantsToReleaseMap: Map<string, number>,
    stockLevelMap: Map<string, any>,
    tx: any
  ): Promise<void> {
    const ids: string[] = [];
    const values: number[] = [];

    // 1. Get deltas in memory (O(N))
    for (const [variantId, qty] of variantsToReleaseMap.entries()) {
      if (qty <= 0) continue;
      const stockLevel = stockLevelMap.get(variantId);
      if (stockLevel) {
        ids.push(stockLevel.id);
        values.push(qty);
      }
    }

    if (ids.length === 0) return;

    const levels = await tx.stockLevel.findMany({
      where: { id: { in: ids } },
      select: { id: true, productVariantId: true, reserved: true },
    });
    const idToQty = new Map(
      ids.map((stockLevelId, i) => [stockLevelId, values[i]!])
    );
    for (const row of levels) {
      const qty = idToQty.get(row.id) ?? 0;
      const res = Number(row.reserved);
      if (qty > 0 && res < qty) {
        this.logger.warn(
          `[RELEASE-CLAMP] quote release: reserved=${res} releaseQty=${qty} stockLevelId=${row.id} variant=${row.productVariantId} — clamping to avoid negative reserved`
        );
      }
    }

    await tx.$executeRaw`
      UPDATE stock_levels
      SET
        reserved = GREATEST(0::numeric, reserved - updates.qty::numeric),
        updated_at = NOW()
      FROM (
        SELECT
          unnest(${ids}::uuid[]) as id,
          unnest(${values}::numeric[]) as qty
      ) as updates
      WHERE stock_levels.id = updates.id
    `;

    this.logger.log(
      `[RELEASE-BATCH] Released ${ids.length} reservations (GREATEST clamp).`
    );
  }

  /**
   * Loads stock_levels for the given variants at a specific location, keyed by
   * variantId. Reservation reconciliation needs this so that releases for
   * removed variants (and reservations after a location move) resolve to the
   * correct (productId, variantId, locationId) row, instead of silently
   * skipping rows that are absent from the current-items map.
   */
  private async loadStockLevelMapForVariants(
    variantIds: string[],
    variantMap: Map<string, any>,
    locationId: string,
    tx: Prisma.TransactionClient
  ): Promise<Map<string, { id: string }>> {
    const whereConditions: Array<{
      productId: string;
      productVariantId: string;
      locationId: string;
    }> = [];
    for (const variantId of variantIds) {
      const variant = variantMap.get(variantId);
      if (!variant?.productId) continue;
      whereConditions.push({
        productId: variant.productId,
        productVariantId: variantId,
        locationId,
      });
    }
    if (whereConditions.length === 0) return new Map();

    const stockLevels = await tx.stockLevel.findMany({
      where: { OR: whereConditions },
      select: { id: true, productId: true, productVariantId: true },
    });
    const byTriplet = new Map<string, { id: string }>(
      stockLevels.map((sl: any) => [
        this.stockLevelTripletKey(
          sl.productId,
          sl.productVariantId,
          locationId
        ),
        sl,
      ])
    );

    const map = new Map<string, { id: string }>();
    for (const variantId of variantIds) {
      const variant = variantMap.get(variantId);
      if (!variant?.productId) continue;
      const sl = byTriplet.get(
        this.stockLevelTripletKey(variant.productId, variantId, locationId)
      );
      if (sl) map.set(variantId, sl);
    }
    return map;
  }

  /**
   * Reconciles stock_levels.reserved for an APPROVED quote being edited.
   *
   * Two transactional scenarios:
   *  - Same location: applies per-variant deltas (current − previous). Variants
   *    removed from the quote (present in previous, absent in current) produce a
   *    negative delta and are released. The stock-level map covers the union of
   *    current ∪ previous variants so removals always resolve their row — this
   *    is the bug that previously left orphan reservations on removed lines.
   *  - Location changed: releases the ENTIRE previous reservation at the old
   *    location and reserves the full current requirement at the new location,
   *    so a moved proforma never leaves a reservation stranded behind.
   *
   * Must be called inside the update transaction (after the FOR UPDATE lock).
   */
  private async reconcileQuoteReservations(params: {
    previousVariantQtyMap: Map<string, number>;
    currentVariantQtyMap: Map<string, number>;
    variantMap: Map<string, any>;
    oldLocationId: string;
    newLocationId: string;
    wasAlreadyApproved: boolean;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    const {
      previousVariantQtyMap,
      currentVariantQtyMap,
      variantMap,
      oldLocationId,
      newLocationId,
      wasAlreadyApproved,
      tx,
    } = params;

    const locationChanged =
      wasAlreadyApproved && oldLocationId !== newLocationId;

    if (locationChanged) {
      // 1. Release everything previously reserved at the OLD location.
      const oldLevelMap = await this.loadStockLevelMapForVariants(
        Array.from(previousVariantQtyMap.keys()),
        variantMap,
        oldLocationId,
        tx
      );
      await this.releaseQuoteInventory(previousVariantQtyMap, oldLevelMap, tx);

      // 2. Reserve the full current requirement at the NEW location.
      const newLevelMap = await this.loadStockLevelMapForVariants(
        Array.from(currentVariantQtyMap.keys()),
        variantMap,
        newLocationId,
        tx
      );
      await this.reserveQuoteInventory(currentVariantQtyMap, newLevelMap, tx);
      return;
    }

    // Same location: delta-based sync over the union of involved variants.
    // For a DRAFT becoming APPROVED, nothing was reserved yet → empty previous.
    const effectivePreviousMap = wasAlreadyApproved
      ? previousVariantQtyMap
      : new Map<string, number>();
    const unionVariantIds = new Set<string>([
      ...currentVariantQtyMap.keys(),
      ...effectivePreviousMap.keys(),
    ]);
    const levelMap = await this.loadStockLevelMapForVariants(
      Array.from(unionVariantIds),
      variantMap,
      newLocationId,
      tx
    );
    await this.reserveQuoteInventory(
      currentVariantQtyMap,
      levelMap,
      tx,
      effectivePreviousMap
    );
  }

  /**
   * Create a new quote
   * Quotes do NOT affect inventory or create payments
   * Includes retry logic for race conditions in quote number generation
   */
  async create(
    createQuoteDto: CreateQuoteDto,
    userId?: string
  ): Promise<QuoteDto> {
    this.logger.log("[CREATE] Creating new quote");

    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await this.createQuoteWithRetry(createQuoteDto, userId);
      } catch (error) {
        // Check if it's a unique constraint violation on quote_number
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes("quote_number")) {
            attempt++;
            if (attempt >= maxRetries) {
              this.logger.error(
                `[CREATE] Failed to create quote after ${maxRetries} attempts due to quote number conflict`
              );
              throw new ConflictException(
                "Unable to generate unique quote number. Please try again."
              );
            }
            this.logger.warn(
              `[CREATE] Quote number conflict detected. Retrying (attempt ${attempt}/${maxRetries})`
            );
            // Add a small random delay to reduce collision probability
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }
        }
        // If it's not a quote_number conflict, rethrow the error
        throw error;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new ConflictException(
      "Unable to create quote after multiple attempts"
    );
  }

  /**
   * Internal method to create a quote (called by create with retry logic)
   */
  private async createQuoteWithRetry(
    createQuoteDto: CreateQuoteDto,
    userId?: string
  ): Promise<QuoteDto> {
    return await this.prisma.$transaction(
      async tx => {
        // 1. Validate branch and location
        await this.validateBranchAndLocation(
          createQuoteDto.branchId,
          createQuoteDto.locationId,
          tx
        );

        // 2. Validate customer if provided
        if (createQuoteDto.customerId) {
          await this.validateCustomer(createQuoteDto.customerId, tx);
        }

        // 3. Validate employees (seller and cashier)
        await this.validateEmployees(
          createQuoteDto.sellerId,
          createQuoteDto.cashierId,
          tx
        );

        // 4. Validate discount code if provided
        if (createQuoteDto.discountCodeId) {
          await this.validateDiscountCode(
            createQuoteDto.discountCodeId,
            createQuoteDto.customerId,
            tx
          );
        }

        // 4.2. Validate stock availability for Kits and Products
        // Note: In Quotes this is informational but prevents creating impossible quotes
        const { variantMap, variantQtyMap, stockLevelMap } =
          await this.validateStockAvailability(
            createQuoteDto.items,
            createQuoteDto.locationId,
            tx
          );

        // 4.3. Validate Quote Initial Status
        const initialStatus = createQuoteDto.status || "DRAFT";
        if (initialStatus !== "DRAFT" && initialStatus !== "APPROVED") {
          throw new BadRequestException(
            "Initial status must be either DRAFT or APPROVED"
          );
        }

        // 5. Calculate quote totals
        const discountCodeValue = createQuoteDto.discountCodeValue || 0;
        const manualDiscount = createQuoteDto.manualDiscount || 0;
        const itemsDiscountTotal = createQuoteDto.itemsDiscountTotal || 0;
        const orderDiscount = discountCodeValue + manualDiscount;
        const totalDiscount = orderDiscount + itemsDiscountTotal;

        const { subtotal, taxes, totalAmount } = this.calculateQuoteTotals(
          createQuoteDto.items,
          discountCodeValue,
          manualDiscount,
          itemsDiscountTotal,
          createQuoteDto.includeTax
        );

        // Validate that discounts do not exceed subtotal (prevent negative totals)
        if (totalDiscount > subtotal) {
          throw new BadRequestException(
            `Total discount ($${totalDiscount.toFixed(2)}) exceeds subtotal ($${subtotal.toFixed(2)}). Discounts cannot exceed the invoice amount.`
          );
        }

        // 6. Generate sequential quote number (12 digits, zero-padded; concurrency-safe via number_sequences)
        const quoteNumber = await this.numberSequenceService.getNextNumber(
          tx,
          "quotes"
        );

        // 7. Calculate subtotal after all discounts (for proportional tax calculation)
        const subtotalAfterDiscounts = subtotal - totalDiscount;

        // 7.1. If created as APPROVED, require user and force fixed expiration window
        // Set validUntil if the quote is created directly as APPROVED
        const approvedAt = initialStatus === "APPROVED" ? new Date() : null;
        const validUntil =
          initialStatus === "APPROVED" && approvedAt
            ? new Date(approvedAt.getTime() + 3 * 24 * 60 * 60 * 1000)
            : null;

        if (initialStatus === "APPROVED" && !userId) {
          throw new BadRequestException(
            "User is required when creating an APPROVED quote."
          );
        }

        // 8. Create the quote
        const quote = await tx.quote.create({
          data: {
            quoteNumber: `PR-${quoteNumber}`,
            customerId: createQuoteDto.customerId,
            branchId: createQuoteDto.branchId,
            locationId: createQuoteDto.locationId,
            sellerId: createQuoteDto.sellerId,
            cashierId: createQuoteDto.cashierId,
            createdBy: userId,
            status: createQuoteDto.status || "DRAFT",
            approvedBy: initialStatus === "APPROVED" ? userId : null,
            approvedAt,
            validUntil, // DRAFT => null, APPROVED => approvedAt + 3 days (fixed)
            discountCodeId: createQuoteDto.discountCodeId,
            discountCodeValue: discountCodeValue,
            manualDiscount: manualDiscount,
            itemsDiscountTotal: itemsDiscountTotal,
            discountAmount: totalDiscount,
            subtotal,
            taxes: createQuoteDto.includeTax ? taxes : 0,
            totalAmount,
            includeTax: createQuoteDto.includeTax,
            metadata: createQuoteDto.metadata ?? {},
          } as any,
          include: {
            customer: {
              include: {
                person: true,
                customerType: true,
                customerPrices: {
                  include: {
                    priceType: true,
                  },
                },
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
            creator: { select: { id: true, email: true } },
          },
        });

        this.logger.debug(`[CREATE] Quote created with ID: ${quote.id}`);

        // Validate all variants exist
        for (const item of createQuoteDto.items) {
          if (!variantMap.has(item.productVariantId)) {
            throw new NotFoundException(
              `Product variant ${item.productVariantId} not found`
            );
          }
        }

        // 10. Prepare quote items data for batch insertion
        const quoteItemsData = createQuoteDto.items.map(item => {
          const variant = variantMap.get(item.productVariantId)!;

          const itemSubtotal = item.unitPrice * item.quantity;
          const itemDiscount = item.discountAmount || 0;
          const itemNetAmount = itemSubtotal - itemDiscount;

          // Calculate tax proportionally based on item's contribution to subtotal after discounts
          let itemTaxAmount = 0;
          if (createQuoteDto.includeTax && subtotalAfterDiscounts > 0) {
            const itemProportion = itemNetAmount / subtotalAfterDiscounts;
            itemTaxAmount = taxes * itemProportion;
          }

          const lineTotal = itemNetAmount + itemTaxAmount;

          return {
            quoteId: quote.id,
            productVariantId: item.productVariantId,
            productId: variant.productId,
            priceTypeId: item.priceTypeId || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: itemDiscount,
            taxAmount: itemTaxAmount,
            lineTotal,
            metadata: {},
          };
        });

        // Use createMany for batch insertion (single DB query)
        await tx.quoteItem.createMany({
          data: quoteItemsData,
        });

        // Fetch the created quote items with relations for the response
        const quoteItems = await tx.quoteItem.findMany({
          where: { quoteId: quote.id },
          include: {
            productVariant: {
              include: {
                product: {
                  include: {
                    kitItems: {
                      include: { productVariant: true },
                    },
                  },
                },
              },
            },
            product: {
              include: {
                kitItems: {
                  include: { productVariant: true },
                },
              },
            },
          },
        });

        this.logger.debug(`[CREATE] Created ${quoteItems.length} quote items`);

        this.logger.log(`[CREATE] Quote ${quoteNumber} created successfully`);

        // Log before reserving inventory
        if (initialStatus === "APPROVED") {
          this.logger.debug(
            `[CREATE] Reserving inventory for quote ${quote.id} with items: ${JSON.stringify(createQuoteDto.items)} at location: ${createQuoteDto.locationId}`
          );
          await this.reserveQuoteInventory(variantQtyMap, stockLevelMap, tx);
        }

        // 12. Return complete quote data
        return this.mapToDto({
          ...quote,
          items: quoteItems,
        });
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
        timeout: 30000, // Maximum time the transaction can run (30 seconds)
      }
    );
  }

  /**
   * Approves a quote (DRAFT -> APPROVED), reserves inventory, and updates status/timestamps.
   */
  async approveQuote(id: string, userId: string): Promise<QuoteDto> {
    // 1. Pre-condición:check if user is authenticated (required for approval)
    if (!userId) {
      throw new BadRequestException(
        "User must be authenticated to approve a quote."
      );
    }

    // 2. Start transaction for approval process (includes validation and state change)
    return await this.prisma.$transaction(
      async tx => {
        // 3. Row-level lock to serialize concurrent approve attempts (double-click,
        //    parallel requests). Under READ COMMITTED a plain findFirst+update is
        //    racy: two transactions can both read DRAFT and both reserve inventory,
        //    doubling stock_levels.reserved. SELECT … FOR UPDATE blocks the second
        //    transaction until the first commits, at which point it sees APPROVED
        //    and we reject.
        const locked = await tx.$queryRaw<
          Array<{ id: string; status: string; location_id: string | null }>
        >`
          SELECT id, status, location_id
          FROM quotes
          WHERE id = ${id}::uuid AND is_deleted = false
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new NotFoundException(`Quote ${id} not found or deleted.`);
        }

        if (locked[0]!.status !== "DRAFT") {
          throw new BadRequestException(
            `Quote ${id} must be in DRAFT status to approve. Current status: ${locked[0]!.status}`
          );
        }

        // 4. Retrieval (safe now: row is locked until tx commits)
        const quote = await tx.quote.findFirst({
          where: { id, isDeleted: false },
          include: {
            items: true,
            customer: {
              include: {
                person: true,
                customerType: true,
                customerPrices: { include: { priceType: true } },
              },
            },
            seller: { include: { person: true } },
            cashier: { include: { person: true } },
            branch: true,
            location: true,
            creator: { select: { id: true, email: true } },
          },
        });

        if (!quote) {
          throw new NotFoundException(`Quote ${id} not found or deleted.`);
        }

        // 5. Stock Availability Validation
        this.logger.debug(`[APPROVE] Validating stock for quote ${id}...`);
        const { variantQtyMap, stockLevelMap } =
          await this.validateStockAvailability(
            quote.items,
            quote.locationId,
            tx
          );

        // 6. Execute Inventory Reservation (updates stock levels with reserved quantities)
        this.logger.debug(`[APPROVE] Reserving inventory for quote ${id}...`);
        await this.reserveQuoteInventory(variantQtyMap, stockLevelMap, tx);

        // 7. Sync Approval Timestamps and Validity (3 Days UTC)
        const approvedAt = new Date();
        const validUntil = new Date(
          approvedAt.getTime() + 3 * 24 * 60 * 60 * 1000
        );

        // 8. Conditional update: extra safety net even with the FOR UPDATE lock.
        //    updateMany with status='DRAFT' guarantees we never overwrite a non-DRAFT
        //    state in case the lock is bypassed (e.g., future code path changes).
        const claim = await tx.quote.updateMany({
          where: { id, isDeleted: false, status: "DRAFT" },
          data: {
            status: "APPROVED",
            approvedAt,
            approvedBy: userId,
            validUntil,
          },
        });

        if (claim.count === 0) {
          this.logger.error(
            `[APPROVE] Quote ${id} could not be claimed for approval (concurrent state change?)`
          );
          throw new ConflictException(
            `Quote ${id} could not be approved (concurrent state change). Please retry.`
          );
        }

        const updatedQuote = await tx.quote.findFirstOrThrow({
          where: { id },
          include: {
            items: true,
            customer: {
              include: {
                person: true,
                customerType: true,
                customerPrices: { include: { priceType: true } },
              },
            },
            seller: { include: { person: true } },
            cashier: { include: { person: true } },
            branch: true,
            location: true,
            creator: { select: { id: true, email: true } },
          },
        });

        this.logger.log(`[APPROVE] Quote ${id} approved by user ${userId}.`);

        // 9. response
        return this.mapToDto(updatedQuote);
      },
      {
        timeout: 30000, // Ensure 30s timeout to handle heavy Kit processing
      }
    );
  }

  /**
   * Annuls a quote (DRAFT or APPROVED), releases inventory if APPROVED,
   */
  async annulQuote(id: string, userId: string): Promise<QuoteDto> {
    this.logger.log(`[ANNUL] Request to annul quote ${id} by user ${userId}`);

    // 1. Identity Pre-validation: Ensure an auditor is present
    if (!userId) {
      throw new BadRequestException(
        "UserId is required to annul a quote for audit purposes."
      );
    }

    // 2. Atomic Transaction: Guarantee state and inventory consistency
    return await this.prisma.$transaction(async tx => {
      // 3. Row-level lock to serialize concurrent annul attempts and prevent
      //    double-release of inventory.
      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM quotes
        WHERE id = ${id}::uuid AND is_deleted = false
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException(
          `Quote ${id} not found or has been deleted.`
        );
      }

      const lockedStatus = locked[0]!.status;
      if (lockedStatus === "CONVERTED") {
        throw new BadRequestException(
          "Cannot annul a quote that is already a legal sale (CONVERTED)."
        );
      }
      if (lockedStatus === "ANNULLED") {
        throw new BadRequestException("This quote is already annulled.");
      }
      if (lockedStatus === "EXPIRED") {
        throw new BadRequestException(
          "Expired quotes cannot be manually annulled via this endpoint."
        );
      }

      // 4. Retrieval (safe now: row is locked until commit)
      const quote = await tx.quote.findFirst({
        where: { id, isDeleted: false },
        include: { items: true },
      });

      if (!quote) {
        throw new NotFoundException(
          `Quote ${id} not found or has been deleted.`
        );
      }

      // 5. Conditional Inventory Release
      // Only APPROVED quotes have blocked stock. DRAFT quotes are skipped to save resources.
      if (quote.status === "APPROVED") {
        this.logger.log(
          `[ANNUL] Quote ${quote.quoteNumber} is APPROVED. Proceeding to release stock.`
        );

        // Fetch variant data to handle kit decomposition
        const { variantQtyMap, stockLevelMap } =
          await this.validateStockAvailability(
            quote.items,
            quote.locationId,
            tx,
            undefined, // variantIdsToFetch - let the method determine based on quote items
            true // skipValidation since we are releasing, not validating availability
          );
        // Delta logic: $Actual(0) - Existing(7) = -7$ (atomic decrement)
        await this.releaseQuoteInventory(variantQtyMap, stockLevelMap, tx);

        this.logger.log(
          `[ANNUL] Inventory release completed for quote ${quote.quoteNumber}.`
        );
      }

      // 6. Persistence & Metadata Update
      // Record who, when, and clear expiration window since the quote is now dead
      const updatedQuote = await tx.quote.update({
        where: { id },
        data: {
          status: "ANNULLED",
          annulledBy: userId,
          annulledAt: new Date(),
          validUntil: null,
        },
        include: {
          items: true,
          customer: { include: { person: true } },
          location: true,
          seller: { include: { person: true } },
        },
      });

      this.logger.log(
        `[ANNUL] Quote ${quote.quoteNumber} successfully annulled.`
      );

      // 7. DTO Mapping: Standardize response for the frontend
      return this.mapToDto(updatedQuote);
    });
  }

  /**
   * Find all quotes with pagination and filters
   */
  async findAll(filters: {
    quoteNumber?: string;
    status?: string;
    customerId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedQuotesDto> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
    };

    if (filters.quoteNumber) {
      where.quoteNumber = {
        contains: filters.quoteNumber,
        mode: "insensitive",
      };
    }

    if (filters.status) {
      where.status = filters.status as any;
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.locationId) {
      where.locationId = filters.locationId;
    }

    // Interpret YYYY-MM-DD filters in the business time zone so a quote created
    // late at night (e.g. 11 PM in Nicaragua, stored as the next UTC day) is
    // still counted under the local day the user selected.
    const createdAtFilter = zonedDayRangeToUtc(
      filters.startDate,
      filters.endDate
    );
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    const [quotes, total] = await Promise.all([
      (this.prisma as any).quote.findMany({
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
          creator: { select: { id: true, email: true } },
        },
      }),
      (this.prisma as any).quote.count({ where }),
    ]);

    return {
      data: quotes.map(quote => this.mapToDto(quote)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a quote by ID
   */
  async findOne(id: string): Promise<QuoteDto> {
    // Single query — stockLevels are loaded unfiltered, then narrowed
    // in memory to the quote's own locationId. The number of locations
    // is small (typically < 10), so the extra rows are negligible
    // compared to saving a full database round-trip.
    const quote = await (this.prisma as any).quote.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        customer: {
          include: {
            person: true,
            customerType: true,
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
        location: true,
        discountCode: true,
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  include: {
                    brand: true,
                    kitItems: {
                      include: {
                        productVariant: {
                          include: {
                            stockLevels: true,
                          },
                        },
                      },
                    },
                  },
                },
                prices: {
                  include: {
                    priceType: true,
                  },
                  orderBy: {
                    priceType: {
                      priority: "asc",
                    },
                  },
                },
                stockLevels: true,
              },
            },
            product: {
              include: {
                brand: true,
                kitItems: {
                  include: {
                    productVariant: {
                      include: {
                        stockLevels: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orders: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    // Filter stockLevels in memory to only the quote's location
    const locationId = quote.locationId;
    if (locationId && quote.items) {
      for (const item of quote.items) {
        if (item.productVariant?.stockLevels) {
          item.productVariant.stockLevels =
            item.productVariant.stockLevels.filter(
              (sl: any) => sl.locationId === locationId
            );
        }
        if (item.productVariant?.product?.kitItems) {
          for (const ki of item.productVariant.product.kitItems) {
            if (ki.productVariant?.stockLevels) {
              ki.productVariant.stockLevels =
                ki.productVariant.stockLevels.filter(
                  (sl: any) => sl.locationId === locationId
                );
            }
          }
        }
        if (item.product?.kitItems) {
          for (const ki of item.product.kitItems) {
            if (ki.productVariant?.stockLevels) {
              ki.productVariant.stockLevels =
                ki.productVariant.stockLevels.filter(
                  (sl: any) => sl.locationId === locationId
                );
            }
          }
        }
      }
    }

    return this.mapToDto(quote);
  }

  /**
   * Update a quote
   */
  async update(
    id: string,
    updateQuoteDto: UpdateQuoteDto,
    userId?: string
  ): Promise<QuoteDto> {
    return await this.prisma.$transaction(
      async tx => {
        // 1. Row-level lock — prevents double-reserve in the DRAFT→APPROVED
        //    transition under concurrent updates (see approveQuote for context).
        const locked = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT status FROM quotes
          WHERE id = ${id}::uuid AND is_deleted = false
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new NotFoundException(`Quote with ID ${id} not found`);
        }

        const lockedStatus = locked[0]!.status;
        if (["CONVERTED", "ANNULLED", "EXPIRED"].includes(lockedStatus)) {
          throw new BadRequestException(
            `Cannot update a quote with status ${lockedStatus}`
          );
        }

        // 2. Fetch full quote (safe now: row is locked until commit)
        const quote = await (tx as any).quote.findFirst({
          where: { id, isDeleted: false },
          include: { items: true },
        });

        if (!quote) {
          throw new NotFoundException(`Quote with ID ${id} not found`);
        }

        // 3. Determine if we need to sync inventory based on status changes and apply Delta logic for accurate adjustments
        const wasAlreadyApproved = quote.status === "APPROVED";

        const isBecomingApproved =
          quote.status === "DRAFT" && updateQuoteDto.status === "APPROVED";

        // 2. Define automatic expiration (+3 days UTC) if becoming approved
        // Set validUntil when updating a DRAFT to APPROVED
        const calculatedValidUntil = isBecomingApproved
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          : updateQuoteDto.validUntil
            ? new Date(updateQuoteDto.validUntil)
            : undefined;

        // 3.CASE A: If items are being updated, recalculate totals
        if (updateQuoteDto.items) {
          this.logger.debug(
            `[UPDATE] Processing item changes for Quote ${quote.quoteNumber}`
          );

          /** Sanitize line items so reservation deltas match persisted quote lines */
          const sanitizedItems = updateQuoteDto.items.map((item: any) => ({
            productVariantId: item.productVariantId,
            quantity: Math.max(1, Math.floor(Number(item.quantity))),
            unitPrice: Number(item.unitPrice),
            discountAmount:
              item.discountAmount != null ? Number(item.discountAmount) : 0,
            ...(item.priceTypeId ? { priceTypeId: item.priceTypeId } : {}),
          }));

          // 4. Determine the source of truth for items to process (updated vs existing)
          const itemsToProcess = sanitizedItems;

          // 5. Create a unique set of all variant IDs involved in the update (both new and existing) to optimize loading
          const allVariantIds = [
            ...new Set([
              ...itemsToProcess.map((i: any) => i.productVariantId),
              ...quote.items.map((i: any) => i.productVariantId),
            ]),
          ];

          // 6a. Resolve the effective target location. An APPROVED quote may be
          //     moved to another location during edit; reservations must follow.
          const newLocationId = updateQuoteDto.locationId ?? quote.locationId;
          const locationChanged =
            wasAlreadyApproved && newLocationId !== quote.locationId;

          // When the location changes, the quote does not yet reserve anything at
          // the new location, so it must NOT be excluded from availability there.
          const excludeQuoteIdForValidation =
            wasAlreadyApproved && !locationChanged ? id : undefined;

          // 6b. VALIDATION AND BULK LOADING: validate the new items at the target
          //     location and load the full variant universe (incl. removed ones).
          const { variantMap, variantQtyMap: currentVariantQtyMap } =
            await this.validateStockAvailability(
              sanitizedItems,
              newLocationId,
              tx,
              allVariantIds, // Pass the union of IDs
              false,
              excludeQuoteIdForValidation
            );

          //  7. PREVIOUS MAP: Flatten the previous state (DB) to calculate the Delta
          const previousVariantQtyMap = new Map<string, number>();
          for (const oldItem of quote.items) {
            const variant = variantMap.get(oldItem.productVariantId);
            if (!variant) continue;

            const isKit = variant.product?.type === ProductType.KIT;
            const kitItems = variant.product?.kitItems || [];

            if (isKit && kitItems.length > 0) {
              for (const kitItem of kitItems) {
                const qty = oldItem.quantity * Number(kitItem.quantity);
                previousVariantQtyMap.set(
                  kitItem.productVariantId,
                  (previousVariantQtyMap.get(kitItem.productVariantId) || 0) +
                    qty
                );
              }
            } else {
              previousVariantQtyMap.set(
                oldItem.productVariantId,
                (previousVariantQtyMap.get(oldItem.productVariantId) || 0) +
                  oldItem.quantity
              );
            }
          }

          //  8. INVENTORY SYNC — release removed lines, move reservations on a
          //     location change, and apply quantity deltas, all atomically.
          if (wasAlreadyApproved || isBecomingApproved) {
            this.logger.log(
              `[UPDATE-STOCK] Reconciling reservations for Quote ${quote.quoteNumber}` +
                (locationChanged
                  ? ` (location ${quote.locationId} → ${newLocationId})`
                  : "")
            );

            await this.reconcileQuoteReservations({
              previousVariantQtyMap,
              currentVariantQtyMap,
              variantMap,
              oldLocationId: quote.locationId,
              newLocationId,
              wasAlreadyApproved,
              tx,
            });
          }

          const discountCodeValue = updateQuoteDto.discountCodeValue || 0;
          const manualDiscount = updateQuoteDto.manualDiscount || 0;
          const itemsDiscountTotal = updateQuoteDto.itemsDiscountTotal || 0;
          const orderDiscount = discountCodeValue + manualDiscount;
          const totalDiscount = orderDiscount + itemsDiscountTotal;

          const { subtotal, taxes, totalAmount } = this.calculateQuoteTotals(
            sanitizedItems,
            discountCodeValue,
            manualDiscount,
            itemsDiscountTotal,
            updateQuoteDto.includeTax ?? quote.includeTax
          );

          const subtotalAfterDiscounts = subtotal - totalDiscount;

          // 9. Validate that discounts do not exceed subtotal (prevent negative totals)
          if (subtotalAfterDiscounts < 0) {
            throw new BadRequestException(
              `Total discount ($${totalDiscount.toFixed(2)}) exceeds subtotal ($${subtotal.toFixed(2)}). Discounts cannot exceed the invoice amount.`
            );
          }

          // 10. Delete existing items
          await tx.quoteItem.deleteMany({
            where: { quoteId: id },
          });

          // 11. prepare new items data
          const quoteItemsData = sanitizedItems.map(item => {
            const variant = variantMap.get(item.productVariantId)!;

            const itemSubtotal = item.unitPrice * item.quantity;
            const itemDiscount = item.discountAmount || 0;
            const itemNetAmount = itemSubtotal - itemDiscount;

            let itemTaxAmount = 0;
            if (
              (updateQuoteDto.includeTax ?? quote.includeTax) &&
              subtotalAfterDiscounts > 0
            ) {
              const itemProportion = itemNetAmount / subtotalAfterDiscounts;
              itemTaxAmount = taxes * itemProportion;
            }

            const lineTotal = itemNetAmount + itemTaxAmount;

            return {
              quoteId: id,
              productVariantId: item.productVariantId,
              productId: variant.productId,
              priceTypeId: item.priceTypeId || undefined,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: itemDiscount,
              taxAmount: itemTaxAmount,
              lineTotal,
              metadata: {},
            };
          });

          // 12. Insert updated items
          await tx.quoteItem.createMany({
            data: quoteItemsData,
          });

          // 13. Update quote with new totals
          const { items: _, ...updateData } = updateQuoteDto;
          await tx.quote.update({
            where: { id },
            data: {
              ...updateData,
              subtotal,
              taxes:
                (updateQuoteDto.includeTax ?? quote.includeTax) ? taxes : 0,
              totalAmount,
              discountAmount: totalDiscount,
              discountCodeValue,
              manualDiscount,
              itemsDiscountTotal,
              validUntil: calculatedValidUntil,
              approvedAt: isBecomingApproved ? new Date() : undefined,
              approvedBy: isBecomingApproved ? userId : undefined,
            } as any,
          });
        } else {
          // CASE B: NO ITEM CHANGES (status/metadata and/or location only)
          const newLocationId = updateQuoteDto.locationId ?? quote.locationId;
          const locationChanged =
            wasAlreadyApproved && newLocationId !== quote.locationId;

          // Reserve when a DRAFT becomes APPROVED, or move reservations when an
          // already-APPROVED quote changes location without editing its items.
          if (isBecomingApproved || locationChanged) {
            const allVariantIds: string[] = [
              ...new Set(
                quote.items.map((i: any) => i.productVariantId as string)
              ),
            ] as string[];
            const excludeQuoteIdForValidation =
              wasAlreadyApproved && !locationChanged ? id : undefined;

            const { variantMap, variantQtyMap: currentVariantQtyMap } =
              await this.validateStockAvailability(
                quote.items,
                newLocationId,
                tx,
                allVariantIds,
                false,
                excludeQuoteIdForValidation
              );

            // Decompose the persisted items (kits → components) to know what was
            // reserved at the old location before this change.
            const previousVariantQtyMap = new Map<string, number>();
            for (const oldItem of quote.items) {
              const variant = variantMap.get(oldItem.productVariantId);
              if (!variant) continue;
              const isKit = variant.product?.type === ProductType.KIT;
              const kitItems = variant.product?.kitItems || [];
              if (isKit && kitItems.length > 0) {
                for (const kitItem of kitItems) {
                  const qty = oldItem.quantity * Number(kitItem.quantity);
                  previousVariantQtyMap.set(
                    kitItem.productVariantId,
                    (previousVariantQtyMap.get(kitItem.productVariantId) || 0) +
                      qty
                  );
                }
              } else {
                previousVariantQtyMap.set(
                  oldItem.productVariantId,
                  (previousVariantQtyMap.get(oldItem.productVariantId) || 0) +
                    oldItem.quantity
                );
              }
            }

            await this.reconcileQuoteReservations({
              previousVariantQtyMap,
              currentVariantQtyMap,
              variantMap,
              oldLocationId: quote.locationId,
              newLocationId,
              wasAlreadyApproved,
              tx,
            });
          }

          // Update quote without recalculating items
          const { items: _, ...updateData } = updateQuoteDto;
          await tx.quote.update({
            where: { id },
            data: {
              ...updateData,
              validUntil: calculatedValidUntil,
              approvedAt: isBecomingApproved ? new Date() : undefined,
              approvedBy: isBecomingApproved ? userId : undefined,
            } as any,
          });
        }
        this.logger.log(
          `[UPDATE-SUCCESS] Quote ${quote.quoteNumber} updated successfully.`
        );
        return this.findOne(id);
      },
      {
        maxWait: 15000,
        timeout: 90000, // Item + kit updates before convert can be heavy
      }
    );
  }

  /**
   * Stable signature of line-level inventory (variant + qty per line). Used to detect drift between
   * saved APPROVED quote lines and checkout payload without merging duplicate variant rows.
   */
  private quoteLineInventorySignature(
    items: Array<{ productVariantId?: string; quantity?: number }>
  ): string {
    if (!items?.length) return "";
    return [...items]
      .filter((i): i is { productVariantId: string; quantity: number } =>
        Boolean(i?.productVariantId)
      )
      .map(i => `${i.productVariantId}:${Number(i.quantity)}`)
      .sort()
      .join("|");
  }

  /**
   * APPROVED quotes reserve inventory for DB line items. Checkout often sends the latest cart without
   * a prior PATCH. Without this, release uses old lines while the order validates new lines → 409.
   * (DRAFT is not synced here: update() stock math assumes reservation; DRAFT convert uses payload vs real stock.)
   */
  private async ensureQuoteLinesMatchConvertPayload(
    quoteId: string,
    convertDto: ConvertQuoteToOrderDto
  ): Promise<void> {
    const pre = await (this.prisma as any).quote.findFirst({
      where: { id: quoteId, isDeleted: false },
      select: {
        status: true,
        discountCodeValue: true,
        manualDiscount: true,
        includeTax: true,
        items: {
          select: { productVariantId: true, quantity: true },
        },
      },
    });
    if (!pre || pre.status !== "APPROVED") return;
    if (!convertDto.items?.length) return;
    if (
      this.quoteLineInventorySignature(pre.items) ===
      this.quoteLineInventorySignature(convertDto.items)
    ) {
      return;
    }
    const itemsDiscountTotal = Number(
      convertDto.items
        .reduce((sum, i) => sum + Number(i.discountAmount || 0), 0)
        .toFixed(2)
    );
    this.logger.log(
      `[CONVERT] Syncing APPROVED quote ${quoteId} lines to checkout payload before conversion`
    );
    await this.update(quoteId, {
      items: convertDto.items.map(i => ({
        productVariantId: i.productVariantId,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        discountAmount: i.discountAmount != null ? Number(i.discountAmount) : 0,
        ...(i.priceTypeId ? { priceTypeId: i.priceTypeId } : {}),
      })),
      discountCodeValue:
        convertDto.discountCodeValue !== undefined
          ? Number(convertDto.discountCodeValue)
          : Number(pre.discountCodeValue ?? 0),
      manualDiscount:
        convertDto.manualDiscount !== undefined
          ? Number(convertDto.manualDiscount)
          : Number(pre.manualDiscount ?? 0),
      itemsDiscountTotal,
      includeTax:
        convertDto.includeTax !== undefined
          ? convertDto.includeTax
          : Boolean(pre.includeTax),
    } as any);
  }

  /**
   * Converts a quote into a sale order. Finalización de proforma + enlace ocurren en la misma
   * transacción que el create del pedido (ordersService.create) para atomicidad.
   * APPROVED: consumeReservation en el pedido descuenta quantity y reserved a la vez.
   */
  async convertToOrder(
    id: string,
    convertDto: ConvertQuoteToOrderDto,
    userId?: string
  ): Promise<any> {
    this.logger.log(
      `[CONVERT] quoteId=${id} itemsInPayload=${convertDto.items?.length ?? 0}`
    );

    await this.ensureQuoteLinesMatchConvertPayload(id, convertDto);

    const quote = await (this.prisma as any).quote.findFirst({
      where: { id, isDeleted: false },
      include: {
        items: {
          include: {
            productVariant: { include: { product: true } },
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    if (quote.status === "CONVERTED") {
      const existingOrder = await this.prisma.order.findFirst({
        where: { quoteId: id },
        orderBy: { createdAt: "desc" },
      });
      if (existingOrder) {
        this.logger.log(
          `[CONVERT] Idempotent: quote ${id} already converted, returning order ${existingOrder.id}`
        );
        return this.ordersService.findOne(existingOrder.id);
      }
      throw new ConflictException(
        "Esta proforma está marcada como convertida pero no tiene pedido vinculado. Contacte soporte."
      );
    }
    if (quote.status === "EXPIRED") {
      throw new BadRequestException("Cannot convert an expired quote");
    }
    if (quote.status === "ANNULLED") {
      throw new BadRequestException("Cannot convert an annulled quote");
    }

    if (convertDto.paymentMethod === "CASH" && !convertDto.cashSessionId) {
      this.logger.warn(
        `[CONVERT] Missing cashSessionId for CASH on quote ${id}`
      );
    }
    if (convertDto.paymentMethod === "CREDIT" && !convertDto.creditType) {
      this.logger.warn(`[CONVERT] Missing credit details for quote ${id}`);
    }

    const isFromApproved = quote.status === "APPROVED";

    const itemsToUse =
      convertDto.items && convertDto.items.length > 0
        ? convertDto.items
        : quote.items;

    this.logger.log(
      `[CONVERT] Processing ${itemsToUse.length} line(s) for quote ${quote.quoteNumber}`
    );

    let itemsDiscountTotal = quote.itemsDiscountTotal
      ? Number(quote.itemsDiscountTotal)
      : undefined;
    let discountAmount = quote.discountAmount
      ? Number(quote.discountAmount)
      : undefined;
    let quoteTotalAmount = quote.totalAmount
      ? Number(quote.totalAmount)
      : undefined;

    if (convertDto.items && convertDto.items.length > 0) {
      itemsDiscountTotal = Number(
        itemsToUse
          .reduce((sum, item) => sum + (item.discountAmount || 0), 0)
          .toFixed(2)
      );
      const subtotal = Number(
        itemsToUse
          .reduce(
            (sum, item) => sum + Number(item.unitPrice) * item.quantity,
            0
          )
          .toFixed(2)
      );
      const discountCodeValue =
        convertDto.discountCodeValue !== undefined
          ? Number(convertDto.discountCodeValue)
          : quote.discountCodeValue
            ? Number(quote.discountCodeValue)
            : 0;
      const manualDiscount =
        convertDto.manualDiscount !== undefined
          ? Number(convertDto.manualDiscount)
          : quote.manualDiscount
            ? Number(quote.manualDiscount)
            : 0;
      const includeTax =
        convertDto.includeTax !== undefined
          ? convertDto.includeTax
          : quote.includeTax;

      const orderDiscount = Number(
        (discountCodeValue + manualDiscount).toFixed(2)
      );
      let totalDiscount = Number(
        (itemsDiscountTotal + orderDiscount).toFixed(2)
      );
      if (totalDiscount > subtotal) {
        totalDiscount = subtotal;
      }
      discountAmount = totalDiscount;

      const subtotalAfterDiscounts = Number(
        (subtotal - discountAmount).toFixed(2)
      );
      const taxes = includeTax
        ? Number((subtotalAfterDiscounts * DEFAULT_TAX_RATE).toFixed(2))
        : 0;
      quoteTotalAmount = Number((subtotalAfterDiscounts + taxes).toFixed(2));
    }

    const createOrderDto: CreateOrderDto = {
      customerId: quote.customerId || undefined,
      branchId: quote.branchId || undefined,
      locationId: quote.locationId!,
      sellerId: quote.sellerId || undefined,
      cashierId: quote.cashierId!,
      cashSessionId: convertDto.cashSessionId,
      discountCodeId: quote.discountCodeId || undefined,
      discountCodeValue:
        convertDto.items &&
        convertDto.items.length > 0 &&
        convertDto.discountCodeValue !== undefined
          ? Number(convertDto.discountCodeValue)
          : quote.discountCodeValue
            ? Number(quote.discountCodeValue)
            : undefined,
      manualDiscount:
        convertDto.items &&
        convertDto.items.length > 0 &&
        convertDto.manualDiscount !== undefined
          ? Number(convertDto.manualDiscount)
          : quote.manualDiscount
            ? Number(quote.manualDiscount)
            : undefined,
      itemsDiscountTotal,
      discountAmount,
      includeTax:
        convertDto.items &&
        convertDto.items.length > 0 &&
        convertDto.includeTax !== undefined
          ? convertDto.includeTax
          : quote.includeTax,
      paymentMethod: convertDto.paymentMethod || "CASH",
      items: itemsToUse.map((item: any) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountAmount: item.discountAmount ? Number(item.discountAmount) : 0,
        type: item.type,
        kitItems: item.kitItems,
        priceTypeId: item.priceTypeId,
        metadata: {
          ...(item.metadata || {}),
          fromQuoteId: quote.id,
          fromQuoteItemId: item.id,
        },
      })),
      payments: convertDto.payments,
      creditType: convertDto.creditType,
      paymentFrequency: convertDto.paymentFrequency,
      durationDays: convertDto.durationDays,
      firstDueDate: convertDto.firstDueDate,
      initialPayment: convertDto.initialPayment,
      quoteTotalAmount,
      metadata: {
        fromQuoteId: quote.id,
        quoteWasApproved: isFromApproved,
        consumeReservation: isFromApproved,
      },
    };

    const order = await this.ordersService.create(createOrderDto, userId);
    this.logger.log(
      `[CONVERT] SUCCESS quote ${quote.quoteNumber} → order ${order.orderNumber ?? order.id}`
    );
    return order;
  }

  /**
   * Delete (soft delete) a quote
   */
  async remove(id: string): Promise<void> {
    const quote = await (this.prisma as any).quote.findFirst({
      where: { id, isDeleted: false },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    if (quote.status === "CONVERTED") {
      throw new BadRequestException("Cannot delete a converted quote");
    }

    // if APPROVED quotes are deleted without annulling,
    // the reserved stock would remain blocked indefinitely,
    // causing inventory issues.
    // Therefore, we enforce that APPROVED quotes must be ANNULLED first to release the stock before they can be deleted.
    // This ensures that our inventory remains accurate and prevents potential stockouts caused by orphaned reservations.
    if (quote.status === "APPROVED") {
      throw new BadRequestException(
        "Cannot delete an APPROVED quote because it has reserved inventory. Please ANNUL the quote first to release the stock before deleting."
      );
    }

    await (this.prisma as any).quote.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      } as any,
    });

    this.logger.log(`[DELETE] Quote ${quote.quoteNumber} soft deleted`);
  }

  /**
   * Calculate quote totals
   */
  private calculateQuoteTotals(
    items: CreateQuoteDto["items"],
    discountCodeValue: number,
    manualDiscount: number,
    itemsDiscountTotal: number,
    includeTax: boolean
  ): { subtotal: number; taxes: number; totalAmount: number } {
    // Calculate items subtotal
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    // Calculate order discount
    const orderDiscount = discountCodeValue + manualDiscount;

    // Calculate total discount
    const totalDiscount = orderDiscount + itemsDiscountTotal;

    // Apply discounts to subtotal
    const subtotalAfterDiscounts = subtotal - totalDiscount;

    // Calculate taxes (15% default)
    const taxes = includeTax
      ? Number((subtotalAfterDiscounts * DEFAULT_TAX_RATE).toFixed(2))
      : 0;

    // Calculate total
    const totalAmount = Number((subtotalAfterDiscounts + taxes).toFixed(2));

    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxes,
      totalAmount,
    };
  }

  /**
   * Validate branch and location
   */
  private async validateBranchAndLocation(
    branchId: string | undefined,
    locationId: string,
    tx: any
  ): Promise<void> {
    if (branchId) {
      const branch = await tx.branch.findFirst({
        where: { id: branchId, isDeleted: false, isActive: true },
      });

      if (!branch) {
        throw new NotFoundException("Branch not found or inactive");
      }
    }

    const location = await tx.location.findFirst({
      where: { id: locationId, isDeleted: false },
    });

    if (!location) {
      throw new NotFoundException("Location not found");
    }
  }

  /**
   * Validate customer
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
   * Validate employees
   */
  private async validateEmployees(
    sellerId: string,
    cashierId: string,
    tx: any
  ): Promise<void> {
    const seller = await tx.employee.findFirst({
      where: { id: sellerId, isDeleted: false, isActive: true },
    });

    if (!seller) {
      throw new NotFoundException("Seller not found or inactive");
    }

    const cashier = await tx.employee.findFirst({
      where: { id: cashierId, isDeleted: false, isActive: true },
    });

    if (!cashier) {
      throw new NotFoundException("Cashier not found or inactive");
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
      where: { id: discountCodeId, isDeleted: false, isActive: true },
    });

    if (!discountCode) {
      throw new NotFoundException("Discount code not found or inactive");
    }

    // Check if discount code is within valid date range
    const now = new Date();
    if (discountCode.startDate && new Date(discountCode.startDate) > now) {
      throw new BadRequestException("Discount code is not yet valid");
    }

    if (discountCode.endDate && new Date(discountCode.endDate) < now) {
      throw new BadRequestException("Discount code has expired");
    }

    // If customer is provided, check if they have access to this discount code
    if (customerId) {
      const customerDiscountCode = await tx.customerDiscountCode.findFirst({
        where: {
          customerId,
          discountCodeId,
          isDeleted: false,
        },
        include: {
          discountCode: true,
        },
      });

      if (!customerDiscountCode) {
        throw new BadRequestException(
          "Customer does not have access to this discount code"
        );
      }
    }
  }

  /**
   * Map Prisma quote to DTO
   */
  private mapToDto(quote: any): QuoteDto {
    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber || undefined,
      customerId: quote.customerId || undefined,
      branchId: quote.branchId || undefined,
      locationId: quote.locationId || undefined,
      sellerId: quote.sellerId || undefined,
      cashierId: quote.cashierId || undefined,
      createdBy: quote.createdBy || undefined,
      status: quote.status,
      validUntil: quote.validUntil || undefined,
      discountCodeId: quote.discountCodeId || undefined,
      discountCodeValue: quote.discountCodeValue
        ? Number(quote.discountCodeValue)
        : undefined,
      manualDiscount: quote.manualDiscount
        ? Number(quote.manualDiscount)
        : undefined,
      itemsDiscountTotal: quote.itemsDiscountTotal
        ? Number(quote.itemsDiscountTotal)
        : undefined,
      discountAmount: quote.discountAmount
        ? Number(quote.discountAmount)
        : undefined,
      subtotal: quote.subtotal ? Number(quote.subtotal) : undefined,
      taxes: quote.taxes ? Number(quote.taxes) : undefined,
      totalAmount: quote.totalAmount ? Number(quote.totalAmount) : undefined,
      includeTax: quote.includeTax,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      metadata: quote.metadata || {},
      items: quote.items
        ? quote.items.map((item: any) => ({
            id: item.id,
            quoteId: item.quoteId,
            productId: item.productId || undefined,
            productVariantId: item.productVariantId || undefined,
            priceTypeId: item.priceTypeId || undefined,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discountAmount: item.discountAmount
              ? Number(item.discountAmount)
              : undefined,
            taxAmount: item.taxAmount ? Number(item.taxAmount) : undefined,
            lineTotal: Number(item.lineTotal),
            metadata: item.metadata || {},
            product: item.product || undefined,
            productVariant: item.productVariant
              ? {
                  ...item.productVariant,
                  prices: item.productVariant.prices
                    ? item.productVariant.prices.map((price: any) => ({
                        priceTypeId: price.priceTypeId,
                        priceTypeName: price.priceType?.name || "",
                        price: Number(price.price),
                        minQuantity: price.minQuantity || 1,
                        priority: price.priceType?.priority || 999,
                        priceType: price.priceType
                          ? {
                              id: price.priceType.id,
                              name: price.priceType.name,
                              priority: price.priceType.priority || 999,
                            }
                          : undefined,
                      }))
                    : [],
                }
              : undefined,
          }))
        : undefined,
      customer: quote.customer
        ? {
            id: quote.customer.id,
            person: quote.customer.person,
            customerType: quote.customer.customerType,
            creditAllowed: quote.customer.creditAllowed,
            creditLimit: quote.customer.creditLimit
              ? Number(quote.customer.creditLimit)
              : undefined,
          }
        : undefined,
      seller: quote.seller || undefined,
      cashier: quote.cashier || undefined,
      location: quote.location || undefined,
      branch: quote.branch || undefined,
      creator: quote.creator || undefined,
      discountCode: quote.discountCode || undefined,
      orderId:
        quote.orders && quote.orders.length > 0
          ? quote.orders[0].id
          : undefined,
    };
  }

  async getQuotePdfData(quoteId: string): Promise<QuotePdfData> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: { include: { person: true } },
        seller: { include: { person: true } },
        cashier: { include: { person: true } },
        branch: true,
        location: true,
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  include: {
                    brand: true,
                    kitItems: {
                      include: {
                        productVariant: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    return {
      companyName: "Esli Cosmetics",
      branchName: quote.branch ? quote.branch.name : "",
      locationName: quote.location ? quote.location.name : "",
      quoteNumber: quote.quoteNumber,
      date: quote.createdAt ? quote.createdAt.toISOString() : "",
      cashier: quote.cashier
        ? `${quote.cashier.person.firstName} ${quote.cashier.person.lastName}`.trim()
        : "",
      seller: quote.seller
        ? `${quote.seller.person.firstName} ${quote.seller.person.lastName}`.trim()
        : "",
      customer: quote.customer
        ? `${quote.customer.person.firstName} ${quote.customer.person.lastName}`.trim()
        : "",
      items: quote.items.map(item => {
        const product = item.productVariant?.product;
        const isKit = product?.type === ProductType.KIT;

        let kitDetails = "";
        if (isKit && product?.kitItems) {
          kitDetails = product.kitItems
            .map(ki => `${ki.quantity}x ${ki.productVariant.name}`)
            .join(", ");
        }

        return {
          id: item.id,
          parentName: product?.name ?? undefined,
          variantName: item.productVariant?.name ?? undefined,
          sku: item.productVariant?.sku ?? undefined,
          name: item.productVariant?.name ?? product?.name ?? "",
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discountAmount: item.discountAmount ? Number(item.discountAmount) : 0,
          taxAmount: item.taxAmount ? Number(item.taxAmount) : 0,
          lineTotal:
            typeof item.lineTotal === "number"
              ? Number(item.lineTotal)
              : Number(item.unitPrice) * item.quantity -
                (item.discountAmount ? Number(item.discountAmount) : 0),
          metadata: {
            ...((item.metadata as any) || {}),
            isKit,
            kitContents: kitDetails,
            components: isKit
              ? product.kitItems.map(ki => ({
                  name: ki.productVariant.name,
                  qty: ki.quantity,
                }))
              : [],
          },
        };
      }),
      subtotal: Number(quote.subtotal ?? 0),
      itemsDiscountTotal: Number(quote.itemsDiscountTotal ?? 0),
      discountCodeValue: quote.discountCodeValue
        ? Number(quote.discountCodeValue)
        : undefined,
      manualDiscount: Number(quote.manualDiscount ?? 0),
      totalDiscount: Number(quote.discountAmount ?? 0),
      taxes: Number(quote.taxes ?? 0),
      iva: Number(quote.includeTax ?? 0),
      totalAmount: Number(quote.totalAmount ?? 0),

      thankYouMessage: "¡Gracias por su preferencia!",
      contactMessage: "Para consultas, contáctenos.",

      quoteType: quote.status as QuotePdfType,
      status: quote.status as QuotePdfType,
      validUntil: quote.validUntil ? quote.validUntil.toISOString() : undefined,
      metadata: quote.metadata ?? undefined,
    };
  }
}
