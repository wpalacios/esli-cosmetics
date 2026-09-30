import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateProductVariantDto } from "./dto/create-product-variants.dto";
import { UpdateProductVariantDto } from "./dto/update-product-variants.dto";
import { ProductVariantDto } from "./dto/product-variants.dto";
import { Prisma, ProductType } from "@prisma/client";
import { VariantPriceDto } from "./dto/variant-prices-dto/variant-prices.dto";
import { CreateVariantPriceDto } from "./dto/variant-prices-dto/create-variant-price.dto";
import { ProductVariantPricesService } from "./product-variant-prices.service";
import { VariantEmbeddingService } from "../products/product-search/variant-embedding.service";
import { VariantAliasService } from "../products/product-search/variant-alias.service";
import { ProductSearchService } from "../products/product-search/product-search.service";
import { DeleteProductVariantResponseDto } from "./dto/delete-product-variant.dto";
import type { DataWorkbookRequest } from "../reports/types/excel-reports.types";
import { normalizeDateRange } from "../../common/date-range/date-range.util";
import type { ExportSalesByProductFilters } from "../reports/types/excel-reports.types";

type PricePayload = Prisma.ProductVariantPriceGetPayload<{
  include: { priceType: true };
}>;

type UpdatedVariantType = Prisma.ProductVariantGetPayload<{
  include: { product: true; prices: { include: { priceType: true } } };
}>;

type ProductSalesListParams = {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  branchId?: string;
  productId?: string;
  productVariantId?: string;
  productName?: string;
  employeeId?: string;
  productVariantName?: string;
  productVariantSku?: string;
  brandId?: string;
  orderNumber?: string;
};

@Injectable()
export class ProductVariantsService {
  private readonly logger = new Logger(ProductVariantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricesService: ProductVariantPricesService,
    private readonly productSearch: ProductSearchService,
    private readonly variantEmbedding: VariantEmbeddingService,
    private readonly variantAlias: VariantAliasService
  ) {}

  private scheduleSearchIndexRefresh(variantId: string): void {
    void this.variantAlias.generateAliasesForVariant(variantId).catch(err => {
      this.logger.warn(
        `Search index refresh failed for variant ${variantId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });
  }

  private mapSinglePricesToDto(config: any): VariantPriceDto {
    return {
      priceTypeId: config.priceTypeId,
      price: Number(config.price),
      minQuantity: config.minQuantity,
    } as VariantPriceDto;
  }

  //Private methods for Create Product Variants
  private async checkUniqueness(
    fieldName: "sku" | "barcode",
    value: string,
    productId: string,
    excludeVariantId?: string
  ): Promise<void> {
    if (!value) return;

    this.logger.debug(
      `[VALIDATION] Checking for unique conflicts on ${fieldName}: ${value}`
    );

    // Check if the value matches the parent product's SKU/barcode (allowed)
    const parentProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { sku: true, barcode: true },
    });

    if (parentProduct) {
      const parentValue =
        fieldName === "sku" ? parentProduct.sku : parentProduct.barcode;
      if (parentValue === value) {
        this.logger.debug(
          `[VALIDATION] ${fieldName} matches parent product, allowing duplicate.`
        );
        return; // Allow variant to have same SKU/barcode as parent product
      }
    }

    // Check for duplicates in other products' variants (excluding current variant if updating)
    const variantCheck = await this.prisma.productVariant.findFirst({
      where: {
        [fieldName]: value,
        isDeleted: false,
        productId: { not: productId }, // Exclude variants from the same product
        ...(excludeVariantId && { id: { not: excludeVariantId } }),
      },
      select: { id: true, productId: true },
    });

    if (variantCheck) {
      this.logger.warn(
        `[VALIDATION] ${fieldName} duplicate in variant from different product: ${value}`
      );
      throw new ConflictException(
        `A variant with ${fieldName} "${value}" already exists in another product`
      );
    }
  }

  private mapSinglePrice(p: PricePayload): VariantPriceDto {
    return {
      priceTypeId: p.priceTypeId,
      price:
        typeof p.price === "object" && "toNumber" in p.price
          ? p.price.toNumber()
          : Number(p.price),
      minQuantity: p.minQuantity,
    };
  }

  private mapToProductVariantDto(
    updatedVariant: UpdatedVariantType
  ): ProductVariantDto {
    this.logger.debug(
      `[MAPPER] Mapping updated variant ${updatedVariant.id} to DTO.`
    );
    return {
      id: updatedVariant.id,
      productId: updatedVariant.productId,
      type: updatedVariant.product.type as ProductType,
      sku: updatedVariant.sku ?? null,
      barcode: updatedVariant.barcode ?? null,
      name: updatedVariant.name ?? null,
      costPrice: Number(updatedVariant.costPrice),
      prices: updatedVariant.prices.map(p => this.mapSinglePrice(p)),
      minimumStock: updatedVariant.minimumStock ?? null,
      maximumStock: updatedVariant.maximumStock ?? null,
      multiple: updatedVariant.multiple ?? null,
      appliesToDiscounts: updatedVariant.appliesToDiscounts,
      attributes:
        typeof updatedVariant.attributes === "object" &&
        updatedVariant.attributes !== null &&
        !Array.isArray(updatedVariant.attributes)
          ? (updatedVariant.attributes as Record<string, any>)
          : {},
      metadata:
        typeof updatedVariant.metadata === "object" &&
        updatedVariant.metadata !== null &&
        !Array.isArray(updatedVariant.metadata)
          ? (updatedVariant.metadata as Record<string, any>)
          : {},
      isActive: updatedVariant.isActive,
      isDeleted: updatedVariant.isDeleted,
      createdAt: updatedVariant.createdAt,
      updatedAt: updatedVariant.updatedAt,
      deletedAt: updatedVariant.deletedAt ?? null,
    };
  }

  async create(
    productId: string,
    createProductVariantDto: CreateProductVariantDto
  ): Promise<ProductVariantDto> {
    this.logger.log(`[CREATE] Creating variant for productId: ${productId}`);

    const parentProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: { select: { name: true } } },
    });

    if (!parentProduct || parentProduct.isDeleted || !parentProduct.isActive) {
      this.logger.warn(
        `[VALIDATION] Product ${productId} not found, deleted, or inactive.`
      );
      throw new NotFoundException("Product (parent) not found or is inactive.");
    }

    this.logger.debug(
      `[VALIDATION] Parent product ${productId} found and active.`
    );

    const { minimumStock, maximumStock } = createProductVariantDto;
    const multiple = createProductVariantDto.multiple ?? null;
    if (
      minimumStock != null &&
      maximumStock != null &&
      minimumStock > maximumStock
    ) {
      this.logger.warn(
        `[VALIDATION] Minimum stock (${minimumStock}) greater than maximum stock (${maximumStock}).`
      );
      throw new BadRequestException(
        "The minimum stock cannot be greater than the maximum stock."
      );
    }

    try {
      await Promise.all([
        this.checkUniqueness("sku", createProductVariantDto.sku, productId),
        this.checkUniqueness(
          "barcode",
          createProductVariantDto.barcode,
          productId
        ),
      ]);
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      this.logger.error(
        `[VALIDATION:UNIQUENESS:ERROR] SKU/Barcode check failed: ${e.message}`
      );
      throw new BadRequestException("Validation failed: " + e.message);
    }

    if (!createProductVariantDto.sku) {
      const parentBrand = await this.prisma.brand.findUnique({
        where: { id: parentProduct.brandId },
      });
      if (!parentBrand) {
        throw new NotFoundException("Brand not found for product variant");
      }

      const brandWords = parentBrand.name.trim().split(/\s+/);
      let brandAbbr = "";
      if (brandWords.length === 1) {
        brandAbbr = brandWords[0].slice(0, 2).toUpperCase();
      } else {
        brandAbbr = brandWords.map(w => w[0].toUpperCase()).join("");
      }

      const skuCount = await this.prisma.productVariant.count({
        where: {
          sku: { startsWith: `${brandAbbr}-` },
        },
      });

      createProductVariantDto.sku = `${brandAbbr}-${String(
        skuCount + 1
      ).padStart(3, "0")}`;
      this.logger.debug(
        `[SKU] Autogenerated SKU: ${createProductVariantDto.sku}`
      );
    }

    const inputPrices: CreateVariantPriceDto[] =
      createProductVariantDto.prices || [];

    try {
      const variant = await this.prisma.$transaction(async tx => {
        const newVariant = await tx.productVariant.create({
          data: {
            productId,
            type: parentProduct.type as ProductType,
            sku: createProductVariantDto.sku,
            barcode: createProductVariantDto.barcode,
            name: createProductVariantDto.name,
            costPrice: createProductVariantDto.costPrice,
            minimumStock,
            maximumStock,
            multiple,
            appliesToDiscounts: createProductVariantDto.appliesToDiscounts,
            attributes:
              (createProductVariantDto.attributes as Prisma.JsonValue) || {},
          },
        });
        this.logger.debug(
          `[TX:VARIANT] Variant created with ID: ${newVariant.id}`
        );

        if (inputPrices.length > 0) {
          const dataToCreate = inputPrices.map(p => ({
            productVariantId: newVariant.id,
            priceTypeId: p.priceTypeId,
            price: p.price,
            minQuantity: p.minQuantity ?? 1,
          }));

          await tx.productVariantPrice.createMany({
            data: dataToCreate,
            skipDuplicates: true,
          });

          this.logger.debug(
            `[TX:PRICES] Inserted ${dataToCreate.length} price configurations.`
          );
        }

        if (parentProduct.type === ProductType.KIT) {
          const kitItems = await tx.productKitItem.findMany({
            where: { productKitId: parentProduct.id },
            select: { productVariantId: true, quantity: true },
          });

          await tx.productVariant.update({
            where: { id: newVariant.id },
            data: {
              metadata: {
                kitItems: kitItems.map(item => ({
                  variantId: item.productVariantId,
                  quantity: item.quantity,
                })),
              },
            },
          });
        }
        this.logger.debug(`[TX:COMMIT] Transaction committed successfully.`);

        return newVariant;
      });

      this.logger.log(
        `[CREATE:SUCCESS] Product variant ${variant.id} created successfully.`
      );

      this.scheduleSearchIndexRefresh(variant.id);

      return this.mapToProductVariantDto(
        await this.prisma.productVariant.findUniqueOrThrow({
          where: { id: variant.id },
          include: { product: true, prices: { include: { priceType: true } } },
        })
      );
    } catch (error) {
      this.logger.error(
        `[CREATE:ERROR] Transaction failed: ${error.message}`,
        error.stack
      );

      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        "Failed to create product variant due to a server error."
      );
    }
  }

  //Private methods for Update Product Variant
  private validateStockRange(min?: number, max?: number): void {
    if (min != null && max != null && min > max) {
      this.logger.warn(
        `[VALIDATION] Minimum stock (${min}) cannot be greater than maximum stock (${max}).`
      );
      throw new BadRequestException(
        "The minimum stock cannot be greater than the maximum stock."
      );
    }
  }

  private prepareUpdateData(
    dto: UpdateProductVariantDto,
    parentType?: ProductType
  ): Prisma.ProductVariantUpdateInput {
    const updateData: Prisma.ProductVariantUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.sku !== undefined) updateData.sku = dto.sku;
    if (dto.barcode !== undefined) updateData.barcode = dto.barcode;
    if (dto.costPrice !== undefined) updateData.costPrice = dto.costPrice;
    if (dto.minimumStock !== undefined) {
      updateData.minimumStock = dto.minimumStock;
    }
    if (dto.maximumStock !== undefined) {
      updateData.maximumStock = dto.maximumStock;
    }
    if (dto.multiple !== undefined) {
      updateData.multiple = dto.multiple ?? null;
    }
    if (dto.appliesToDiscounts !== undefined) {
      updateData.appliesToDiscounts = dto.appliesToDiscounts;
    }
    if (dto.attributes !== undefined) {
      updateData.attributes = dto.attributes as Prisma.JsonValue;
    }
    if (parentType !== undefined) {
      updateData.type = parentType;
    }

    return updateData;
  }

  async update(
    productId: string,
    variantId: string,
    updateProductVariantDto: UpdateProductVariantDto
  ): Promise<ProductVariantDto> {
    this.logger.log(`[UPDATE] Updating variant with ID: ${variantId}`);
    this.logger.debug(
      `[UPDATE] Received DTO: ${JSON.stringify(updateProductVariantDto, null, 2)}`
    );
    this.logger.debug(
      `[UPDATE] Prices in DTO: ${JSON.stringify(updateProductVariantDto.prices, null, 2)}`
    );

    // Check if variant exists and is not deleted
    const existingVariant: UpdatedVariantType | null =
      await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true, prices: { include: { priceType: true } } },
      });

    if (!existingVariant || existingVariant.isDeleted) {
      this.logger.warn(
        `[VALIDATION] Variant with ID ${variantId} not found or deleted.`
      );
      throw new NotFoundException("Product variant not found or is deleted.");
    }

    if (existingVariant.productId !== productId) {
      this.logger.warn(
        `[VALIDATION] Variant ${variantId} does not belong to product ${productId}.`
      );
      throw new NotFoundException(
        "Product variant not found under the specified product ID."
      );
    }

    this.logger.debug(`[UPDATE] Existing variant found: ${variantId}.`);

    // Validate stock range
    const minStockToValidate =
      updateProductVariantDto.minimumStock !== undefined
        ? updateProductVariantDto.minimumStock
        : existingVariant.minimumStock;

    const maxStockToValidate =
      updateProductVariantDto.maximumStock !== undefined
        ? updateProductVariantDto.maximumStock
        : existingVariant.maximumStock;

    this.validateStockRange(minStockToValidate, maxStockToValidate);
    this.logger.debug(
      `[UPDATE] Stock range validated: Min=${minStockToValidate}, Max=${maxStockToValidate}.`
    );

    // Check uniqueness for SKU and barcode
    try {
      if (
        updateProductVariantDto.sku &&
        updateProductVariantDto.sku !== existingVariant.sku
      ) {
        await this.checkUniqueness(
          "sku",
          updateProductVariantDto.sku,
          productId,
          variantId
        );
      }
      if (
        updateProductVariantDto.barcode &&
        updateProductVariantDto.barcode !== existingVariant.barcode
      ) {
        await this.checkUniqueness(
          "barcode",
          updateProductVariantDto.barcode,
          productId,
          variantId
        );
      }
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      throw new BadRequestException("Validation failed: " + e.message);
    }

    const parentProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { type: true },
    });
    const parentType = parentProduct?.type as ProductType | undefined;

    const updateVariantData = this.prepareUpdateData(
      updateProductVariantDto,
      parentType
    );
    const transactionActions: Prisma.PrismaPromise<any>[] = [];

    // If prices are being updated, validate and prepare price actions
    if (updateProductVariantDto.prices !== undefined) {
      this.pricesService.validatePrices(updateProductVariantDto.prices);
      this.logger.debug(
        `[UPDATE] Price configs validated. Preparing transaction actions.`
      );
      updateProductVariantDto.prices.map(p => p.priceTypeId);

      this.logger.debug(
        `[UPDATE] Prices validated. Preparing transaction actions.`
      );

      // Update prices in transaction from product variant prices service
      const priceActions = this.pricesService.updatePricesInTransaction(
        variantId,
        updateProductVariantDto.prices
      );
      transactionActions.push(...priceActions);
    }

    // Main update action for the variant
    const updateAction = this.prisma.productVariant.update({
      where: { id: variantId },
      data: updateVariantData,
    });
    transactionActions.push(updateAction);

    // If the product is a KIT, update the metadata with the current kit items
    if (parentType === ProductType.KIT) {
      const kitItems = await this.prisma.productKitItem.findMany({
        where: { productKitId: productId },
        select: { productVariantId: true, quantity: true },
      });
      transactionActions.push(
        this.prisma.productVariant.update({
          where: { id: variantId },
          data: {
            metadata: {
              kitItems: kitItems.map(item => ({
                variantId: item.productVariantId,
                quantity: item.quantity,
              })),
            },
          },
        })
      );
    }

    // Final read action to return the updated variant with all relations
    const finalReadAction = this.prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      include: { product: true, prices: { include: { priceType: true } } },
    });
    transactionActions.push(finalReadAction);

    this.logger.debug(
      `[UPDATE] Executing Prisma transaction with ${transactionActions.length} actions.`
    );

    const transactionResult =
      await this.prisma.$transaction(transactionActions);

    // The last action is always the final read, so we return that
    const updatedVariant: UpdatedVariantType =
      transactionResult[transactionResult.length - 1];

    this.logger.log(
      `[UPDATE] Product variant ${variantId} updated successfully`
    );

    this.scheduleSearchIndexRefresh(variantId);

    return this.mapToProductVariantDto(updatedVariant);
  }

  async remove(variantId: string): Promise<DeleteProductVariantResponseDto> {
    this.logger.log(`[DELETE] Soft deleting variant with ID: ${variantId}`);

    const existingVariant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!existingVariant || existingVariant.isDeleted) {
      this.logger.warn(
        `[VALIDATION] Variant with ID ${variantId} not found or already deleted.`
      );
      throw new NotFoundException(
        "Product variant not found or is already deleted."
      );
    }

    // Soft delete the variant and cascade delete related product kit items in a transaction
    await this.prisma.$transaction(async tx => {
      await tx.productKitItem.deleteMany({
        where: { productVariantId: variantId },
      });

      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `[DELETE] Product variant ${variantId} soft deleted successfully`
    );

    return {
      success: true,
      message: "Product deleted successfully",
      id: variantId,
    };
  }

  async findOne(variantId: string): Promise<ProductVariantDto> {
    this.logger.log(`[FIND] Finding variant with ID: ${variantId}`);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: {
            brand: true,
            category: true,
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
        prices: true,
      },
    });

    if (!variant || variant.isDeleted) {
      this.logger.warn(
        `[VALIDATION] Variant with ID ${variantId} not found or deleted.`
      );
      throw new NotFoundException("Product variant not found or is deleted.");
    }

    const prices: VariantPriceDto[] = variant.prices.map(p =>
      this.mapSinglePricesToDto(p)
    );

    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku ?? null,
      barcode: variant.barcode ?? null,
      name: variant.name ?? null,
      costPrice: Number(variant.costPrice),
      prices,
      minimumStock: variant.minimumStock ?? null,
      maximumStock: variant.maximumStock ?? null,
      multiple: variant.multiple ?? null,
      appliesToDiscounts: variant.appliesToDiscounts ?? null,
      attributes: variant.attributes ?? null,
      metadata: variant.metadata ?? null,
      isActive: variant.isActive,
      isDeleted: variant.isDeleted,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      deletedAt: variant.deletedAt ?? null,
    } as ProductVariantDto;
  }

  // Search for Product Variants for POS
  // Optimized with GIN trigram indexes for fast case-insensitive text search
  // See migration: 20260108004327_optimize_product_search_indexes
  async searchForPOS(query: string, locationId?: string): Promise<any[]> {
    const startTime = Date.now();
    this.logger.log(`[SEARCH_POS] Searching variants with query: ${query}`);

    if (!query || query.trim() === "") {
      throw new BadRequestException("Search query is required");
    }

    const hybridHits = await this.variantEmbedding.hybridSearchVariantIds(
      query,
      50
    );
    if (hybridHits.length > 0) {
      const variants = await this.findVariantsByIds(
        hybridHits.map(hit => hit.variantId),
        locationId
      );
      if (variants.length > 0) {
        const scoreByVariantId = new Map(
          hybridHits.map(hit => [hit.variantId, hit.score])
        );
        variants.sort(
          (a, b) =>
            (scoreByVariantId.get(b.id) ?? 0) -
            (scoreByVariantId.get(a.id) ?? 0)
        );
        this.logger.debug(
          `[SEARCH_POS] Hybrid search found ${variants.length} variants in ${Date.now() - startTime}ms`
        );
        return variants.map(variant =>
          this.mapPosSearchVariant(variant, locationId)
        );
      }
    }

    const queries = this.productSearch.expandSearchQueries(query);
    for (const searchTerm of queries) {
      const variants = await this.findVariantsForPosQuery(
        searchTerm,
        locationId
      );
      if (variants.length > 0) {
        this.logger.debug(
          `[SEARCH_POS] Found ${variants.length} variants in ${Date.now() - startTime}ms (query="${searchTerm}")`
        );
        return variants.map(variant =>
          this.mapPosSearchVariant(variant, locationId)
        );
      }
    }

    this.logger.debug(
      `[SEARCH_POS] Found 0 variants in ${Date.now() - startTime}ms`
    );
    return [];
  }

  private async findVariantsForPosQuery(query: string, locationId?: string) {
    return this.prisma.productVariant.findMany({
      where: this.productSearch.buildVariantTokenWhere(query),
      include: this.posSearchInclude(locationId),
      take: 50,
    });
  }

  private async findVariantsByIds(variantIds: string[], locationId?: string) {
    if (variantIds.length === 0) return [];
    return this.prisma.productVariant.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        id: { in: variantIds },
        product: { isDeleted: false, isActive: true },
      },
      include: this.posSearchInclude(locationId),
      take: 50,
    });
  }

  private posSearchInclude(locationId?: string): Prisma.ProductVariantInclude {
    return {
      product: {
        include: {
          brand: true,
          category: true,
          images: {
            where: { isDeleted: false },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          kitItems: {
            include: {
              productVariant: {
                include: {
                  stockLevels: locationId
                    ? {
                        where: { locationId },
                      }
                    : undefined,
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
      images: {
        where: { isDeleted: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      stockLevels: locationId
        ? {
            where: {
              locationId,
            },
          }
        : undefined,
    };
  }

  private mapPosSearchVariant(variant: any, _locationId?: string): any {
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
      multiple: variant.multiple,
      appliesToDiscounts: variant.appliesToDiscounts,
      attributes:
        typeof variant.attributes === "object" &&
        variant.attributes !== null &&
        !Array.isArray(variant.attributes)
          ? (variant.attributes as Record<string, any>)
          : {},
      metadata: variant.metadata ?? null,
      product: (() => {
        const prod = variant.product as any;
        const variantImages = (variant as any).images ?? [];
        const productImages = (prod.images ?? []).slice();
        const effectiveList =
          variantImages.length > 0 ? variantImages : productImages;
        const images = effectiveList
          .slice()
          .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
        const primary = images.find((img: any) => img.isPrimary);
        const primaryImageUrl = primary?.url ?? images[0]?.url ?? undefined;
        return {
          id: variant.product.id,
          name: variant.product.name,
          type: variant.product.type,
          sku: variant.product.sku,
          brand: variant.product.brand
            ? {
                id: variant.product.brand.id,
                name: variant.product.brand.name,
                logoUrl: (variant.product.brand as any).logoUrl ?? undefined,
              }
            : null,
          category: variant.product.category
            ? {
                id: variant.product.category.id,
                name: variant.product.category.name,
              }
            : null,
          images: images.map((img: any) => ({
            id: img.id,
            url: img.url,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
            createdAt: img.createdAt,
          })),
          primaryImageUrl,
          kitItems: variant.product.kitItems?.map(ki => ({
            id: ki.id,
            quantity: Number(ki.quantity),
            productVariantId: ki.productVariantId,
            productVariant: {
              id: ki.productVariant.id,
              name: ki.productVariant.name,
              sku: ki.productVariant.sku,
              stockLevel: ki.productVariant.stockLevels?.[0]
                ? {
                    quantity: Number(ki.productVariant.stockLevels[0].quantity),
                    reserved: Number(ki.productVariant.stockLevels[0].reserved),
                    available:
                      Number(ki.productVariant.stockLevels[0].quantity) -
                      Number(ki.productVariant.stockLevels[0].reserved),
                  }
                : null,
            },
          })),
        };
      })(),
      stockLevel: variant.stockLevels?.[0]
        ? {
            quantity: Number(variant.stockLevels[0].quantity),
            reserved: Number(variant.stockLevels[0].reserved),
            available:
              Number(variant.stockLevels[0].quantity) -
              Number(variant.stockLevels[0].reserved),
          }
        : null,
      isActive: variant.isActive,
      isDeleted: variant.isDeleted,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      deletedAt: variant.deletedAt,
    };
  }

  // Report: Sales by Products
  public async exportSalesByProductReport(
    filters: ExportSalesByProductFilters
  ): Promise<DataWorkbookRequest> {
    const { from, to } = normalizeDateRange({
      from: filters.from,
      to: filters.to,
    });

    // Build order-level AND predicates
    const orderAnd: Prisma.OrderWhereInput[] = [
      { customer: { isDeleted: false } },
    ];
    if (filters.branchId) orderAnd.push({ branchId: filters.branchId });
    if (filters.employeeId) {
      orderAnd.push({
        OR: [
          { sellerId: filters.employeeId },
          { cashierId: filters.employeeId },
        ],
      });
    }

    if (from || to) {
      orderAnd.push({
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      });
    }

    const itemClauses: Prisma.OrderItemWhereInput[] = [];
    if (filters.productId) itemClauses.push({ productId: filters.productId });
    if (filters.productVariantId) {
      itemClauses.push({ productVariantId: filters.productVariantId });
    }
    if (filters.productName) {
      itemClauses.push({
        product: {
          name: { contains: filters.productName, mode: "insensitive" },
        },
      });
    }
    if (filters.productVariantName) {
      itemClauses.push({
        productVariant: {
          name: { contains: filters.productVariantName, mode: "insensitive" },
        },
      });
    }
    if (filters.productVariantSku) {
      itemClauses.push({
        productVariant: {
          sku: { contains: filters.productVariantSku, mode: "insensitive" },
        },
      });
      itemClauses.push({
        product: {
          sku: { contains: filters.productVariantSku, mode: "insensitive" },
        },
      });
    }
    let productSomeClause: Prisma.OrderItemWhereInput | null = null;
    if (itemClauses.length) {
      productSomeClause =
        itemClauses.length === 1 ? itemClauses[0] : { OR: itemClauses };
      if (filters.brandId) {
        productSomeClause = {
          AND: [productSomeClause, { product: { brandId: filters.brandId } }],
        };
      }
    } else if (filters.brandId) {
      productSomeClause = { product: { brandId: filters.brandId } };
    }

    const orderNumberPredicate = filters.orderNumber
      ? {
          orderNumber: {
            contains: filters.orderNumber,
            mode: "insensitive" as Prisma.QueryMode,
          },
        }
      : null;

    const orParts: Prisma.OrderWhereInput[] = [];
    if (orderNumberPredicate) orParts.push(orderNumberPredicate);
    if (productSomeClause) {
      orParts.push({ orderItems: { some: productSomeClause } });
    }

    // Optional cap on materialized rows (used by preview to avoid loading the
    // entire order-item history into memory). Undefined => unbounded (export).
    const rowLimit =
      typeof filters.maxRows === "number" && filters.maxRows > 0
        ? Math.floor(filters.maxRows)
        : undefined;

    // Hard ceiling for full (non-preview) exports: refuse to build a report so
    // large it could exhaust process memory. Callers must narrow the range.
    const MAX_EXPORT_ROWS = 50000;
    const guardExportSize = async (
      where: Prisma.OrderItemWhereInput
    ): Promise<void> => {
      if (rowLimit) return; // preview is already bounded by `take`
      const count = await this.prisma.orderItem.count({ where });
      if (count > MAX_EXPORT_ROWS) {
        throw new BadRequestException(
          `El reporte tiene ${count.toLocaleString()} líneas, supera el máximo de ${MAX_EXPORT_ROWS.toLocaleString()}. Filtra por rango de fechas, producto o marca para reducir el resultado.`
        );
      }
    };

    // Build per-item rows: date, orderNumber, product (combined), quantity, total (net per line)
    const rows: Array<Record<string, any>> = [];

    if (filters.orderNumber) {
      const orderNumberPredicateLocal = {
        orderNumber: {
          contains: filters.orderNumber,
          mode: "insensitive" as Prisma.QueryMode,
        },
      };

      // Build a where that ONLY filters orders by order-level constraints + orderNumber.
      // This ensures we return all items for matching orders (ignoring item-level filters).
      const whereForOrders: Prisma.OrderWhereInput = orderAnd.length
        ? { AND: [...orderAnd, orderNumberPredicateLocal] }
        : orderNumberPredicateLocal;
      const orders = await this.prisma.order.findMany({
        where: whereForOrders,
        ...(rowLimit ? { take: rowLimit } : {}),
        include: {
          branch: { select: { id: true, name: true } },
          orderItems: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              discountAmount: true,
              taxAmount: true,
              lineTotal: true,
              product: {
                select: { id: true, name: true, sku: true, brandId: true },
              },
              productVariant: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const o of orders) {
        for (const it of o.orderItems ?? []) {
          const qty = Number(it.quantity ?? 0);
          const unit = Number(it.unitPrice ?? 0);
          const discount = Number(it.discountAmount ?? 0);

          const itemSubtotal = unit * qty;
          const itemDiscount = discount;
          const itemNetAmount = itemSubtotal - itemDiscount;

          const orderSubtotal = Number(o.subtotal ?? 0);
          const orderDiscountAmount = Number(o.discountAmount ?? 0);
          const orderTaxes = Number(o.taxes ?? 0);
          const itemsDiscountTotal = Number(o.itemsDiscountTotal ?? 0);

          const orderLevelDiscount = orderDiscountAmount - itemsDiscountTotal;
          const orderBaseForProportion = orderSubtotal - itemsDiscountTotal;

          const itemProportion =
            orderBaseForProportion > 0
              ? itemNetAmount / orderBaseForProportion
              : 0;

          const itemOrderDiscountDistributed =
            orderLevelDiscount * itemProportion;

          let itemTaxAmount = 0;
          if (o.includeTax && orderBaseForProportion > 0) {
            itemTaxAmount = orderTaxes * itemProportion;
          }

          const recomputedTotalRaw =
            itemNetAmount - itemOrderDiscountDistributed + itemTaxAmount;

          const recomputed = Number(recomputedTotalRaw.toFixed(2));
          const total = recomputed;

          const sku = it.productVariant?.sku ?? it.product?.sku ?? "";

          const parts: string[] = [];
          if (it.product?.name) parts.push(it.product.name);
          if (it.productVariant?.name) parts.push(it.productVariant.name);
          if (sku) parts.push(sku);
          const productCombined = parts.join(" - ");

          rows.push({
            date: o.createdAt,
            orderNumber: o.orderNumber,
            product: productCombined,
            quantity: qty,
            total,
          });
        }
      }
    } else if (productSomeClause) {
      // Build an item-level where that matches the preview semantics:
      // items whose order matches orderAnd AND whose item matches productSomeClause
      const prismaItemWhere: Prisma.OrderItemWhereInput = {
        AND: [{ order: { AND: orderAnd } }, productSomeClause],
      };
      await guardExportSize(prismaItemWhere);
      const items = await this.prisma.orderItem.findMany({
        where: prismaItemWhere,
        ...(rowLimit ? { take: rowLimit } : {}),
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          discountAmount: true,
          taxAmount: true,
          lineTotal: true,
          order: {
            select: {
              createdAt: true,
              orderNumber: true,
              subtotal: true,
              taxes: true,
              itemsDiscountTotal: true,
              discountAmount: true,
              includeTax: true,
              branch: { select: { name: true } },
            },
          },
          product: {
            select: { id: true, name: true, sku: true, brandId: true },
          },
          productVariant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: [{ order: { createdAt: "desc" } }, { id: "desc" }],
      });

      for (const it of items) {
        const o = it.order!;
        const qty = Number(it.quantity ?? 0);
        const unit = Number(it.unitPrice ?? 0);
        const discount = Number(it.discountAmount ?? 0);

        const itemSubtotal = unit * qty;
        const itemDiscount = discount;
        const itemNetAmount = itemSubtotal - itemDiscount;

        const orderSubtotal = Number(o.subtotal ?? 0);
        const orderDiscountAmount = Number(o.discountAmount ?? 0);
        const orderTaxes = Number(o.taxes ?? 0);
        const itemsDiscountTotal = Number(o.itemsDiscountTotal ?? 0);

        const orderLevelDiscount = orderDiscountAmount - itemsDiscountTotal;
        const orderBaseForProportion = orderSubtotal - itemsDiscountTotal;

        const itemProportion =
          orderBaseForProportion > 0
            ? itemNetAmount / orderBaseForProportion
            : 0;

        const itemOrderDiscountDistributed =
          orderLevelDiscount * itemProportion;

        let itemTaxAmount = 0;
        if (o.includeTax && orderBaseForProportion > 0) {
          itemTaxAmount = orderTaxes * itemProportion;
        }

        const recomputedTotalRaw =
          itemNetAmount - itemOrderDiscountDistributed + itemTaxAmount;

        const recomputed = Number(recomputedTotalRaw.toFixed(2));
        const total = recomputed;
        const sku = it.productVariant?.sku ?? it.product?.sku ?? "";

        const parts: string[] = [];
        if (it.product?.name) parts.push(it.product.name);
        if (it.productVariant?.name) parts.push(it.productVariant.name);
        if (sku) parts.push(sku);
        const productCombined = parts.join(" - ");

        rows.push({
          date: o.createdAt,
          orderNumber: o.orderNumber,
          product: productCombined,
          quantity: qty,
          total,
        });
      }
    } else {
      // No filters: return all items whose order matches order-level constraints (orderAnd).
      const prismaItemWhereAll: Prisma.OrderItemWhereInput = {
        order: { AND: orderAnd },
      };

      await guardExportSize(prismaItemWhereAll);
      const itemsAll = await this.prisma.orderItem.findMany({
        where: prismaItemWhereAll,
        ...(rowLimit ? { take: rowLimit } : {}),
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          discountAmount: true,
          taxAmount: true,
          lineTotal: true,
          order: {
            select: {
              createdAt: true,
              orderNumber: true,
              subtotal: true,
              taxes: true,
              itemsDiscountTotal: true,
              discountAmount: true,
              includeTax: true,
              branch: { select: { name: true } },
            },
          },
          product: {
            select: { id: true, name: true, sku: true, brandId: true },
          },
          productVariant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: [{ order: { createdAt: "desc" } }, { id: "desc" }],
      });
      for (const it of itemsAll) {
        const o = it.order!;
        const qty = Number(it.quantity ?? 0);
        const unit = Number(it.unitPrice ?? 0);
        const discount = Number(it.discountAmount ?? 0);

        const itemSubtotal = unit * qty;
        const itemDiscount = discount;
        const itemNetAmount = itemSubtotal - itemDiscount;

        const orderSubtotal = Number(o.subtotal ?? 0);
        const orderDiscountAmount = Number(o.discountAmount ?? 0);
        const orderTaxes = Number(o.taxes ?? 0);
        const itemsDiscountTotal = Number(o.itemsDiscountTotal ?? 0);

        const orderLevelDiscount = orderDiscountAmount - itemsDiscountTotal;
        const orderBaseForProportion = orderSubtotal - itemsDiscountTotal;

        const itemProportion =
          orderBaseForProportion > 0
            ? itemNetAmount / orderBaseForProportion
            : 0;

        const itemOrderDiscountDistributed =
          orderLevelDiscount * itemProportion;

        let itemTaxAmount = 0;
        if (o.includeTax && orderBaseForProportion > 0) {
          itemTaxAmount = orderTaxes * itemProportion;
        }

        const recomputedTotalRaw =
          itemNetAmount - itemOrderDiscountDistributed + itemTaxAmount;

        const recomputed = Number(recomputedTotalRaw.toFixed(2));
        const total = recomputed;

        const sku = it.productVariant?.sku ?? it.product?.sku ?? "";
        const parts: string[] = [];
        if (it.product?.name) parts.push(it.product.name);
        if (it.productVariant?.name) parts.push(it.productVariant.name);
        if (sku) parts.push(sku);
        const productCombined = parts.join(" - ");

        rows.push({
          date: o.createdAt,
          orderNumber: o.orderNumber,
          product: productCombined,
          quantity: qty,
          total,
        });
      }
    }
    const fields = [
      "date",
      "orderNumber",
      "product",
      "quantity",
      "total",
    ] as const;

    const headerMap = {
      date: "Fecha",
      orderNumber: "# Orden",
      product: "Producto",
      quantity: "Cantidad",
      total: "Total",
    } as const;

    const columnHints = {
      date: { width: 22, numFmt: "dd/mm/yyyy hh:mm:ss AM/PM" },
      orderNumber: { width: 20 },
      product: { width: 90 },
      quantity: { width: 12 },
      total: { width: 18, numFmt: '"$"#,##0.00' },
    };

    // Calculate totals for numeric columns (quantity, total)
    const numericFields: Array<(typeof fields)[number]> = ["quantity", "total"];
    const numericFieldIndices = numericFields
      .map(field => {
        const index = fields.indexOf(field);
        return index >= 0 ? { field, index } : null;
      })
      .filter(
        (item): item is { field: (typeof fields)[number]; index: number } =>
          item !== null
      );

    if (!rowLimit && numericFieldIndices.length > 0) {
      const sums: Record<(typeof fields)[number], number> = {} as Record<
        (typeof fields)[number],
        number
      >;
      for (const { field } of numericFieldIndices) {
        sums[field] = 0;
      }

      for (const row of rows) {
        for (const { field } of numericFieldIndices) {
          const value = (row as any)[field];
          if (typeof value === "number") {
            sums[field] += value;
          } else if (value != null) {
            const num = Number(value);
            if (!Number.isNaN(num)) {
              sums[field] += num;
            }
          }
        }
      }

      // Check if any sum is non-zero
      const hasNonZeroSum = Object.values(sums).some(
        s => !Number.isNaN(s) && s !== 0
      );

      if (hasNonZeroSum) {
        const totalRow: any = {};
        // Create total row with empty values except for numeric columns
        fields.forEach((field, index) => {
          if (index === 0) {
            // Put "Total" label in first column
            totalRow[field] = "Total";
          } else {
            // Check if this field is one of the numeric fields we're summing
            const numericField = numericFieldIndices.find(
              nf => nf.field === field
            );
            if (numericField) {
              // Put sum in the corresponding numeric column
              totalRow[field] = sums[numericField.field];
            } else {
              totalRow[field] = "";
            }
          }
        });
        rows.push(totalRow);
      }
    }

    const fileName = `ventas-por-producto-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    return {
      fileName,
      sheets: [
        {
          name: "Reporte de ventas por producto",
          rows,
          fields,
          headerMap,
          columnHints,
          defaultColumnWidth: 16,
        },
      ],
    } as DataWorkbookRequest;
  }

  async listSalesByProductItems(params: ProductSalesListParams = {}): Promise<{
    data: Array<{
      date: string;
      orderNumber: string;
      branch: string;
      productName: string;
      variantName: string;
      variantSku: string;
      quantity: number;
      orderTotal: number;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const skip = (page - 1) * limit;

    const { from, to } = normalizeDateRange({
      from: params.from,
      to: params.to,
    });

    const orderAnd: Prisma.OrderWhereInput[] = [
      { customer: { isDeleted: false } },
    ];
    if (params.employeeId) {
      orderAnd.push({
        OR: [{ sellerId: params.employeeId }, { cashierId: params.employeeId }],
      });
    }
    if (params.branchId) orderAnd.push({ branchId: params.branchId });
    if (from || to) {
      orderAnd.push({
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      });
    }

    // Build item-level clauses (these match the item itself)
    const itemClauses: Prisma.OrderItemWhereInput[] = [];
    if (params.productId) itemClauses.push({ productId: params.productId });
    if (params.productVariantId) {
      itemClauses.push({ productVariantId: params.productVariantId });
    }
    if (params.productName) {
      itemClauses.push({
        product: {
          name: { contains: params.productName, mode: "insensitive" },
        },
      });
    }
    if (params.productVariantName) {
      itemClauses.push({
        productVariant: {
          name: { contains: params.productVariantName, mode: "insensitive" },
        },
      });
    }
    if (params.productVariantSku) {
      itemClauses.push({
        productVariant: {
          sku: { contains: params.productVariantSku, mode: "insensitive" },
        },
      });
      itemClauses.push({
        product: {
          sku: { contains: params.productVariantSku, mode: "insensitive" },
        },
      });
    }

    if (params.brandId) {
      if (itemClauses.length) {
        const wrapped =
          itemClauses.length === 1 ? itemClauses[0] : { OR: itemClauses };
        itemClauses.length = 0;
        itemClauses.push({
          AND: [wrapped, { product: { brandId: params.brandId } }],
        });
      } else {
        itemClauses.push({ product: { brandId: params.brandId } });
      }
    }

    // orderNumber clause
    const orderNumberClause: Prisma.OrderItemWhereInput | null =
      params.orderNumber
        ? {
            order: {
              orderNumber: {
                contains: params.orderNumber,
                mode: "insensitive",
              },
            },
          }
        : null;

    // Compose final where for orderItem.findMany
    const andParts: Prisma.OrderItemWhereInput[] = [];
    if (orderAnd.length) {
      andParts.push({ order: { AND: orderAnd } });
    }

    const orParts: Prisma.OrderItemWhereInput[] = [];
    if (orderNumberClause) orParts.push(orderNumberClause);
    if (itemClauses.length) {
      orParts.push(
        itemClauses.length === 1 ? itemClauses[0] : { OR: itemClauses }
      );
    }

    let prismaItemWhere: Prisma.OrderItemWhereInput = {};
    if (andParts.length && orParts.length) {
      prismaItemWhere = {
        AND: [...andParts, orParts.length === 1 ? orParts[0] : { OR: orParts }],
      };
    } else if (andParts.length) {
      prismaItemWhere = andParts.length === 1 ? andParts[0] : { AND: andParts };
    } else if (orParts.length) {
      prismaItemWhere = orParts.length === 1 ? orParts[0] : { OR: orParts };
    } else {
      prismaItemWhere = {};
    }

    const total = await this.prisma.orderItem.count({ where: prismaItemWhere });

    const items = await this.prisma.orderItem.findMany({
      where: prismaItemWhere,
      skip,
      take: limit,
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        discountAmount: true,
        taxAmount: true,
        lineTotal: true,
        order: {
          select: {
            createdAt: true,
            orderNumber: true,
            subtotal: true,
            taxes: true,
            itemsDiscountTotal: true,
            discountAmount: true,
            includeTax: true,
            branch: { select: { name: true } },
          },
        },
        product: { select: { name: true, sku: true } },
        productVariant: { select: { name: true, sku: true } },
      },
      orderBy: [{ order: { createdAt: "desc" } }, { id: "desc" }],
    });
    const data = items.map(item => {
      const o = item.order!;

      const qty = Number(item.quantity ?? 0);
      const unit = Number(item.unitPrice ?? 0);
      const discount = Number(item.discountAmount ?? 0);

      const itemSubtotal = unit * qty;
      const itemDiscount = discount;
      const itemNetAmount = itemSubtotal - itemDiscount;

      const orderSubtotal = Number(o.subtotal ?? 0);
      const orderDiscountAmount = Number(o.discountAmount ?? 0);
      const orderTaxes = Number(o.taxes ?? 0);
      const itemsDiscountTotal = Number(o.itemsDiscountTotal ?? 0);

      const orderLevelDiscount = orderDiscountAmount - itemsDiscountTotal;
      const orderBaseForProportion = orderSubtotal - itemsDiscountTotal;

      const itemProportion =
        orderBaseForProportion > 0 ? itemNetAmount / orderBaseForProportion : 0;

      const itemOrderDiscountDistributed = orderLevelDiscount * itemProportion;

      let itemTaxAmount = 0;
      if (o.includeTax && orderBaseForProportion > 0) {
        itemTaxAmount = orderTaxes * itemProportion;
      }

      const recomputedTotalRaw =
        itemNetAmount - itemOrderDiscountDistributed + itemTaxAmount;

      const recomputed = Number(recomputedTotalRaw.toFixed(2));

      // Prefer persisted lineTotal if present, else use recomputed
      const lineTotal =
        typeof item.lineTotal === "number" && !isNaN(item.lineTotal)
          ? Number(Number(item.lineTotal).toFixed(2))
          : recomputed;

      return {
        date: o.createdAt
          ? o.createdAt.toISOString().slice(0, 19).replace("T", " ")
          : "",
        orderNumber: o.orderNumber ?? "",
        branch: o.branch?.name ?? "",
        productName: item.product?.name ?? "",
        variantName: item.productVariant?.name ?? "",
        variantSku: item.productVariant?.sku ?? item.product?.sku ?? "",
        quantity: qty,
        orderTotal: lineTotal,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { data, pagination: { page, limit, total, totalPages } };
  }

  async listVariantsPaginated(productId: string, page = 1, limit = 10) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);

    const total = await this.prisma.productVariant.count({
      where: { productId, isDeleted: false },
    });
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const safePage = Math.min(pageNum, totalPages);
    const skip = (safePage - 1) * limitNum;

    const variants = await this.prisma.productVariant.findMany({
      where: { productId, isDeleted: false },
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        prices: true,
        product: {
          include: {
            brand: true,
            category: true,
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
    });

    return {
      data: variants,
      pagination: { page: safePage, limit: limitNum, total, totalPages },
    };
  }

  // Get ALL variants with Global Stock (Paginated & Searchable)
  // Uses the same search logic as searchForPOS but without locationId filter
  async getAllVariantsWithStock(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<any> {
    const skip = (page - 1) * limit;

    // Build where clause using the same structure as searchForPOS
    let whereClause: Prisma.ProductVariantWhereInput;

    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      // Use exact same structure as searchForPOS, but also filter out deleted/inactive products
      whereClause = {
        isDeleted: false,
        isActive: true,
        product: {
          isDeleted: false,
          isActive: true,
        },
        OR: [
          { barcode: { contains: searchTerm, mode: "insensitive" } },
          { sku: { contains: searchTerm, mode: "insensitive" } },
          { name: { contains: searchTerm, mode: "insensitive" } },
          {
            product: {
              name: { contains: searchTerm, mode: "insensitive" },
              isDeleted: false,
              isActive: true,
            },
          },
        ],
      };
    } else {
      // No search, just use base conditions
      whereClause = {
        isDeleted: false,
        isActive: true,
        product: { isDeleted: false, isActive: true },
      };
    }

    this.logger.log(
      `[GET_ALL_VARIANTS] Page: ${page}, Limit: ${limit}, Search: "${search || "none"}"`
    );

    // Debug: Check if variant exists at all (without product filters) when search returns 0
    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      const variantExistsCheck = await this.prisma.productVariant.count({
        where: {
          OR: [
            { barcode: { contains: searchTerm, mode: "insensitive" } },
            { sku: { contains: searchTerm, mode: "insensitive" } },
            { name: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
      });

      if (variantExistsCheck > 0) {
        // Check if variants are inactive or deleted
        const inactiveOrDeleted = await this.prisma.productVariant.count({
          where: {
            AND: [
              {
                OR: [
                  { barcode: { contains: searchTerm, mode: "insensitive" } },
                  { sku: { contains: searchTerm, mode: "insensitive" } },
                  { name: { contains: searchTerm, mode: "insensitive" } },
                ],
              },
              {
                OR: [{ isDeleted: true }, { isActive: false }],
              },
            ],
          },
        });

        // Check if variants have inactive/deleted products
        const withInactiveProducts = await this.prisma.productVariant.count({
          where: {
            AND: [
              {
                OR: [
                  { barcode: { contains: searchTerm, mode: "insensitive" } },
                  { sku: { contains: searchTerm, mode: "insensitive" } },
                  { name: { contains: searchTerm, mode: "insensitive" } },
                ],
              },
              { isDeleted: false },
              { isActive: true },
              {
                product: {
                  OR: [{ isDeleted: true }, { isActive: false }],
                },
              },
            ],
          },
        });

        this.logger.debug(
          `[GET_ALL_VARIANTS] Debug for search "${searchTerm}": ` +
            `Total variants matching: ${variantExistsCheck}, ` +
            `Inactive/Deleted variants: ${inactiveOrDeleted}, ` +
            `With inactive/deleted products: ${withInactiveProducts}`
        );
      } else {
        this.logger.debug(
          `[GET_ALL_VARIANTS] No variants found matching "${searchTerm}" in barcode, sku, or name`
        );
      }
    }

    const total = await this.prisma.productVariant.count({
      where: whereClause,
    });

    this.logger.log(`[GET_ALL_VARIANTS] Total variants found: ${total}`);

    const variants = await this.prisma.productVariant.findMany({
      where: whereClause,
      include: {
        product: {
          include: {
            brand: true,
            category: true,
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

    const data = variants.map(variant => {
      // 1. Calculate global stock from stock levels
      let globalStock = variant.stockLevels.reduce(
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

      // 2. If KIT, recalculate global stock based on components
      if (
        variant.product.type === "KIT" &&
        variant.product.kitItems?.length > 0
      ) {
        const kitStocks = variant.product.kitItems.map(item => {
          const requiredQty = Number(item.quantity || 1);
          // Sum stock from all locations for this component
          const componentTotalAvailable =
            item.productVariant.stockLevels.reduce((sum, sl) => {
              return (
                sum + (Number(sl.quantity ?? 0) - Number(sl.reserved ?? 0))
              );
            }, 0);
          return Math.floor(componentTotalAvailable / requiredQty);
        });

        const virtualAvailable = Math.min(...kitStocks);

        // override globalStock with virtual stock for kits
        globalStock = {
          quantity: virtualAvailable,
          reserved: 0, // kits reserve stock of components
        };
      }

      return {
        id: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        barcode: variant.barcode,
        name: variant.name,
        type: variant.type,
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
        multiple: variant.multiple,
        appliesToDiscounts: variant.appliesToDiscounts,
        attributes: variant.attributes,
        isActive: variant.isActive,
        isDeleted: variant.isDeleted,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
        deletedAt: variant.deletedAt,
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

    this.logger.log(`[GET_ALL_VARIANTS] Returning ${data.length} variants`);

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
}
