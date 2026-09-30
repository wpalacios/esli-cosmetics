import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateStockLevelDto } from "./dto/create-stock-level.dto";
import { UpdateStockLevelDto } from "./dto/update-stock-level.dto";
import { KitAvailabilityDto, StockLevelDto } from "./dto/stock-level.dto";
import { PaginatedStockLevelDto } from "./dto/paginated-stock-level.dto";
import { DeleteStockLevelResponseDto } from "./dto/delete-stock-level.dto";
import { Prisma } from "@prisma/client";
import { zonedDayRangeToUtc } from "../../common/date-range/date-range.util";
import { StockLevelNotificationService } from "./stock-level-notification.service";

@Injectable()
export class StockLevelsService {
  private readonly logger = new Logger(StockLevelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockLevelNotificationService: StockLevelNotificationService
  ) {}

  async create(createDto: CreateStockLevelDto): Promise<StockLevelDto> {
    // Validate that at least one product identifier is provided
    if (!createDto.productVariantId && !createDto.productId) {
      throw new BadRequestException(
        "Either productVariantId or productId must be provided"
      );
    }

    // Batch validate all entities in parallel to reduce query count
    const [location, productVariant, product, existing] = await Promise.all([
      // Validate location exists
      this.prisma.location.findFirst({
        where: { id: createDto.locationId, isDeleted: false },
      }),
      // Validate product variant if provided
      createDto.productVariantId
        ? this.prisma.productVariant.findFirst({
            where: { id: createDto.productVariantId, isDeleted: false },
          })
        : Promise.resolve(null),
      // Validate product if provided
      createDto.productId
        ? this.prisma.product.findFirst({
            where: { id: createDto.productId, isDeleted: false },
          })
        : Promise.resolve(null),
      // Check if stock level already exists
      this.prisma.stockLevel.findFirst({
        where: {
          productVariantId: createDto.productVariantId,
          locationId: createDto.locationId,
        },
      }),
    ]);

    if (!location) {
      throw new NotFoundException("Location not found or inactive");
    }

    if (createDto.productVariantId && !productVariant) {
      throw new NotFoundException("Product variant not found or inactive");
    }

    if (createDto.productId && !product) {
      throw new NotFoundException("Product not found or inactive");
    }

    if (existing) {
      throw new ConflictException(
        "Stock level already exists for this product variant and location"
      );
    }

    const stockLevel = await this.prisma.stockLevel.create({
      data: {
        productVariantId: createDto.productVariantId,
        productId: createDto.productId,
        locationId: createDto.locationId,
        quantity: createDto.quantity ?? 0,
        reserved: createDto.reserved ?? 0,
      },
      include: {
        productVariant: {
          include: {
            product: true,
          },
        },
        product: true,
        location: true,
      },
    });

    // Check for low stock and notify if applicable
    if (stockLevel.productVariantId && stockLevel.locationId) {
      await this.stockLevelNotificationService.checkAndNotifyLowStock(
        stockLevel.productVariantId,
        stockLevel.locationId,
        Number(stockLevel.quantity)
      );
    }

    return this.mapToDto(stockLevel);
  }

  /**
   * Build AND-able where conditions for the location/date filters shared by the
   * list and search endpoints. The date range filters by `updatedAt` (last stock
   * change) and is interpreted in the business time zone.
   */
  private buildStockLevelFilters(filters?: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Prisma.StockLevelWhereInput[] {
    const conditions: Prisma.StockLevelWhereInput[] = [];
    if (filters?.locationId) {
      conditions.push({ locationId: filters.locationId });
    }
    const updatedAt = zonedDayRangeToUtc(filters?.startDate, filters?.endDate);
    if (updatedAt) {
      conditions.push({ updatedAt });
    }
    return conditions;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: {
      locationId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedStockLevelDto> {
    const skip = (page - 1) * limit;

    // Hide orphan rows (no product AND no variant). They hold ghost stock from
    // legacy stock_movements that were created without a product/variant reference
    // (mostly January–April 2026 inventory leveling); they cannot be displayed
    // meaningfully in the UI ("undefined - undefined") and are tracked separately
    // via the audit script.
    const filterConditions = this.buildStockLevelFilters(filters);
    const whereClause: Prisma.StockLevelWhereInput = {
      OR: [{ productId: { not: null } }, { productVariantId: { not: null } }],
      ...(filterConditions.length > 0 ? { AND: filterConditions } : {}),
    };

    const [stockLevels, total] = await Promise.all([
      this.prisma.stockLevel.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
          product: true,
          location: true,
        },
      }),
      this.prisma.stockLevel.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: stockLevels.map(sl => this.mapToDto(sl)),
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

  async searchStockLevels(
    search?: string,
    page = 1,
    limit = 10,
    filters?: {
      locationId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedStockLevelDto> {
    const skip = (page - 1) * limit;

    if (!search || search.trim() === "") {
      throw new BadRequestException("You must provide a search term");
    }

    const filterConditions = this.buildStockLevelFilters(filters);
    const whereClause: Prisma.StockLevelWhereInput = {
      ...(filterConditions.length > 0 ? { AND: filterConditions } : {}),
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
          location: {
            name: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
        },
      ],
    };

    const [stockLevels, total] = await Promise.all([
      this.prisma.stockLevel.findMany({
        where: whereClause,
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
          product: true,
          location: true,
        },
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.stockLevel.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: stockLevels.map(sl => this.mapToDto(sl)),
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

  async findByProductVariant(
    productVariantId: string
  ): Promise<StockLevelDto[]> {
    const stockLevels = await this.prisma.stockLevel.findMany({
      where: {
        productVariantId,
        locationId: {
          not: null,
        },
        location: {
          isDeleted: false,
        },
        productVariant: {
          isDeleted: false,
        },
        product: {
          isDeleted: false,
        },
      },
      include: {
        productVariant: {
          include: {
            product: true,
          },
        },
        product: true,
        location: true,
      },
      orderBy: {
        location: {
          name: "asc",
        },
      },
    });

    return stockLevels.map(sl => this.mapToDto(sl));
  }

  /**
   * Batch fetch stock levels for multiple product variants at a specific location
   * Optimized for POS checkout validation
   */
  async findByProductVariantsAndLocation(
    productVariantIds: string[],
    locationId: string
  ): Promise<StockLevelDto[]> {
    if (productVariantIds.length === 0) {
      return [];
    }

    const stockLevels = await this.prisma.stockLevel.findMany({
      where: {
        productVariantId: { in: productVariantIds },
        locationId,
        productVariant: {
          isDeleted: false,
        },
        product: {
          isDeleted: false,
        },
      },
      include: {
        productVariant: {
          include: {
            product: {
              include: {
                brand: true,
                category: true,
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
          },
        },
        product: true,
        location: true,
      },
    });

    return stockLevels.map(sl => this.mapToDto(sl));
  }

  async findOne(id: string): Promise<StockLevelDto> {
    const stockLevel = await this.prisma.stockLevel.findUnique({
      where: { id },
      include: {
        productVariant: {
          include: {
            product: true,
          },
        },
        product: true,
        location: true,
      },
    });

    if (!stockLevel) {
      throw new NotFoundException("Stock level not found");
    }

    return this.mapToDto(stockLevel);
  }

  async update(
    id: string,
    updateDto: UpdateStockLevelDto
  ): Promise<StockLevelDto> {
    const existing = await this.prisma.stockLevel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("Stock level not found");
    }

    const updated = await this.prisma.stockLevel.update({
      where: { id },
      data: {
        quantity: updateDto.quantity ?? existing.quantity,
        reserved: updateDto.reserved ?? existing.reserved,
      },
      include: {
        productVariant: {
          include: {
            product: true,
          },
        },
        product: true,
        location: true,
      },
    });

    // Check for low stock and notify if applicable
    if (updated.productVariantId && updated.locationId) {
      await this.stockLevelNotificationService.checkAndNotifyLowStock(
        updated.productVariantId,
        updated.locationId,
        Number(updated.quantity)
      );
    }

    return this.mapToDto(updated);
  }

  /**
   * Returns kit availability per location for one or multiple KIT variant IDs.
   * Uses kit components (kitItems) to compute how many complete kits can be built.
   * Output values are always clamped to 0 or greater.
   */
  async getKitStockLevelsByLocation(
    kitVariantIds: string[]
  ): Promise<KitAvailabilityDto[]> {
    try {
      // Step 1: Normalize input (remove duplicates and empty values)
      const normalizedKitIds: string[] = Array.from(
        new Set((kitVariantIds || []).filter(Boolean))
      );

      // Step 2: Validate input
      if (normalizedKitIds.length === 0) {
        throw new BadRequestException(
          "kitVariantIds must contain at least one valid KIT variant ID"
        );
      }

      // Step 3: Load KIT variants and their component definitions (kitItems)
      const kitVariants = await this.prisma.productVariant.findMany({
        where: {
          id: { in: normalizedKitIds },
          isDeleted: false,
          product: { isDeleted: false },
        },
        select: {
          id: true,
          product: {
            select: {
              kitItems: {
                select: {
                  productVariantId: true,
                  quantity: true,
                },
              },
            },
          },
        },
      });

      // Step 4: Validate kits were found
      if (kitVariants.length === 0) {
        throw new NotFoundException(
          "No active KIT variants were found for the provided IDs"
        );
      }

      const foundIds = new Set(kitVariants.map(k => k.id));
      const missingIds = normalizedKitIds.filter(id => !foundIds.has(id));
      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Some KIT variants were not found: ${missingIds.join(", ")}`
        );
      }

      // Step 5: Collect unique component variant IDs from all kitItems
      const componentIds: string[] = Array.from(
        new Set(
          kitVariants.flatMap(kit =>
            (kit.product?.kitItems || []).map(item => item.productVariantId)
          )
        )
      );

      // Step 6: Validate kits have components
      if (componentIds.length === 0) {
        throw new BadRequestException(
          "Selected KIT variants do not have kitItems configured"
        );
      }

      // Step 7: Load stock rows for all components across valid locations
      const stockLevels = await this.prisma.stockLevel.findMany({
        where: {
          productVariantId: { in: componentIds },
          location: { isDeleted: false },
          productVariant: { isDeleted: false },
        },
        select: {
          productVariantId: true,
          locationId: true,
          quantity: true,
          reserved: true,
          location: { select: { name: true } },
        },
      });

      // Step 8: Build location -> component stock map using available = max(0, quantity - reserved)
      const locationStocks = new Map<
        string,
        { locationName: string; componentStock: Map<string, number> }
      >();

      for (const stockLevel of stockLevels) {
        if (!stockLevel.locationId) continue;

        if (!locationStocks.has(stockLevel.locationId)) {
          locationStocks.set(stockLevel.locationId, {
            locationName: stockLevel.location?.name || "",
            componentStock: new Map<string, number>(),
          });
        }

        const available = Math.max(
          0,
          Number(stockLevel.quantity || 0) - Number(stockLevel.reserved || 0)
        );

        locationStocks
          .get(stockLevel.locationId)!
          .componentStock.set(stockLevel.productVariantId, available);
      }

      // Step 9: Compute kitsAvailable per kit and per location
      const result: KitAvailabilityDto[] = [];

      for (const kit of kitVariants) {
        const kitItems = kit.product?.kitItems || [];

        for (const [locationId, data] of locationStocks.entries()) {
          const stocks: Record<string, number> = {};
          const possibleKitsPerComponent: number[] = [];

          for (const item of kitItems) {
            // Step 9.1: Normalize required quantity (minimum 1)
            const requiredQty = Math.max(1, Number(item.quantity || 1));

            // Step 9.2: Read component stock in this location (never negative)
            const availableComponent = Math.max(
              0,
              Number(data.componentStock.get(item.productVariantId) || 0)
            );

            // Step 9.3: Store component stock for response payload
            stocks[item.productVariantId] = availableComponent;

            // Step 9.4: Compute buildable kits limited by this component
            possibleKitsPerComponent.push(
              Math.floor(availableComponent / requiredQty)
            );
          }

          // Step 9.5: Final kit capacity in this location = bottleneck component, clamped to 0
          const kitsAvailable =
            possibleKitsPerComponent.length > 0
              ? Math.max(0, Math.min(...possibleKitsPerComponent))
              : 0;

          // Step 9.6: Append DTO row
          result.push({
            kitVariantId: kit.id,
            locationId,
            locationName: data.locationName,
            stocks,
            kitsAvailable,
          });
        }
      }

      // Step 10: Sort by highest kit availability first
      return result.sort((a, b) => b.kitsAvailable - a.kitsAvailable);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        "Failed to compute kit availability by location",
        error instanceof Error ? error.stack : undefined
      );

      throw new InternalServerErrorException(
        "Unexpected error while computing kit availability"
      );
    }
  }

  async remove(id: string): Promise<DeleteStockLevelResponseDto> {
    const stockLevel = await this.prisma.stockLevel.findUnique({
      where: { id },
    });

    if (!stockLevel) {
      throw new NotFoundException("Stock level not found");
    }

    await this.prisma.stockLevel.delete({
      where: { id },
    });

    return {
      success: true,
      message: "Stock level deleted successfully",
      id,
    };
  }

  private mapToDto(
    stockLevel: Prisma.StockLevelGetPayload<{
      include: {
        productVariant: {
          include: {
            product: true;
          };
        };
        product: true;
        location: true;
      };
    }>
  ): StockLevelDto {
    return {
      id: stockLevel.id,
      productVariantId: stockLevel.productVariantId,
      productId: stockLevel.productId,
      locationId: stockLevel.locationId,
      quantity: Number(stockLevel.quantity),
      reserved: Number(stockLevel.reserved),
      updatedAt: stockLevel.updatedAt,
      productVariant: stockLevel.productVariant,
      product: stockLevel.product,
      location: stockLevel.location,
    };
  }
}
