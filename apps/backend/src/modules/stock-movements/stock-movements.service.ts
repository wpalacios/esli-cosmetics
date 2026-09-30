import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";
import { StockMovementDto } from "./dto/stock-movement.dto";
import { PaginatedStockMovementDto } from "./dto/paginated-stock-movement.dto";
import { BulkPurchaseImportDto } from "./dto/bulk-purchase-import.dto";
import { ResolveVariantDisplayNamesDto } from "./dto/resolve-variant-display-names.dto";
import { LocationType, Prisma, StockMovementType } from "@prisma/client";
import { zonedDayRangeToUtc } from "../../common/date-range/date-range.util";
import { StockLevelNotificationService } from "../stock-levels/stock-level-notification.service";
import { ProductVariantPricesService } from "../product-variants/product-variant-prices.service";
import {
  StockMovementReportData,
  StockMovementReportItem,
  StockMovementExportFilters,
  StockMovementPreviewRow,
  PaginatedStockMovements,
} from "../reports/types/stock-movements-types";

interface StockLevelUpdate {
  productId: string | null;
  productVariantId: string | null;
  locationId: string;
  delta: number; // Positive for increase, negative for decrease
}

interface MovementValidationRules {
  fromLocationRequired: boolean;
  toLocationRequired: boolean;
  fromLocationType?: LocationType;
  toLocationType?: LocationType;
  noteRequired: boolean;
  referenceRequired: boolean;
  requiresStockCheck: boolean;
  quantityMustBePositive: boolean;
}

@Injectable()
export class StockMovementsService {
  private readonly logger = new Logger(StockMovementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => StockLevelNotificationService))
    private readonly stockLevelNotificationService: StockLevelNotificationService,
    private readonly productVariantPricesService: ProductVariantPricesService
  ) {}

  /**
   * Create a stock movement with automatic stock level updates
   * Uses database transaction to ensure consistency
   */
  async create(
    createDto: CreateStockMovementDto,
    userId?: string
  ): Promise<StockMovementDto> {
    const result = await this.prisma.$transaction(async tx => {
      return this.createWithTransaction(createDto, tx, userId);
    });

    // Check for low stock after transaction completes
    // Only check for movements that deduct stock
    if (
      this.isDeductingMovement(createDto.movementType) &&
      createDto.productVariantId
    ) {
      const locationId = createDto.fromLocationId || createDto.toLocationId;
      if (locationId) {
        //executing in background
        this.stockLevelNotificationService
          .checkAndNotifyLowStock(createDto.productVariantId, locationId)
          .catch(error => {
            this.logger.error(
              `Error checking low stock for product variant ${createDto.productVariantId} at location ${locationId}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          });
      }
    }

    return result;
  }

  /**
   * Create a stock movement within an existing transaction
   * Use this method when you're already inside a transaction
   */
  async createWithTransaction(
    createDto: CreateStockMovementDto,
    tx: Prisma.TransactionClient,
    userId?: string
  ): Promise<StockMovementDto> {
    // 1. Validate movement type rules
    await this.validateMovementRules(createDto, tx);

    // 2. Check stock availability if required
    if (this.requiresStockCheck(createDto.movementType)) {
      await this.validateStockAvailability(createDto, tx);
    }

    // 3. Create the stock movement (immutable record)
    const stockMovement = await tx.stockMovement.create({
      data: {
        productVariantId: createDto.productVariantId,
        productId: createDto.productId,
        fromLocationId: createDto.fromLocationId,
        toLocationId: createDto.toLocationId,
        movementType: createDto.movementType,
        quantity: createDto.quantity,
        reference: createDto.reference,
        note: createDto.note,
        metadata: createDto.metadata ?? {},
        createdBy: userId,
      },
      include: {
        productVariant: {
          include: {
            product: true,
          },
        },
        product: true,
        fromLocation: true,
        toLocation: true,
        creator: { select: { id: true, email: true } },
      },
    });

    // 4. Update stock levels (derived data)
    await this.updateStockLevels(stockMovement, tx);

    return this.mapToDto(stockMovement);
  }

  /**
   * Throws if a movement DTO has neither productId nor productVariantId.
   * `createWithTransaction` already enforces this for single movements via
   * `validateMovementRules`; the bulk entry points used to bypass that check,
   * which is how the production DB accumulated 473 orphan movements before
   * 2026-05. Every bulk creator now calls this on each row to close that gap.
   */
  private assertMovementHasProductReference(
    createDto: CreateStockMovementDto
  ): void {
    if (!createDto.productVariantId && !createDto.productId) {
      throw new BadRequestException(
        `Stock movement is missing a product reference: ${createDto.movementType} qty=${createDto.quantity} ref=${createDto.reference ?? "—"}`
      );
    }
  }

  /**
   * Create multiple stock movements within an existing sale order transaction.
   * Uses atomic UPSERT for stock_levels (same path as transfers/purchases) and
   * refuses to write movements unless every sale line resolves to an existing row.
   */
  async createSaleOrderMovements(
    createDtos: CreateStockMovementDto[],
    tx: Prisma.TransactionClient,
    userId?: string,
    options?: { alsoReleaseReserved?: boolean }
  ): Promise<StockMovementDto[]> {
    if (createDtos.length === 0) {
      return [];
    }

    for (const dto of createDtos) this.assertMovementHasProductReference(dto);

    const stockLevelUpdatesMap = new Map<string, StockLevelUpdate>();

    for (const createDto of createDtos) {
      if (
        createDto.movementType === StockMovementType.SALE &&
        createDto.fromLocationId
      ) {
        const key = `${createDto.productId || "null"}-${
          createDto.productVariantId || "null"
        }-${createDto.fromLocationId}`;

        const existing = stockLevelUpdatesMap.get(key);
        if (existing) {
          existing.delta -= Number(createDto.quantity);
        } else {
          stockLevelUpdatesMap.set(key, {
            productId: createDto.productId,
            productVariantId: createDto.productVariantId,
            locationId: createDto.fromLocationId,
            delta: -Number(createDto.quantity),
          });
        }
      }
    }

    const updates = Array.from(stockLevelUpdatesMap.values());

    let existingStockLevels: Array<{
      id: string;
      productId: string | null;
      productVariantId: string | null;
      locationId: string;
    }> = [];

    if (updates.length > 0) {
      const whereConditions = updates.map(update => ({
        productId: update.productId,
        productVariantId: update.productVariantId,
        locationId: update.locationId,
      }));

      existingStockLevels = await tx.stockLevel.findMany({
        where: { OR: whereConditions },
        select: {
          id: true,
          productId: true,
          productVariantId: true,
          locationId: true,
        },
      });

      const foundKeys = new Set(
        existingStockLevels.map(
          sl =>
            `${sl.productId ?? "null"}-${sl.productVariantId ?? "null"}-${sl.locationId}`
        )
      );

      for (const update of updates) {
        const key = `${update.productId ?? "null"}-${
          update.productVariantId ?? "null"
        }-${update.locationId}`;
        if (!foundKeys.has(key)) {
          throw new BadRequestException(
            `No hay registro de inventario en esta ubicación para la variante ${update.productVariantId ?? update.productId}. Cree el nivel de stock antes de registrar la venta.`
          );
        }
      }
    }

    const saleDtos = createDtos.filter(
      dto =>
        dto.movementType === StockMovementType.SALE &&
        dto.fromLocationId != null
    );
    if (saleDtos.length > 0 && updates.length === 0) {
      throw new BadRequestException(
        "Las líneas de venta no pudieron vincularse a registros de inventario."
      );
    }

    if (updates.length > 0) {
      await this.batchUpdateStockLevels(updates, tx);

      if (options?.alsoReleaseReserved) {
        const saleQtyByStockLevelId = new Map<string, number>();

        for (const row of existingStockLevels) {
          const key = `${row.productId ?? "null"}-${
            row.productVariantId ?? "null"
          }-${row.locationId}`;
          const update = stockLevelUpdatesMap.get(key);
          if (update) {
            saleQtyByStockLevelId.set(row.id, Math.abs(update.delta));
          }
        }

        const ids = Array.from(saleQtyByStockLevelId.keys());
        const qtys = ids.map(id => saleQtyByStockLevelId.get(id)!);

        if (ids.length > 0) {
          await tx.$executeRaw`
            UPDATE stock_levels
            SET
              reserved = GREATEST(0::numeric, reserved - updates.qty::numeric),
              updated_at = NOW()
            FROM (
              SELECT
                unnest(${ids}::uuid[]) AS id,
                unnest(${qtys}::numeric[]) AS qty
            ) AS updates
            WHERE stock_levels.id = updates.id
          `;
        }
      }
    }

    const movementsData = createDtos.map(createDto => ({
      productVariantId: createDto.productVariantId,
      productId: createDto.productId,
      fromLocationId: createDto.fromLocationId,
      toLocationId: createDto.toLocationId,
      movementType: createDto.movementType,
      quantity: createDto.quantity,
      reference: createDto.reference,
      note: createDto.note,
      metadata: createDto.metadata ?? {},
      transferId: createDto.transferId,
      createdBy: userId,
    }));

    await tx.stockMovement.createMany({
      data: movementsData,
    });

    if (updates.length > 0) {
      // Check for low stock after batch update completes
      // Collect all product variant + location combinations that need checking
      const lowStockChecks: Array<{
        productVariantId: string;
        locationId: string;
        currentQuantity: number;
      }> = [];

      // Fetch updated stock levels to get current quantities
      const whereConditions = updates.map(update => ({
        productId: update.productId,
        productVariantId: update.productVariantId,
        locationId: update.locationId,
      }));

      if (whereConditions.length > 0) {
        const updatedStockLevels = await tx.stockLevel.findMany({
          where: {
            OR: whereConditions,
          },
        });

        // Build checks array with current quantities
        for (const stockLevel of updatedStockLevels) {
          if (stockLevel.productVariantId && stockLevel.locationId) {
            lowStockChecks.push({
              productVariantId: stockLevel.productVariantId,
              locationId: stockLevel.locationId,
              currentQuantity: Number(stockLevel.quantity),
            });
          }
        }

        // Batch check and notify for low stock
        if (lowStockChecks.length > 0) {
          //executing in background
          this.stockLevelNotificationService
            .checkAndNotifyMultiple(lowStockChecks)
            .catch(error => {
              this.logger.error(
                `Error checking low stock for multiple product variants: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            });
        }
      }
    }

    // Note: We don't return the created movements since they're not needed for the response
    // If needed in the future, we can fetch them, but for now this saves a query
    return [];
  }

  /**
   * Create multiple stock movements for annulment (ANNULMENT type).
   * Stock comes back to the location (increases stock at toLocation).
   * Updates stock_levels before writing movements (same safety order as sales).
   */
  async createSaleAnnulmentMovements(
    createDtos: CreateStockMovementDto[],
    tx: Prisma.TransactionClient,
    userId?: string
  ): Promise<StockMovementDto[]> {
    if (createDtos.length === 0) {
      return [];
    }

    for (const dto of createDtos) this.assertMovementHasProductReference(dto);

    const stockLevelUpdatesMap = new Map<string, StockLevelUpdate>();

    for (const createDto of createDtos) {
      if (
        createDto.movementType === StockMovementType.ANNULMENT &&
        createDto.toLocationId
      ) {
        const key = `${createDto.productId || "null"}-${
          createDto.productVariantId || "null"
        }-${createDto.toLocationId}`;

        const existing = stockLevelUpdatesMap.get(key);
        if (existing) {
          existing.delta += Number(createDto.quantity);
        } else {
          stockLevelUpdatesMap.set(key, {
            productId: createDto.productId,
            productVariantId: createDto.productVariantId,
            locationId: createDto.toLocationId,
            delta: Number(createDto.quantity),
          });
        }
      }
    }

    const updates = Array.from(stockLevelUpdatesMap.values());

    const annulmentDtos = createDtos.filter(
      dto =>
        dto.movementType === StockMovementType.ANNULMENT &&
        dto.toLocationId != null
    );
    if (annulmentDtos.length > 0 && updates.length === 0) {
      throw new BadRequestException(
        "Las líneas de anulación no pudieron vincularse a registros de inventario."
      );
    }

    if (updates.length > 0) {
      await this.batchUpdateStockLevels(updates, tx);
    }

    const movementsData = createDtos.map(createDto => ({
      productVariantId: createDto.productVariantId,
      productId: createDto.productId,
      fromLocationId: createDto.fromLocationId,
      toLocationId: createDto.toLocationId,
      movementType: createDto.movementType,
      quantity: createDto.quantity,
      reference: createDto.reference,
      note: createDto.note,
      metadata: createDto.metadata ?? {},
      transferId: createDto.transferId,
      createdBy: userId,
    }));

    await tx.stockMovement.createMany({
      data: movementsData,
    });

    return [];
  }

  /**
   * Create multiple PURCHASE movements (increase stock at toLocation).
   */
  private async createBulkPurchaseMovements(
    createDtos: CreateStockMovementDto[],
    tx: Prisma.TransactionClient,
    userId?: string
  ): Promise<void> {
    if (createDtos.length === 0) {
      return;
    }

    for (const dto of createDtos) this.assertMovementHasProductReference(dto);

    const stockLevelUpdatesMap = new Map<string, StockLevelUpdate>();

    for (const createDto of createDtos) {
      if (
        createDto.movementType === StockMovementType.PURCHASE &&
        createDto.toLocationId
      ) {
        const key = `${createDto.productId || "null"}-${
          createDto.productVariantId || "null"
        }-${createDto.toLocationId}`;

        const existing = stockLevelUpdatesMap.get(key);
        if (existing) {
          existing.delta += Number(createDto.quantity);
        } else {
          stockLevelUpdatesMap.set(key, {
            productId: createDto.productId,
            productVariantId: createDto.productVariantId,
            locationId: createDto.toLocationId,
            delta: Number(createDto.quantity),
          });
        }
      }
    }

    const updates = Array.from(stockLevelUpdatesMap.values());
    const purchaseDtos = createDtos.filter(
      dto =>
        dto.movementType === StockMovementType.PURCHASE &&
        dto.toLocationId != null
    );
    if (purchaseDtos.length > 0 && updates.length === 0) {
      throw new BadRequestException(
        "Las líneas de compra no pudieron vincularse a registros de inventario."
      );
    }

    if (updates.length > 0) {
      await this.batchUpdateStockLevels(updates, tx);
    }

    const movementsData = createDtos.map(createDto => ({
      productVariantId: createDto.productVariantId,
      productId: createDto.productId,
      fromLocationId: createDto.fromLocationId,
      toLocationId: createDto.toLocationId,
      movementType: createDto.movementType,
      quantity: createDto.quantity,
      reference: createDto.reference,
      note: createDto.note,
      metadata: createDto.metadata ?? {},
      transferId: createDto.transferId,
      createdBy: userId,
    }));

    await tx.stockMovement.createMany({
      data: movementsData,
    });
  }

  /**
   * Create multiple stock movements for transfers (TRANSFER, DAMAGE, NEGATIVE_ADJUSTMENT types)
   * TRANSFER: decreases stock at fromLocation, increases at toLocation
   * DAMAGE/NEGATIVE_ADJUSTMENT: decreases stock (if fromLocationId is provided)
   */
  async createTransferMovements(
    createDtos: CreateStockMovementDto[],
    tx: Prisma.TransactionClient,
    userId?: string
  ): Promise<StockMovementDto[]> {
    if (createDtos.length === 0) {
      return [];
    }

    for (const dto of createDtos) this.assertMovementHasProductReference(dto);

    const stockLevelUpdatesMap = new Map<string, StockLevelUpdate>();

    for (const createDto of createDtos) {
      if (createDto.movementType === StockMovementType.TRANSFER) {
        if (createDto.fromLocationId) {
          const fromKey = `${createDto.productId || "null"}-${
            createDto.productVariantId || "null"
          }-${createDto.fromLocationId}`;

          const existingFrom = stockLevelUpdatesMap.get(fromKey);
          if (existingFrom) {
            existingFrom.delta -= Number(createDto.quantity);
          } else {
            stockLevelUpdatesMap.set(fromKey, {
              productId: createDto.productId,
              productVariantId: createDto.productVariantId,
              locationId: createDto.fromLocationId,
              delta: -Number(createDto.quantity),
            });
          }
        }

        if (createDto.toLocationId) {
          const toKey = `${createDto.productId || "null"}-${
            createDto.productVariantId || "null"
          }-${createDto.toLocationId}`;

          const existingTo = stockLevelUpdatesMap.get(toKey);
          if (existingTo) {
            existingTo.delta += Number(createDto.quantity);
          } else {
            stockLevelUpdatesMap.set(toKey, {
              productId: createDto.productId,
              productVariantId: createDto.productVariantId,
              locationId: createDto.toLocationId,
              delta: Number(createDto.quantity),
            });
          }
        }
      } else if (
        (createDto.movementType === StockMovementType.DAMAGE ||
          createDto.movementType === StockMovementType.NEGATIVE_ADJUSTMENT) &&
        createDto.fromLocationId
      ) {
        const key = `${createDto.productId || "null"}-${
          createDto.productVariantId || "null"
        }-${createDto.fromLocationId}`;

        const existing = stockLevelUpdatesMap.get(key);
        if (existing) {
          existing.delta -= Number(createDto.quantity);
        } else {
          stockLevelUpdatesMap.set(key, {
            productId: createDto.productId,
            productVariantId: createDto.productVariantId,
            locationId: createDto.fromLocationId,
            delta: -Number(createDto.quantity),
          });
        }
      } else if (
        createDto.movementType === StockMovementType.RETURN &&
        createDto.toLocationId
      ) {
        const key = `${createDto.productId || "null"}-${
          createDto.productVariantId || "null"
        }-${createDto.toLocationId}`;

        const existing = stockLevelUpdatesMap.get(key);
        if (existing) {
          existing.delta += Number(createDto.quantity);
        } else {
          stockLevelUpdatesMap.set(key, {
            productId: createDto.productId,
            productVariantId: createDto.productVariantId,
            locationId: createDto.toLocationId,
            delta: Number(createDto.quantity),
          });
        }
      }
    }

    const updates = Array.from(stockLevelUpdatesMap.values());
    const stockAffectingDtos = createDtos.filter(
      dto =>
        dto.movementType === StockMovementType.TRANSFER ||
        dto.movementType === StockMovementType.DAMAGE ||
        dto.movementType === StockMovementType.NEGATIVE_ADJUSTMENT ||
        dto.movementType === StockMovementType.RETURN
    );
    if (stockAffectingDtos.length > 0 && updates.length === 0) {
      throw new BadRequestException(
        "Las líneas de traslado/ajuste no pudieron vincularse a registros de inventario."
      );
    }

    if (updates.length > 0) {
      await this.batchUpdateStockLevels(updates, tx);
    }

    const movementsData = createDtos.map(createDto => ({
      productVariantId: createDto.productVariantId,
      productId: createDto.productId,
      fromLocationId: createDto.fromLocationId,
      toLocationId: createDto.toLocationId,
      movementType: createDto.movementType,
      quantity: createDto.quantity,
      reference: createDto.reference,
      note: createDto.note,
      metadata: createDto.metadata ?? {},
      transferId: createDto.transferId,
      createdBy: userId,
    }));

    await tx.stockMovement.createMany({
      data: movementsData,
    });

    return [];
  }

  /**
   * Validate movement rules based on movement type
   */
  private async validateMovementRules(
    createDto: CreateStockMovementDto,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    // Validate that at least one product identifier is provided
    if (!createDto.productVariantId && !createDto.productId) {
      throw new BadRequestException(
        "Either productVariantId or productId must be provided"
      );
    }

    // Get validation rules for this movement type
    const rules = this.getValidationRules(createDto.movementType);

    // Validate quantity
    if (rules.quantityMustBePositive && createDto.quantity <= 0) {
      throw new BadRequestException("Quantity must be positive");
    }

    // Validate locations
    if (rules.fromLocationRequired && !createDto.fromLocationId) {
      throw new BadRequestException(
        `fromLocation is required for ${createDto.movementType}`
      );
    }

    if (rules.toLocationRequired && !createDto.toLocationId) {
      throw new BadRequestException(
        `toLocation is required for ${createDto.movementType}`
      );
    }

    // Validate required fields
    if (rules.noteRequired && !createDto.note) {
      throw new BadRequestException(
        `Note is required for ${createDto.movementType}`
      );
    }

    if (rules.referenceRequired && !createDto.reference) {
      throw new BadRequestException(
        `Reference is required for ${createDto.movementType}`
      );
    }

    // Validate product variant if provided
    if (createDto.productVariantId) {
      const productVariant = await tx.productVariant.findFirst({
        where: {
          id: createDto.productVariantId,
          isDeleted: false,
          isActive: true,
        },
      });
      if (!productVariant) {
        throw new NotFoundException("Product variant not found or inactive");
      }
    }

    // Validate product if provided
    if (createDto.productId) {
      const product = await tx.product.findFirst({
        where: {
          id: createDto.productId,
          isDeleted: false,
          isActive: true,
        },
      });
      if (!product) {
        throw new NotFoundException("Product not found or inactive");
      }
    }

    // Validate fromLocation if provided
    if (createDto.fromLocationId) {
      const fromLocation = await tx.location.findFirst({
        where: { id: createDto.fromLocationId, isDeleted: false },
        select: { id: true, locationType: true, name: true },
      });
      if (!fromLocation) {
        throw new NotFoundException("Source location not found or inactive");
      }

      // Validate location type if specified in rules
      if (
        rules.fromLocationType &&
        fromLocation.locationType !== rules.fromLocationType
      ) {
        throw new BadRequestException(
          `Source location must be of type ${rules.fromLocationType}`
        );
      }
    }

    // Validate toLocation if provided
    if (createDto.toLocationId) {
      const toLocation = await tx.location.findFirst({
        where: { id: createDto.toLocationId, isDeleted: false },
        select: { id: true, locationType: true, name: true },
      });
      if (!toLocation) {
        throw new NotFoundException(
          "Destination location not found or inactive"
        );
      }

      // Validate location type if specified in rules
      if (
        rules.toLocationType &&
        toLocation.locationType !== rules.toLocationType
      ) {
        throw new BadRequestException(
          `Destination location must be of type ${rules.toLocationType}`
        );
      }
    }

    // Special validations
    if (createDto.movementType === StockMovementType.RETURN) {
      this.validateReturn(createDto);
    }

    if (createDto.movementType === StockMovementType.ANNULMENT) {
      this.validateAnnulment(createDto);
    }
  }

  /**
   * Get validation rules for a specific movement type
   */
  private getValidationRules(
    movementType: StockMovementType
  ): MovementValidationRules {
    const rules: Record<string, MovementValidationRules> = {
      [StockMovementType.PURCHASE]: {
        fromLocationRequired: false,
        toLocationRequired: true,
        noteRequired: false,
        referenceRequired: true,
        requiresStockCheck: false,
        quantityMustBePositive: true,
      },
      [StockMovementType.SALE]: {
        fromLocationRequired: true,
        toLocationRequired: false,
        noteRequired: false,
        referenceRequired: false,
        requiresStockCheck: true,
        quantityMustBePositive: true,
      },
      POSITIVE_ADJUSTMENT: {
        fromLocationRequired: false,
        toLocationRequired: true,
        noteRequired: true,
        referenceRequired: false,
        requiresStockCheck: false,
        quantityMustBePositive: true,
      },
      NEGATIVE_ADJUSTMENT: {
        fromLocationRequired: true,
        toLocationRequired: false,
        noteRequired: true,
        referenceRequired: false,
        requiresStockCheck: true, // Need to check stock availability
        quantityMustBePositive: true,
      },
      [StockMovementType.TRANSFER]: {
        fromLocationRequired: true,
        toLocationRequired: true,
        noteRequired: false,
        referenceRequired: false,
        requiresStockCheck: true,
        quantityMustBePositive: true,
      },
      [StockMovementType.DAMAGE]: {
        fromLocationRequired: true,
        toLocationRequired: false,
        noteRequired: true,
        referenceRequired: false,
        requiresStockCheck: true,
        quantityMustBePositive: true,
      },
      [StockMovementType.RETURN]: {
        fromLocationRequired: false, // Conditional - only toLocation for customer returns
        toLocationRequired: false, // Conditional - only toLocation for customer returns (stock coming back)
        noteRequired: false,
        referenceRequired: true,
        requiresStockCheck: false, // Stock is coming back, no need to check
        quantityMustBePositive: true,
      },
      [StockMovementType.ANNULMENT]: {
        fromLocationRequired: false, // Conditional - only toLocation for annulments (same as RETURN)
        toLocationRequired: false, // Conditional - only toLocation for annulments (stock coming back)
        noteRequired: false,
        referenceRequired: false,
        requiresStockCheck: false, // Stock is coming back, no need to check (same as RETURN)
        quantityMustBePositive: true,
      },
      [StockMovementType.RESTOCK]: {
        fromLocationRequired: true,
        toLocationRequired: true,
        noteRequired: false,
        referenceRequired: false,
        requiresStockCheck: true,
        quantityMustBePositive: true,
      },
    };

    const rule = rules[movementType];
    if (!rule) {
      throw new BadRequestException(`Invalid movement type: ${movementType}`);
    }
    return rule;
  }

  /**
   * Check if a movement type requires stock availability check
   */
  private requiresStockCheck(movementType: StockMovementType): boolean {
    const rules = this.getValidationRules(movementType);
    return rules.requiresStockCheck;
  }

  /**
   * Validate stock availability for movements that remove stock
   */
  private async validateStockAvailability(
    createDto: CreateStockMovementDto,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    if (!createDto.fromLocationId) {
      return; // No need to check if no source location
    }

    const stockLevel = await tx.stockLevel.findFirst({
      where: {
        productId: createDto.productId,
        productVariantId: createDto.productVariantId,
        locationId: createDto.fromLocationId,
      },
    });

    const currentQuantity = stockLevel ? Number(stockLevel.quantity) : 0;
    const reservedQuantity = stockLevel ? Number(stockLevel.reserved) : 0;
    const availableQuantity = currentQuantity - reservedQuantity;

    if (availableQuantity < createDto.quantity) {
      const productName = createDto.productId
        ? (
            await tx.product.findUnique({
              where: { id: createDto.productId },
              select: { name: true },
            })
          )?.name
        : "Product";

      throw new ConflictException(
        `Insufficient stock. Available: ${availableQuantity}, Requested: ${createDto.quantity} for ${productName}`
      );
    }
  }

  /**
   * Validate return movement (only toLocation allowed - stock coming back from customer)
   */
  private validateReturn(createDto: CreateStockMovementDto): void {
    if (!createDto.toLocationId) {
      throw new BadRequestException(
        "RETURN movement must have toLocation (stock coming back from customer)"
      );
    }

    if (createDto.fromLocationId) {
      throw new BadRequestException(
        "RETURN movement must only have toLocation (not fromLocation). Returns are only for customer returns, not supplier returns."
      );
    }
  }

  /**
   * Validate annulment movement (only toLocation allowed - stock coming back, same as RETURN)
   */
  private validateAnnulment(createDto: CreateStockMovementDto): void {
    if (!createDto.toLocationId) {
      throw new BadRequestException(
        "ANNULMENT movement must have toLocation (stock coming back from annulled order)"
      );
    }

    if (createDto.fromLocationId) {
      throw new BadRequestException(
        "ANNULMENT movement must only have toLocation (not fromLocation). Annulments are only for sales orders, not supplier returns."
      );
    }
  }

  /**
   * Calculate and apply stock level updates based on movement type
   */
  private async updateStockLevels(
    movement: {
      movementType: StockMovementType;
      productId: string | null;
      productVariantId: string | null;
      fromLocationId: string | null;
      toLocationId: string | null;
      quantity: Prisma.Decimal;
    },
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const updates = this.calculateStockLevelUpdates(movement);

    for (const update of updates) {
      await this.applyStockLevelUpdate(update, tx);
    }
  }

  /**
   * Calculate which stock levels to update and by how much
   */
  private calculateStockLevelUpdates(movement: {
    movementType: StockMovementType;
    productId: string | null;
    productVariantId: string | null;
    fromLocationId: string | null;
    toLocationId: string | null;
    quantity: Prisma.Decimal;
  }): StockLevelUpdate[] {
    const updates: StockLevelUpdate[] = [];

    switch (movement.movementType) {
      case StockMovementType.SALE:
        // Stock going out
        updates.push({
          locationId: movement.fromLocationId,
          productId: movement.productId,
          productVariantId: movement.productVariantId,
          delta: -Number(movement.quantity),
        });
        break;

      case "NEGATIVE_ADJUSTMENT":
        // Stock being deducted
        updates.push({
          locationId: movement.fromLocationId,
          productId: movement.productId,
          productVariantId: movement.productVariantId,
          delta: -Number(movement.quantity),
        });
        break;

      case StockMovementType.TRANSFER:
      case StockMovementType.RESTOCK:
        // Decrease from source
        updates.push({
          locationId: movement.fromLocationId,
          productId: movement.productId,
          productVariantId: movement.productVariantId,
          delta: -Number(movement.quantity),
        });
        // Increase at destination
        updates.push({
          locationId: movement.toLocationId,
          productId: movement.productId,
          productVariantId: movement.productVariantId,
          delta: Number(movement.quantity),
        });
        break;

      case StockMovementType.DAMAGE:
        // Stock being written off
        updates.push({
          locationId: movement.fromLocationId,
          productId: movement.productId,
          productVariantId: movement.productVariantId,
          delta: -Number(movement.quantity),
        });
        break;

      case StockMovementType.PURCHASE:
      case StockMovementType.POSITIVE_ADJUSTMENT:
      case StockMovementType.ANNULMENT:
      case StockMovementType.RETURN:
        updates.push({
          locationId: movement.toLocationId,
          productId: movement.productId,
          productVariantId: movement.productVariantId,
          delta: Number(movement.quantity),
        });

        break;
    }

    return updates;
  }

  /**
   * Apply a single stock level update atomically.
   *
   * Uses INSERT ... ON CONFLICT DO UPDATE so the operation is a single
   * round-trip and is safe under concurrent load: PostgreSQL takes a
   * row-level lock on the conflicting row and serializes the increment.
   * Requires the (product_id, product_variant_id, location_id) unique index
   * to be NULLS NOT DISTINCT (see migration 20260522180000_stock_levels_atomic_upsert)
   * so products without a variant resolve correctly to a single stock level row.
   */
  private async applyStockLevelUpdate(
    update: StockLevelUpdate,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO stock_levels (
        id, product_id, product_variant_id, location_id, quantity, reserved, updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${update.productId}::uuid,
        ${update.productVariantId}::uuid,
        ${update.locationId}::uuid,
        ${update.delta}::numeric,
        0::numeric,
        NOW()
      )
      ON CONFLICT (product_id, product_variant_id, location_id) DO UPDATE
        SET quantity = stock_levels.quantity + EXCLUDED.quantity,
            updated_at = NOW()
    `;
  }

  /**
   * Batch update stock levels atomically.
   *
   * Aggregates input deltas by (productId, productVariantId, locationId) — the
   * conflict target — so each tuple appears at most once per statement, then
   * issues a single INSERT ... ON CONFLICT DO UPDATE. This eliminates the
   * find-then-update race window of the previous implementation: there is no
   * longer a window between read and write where a concurrent transaction can
   * insert a conflicting row, so we can never roll back the whole transaction
   * (movements + status updates included) due to an avoidable unique violation.
   */
  private async batchUpdateStockLevels(
    updates: StockLevelUpdate[],
    tx: Prisma.TransactionClient
  ): Promise<void> {
    if (updates.length === 0) return;

    // Aggregate by conflict target so the same row is not affected twice in a single statement
    // (PostgreSQL rejects ON CONFLICT statements that touch the same row more than once).
    const aggregated = new Map<string, StockLevelUpdate>();
    for (const update of updates) {
      const key = `${update.productId ?? "null"}-${
        update.productVariantId ?? "null"
      }-${update.locationId}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.delta += update.delta;
      } else {
        aggregated.set(key, { ...update });
      }
    }

    const rows = Array.from(aggregated.values());
    const productIds = rows.map(r => r.productId);
    const variantIds = rows.map(r => r.productVariantId);
    const locationIds = rows.map(r => r.locationId);
    const deltas = rows.map(r => r.delta);

    // Atomic UPSERT: INSERT each (product, variant, location) row, or increment
    // the existing row's quantity by the delta when the row already exists.
    // The unique index on (product_id, product_variant_id, location_id) is
    // declared with NULLS NOT DISTINCT, so this works for products without variants.
    await tx.$executeRaw`
      INSERT INTO stock_levels (
        id, product_id, product_variant_id, location_id, quantity, reserved, updated_at
      )
      SELECT
        gen_random_uuid(),
        input.product_id,
        input.product_variant_id,
        input.location_id,
        input.delta,
        0::numeric,
        NOW()
      FROM (
        SELECT
          unnest(${productIds}::uuid[]) AS product_id,
          unnest(${variantIds}::uuid[]) AS product_variant_id,
          unnest(${locationIds}::uuid[]) AS location_id,
          unnest(${deltas}::numeric[]) AS delta
      ) AS input
      ON CONFLICT (product_id, product_variant_id, location_id) DO UPDATE
        SET quantity = stock_levels.quantity + EXCLUDED.quantity,
            updated_at = NOW()
    `;
  }

  /**
   * Build AND-able where conditions for location/date filters shared by the
   * list and search endpoints. Date bounds are interpreted in the business
   * time zone so late-night movements land on the correct local day.
   */
  private buildMovementFilters(filters?: {
    fromLocationId?: string;
    toLocationId?: string;
    startDate?: string;
    endDate?: string;
  }): Prisma.StockMovementWhereInput[] {
    const conditions: Prisma.StockMovementWhereInput[] = [];
    if (filters?.fromLocationId) {
      conditions.push({ fromLocationId: filters.fromLocationId });
    }
    if (filters?.toLocationId) {
      conditions.push({ toLocationId: filters.toLocationId });
    }
    const createdAt = zonedDayRangeToUtc(filters?.startDate, filters?.endDate);
    if (createdAt) {
      conditions.push({ createdAt });
    }
    return conditions;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: {
      fromLocationId?: string;
      toLocationId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedStockMovementDto> {
    const skip = (page - 1) * limit;

    const filterConditions = this.buildMovementFilters(filters);
    const whereClause: Prisma.StockMovementWhereInput =
      filterConditions.length > 0 ? { AND: filterConditions } : {};

    const [stockMovements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
          product: true,
          fromLocation: true,
          toLocation: true,
          creator: { select: { id: true, email: true } },
        },
      }),
      this.prisma.stockMovement.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: stockMovements.map(sm => this.mapToDto(sm)),
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

  async searchStockMovements(
    search?: string,
    page = 1,
    limit = 10,
    filters?: {
      fromLocationId?: string;
      toLocationId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedStockMovementDto> {
    const skip = (page - 1) * limit;

    if (!search || search.trim() === "") {
      throw new BadRequestException("You must provide a search term");
    }

    const searchClause: Prisma.StockMovementWhereInput = {
      OR: [
        {
          productVariant: {
            name: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
        },
        {
          productVariant: {
            sku: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
        },
        {
          product: {
            name: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
        },
        {
          product: {
            sku: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
        },
        {
          reference: { contains: search, mode: Prisma.QueryMode.insensitive },
        },
        {
          fromLocation: {
            name: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
        },
        {
          toLocation: {
            name: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
        },
      ],
    };

    const filterConditions = this.buildMovementFilters(filters);
    const whereClause: Prisma.StockMovementWhereInput =
      filterConditions.length > 0
        ? { AND: [searchClause, ...filterConditions] }
        : searchClause;

    const [stockMovements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: whereClause,
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
          product: true,
          fromLocation: true,
          toLocation: true,
          creator: { select: { id: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      this.prisma.stockMovement.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: stockMovements.map(sm => this.mapToDto(sm)),
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

  async findOne(id: string): Promise<StockMovementDto> {
    const stockMovement = await this.prisma.stockMovement.findUnique({
      where: { id },
      include: {
        productVariant: {
          include: {
            product: true,
          },
        },
        product: true,
        fromLocation: true,
        toLocation: true,
        creator: { select: { id: true, email: true } },
      },
    });

    if (!stockMovement) {
      throw new NotFoundException("Stock movement not found");
    }

    return this.mapToDto(stockMovement);
  }

  /**
   * Get movement history for a specific product
   */
  async findByProduct(
    productId: string,
    productVariantId?: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedStockMovementDto> {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.StockMovementWhereInput = {
      productId,
      ...(productVariantId && { productVariantId }),
    };

    const [stockMovements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
          product: true,
          fromLocation: true,
          toLocation: true,
          creator: { select: { id: true, email: true } },
        },
      }),
      this.prisma.stockMovement.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: stockMovements.map(sm => this.mapToDto(sm)),
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
   * Get movement history for a specific location
   */
  async findByLocation(
    locationId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedStockMovementDto> {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.StockMovementWhereInput = {
      OR: [{ fromLocationId: locationId }, { toLocationId: locationId }],
    };

    const [stockMovements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
          product: true,
          fromLocation: true,
          toLocation: true,
          creator: { select: { id: true, email: true } },
        },
      }),
      this.prisma.stockMovement.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: stockMovements.map(sm => this.mapToDto(sm)),
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

  private mapToDto(
    stockMovement: Prisma.StockMovementGetPayload<{
      include: {
        productVariant: {
          include: {
            product: true;
          };
        };
        product: true;
        fromLocation: true;
        toLocation: true;
        creator: { select: { id: true; email: true } };
      };
    }>
  ): StockMovementDto {
    return {
      id: stockMovement.id,
      productVariantId: stockMovement.productVariantId,
      productId: stockMovement.productId,
      fromLocationId: stockMovement.fromLocationId,
      toLocationId: stockMovement.toLocationId,
      movementType: stockMovement.movementType,
      quantity: Number(stockMovement.quantity),
      reference: stockMovement.reference,
      createdBy: stockMovement.createdBy,
      createdAt: stockMovement.createdAt,
      note: stockMovement.note,
      metadata: stockMovement.metadata,
      productVariant: stockMovement.productVariant,
      product: stockMovement.product,
      fromLocation: stockMovement.fromLocation,
      toLocation: stockMovement.toLocation,
      creator: stockMovement.creator,
    };
  }

  private normalizeVariantDisplayName(raw: string): string {
    return raw.trim().toLowerCase().replaceAll(/\s+/g, " ");
  }

  private async validateBulkPurchaseImportRows(
    dto: BulkPurchaseImportDto
  ): Promise<Array<{ rowIndex: number; message: string }>> {
    const errors: Array<{ rowIndex: number; message: string }> = [];

    const variantIds = [...new Set(dto.rows.map(r => r.productVariantId))];
    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isDeleted: false,
        isActive: true,
        product: { isDeleted: false, isActive: true },
      },
      select: { id: true, productId: true },
    });
    const variantMap = new Map(variants.map(v => [v.id, v]));

    const locationIdSet = new Set<string>();
    for (const row of dto.rows) {
      for (const lq of row.locationQuantities) {
        locationIdSet.add(lq.locationId);
      }
    }
    const locations = await this.prisma.location.findMany({
      where: { id: { in: [...locationIdSet] }, isDeleted: false },
      select: { id: true },
    });
    const locationSet = new Set(locations.map(l => l.id));

    const priceTypeIdSet = new Set<string>();
    for (const row of dto.rows) {
      for (const p of row.prices) {
        priceTypeIdSet.add(p.priceTypeId);
      }
    }
    const priceTypes = await this.prisma.priceType.findMany({
      where: {
        id: { in: [...priceTypeIdSet] },
        isDeleted: false,
        isActive: true,
      },
      select: { id: true },
    });
    const priceTypeSet = new Set(priceTypes.map(pt => pt.id));

    for (const [i, row] of dto.rows.entries()) {
      const v = variantMap.get(row.productVariantId);
      if (!v) {
        errors.push({
          rowIndex: i,
          message: "Variant not found or inactive",
        });
        continue;
      }
      if (v.productId !== row.productId) {
        errors.push({
          rowIndex: i,
          message: "productId does not match variant",
        });
      }

      const positiveQty = row.locationQuantities.some(lq => lq.quantity > 0);
      if (!positiveQty) {
        errors.push({
          rowIndex: i,
          message: "At least one location quantity must be greater than 0",
        });
      }

      for (const lq of row.locationQuantities) {
        if (!locationSet.has(lq.locationId)) {
          errors.push({
            rowIndex: i,
            message: "Invalid or inactive destination location",
          });
        }
      }

      for (const p of row.prices) {
        if (!priceTypeSet.has(p.priceTypeId)) {
          errors.push({
            rowIndex: i,
            message: "Invalid or inactive price type",
          });
        }
      }
    }

    return errors;
  }

  async resolveVariantDisplayNames(
    dto: ResolveVariantDisplayNamesDto
  ): Promise<{
    results: Array<{
      normalizedName: string;
      status: "unique" | "not_found" | "ambiguous";
      productVariantId?: string;
      productId?: string;
      candidateCount?: number;
    }>;
  }> {
    const normalizedList = [
      ...new Set(
        dto.names
          .map(n => this.normalizeVariantDisplayName(n))
          .filter(s => s.length > 0)
      ),
    ];

    if (normalizedList.length === 0) {
      throw new BadRequestException("No valid names after normalization");
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; productId: string; norm: string }>
    >`
      SELECT pv.id,
             pv.product_id AS "productId",
             trim(lower(regexp_replace(trim(coalesce(pv.name, '')), '[[:space:]]+', ' ', 'g'))) AS norm
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv.product_id
      WHERE pv.is_deleted = false
        AND pv.is_active = true
        AND p.is_deleted = false
        AND p.is_active = true
        AND trim(lower(regexp_replace(trim(coalesce(pv.name, '')), '[[:space:]]+', ' ', 'g'))) IN (${Prisma.join(
          normalizedList
        )})
    `;

    const byNorm = new Map<string, Array<{ id: string; productId: string }>>();
    for (const r of rows) {
      const list = byNorm.get(r.norm) ?? [];
      list.push({ id: r.id, productId: r.productId });
      byNorm.set(r.norm, list);
    }

    return {
      results: normalizedList.map(normalizedName => {
        const matches = byNorm.get(normalizedName) ?? [];
        if (matches.length === 0) {
          return { normalizedName, status: "not_found" as const };
        }
        if (matches.length > 1) {
          return {
            normalizedName,
            status: "ambiguous" as const,
            candidateCount: matches.length,
          };
        }
        return {
          normalizedName,
          status: "unique" as const,
          productVariantId: matches[0].id,
          productId: matches[0].productId,
        };
      }),
    };
  }

  async bulkPurchaseImport(
    dto: BulkPurchaseImportDto,
    userId?: string
  ): Promise<{
    dryRun: boolean;
    ok: boolean;
    rowsProcessed: number;
    movementsCreated: number;
    errors: Array<{ rowIndex: number; message: string }>;
  }> {
    const errors = await this.validateBulkPurchaseImportRows(dto);

    let movementsCreated = 0;
    for (const row of dto.rows) {
      for (const lq of row.locationQuantities) {
        if (lq.quantity > 0) {
          movementsCreated++;
        }
      }
    }

    if (errors.length > 0) {
      if (dto.dryRun) {
        return {
          dryRun: true,
          ok: false,
          rowsProcessed: dto.rows.length,
          movementsCreated,
          errors,
        };
      }
      throw new BadRequestException({
        message: "Bulk purchase validation failed",
        errors,
      });
    }

    if (dto.dryRun) {
      return {
        dryRun: true,
        ok: true,
        rowsProcessed: dto.rows.length,
        movementsCreated,
        errors: [],
      };
    }

    await this.prisma.$transaction(
      async tx => {
        for (let i = 0; i < dto.rows.length; i++) {
          const row = dto.rows[i];
          await tx.productVariant.update({
            where: { id: row.productVariantId },
            data: { costPrice: row.costPrice },
          });
          await this.productVariantPricesService.upsertPartialPricesInTransaction(
            tx,
            row.productVariantId,
            row.prices.map(p => ({
              priceTypeId: p.priceTypeId,
              price: p.price,
            }))
          );
        }

        const movementDtos: CreateStockMovementDto[] = [];
        for (let i = 0; i < dto.rows.length; i++) {
          const row = dto.rows[i];
          const metadata: Record<string, string | number> = {
            source: "excel_purchase_import",
            importRowIndex: i,
          };
          if (dto.batchIndex != null) {
            metadata.batchIndex = dto.batchIndex;
          }
          if (dto.batchCount != null) {
            metadata.batchCount = dto.batchCount;
          }

          for (const lq of row.locationQuantities) {
            if (lq.quantity > 0) {
              movementDtos.push({
                productVariantId: row.productVariantId,
                productId: row.productId,
                toLocationId: lq.locationId,
                movementType: StockMovementType.PURCHASE,
                quantity: lq.quantity,
                reference: dto.reference,
                note: dto.note,
                metadata,
              });
            }
          }
        }

        if (movementDtos.length > 0) {
          await this.createBulkPurchaseMovements(movementDtos, tx, userId);
        }
      },
      { maxWait: 10_000, timeout: 60_000 }
    );

    return {
      dryRun: false,
      ok: true,
      rowsProcessed: dto.rows.length,
      movementsCreated,
      errors: [],
    };
  }

  /**
   * Check if a movement type deducts stock from a location
   */
  private isDeductingMovement(movementType: StockMovementType): boolean {
    const deductingTypes: StockMovementType[] = [
      StockMovementType.SALE,
      StockMovementType.NEGATIVE_ADJUSTMENT,
      StockMovementType.DAMAGE,
      StockMovementType.TRANSFER,
    ];
    return deductingTypes.includes(movementType);
  }

  private hasValue(value?: string | null): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  private isDateOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private hasExplicitTimezone(value: string): boolean {
    return /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  }

  private parseDateInputAsUtc(value: string): Date {
    const dateStr = value.trim();

    // YYYY-MM-DD => build UTC date explicitly
    if (this.isDateOnly(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    }

    // Datetime without timezone => treat as UTC
    if (dateStr.includes("T") && !this.hasExplicitTimezone(dateStr)) {
      return new Date(`${dateStr}Z`);
    }

    // Datetime with timezone (or other valid format)
    return new Date(dateStr);
  }

  private toStartOfDay(dateStr: string): Date {
    const parsed = this.parseDateInputAsUtc(dateStr);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid fromDate: ${dateStr}`);
    }

    // If input already had time, keep it as-is; otherwise use 00:00:00.000 UTC
    if (!this.isDateOnly(dateStr.trim())) return parsed;

    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
  }

  private toEndOfDay(dateStr: string): Date {
    const parsed = this.parseDateInputAsUtc(dateStr);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid toDate: ${dateStr}`);
    }

    // If input already had time, keep it as-is; otherwise use 23:59:59.999 UTC
    if (!this.isDateOnly(dateStr.trim())) return parsed;

    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );
  }
  private normalizeExportFilters(
    filters: StockMovementExportFilters & { skip?: number; take?: number }
  ): StockMovementExportFilters & { skip?: number; take?: number } {
    return {
      fromDate: this.hasValue(filters.fromDate)
        ? filters.fromDate.trim()
        : undefined,
      toDate: this.hasValue(filters.toDate) ? filters.toDate.trim() : undefined,
      fromLocationId: this.hasValue(filters.fromLocationId)
        ? filters.fromLocationId.trim()
        : undefined,
      toLocationId: this.hasValue(filters.toLocationId)
        ? filters.toLocationId.trim()
        : undefined,
      createdBy: this.hasValue(filters.createdBy)
        ? filters.createdBy.trim()
        : undefined,
      productId: this.hasValue(filters.productId)
        ? filters.productId.trim()
        : undefined,
      productVariantId: this.hasValue(filters.productVariantId)
        ? filters.productVariantId.trim()
        : undefined,
      movementType: filters.movementType,
      reference: this.hasValue(filters.reference)
        ? filters.reference.trim()
        : undefined,
      movementsIds:
        Array.isArray(filters.movementsIds) && filters.movementsIds.length > 0
          ? filters.movementsIds
          : undefined,
      skip: filters.skip,
      take: filters.take,
    };
  }

  /**
   * Private helper to build a dynamic WHERE clause based on specific filters.
   * Excludes generic search to focus on precise data points.
   */
  private buildStockMovementWhere(
    filters: StockMovementExportFilters
  ): Prisma.StockMovementWhereInput {
    const f = this.normalizeExportFilters(filters);
    const and: Prisma.StockMovementWhereInput[] = [];

    // Date range filter
    if (f.fromDate || f.toDate) {
      and.push({
        createdAt: {
          ...(f.fromDate ? { gte: this.toStartOfDay(f.fromDate) } : {}),
          ...(f.toDate ? { lte: this.toEndOfDay(f.toDate) } : {}),
        },
      });
    }

    if (f.fromLocationId) and.push({ fromLocationId: f.fromLocationId });
    if (f.toLocationId) and.push({ toLocationId: f.toLocationId });

    if (f.createdBy) {
      const identityId = f.createdBy;
      and.push({
        OR: [
          { createdBy: identityId },
          {
            creator: {
              employees: {
                some: { id: identityId },
              },
            },
          },
        ],
      });
    }

    if (f.productId) and.push({ productId: f.productId });
    if (f.productVariantId) and.push({ productVariantId: f.productVariantId });
    if (f.movementType) and.push({ movementType: f.movementType });

    if (f.reference) {
      const searchTerm = f.reference;
      and.push({
        OR: [
          { reference: { contains: searchTerm, mode: "insensitive" } },
          {
            product: {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { sku: { contains: searchTerm, mode: "insensitive" } },
                { barcode: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
          {
            productVariant: {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { sku: { contains: searchTerm, mode: "insensitive" } },
                {
                  product: {
                    name: { contains: searchTerm, mode: "insensitive" },
                  },
                },
              ],
            },
          },
        ],
      });
    }
    if (f.movementsIds?.length) {
      and.push({ id: { in: f.movementsIds } });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  /**
   * Returns a paginated list of movements for the UI Table preview.
   */
  async listStockMovementsPreview(
    params: StockMovementExportFilters & { page?: number; limit?: number }
  ): Promise<PaginatedStockMovements> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const skip = (page - 1) * limit;

    const normalizedFilters = this.normalizeExportFilters(params);
    const where = this.buildStockMovementWhere(normalizedFilters);

    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: true,
          productVariant: { include: { product: true } },
          fromLocation: true,
          toLocation: true,
          creator: { select: { id: true, email: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    ]);

    const data: StockMovementPreviewRow[] = movements.map((m: any) => {
      const sku = m.productVariant?.sku ?? m.product?.sku ?? "N/A";
      const product = m.productVariant?.product?.name ?? m.product?.name ?? "";
      const variant = m.productVariant?.name ?? "";

      return {
        id: m.id,
        date: m.createdAt.toISOString(),
        sku,
        product,
        variant,
        type: m.movementType,
        fromLocation: m.fromLocation?.name ?? "—",
        toLocation: m.toLocation?.name ?? "—",
        quantity: Number(m.quantity),
        reference: m.reference ?? "N/A",
        createdBy: m.creator?.email ?? "—",
      };
    });

    const totalPages = Math.ceil(total / limit);
    return { data, pagination: { page, limit, total, totalPages } };
  }

  /**
   * Returns the full data package for the PDF report.
   * Implements the "Rule of 8": Returns only the last 8 items if no filters are applied.
   */
  async getStockMovementReportData(
    filters: StockMovementExportFilters & { skip?: number; take?: number }
  ): Promise<StockMovementReportData> {
    const normalizedFilters = this.normalizeExportFilters(filters);
    const where = this.buildStockMovementWhere(normalizedFilters);

    const isSearchActive = Object.keys(where).length > 0;

    // When exporting a filtered set we return ALL matches (take: undefined) with
    // heavy includes. Guard against unbounded date ranges exhausting memory.
    const MAX_EXPORT_MOVEMENTS = 20000;
    const hasExplicitPage = typeof filters.take === "number";
    if (!hasExplicitPage && isSearchActive) {
      const count = await this.prisma.stockMovement.count({ where });
      if (count > MAX_EXPORT_MOVEMENTS) {
        throw new BadRequestException(
          `El reporte tiene ${count.toLocaleString()} movimientos, supera el máximo de ${MAX_EXPORT_MOVEMENTS.toLocaleString()}. Filtra por rango de fechas o ubicación para reducir el resultado.`
        );
      }
    }

    const movements = await this.prisma.stockMovement.findMany({
      where,
      include: {
        product: true,
        productVariant: { include: { product: true } },
        fromLocation: true,
        toLocation: true,
        creator: { select: { id: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: filters.skip ?? 0,
      take: filters.take ?? (isSearchActive ? undefined : 8),
    });
    if (!movements.length) {
      throw new NotFoundException(
        "No stock movements found matching the criteria."
      );
    }

    const items: StockMovementReportItem[] = movements.map((m: any) => {
      const sku = m.productVariant?.sku ?? m.product?.sku ?? "N/A";
      const pName = m.productVariant?.product?.name ?? m.product?.name ?? "";
      const vName = m.productVariant?.name ?? "";

      return {
        id: m.id,
        productId: m.productId,
        productVariantId: m.productVariantId,
        date: m.createdAt.toISOString(),
        sku,
        description: `[${sku}] ${pName} ${vName}`.trim(),
        type: m.movementType,
        fromLocation: m.fromLocation?.name ?? "—",
        toLocation: m.toLocation?.name ?? "—",
        quantity: Number(m.quantity),
        reference: m.reference ?? "N/A",
        product: m.product,
        productVariant: m.productVariant,
        createdBy: m.creator?.email ?? "—",
      };
    });

    const originHeader = normalizedFilters.fromLocationId
      ? (items[0]?.fromLocation ?? "—")
      : "";

    const destinationHeader = normalizedFilters.toLocationId
      ? (items[0]?.toLocation ?? "—")
      : "";

    return {
      companyName: "Esli Cosmetics",
      generatedAt: new Date().toISOString(),
      originHeader,
      destinationHeader,
      items,
      totalItems: items.length,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    };
  }
}
