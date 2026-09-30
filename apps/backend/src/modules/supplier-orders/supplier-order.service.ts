import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StockLevelsService } from "../stock-levels/stock-levels.service";
import {
  CreatePurchaseOrderItemDto,
  CreateSupplierOrderDto,
} from "./dto/create-supplier-order.dto";
import { PurchaseOrderDto } from "./dto/supplier-order.dto";
import { UpdateSupplierOrderDto } from "./dto/update-supplier-order.dto";
import { UpdatePurchaseOrderItemDto } from "./dto/update-supplier-order.dto";
import { DeleteSupplierOrderResponseDto } from "./dto/delete-supplier-order.dto";
import { PaginatedSupplierOrdersDto } from "./dto/paginated-supplier-order.dto";
import { Prisma } from "@prisma/client";
import { isUUID } from "class-validator";
import { SupplierOrderPdfData } from "../reports/types/supplier-order-types";

// Helper type to handle stock injection before mapping
type PurchaseOrderWithItems = Prisma.PurchaseOrderGetPayload<{
  include: {
    supplier: true;
    purchaseOrderItems: {
      include: {
        productVariant: {
          include: {
            product: {
              include: {
                brand: true;
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class SupplierOrderService {
  private readonly logger = new Logger(SupplierOrderService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => StockLevelsService))
    private stockLevelsService: StockLevelsService
  ) {}

  private buildPagination(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  private mapToPurchaseOrderDto(
    order: PurchaseOrderWithItems
  ): PurchaseOrderDto {
    return {
      id: order.id,
      supplierId: order.supplierId || "",
      brandId:
        order.purchaseOrderItems[0]?.productVariant?.product?.brandId ||
        undefined,
      brandName:
        order.purchaseOrderItems[0]?.productVariant?.product?.brand?.name ||
        undefined,
      status: order.status || undefined,
      expectedDate: order.expectedDate
        ? order.expectedDate.toISOString()
        : undefined,
      total: order.total?.toString(),
      items: order.purchaseOrderItems.map(item => ({
        id: item.id,
        productVariantId: item.productVariantId || "",
        productVariantName:
          item.productVariant?.name || item.productVariant?.product?.name,
        quantity: item.quantity || 0,
        unitCost: item.unitCost?.toString(),
        lineTotal: item.lineTotal?.toString(),
      })),
    };
  }

  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateString) && !isNaN(new Date(dateString).getTime());
  }

  // Check requried fields
  private validateRequiredFields(
    dto: CreateSupplierOrderDto | UpdateSupplierOrderDto
  ) {
    if (
      !dto.supplierId ||
      typeof dto.supplierId !== "string" ||
      dto.supplierId.trim() === ""
    ) {
      this.logger.error("supplierId validation failed");
      throw new BadRequestException(
        "supplierId is required and must be a non-empty string"
      );
    }

    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      this.logger.error("items validation failed");
      throw new BadRequestException(
        "items is required and must be a non-empty array"
      );
    }
  }

  // Check items validations
  private validateOrderItems(
    items: (CreatePurchaseOrderItemDto | UpdatePurchaseOrderItemDto)[]
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      this.logger.error("Order items validation failed");
      throw new BadRequestException("You must provide at least one order item");
    }
    for (const [index, item] of items.entries()) {
      if (
        item.quantity === undefined ||
        item.quantity === null ||
        isNaN(Number(item.quantity))
      ) {
        this.logger.error(`Item quantity validation failed at index ${index}`);
        throw new BadRequestException(
          `Quantity is required and must be a number (item index: ${index})`
        );
      }
      if (Number(item.quantity) <= 0) {
        this.logger.error(
          `Item quantity must be greater than zero at index ${index}`
        );
        throw new BadRequestException(
          `Quantity must be greater than zero (item index: ${index})`
        );
      }
      if (
        !item.productVariantId ||
        typeof item.productVariantId !== "string" ||
        item.productVariantId.trim() === ""
      ) {
        this.logger.error(
          `Item productVariantId validation failed at index ${index}`
        );
        throw new BadRequestException(
          `productVariantId is required and must be a non-empty string (item index: ${index})`
        );
      }
    }
  }

  // Optimized: Get all variants for a specific brand with calculated Global Stock
  async getVariantsByBrandWithStock(
    brandId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<any> {
    if (!isUUID(brandId)) {
      throw new BadRequestException("Invalid Brand ID");
    }

    const skip = (page - 1) * limit;

    this.logger.log(
      `[GET_BY_BRAND] Fetching variants for brand: ${brandId}, page: ${page}, limit: ${limit}`
    );

    const total = await this.prisma.productVariant.count({
      where: {
        isDeleted: false,
        isActive: true,
        product: { brandId, isDeleted: false },
      },
    });

    const variants = await this.prisma.productVariant.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        product: {
          brandId: brandId,
          isDeleted: false,
        },
      },
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
            priceType: { priority: "asc" },
          },
        },
        stockLevels: true,
      },
      orderBy: {
        name: "asc",
      },
      skip: skip,
      take: limit,
    });

    this.logger.debug(
      `[GET_VARIANT_STOCK_BY_BRAND] Found ${variants.length} variants on this page`
    );

    const data = variants.map(variant => {
      const globalStock = variant.stockLevels.reduce(
        (acc, sl) => {
          const qty = Number(sl.quantity ?? 0);
          const res = Number(sl.reserved ?? 0);
          return {
            quantity: acc.quantity + qty,
            reserved: acc.reserved + res,
          };
        },
        { quantity: 0, reserved: 0 }
      );

      return {
        id: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        barcode: variant.barcode,
        name: variant.name,
        costPrice: Number(variant.costPrice),
        prices: variant.prices.map(p => ({
          priceTypeId: p.priceTypeId,
          priceTypeName: p.priceType.name,
          price: Number(p.price),
          minQuantity: p.minQuantity,
          priority: p.priceType.priority,
        })),
        minimumStock: variant.minimumStock,
        maximumStock: variant.maximumStock,
        appliesToDiscounts: variant.appliesToDiscounts,
        attributes: variant.attributes,
        product: {
          id: variant.product.id,
          name: variant.product.name,
          sku: variant.product.sku,
          brand: variant.product.brand
            ? {
                id: variant.product.brand.id,
                name: variant.product.brand.name,
              }
            : null,
          category: variant.product.category
            ? {
                id: variant.product.category.id,
                name: variant.product.category.name,
              }
            : null,
        },
        stockLevel: {
          quantity: globalStock.quantity,
          reserved: globalStock.reserved,
          available: globalStock.quantity - globalStock.reserved,
        },
      };
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async create(dto: CreateSupplierOrderDto): Promise<PurchaseOrderDto> {
    this.logger.log(`Creating supplier order: ${JSON.stringify(dto)}`);

    this.validateRequiredFields(dto);
    this.validateOrderItems(dto.items);

    const createdOrder = await this.prisma.$transaction(async tx => {
      this.logger.log(`Validating supplier: ${dto.supplierId}`);
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, isDeleted: false },
      });
      if (!supplier) {
        this.logger.error("Supplier not found");
        throw new NotFoundException("Supplier not found");
      }

      // Process Items
      const itemsToCreate: CreatePurchaseOrderItemDto[] = [];
      let total = 0;

      for (const item of dto.items) {
        this.logger.log(`Validating productVariant: ${item.productVariantId}`);
        const productVariant = await tx.productVariant.findFirst({
          where: { id: item.productVariantId, isDeleted: false },
          include: { product: true },
        });
        if (!productVariant) {
          this.logger.error(
            `Product variant ${item.productVariantId} not found`
          );
          throw new NotFoundException(
            `Product variant ${item.productVariantId} not found`
          );
        }

        // Check for brand if provided
        if (dto.brandId && productVariant.product.brandId !== dto.brandId) {
          this.logger.error(
            `Product variant ${item.productVariantId} does not belong to brand ${dto.brandId}`
          );
          throw new ConflictException(
            `Product variant ${item.productVariantId} does not belong to the selected brand`
          );
        }

        // totals
        const unitCost =
          item.unitCost !== undefined
            ? Number(item.unitCost)
            : Number(productVariant.costPrice) || 0;
        const lineTotal = unitCost * item.quantity;
        total += lineTotal;

        this.logger.log(
          `Item ready: variant=${item.productVariantId}, quantity=${item.quantity}, unitCost=${unitCost}, lineTotal=${lineTotal}`
        );

        itemsToCreate.push({
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          unitCost: unitCost,
          lineTotal: lineTotal,
        });
      }

      this.logger.log("Creating purchase order in DB...");
      const order = await tx.purchaseOrder.create({
        data: {
          supplierId: dto.supplierId,
          status: dto.status || "PENDING",
          expectedDate: dto.expectedDate
            ? new Date(dto.expectedDate)
            : undefined,
          total: new Prisma.Decimal(total),
          purchaseOrderItems: {
            create: itemsToCreate,
          },
        },
        include: {
          supplier: true,
          purchaseOrderItems: {
            include: {
              productVariant: { include: { product: true } },
            },
          },
        },
      });

      this.logger.log(`Order created: ${order.id}`);
      return order as PurchaseOrderWithItems;
    });

    this.logger.log(`Returning mapped order DTO: ${createdOrder.id}`);
    return this.mapToPurchaseOrderDto(createdOrder);
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedSupplierOrdersDto> {
    this.logger.log(
      `Fetching all supplier orders: page=${page}, limit=${limit}`
    );
    const skip = (page - 1) * limit;
    const where: Prisma.PurchaseOrderWhereInput = { isDeleted: false };

    const [orders, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          supplier: true,
          purchaseOrderItems: {
            include: {
              productVariant: { include: { product: true } },
            },
          },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    this.logger.log(`Found ${orders.length} orders, total: ${total}`);
    const ordersWithItems = orders as PurchaseOrderWithItems[];

    return {
      data: ordersWithItems.map(order => this.mapToPurchaseOrderDto(order)),
      pagination: this.buildPagination(page, limit, total),
    };
  }

  async findOne(id: string): Promise<PurchaseOrderDto> {
    this.logger.log(`Fetching supplier order by id: ${id}`);
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, isDeleted: false },
      include: {
        supplier: true,
        purchaseOrderItems: {
          include: {
            productVariant: { include: { product: true } },
          },
        },
      },
    });

    if (!order) {
      this.logger.error("Purchase order not found");
      throw new NotFoundException("Purchase order not found");
    }

    this.logger.log(`Order found: ${order.id}`);
    return this.mapToPurchaseOrderDto(order as PurchaseOrderWithItems);
  }

  async searchSupplierOrder(
    search?: string,
    page = 1,
    limit = 10
  ): Promise<PaginatedSupplierOrdersDto> {
    this.logger.log(
      `Searching supplier orders: search="${search}", page=${page}, limit=${limit}`
    );
    const skip = (page - 1) * limit;

    if (!search || search.trim() === "") {
      this.logger.error("No search term provided");
      throw new BadRequestException("You must provide a search term");
    }

    //Formulate search conditions
    const orConditions: Prisma.PurchaseOrderWhereInput[] = [
      { supplier: { name: { contains: search, mode: "insensitive" } } },
      { status: { contains: search, mode: "insensitive" } },
      {
        purchaseOrderItems: {
          some: {
            productVariant: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                {
                  product: { name: { contains: search, mode: "insensitive" } },
                },
                {
                  product: {
                    brand: { name: { contains: search, mode: "insensitive" } },
                  },
                },
              ],
            },
          },
        },
      },
    ];

    if (isUUID(search)) {
      orConditions.push({ id: { equals: search } });
    }

    if (this.isValidDate(search)) {
      orConditions.push({ expectedDate: { equals: new Date(search) } });
    }

    const where: Prisma.PurchaseOrderWhereInput = {
      isDeleted: false,
      OR: orConditions,
    };

    const [orders, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          supplier: true,
          purchaseOrderItems: {
            include: {
              productVariant: { include: { product: true } },
            },
          },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    this.logger.log(`Search found ${orders.length} orders, total: ${total}`);
    const ordersWithItems = orders as PurchaseOrderWithItems[];

    return {
      data: ordersWithItems.map(order => this.mapToPurchaseOrderDto(order)),
      pagination: this.buildPagination(page, limit, total),
    };
  }

  async update(
    id: string,
    dto: UpdateSupplierOrderDto
  ): Promise<PurchaseOrderDto> {
    this.logger.log(`[UPDATE] Request for ID: ${id}`);
    this.logger.log(`[UPDATE] Payload: ${JSON.stringify(dto)}`);

    return this.prisma.$transaction(async tx => {
      const existingOrder = await tx.purchaseOrder.findUnique({
        where: { id, isDeleted: false },
        include: { purchaseOrderItems: true, supplier: true },
      });

      if (!existingOrder) {
        throw new NotFoundException(`Order ${id} not found`);
      }

      const dataToUpdate: Prisma.PurchaseOrderUpdateInput = {
        updatedAt: new Date(),
      };

      if (dto.status) dataToUpdate.status = dto.status;
      if (dto.expectedDate)
        dataToUpdate.expectedDate = new Date(dto.expectedDate);

      if (dto.supplierId && dto.supplierId !== existingOrder.supplierId) {
        const supplier = await tx.supplier.findUnique({
          where: { id: dto.supplierId },
        });
        if (!supplier) throw new NotFoundException("Supplier not found");
        dataToUpdate.supplier = { connect: { id: dto.supplierId } };
      }

      if (dto.items && dto.items.length > 0) {
        this.logger.log(
          `[UPDATE] Replacing items... count: ${dto.items.length}`
        );

        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        let newTotal = 0;
        const itemsToCreate = [];

        for (const item of dto.items) {
          if (!item.productVariantId || !item.quantity) {
            throw new BadRequestException(
              "Invalid item data: missing variantId or quantity"
            );
          }

          const productVariant = await tx.productVariant.findFirst({
            where: { id: item.productVariantId, isDeleted: false },
            include: { product: true },
          });
          if (!productVariant) {
            throw new NotFoundException(
              `Product variant ${item.productVariantId} not found`
            );
          }

          if (dto.brandId && productVariant.product.brandId !== dto.brandId) {
            throw new ConflictException(
              `Product variant ${item.productVariantId} does not belong to the selected brand`
            );
          }

          let unitCost = item.unitCost;
          if (unitCost === undefined) {
            unitCost = Number(productVariant.costPrice || 0);
          }

          const lineTotal = Number(unitCost) * item.quantity;
          newTotal += lineTotal;

          itemsToCreate.push({
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitCost: new Prisma.Decimal(unitCost),
            lineTotal: new Prisma.Decimal(lineTotal),
          });
        }

        dataToUpdate.purchaseOrderItems = { create: itemsToCreate };
        dataToUpdate.total = new Prisma.Decimal(newTotal);
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: dataToUpdate,
        include: {
          supplier: true,
          purchaseOrderItems: {
            include: { productVariant: { include: { product: true } } },
          },
        },
      });

      this.logger.log(`[UPDATE] Success. New Total: ${updated.total}`);
      return this.mapToPurchaseOrderDto(updated);
    });
  }

  // SOFT DELETE
  async remove(id: string): Promise<DeleteSupplierOrderResponseDto> {
    this.logger.log(`Deleting (soft) supplier order: ${id}`);
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, isDeleted: false },
    });

    if (!order) {
      this.logger.error(`Purchase Order with ID ${id} not found`);
      throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    }

    // Soft Delete
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Order soft deleted: ${order.id}`);
    return {
      success: true,
      message: "Supplier order deleted successfully",
      id: order.id,
    };
  }

  async getSupplierOrderPdfData(
    orderId: string
  ): Promise<SupplierOrderPdfData> {
    if (!orderId) {
      this.logger.error("No orderId provided");
      throw new BadRequestException("orderId is required");
    }

    this.logger.log(`Buscando orden de compra con id: ${orderId}`);

    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        supplier: true,
        purchaseOrderItems: {
          include: {
            productVariant: { include: { product: true } },
          },
        },
      },
    });

    this.logger.log(`Resultado de la orden: ${JSON.stringify(order, null, 2)}`);

    if (!order) {
      this.logger.error("Supplier order not found");
      throw new NotFoundException("Supplier order not found");
    }

    const items = order.purchaseOrderItems.map(item => ({
      productName: item.productVariant?.product?.name || "Producto Desconocido",
      variantName: item.productVariant?.name || "",
      sku: item.productVariant?.sku || "",
      quantity: item.quantity,
      unitCost: Number(item.unitCost),
      totalCost: Number(item.lineTotal),
    }));

    this.logger.log(
      `Items mapeados para PDF: ${JSON.stringify(items, null, 2)}`
    );

    const pdfData: SupplierOrderPdfData = {
      // Company Info
      companyName: "Esli Cosmetics",
      companyAddress:
        "De la Iglesia Pio X, 1c hacia abajo.\nEdificio doble planta.",
      companyEmail: "cosmeticseym@gmail.com",

      // Order Details
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      date: order.createdAt.toISOString(),
      expectedDate: order.expectedDate
        ? order.expectedDate.toISOString()
        : undefined,
      status: order.status,

      // Supplier Info
      supplierName: order.supplier?.name || "Proveedor Desconocido",
      supplierContact: order.supplier?.contactName || "",
      supplierPhone: order.supplier?.phone || "",
      supplierEmail: order.supplier?.email || "",
      supplierAddress: order.supplier?.address || "",

      // Items Mapping
      items,

      // Totals
      totalAmount: Number(order.total),
    };

    this.logger.log(
      `Objeto final enviado al PDF: ${JSON.stringify(pdfData, null, 2)}`
    );

    return pdfData;
  }
}
