import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ProductsDto } from "./dto/products.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { Prisma, ProductType } from "@prisma/client";
import { PaginatedProductDto } from "./dto/paginated-product.dto";
import { DeleteProductResponseDto } from "./dto/delete-product.dto";
import { ProductVariantDto } from "../product-variants/dto/product-variants.dto";
import { VariantAliasService } from "./product-search/variant-alias.service";
import { VariantEmbeddingService } from "./product-search/variant-embedding.service";
import { ProductSearchService } from "./product-search/product-search.service";

type ProductVariantWithPrices = Prisma.ProductVariantGetPayload<{
  include: { prices: true };
}>;

type ProductFullResponse = Prisma.ProductGetPayload<{
  include: {
    brand: true;
    category: true;
    taxRate: true;
    variants: {
      include: { prices: true };
    };
    kitItems: {
      include: {
        productVariant: { include: { prices: true } };
      };
    };
    images: true;
  };
}>;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private readonly productSearch: ProductSearchService,
    private readonly variantEmbedding: VariantEmbeddingService,
    private readonly variantAlias: VariantAliasService
  ) {}
  private readonly logger = new Logger(ProductsService.name);

  /** Refresh the search index of all active variants of a product (e.g. after name/brand change). */
  private scheduleProductVariantsIndexRefresh(productId: string): void {
    void this.refreshProductVariantsIndexAsync(productId).catch(err => {
      this.logger.warn(
        `Search index refresh failed for product ${productId} variants: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });
  }

  private async refreshProductVariantsIndexAsync(
    productId: string
  ): Promise<void> {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId, isDeleted: false },
      select: { id: true },
    });
    for (const variant of variants) {
      await this.variantAlias.generateAliasesForVariant(variant.id);
    }
  }

  private mapVariants(
    variants: (ProductVariantWithPrices & { images?: unknown[] })[],
    productImages?: {
      id: string;
      url: string;
      sortOrder: number;
      isPrimary: boolean;
      createdAt: Date;
    }[]
  ): ProductVariantDto[] {
    return variants.map(variant => {
      const variantImages = (variant as { images?: unknown[] }).images ?? [];
      const effectiveList =
        variantImages.length > 0 ? variantImages : (productImages ?? []);
      const sorted = effectiveList
        .slice()
        .sort(
          (a: any, b: any) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      const primary = sorted.find((img: any) => img.isPrimary) as
        | { url?: string }
        | undefined;
      const first = sorted[0] as { url?: string } | undefined;
      const primaryImageUrl = primary?.url ?? first?.url ?? undefined;
      return {
        id: variant.id,
        productId: variant.productId,
        type: variant.type,
        sku: variant.sku ?? undefined,
        barcode: variant.barcode ?? undefined,
        name: variant.name ?? undefined,
        costPrice: this.toNum(variant.costPrice) ?? 0,
        minimumStock: variant.minimumStock ?? undefined,
        maximumStock: variant.maximumStock ?? undefined,
        multiple: variant.multiple ?? undefined,
        appliesToDiscounts: variant.appliesToDiscounts ?? true,
        attributes:
          typeof variant.attributes === "object" && variant.attributes !== null
            ? (variant.attributes as Record<string, any>)
            : {},
        metadata:
          typeof variant.metadata === "object" && variant.metadata !== null
            ? (variant.metadata as Record<string, any>)
            : null,
        isActive: variant.isActive,
        isDeleted: variant.isDeleted,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
        deletedAt: variant.deletedAt,
        prices: variant.prices.map(price => ({
          priceTypeId: price.priceTypeId,
          price: this.toNum(price.price) ?? 0,
          minQuantity: price.minQuantity,
        })),
        images:
          variantImages.length > 0
            ? variantImages.map((img: any) => ({
                id: img.id,
                url: img.url,
                sortOrder: img.sortOrder,
                isPrimary: img.isPrimary,
                createdAt: img.createdAt,
              }))
            : undefined,
        primaryImageUrl: primaryImageUrl ?? null,
      };
    });
  }

  private toNum(val: any): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === "number") return val;
    if (typeof val === "object" && "toNumber" in val) return val.toNumber();
    return Number(val);
  }

  async create(createProductDto: CreateProductDto): Promise<ProductsDto> {
    const {
      name,
      sku,
      barcode,
      brandId,
      categoryId,
      taxId,
      type,
      defaultVariant,
    } = createProductDto;

    if (!barcode || typeof barcode !== "string" || barcode.trim() === "") {
      throw new BadRequestException("Barcode is required and cannot be empty");
    }
    createProductDto.barcode = barcode.trim();

    if (!createProductDto.sku) {
      // SKU for KIT products
      if (type === ProductType.KIT) {
        const prefix = "KIT";
        let abbr = "";

        // if brand is provided, use it for abbreviation
        if (brandId) {
          const brand = await this.prisma.brand.findUnique({
            where: { id: brandId },
          });
          if (brand) {
            const brandWords = brand.name.trim().split(/\s+/);
            if (brandWords.length === 1) {
              abbr = brandWords[0].slice(0, 2).toUpperCase();
            } else {
              abbr = brandWords.map(w => w[0].toUpperCase()).join("");
            }
          }
        }

        // if no brandId or brand not found, use product name for abbreviation
        if (!abbr) {
          const nameWords = name.trim().split(/\s+/);
          if (nameWords.length === 1) {
            abbr = nameWords[0].slice(0, 2).toUpperCase();
          } else {
            abbr = nameWords.map(w => w[0].toUpperCase()).join("");
          }
        }

        const kitSkuPrefix = `${prefix}-${abbr}-`;
        const skuCount = await this.prisma.product.count({
          where: { sku: { startsWith: kitSkuPrefix } },
        });
        createProductDto.sku = `${kitSkuPrefix}${String(skuCount + 1).padStart(3, "0")}`;
      } else {
        // SKU for standard products (non-KIT)
        if (!brandId) {
          throw new BadRequestException(
            "Brand ID is required to auto-generate SKU"
          );
        }
        const brand = await this.prisma.brand.findUnique({
          where: { id: brandId },
        });
        if (!brand) throw new NotFoundException("Brand not found");

        const brandWords = brand.name.trim().split(/\s+/);
        let brandAbbr = "";
        if (brandWords.length === 1) {
          brandAbbr = brandWords[0].slice(0, 2).toUpperCase();
        } else {
          brandAbbr = brandWords.map(w => w[0].toUpperCase()).join("");
        }
        const skuCount = await this.prisma.product.count({
          where: { sku: { startsWith: `${brandAbbr}-` } },
        });
        createProductDto.sku = `${brandAbbr}-${String(skuCount + 1).padStart(3, "0")}`;
      }
    }
    // Track if SKU was auto-generated for retry logic
    const isSkuAutoGenerated = !sku;
    // sku is the original value before auto-generation

    // Check if manually provided SKU already exists (skip for auto-generated, handled in retry loop)
    // Note: Must check ALL products (including deleted) because unique constraint applies to all
    if (createProductDto.sku && !isSkuAutoGenerated) {
      const existingSkuProduct = await this.prisma.product.findFirst({
        where: { sku: createProductDto.sku },
      });
      if (existingSkuProduct && !existingSkuProduct.isDeleted) {
        throw new ConflictException({
          message: `A product with SKU "${createProductDto.sku}" already exists`,
          code: "PRODUCT_SKU_CONFLICT",
          field: "sku",
        });
      }
    }

    const existingBarCodeProduct = await this.prisma.product.findFirst({
      where: { barcode: createProductDto.barcode },
    });
    if (existingBarCodeProduct && !existingBarCodeProduct.isDeleted) {
      throw new ConflictException({
        message: `A product with barcode "${createProductDto.barcode}" already exists`,
        code: "PRODUCT_BARCODE_CONFLICT",
        field: "barcode",
      });
    } else if (existingBarCodeProduct?.isDeleted) {
      // hard-delete the product, user will not be able to recover it
      await this.prisma.product.delete({
        where: { id: existingBarCodeProduct.id },
      });
    }

    // Validate category existence and active status (only if provided)
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: categoryId, isDeleted: false, isActive: true },
      });
      if (!category)
        throw new NotFoundException("Category not found or inactive");
    }
    if (taxId) {
      const taxRate = await this.prisma.taxRate.findFirst({
        where: { id: taxId, isDeleted: false, active: true },
      });
      if (!taxRate)
        throw new NotFoundException("Tax rate not found or inactive");
    }

    let createAttempts = 0;
    const maxCreateAttempts = 10;
    while (createAttempts < maxCreateAttempts) {
      try {
        const created = await this.prisma.$transaction(async tx => {
          const product = await tx.product.create({
            data: {
              name,
              sku: createProductDto.sku,
              barcode: createProductDto.barcode,
              description: createProductDto.description,
              brandId,
              categoryId,
              taxRateId: taxId,
              defaultVariantOnly: createProductDto.defaultVariantOnly ?? false,
              type: type || ProductType.STANDARD,
              expirationDate: createProductDto.expirationDate,
            },
          });
          // Create default variant if defaultVariantOnly is true and defaultVariant data is provided
          if (createProductDto.defaultVariantOnly && defaultVariant) {
            try {
              const variant = await tx.productVariant.create({
                data: {
                  productId: product.id,
                  type: product.type,
                  name: createProductDto.name,
                  sku: product.sku,
                  barcode: product.barcode,
                  costPrice: defaultVariant.costPrice ?? 0,
                  minimumStock: defaultVariant.minimumStock ?? null,
                  maximumStock: defaultVariant.maximumStock ?? null,
                  multiple: defaultVariant.multiple ?? null,
                  appliesToDiscounts: defaultVariant.appliesToDiscounts ?? true,
                  attributes: defaultVariant.attributes ?? {},
                },
              });

              if (defaultVariant.prices?.length) {
                await tx.productVariantPrice.createMany({
                  data: defaultVariant.prices.map(p => ({
                    productVariantId: variant.id,
                    priceTypeId: p.priceTypeId,
                    price: p.price,
                    minQuantity: p.minQuantity ?? 1,
                  })),
                });
              }

              if (
                product.type === ProductType.KIT &&
                createProductDto.kitItems?.length
              ) {
                await tx.productKitItem.createMany({
                  data: createProductDto.kitItems.map(item => ({
                    productKitId: product.id,
                    productVariantId: item.productVariantId,
                    quantity: item.quantity,
                  })),
                });
                const kitDetails = await tx.productKitItem.findMany({
                  where: { productKitId: product.id },
                  include: {
                    productVariant: {
                      select: { name: true, sku: true },
                    },
                  },
                });

                // kit metadata composition
                const kitMetadata = {
                  composition: kitDetails.map(it => ({
                    variantId: it.productVariantId,
                    name: it.productVariant.name,
                    quantity: Number(it.quantity),
                  })),
                };

                // update variant metadata
                await tx.productVariant.update({
                  where: { id: variant.id },
                  data: { metadata: kitMetadata },
                });
              }
            } catch (error) {
              this.logger.error(
                `Error creating default variant for product ${product.id}. Rolling back transaction.`,
                error
              );
              // Re-throw the error to ensure the transaction is rolled back
              throw new InternalServerErrorException(
                `Failed to create default variant: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              );
            }
          }

          const fullProduct = await tx.product.findUnique({
            where: { id: product.id },
            include: {
              brand: true,
              category: true,
              taxRate: true,
              variants: {
                where: { isDeleted: false },
                include: { prices: true },
              },
              kitItems: {
                include: {
                  productVariant: { include: { prices: true } },
                },
              },
            },
          });

          if (!fullProduct) throw new NotFoundException("Product not found");

          return {
            id: fullProduct.id,
            name: fullProduct.name,
            sku: fullProduct.sku ?? undefined,
            barcode: fullProduct.barcode ?? undefined,
            description: fullProduct.description,
            brandId: fullProduct.brandId ?? undefined,
            brand: fullProduct.brand,
            categoryId: fullProduct.categoryId,
            category: fullProduct.category,
            variants: this.mapVariants(fullProduct.variants),
            isActive: fullProduct.isActive,
            isDeleted: fullProduct.isDeleted,
            defaultVariantOnly: fullProduct.defaultVariantOnly,
            createdAt: fullProduct.createdAt,
            updatedAt: fullProduct.updatedAt,
            deletedAt: fullProduct.deletedAt,
            metadata:
              typeof fullProduct.metadata === "object"
                ? (fullProduct.metadata as any)
                : {},
            type: fullProduct.type,
            expirationDate: fullProduct.expirationDate,
            kitItems: fullProduct.kitItems.map(item => ({
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              productVariant: item.productVariant
                ? this.mapVariants([item.productVariant])[0]
                : undefined,
            })),
            taxRateId: fullProduct.taxRate?.id,
          };
        });
        this.scheduleProductVariantsIndexRefresh(created.id);
        return created;
      } catch (error: any) {
        // Prisma unique constraint error
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          isSkuAutoGenerated &&
          createAttempts < maxCreateAttempts - 1
        ) {
          createAttempts++;
          const brand = await this.prisma.brand.findUnique({
            where: { id: brandId },
          });
          if (brand) {
            const brandWords = brand.name.trim().split(/\s+/);
            let brandAbbr = "";
            if (brandWords.length === 1) {
              brandAbbr = brandWords[0].slice(0, 2).toUpperCase();
            } else {
              brandAbbr = brandWords.map(w => w[0].toUpperCase()).join("");
            }
            const skuCount = await this.prisma.product.count({
              where: { sku: { startsWith: `${brandAbbr}-` } },
            });
            createProductDto.sku = `${brandAbbr}-${String(skuCount + 1).padStart(3, "0")}`;
            await new Promise(resolve => setTimeout(resolve, 50));
            continue;
          }
        }
        throw error;
      }
    }
    throw new InternalServerErrorException(
      "Failed to create product after multiple SKU generation attempts"
    );
  }

  private mapProductImages(
    images: Array<{
      id: string;
      productId: string;
      url: string;
      sortOrder: number;
      isPrimary: boolean;
      createdAt: Date;
    }>
  ) {
    const list = (images || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const primary = list.find(img => img.isPrimary);
    return {
      images: list.map(img => ({
        id: img.id,
        productId: img.productId,
        url: img.url,
        sortOrder: img.sortOrder,
        isPrimary: img.isPrimary,
        createdAt: img.createdAt,
      })),
      primaryImageUrl: primary?.url ?? list[0]?.url ?? undefined,
    };
  }

  async findOne(id: string): Promise<ProductsDto> {
    const product = (await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        taxRate: true,
        variants: {
          where: { isDeleted: false },
          include: {
            prices: true,
            images: {
              where: { isDeleted: false },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          } as Record<string, unknown>,
        },
        kitItems: {
          include: {
            productVariant: { include: { prices: true } },
          },
        },
        images: {
          where: { isDeleted: false },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    })) as unknown as ProductFullResponse | null;

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const { images: productImages, primaryImageUrl } = this.mapProductImages(
      (product as any).images ?? []
    );
    return {
      id: product.id,
      name: product.name,
      sku: product.sku ?? undefined,
      barcode: product.barcode ?? undefined,
      description: product.description,
      brandId: product.brandId ?? undefined,
      brand: product.brand,
      categoryId: product.categoryId,
      category: product.category,
      variants: this.mapVariants(
        product.variants,
        (product as any).images ?? []
      ),
      isActive: product.isActive,
      isDeleted: product.isDeleted,
      defaultVariantOnly: product.defaultVariantOnly,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
      metadata:
        typeof product.metadata === "object" && product.metadata !== null
          ? (product.metadata as Record<string, any>)
          : {},
      type: product.type,
      expirationDate: product.expirationDate,
      kitItems: product.kitItems.map(item => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        productVariant: item.productVariant
          ? this.mapVariants([item.productVariant])[0]
          : undefined,
      })),
      taxRateId: product.taxRate?.id,
      images: productImages,
      primaryImageUrl,
    };
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto
  ): Promise<ProductsDto> {
    const existingProduct = await this.validateProductExists(id);
    await this.validateCategory(
      updateProductDto.categoryId,
      existingProduct.categoryId
    );
    await this.validateTaxRate(
      updateProductDto.taxId,
      existingProduct.taxRateId
    );

    // Check SKU uniqueness if SKU is being provided
    // Normalize SKU values for comparison (handle null/undefined/empty string)
    let normalizedSku: string | null = null;
    let isSkuChanging = false;
    if (updateProductDto.sku !== undefined) {
      normalizedSku = updateProductDto.sku?.trim() || null;
      const normalizedExistingSku = existingProduct.sku?.trim() || null;
      isSkuChanging = normalizedSku !== normalizedExistingSku;

      // Only check uniqueness if the SKU is actually changing
      if (isSkuChanging) {
        try {
          await this.checkSkuUniqueness(normalizedSku, id);
        } catch (e) {
          if (e instanceof ConflictException) throw e;
          throw new BadRequestException("Validation failed: " + e.message);
        }
      }
    }

    // Normalize barcode if provided
    let normalizedBarcode: string | null = null;
    let isBarcodeChanging = false;
    if (updateProductDto.barcode !== undefined) {
      normalizedBarcode = updateProductDto.barcode?.trim() || null;
      const normalizedExistingBarcode = existingProduct.barcode?.trim() || null;
      isBarcodeChanging = normalizedBarcode !== normalizedExistingBarcode;
    }

    // Remove soft-deleted products with duplicate SKU or barcode before updating
    // This prevents database unique constraint violations
    // Only check if the values are actually changing
    if (isSkuChanging || isBarcodeChanging) {
      await this.removeSoftDeletedDuplicates(
        id,
        isSkuChanging && normalizedSku ? normalizedSku : undefined,
        isBarcodeChanging && normalizedBarcode ? normalizedBarcode : undefined
      );
    }

    try {
      await this.prisma.$transaction(async tx => {
        const updatedProduct = await tx.product.update({
          where: { id },
          data: {
            name: updateProductDto.name ?? existingProduct.name,
            description:
              updateProductDto.description ?? existingProduct.description,
            brandId:
              updateProductDto.brandId === undefined
                ? existingProduct.brandId
                : updateProductDto.brandId === "" ||
                    updateProductDto.brandId === null
                  ? null
                  : updateProductDto.brandId,
            categoryId:
              updateProductDto.categoryId === undefined
                ? existingProduct.categoryId
                : updateProductDto.categoryId === "" ||
                    updateProductDto.categoryId === null
                  ? null
                  : updateProductDto.categoryId,
            taxRateId:
              updateProductDto.taxId === undefined
                ? existingProduct.taxRateId
                : updateProductDto.taxId === "" ||
                    updateProductDto.taxId === null
                  ? null
                  : updateProductDto.taxId,
            ...(updateProductDto.sku !== undefined && {
              sku: normalizedSku,
            }),
            ...(updateProductDto.barcode !== undefined && {
              barcode: normalizedBarcode,
            }),
            ...(updateProductDto.defaultVariantOnly !== undefined && {
              defaultVariantOnly: updateProductDto.defaultVariantOnly,
            }),
            ...(updateProductDto.type && { type: updateProductDto.type }),
            ...(updateProductDto.expirationDate && {
              expirationDate: updateProductDto.expirationDate,
            }),
            metadata: updateProductDto.metadata ?? existingProduct.metadata,
          },
        });

        if (
          updateProductDto.type &&
          updateProductDto.type !== existingProduct.type
        ) {
          await tx.productVariant.updateMany({
            where: { productId: id, isDeleted: false },
            data: { type: updateProductDto.type },
          });
        }

        const isDefaultVariantOnly =
          updateProductDto.defaultVariantOnly !== undefined
            ? updateProductDto.defaultVariantOnly
            : (existingProduct.defaultVariantOnly ?? false);

        if (isDefaultVariantOnly && updateProductDto.defaultVariant) {
          const existingVariants = await tx.productVariant.findMany({
            where: { productId: id, isDeleted: false },
          });
          const defaultVariant = existingVariants.find(v => !v.isDeleted);

          let costPrice = updateProductDto.defaultVariant.costPrice;
          if (
            updateProductDto.type === ProductType.KIT &&
            (costPrice === undefined ||
              costPrice === null ||
              isNaN(Number(costPrice)))
          ) {
            costPrice = 0;
          }

          const normalizedVariantData = {
            name: updateProductDto.name ?? existingProduct.name,
            type: updatedProduct.type as ProductType,
            sku: updateProductDto.sku ?? existingProduct.sku ?? null,
            barcode:
              updateProductDto.barcode ?? existingProduct.barcode ?? null,
            costPrice: costPrice,
            prices: (updateProductDto.defaultVariant.prices || []).map(
              (p: any) => ({
                priceTypeId: p.priceTypeId,
                price: this.toNum(p.price) || 0,
                minQuantity: p.minQuantity ? Number(p.minQuantity) : 1,
              })
            ),
            minimumStock:
              updateProductDto.defaultVariant.minimumStock !== undefined &&
              updateProductDto.defaultVariant.minimumStock !== null
                ? Number(updateProductDto.defaultVariant.minimumStock)
                : null,
            maximumStock:
              updateProductDto.defaultVariant.maximumStock !== undefined &&
              updateProductDto.defaultVariant.maximumStock !== null
                ? Number(updateProductDto.defaultVariant.maximumStock)
                : null,
            multiple:
              updateProductDto.defaultVariant.multiple !== undefined &&
              updateProductDto.defaultVariant.multiple !== null
                ? Number(updateProductDto.defaultVariant.multiple)
                : null,
            appliesToDiscounts:
              updateProductDto.defaultVariant.appliesToDiscounts !==
                undefined &&
              updateProductDto.defaultVariant.appliesToDiscounts !== null
                ? Boolean(updateProductDto.defaultVariant.appliesToDiscounts)
                : true,
            attributes: (() => {
              const attrs: any = updateProductDto.defaultVariant.attributes;
              if (
                attrs === undefined ||
                attrs === null ||
                attrs === "$undefined" ||
                attrs === ""
              ) {
                return null;
              }
              if (typeof attrs === "string") {
                try {
                  return JSON.parse(attrs);
                } catch {
                  return null;
                }
              }
              if (typeof attrs === "object" && !Array.isArray(attrs)) {
                return attrs;
              }
              return null;
            })(),
          };

          if (defaultVariant) {
            await this.updateDefaultVariant(
              defaultVariant.id,
              normalizedVariantData,
              tx
            );
          } else {
            await this.createDefaultVariant(id, normalizedVariantData, tx);
          }
        }

        // If product type is changing FROM KIT to something else, clear kit items
        if (
          existingProduct.type === ProductType.KIT &&
          updateProductDto.type &&
          updateProductDto.type !== ProductType.KIT
        ) {
          await tx.productKitItem.deleteMany({ where: { productKitId: id } });
        }
        if (
          updateProductDto.type === ProductType.KIT &&
          Array.isArray(updateProductDto.kitItems)
        ) {
          await tx.productKitItem.deleteMany({ where: { productKitId: id } });

          if (updateProductDto.kitItems.length > 0) {
            await tx.productKitItem.createMany({
              data: updateProductDto.kitItems.map(item => ({
                productKitId: id,
                productVariantId: item.productVariantId,
                quantity: item.quantity,
              })),
            });

            const kitDetails = await tx.productKitItem.findMany({
              where: { productKitId: id },
              include: {
                productVariant: {
                  select: { name: true, sku: true },
                },
              },
            });

            const kitMetadata = {
              composition: kitDetails.map(it => ({
                variantId: it.productVariantId,
                name: it.productVariant.name,
                sku: it.productVariant.sku,
                quantity: Number(it.quantity),
              })),
            };

            await tx.productVariant.updateMany({
              where: { productId: id, isDeleted: false },
              data: { metadata: kitMetadata as any },
            });
          }
        }
      });

      const updated = await this.findOne(id);
      this.scheduleProductVariantsIndexRefresh(id);
      return updated;
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Handle Prisma specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.warn(
          `Prisma Known Request Error in product update: ${error.code}`,
          error.meta
        );
        if (error.code === "P2002") {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes("barcode")) {
            throw new ConflictException({
              message: `A product with barcode "${updateProductDto.barcode}" already exists`,
              code: "PRODUCT_BARCODE_CONFLICT",
              field: "barcode",
            });
          }
          if (target.includes("sku")) {
            throw new ConflictException({
              message: `A product with SKU "${updateProductDto.sku}" already exists`,
              code: "PRODUCT_SKU_CONFLICT",
              field: "sku",
            });
          }
          throw new ConflictException(
            "A product with these unique constraints already exists."
          );
        }
        if (error.code === "P2003") {
          // Foreign key constraint failed
          throw new BadRequestException(
            `Invalid reference ID for a related entity (e.g., brand, category, or tax rate). Field: ${error.meta?.field_name}`
          );
        }
      }

      const errMessage = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[UPDATE] Failed to update product ${id}: ${errMessage}`,
        errStack
      );
      throw new InternalServerErrorException(
        "Failed to update product due to an internal error."
      );
    }
  }

  // Private method to create default variant (runs inside caller's transaction to avoid deadlocks)
  private async createDefaultVariant(
    productId: string,
    variantData: {
      name: string;
      type: ProductType;
      sku?: string | null;
      barcode?: string | null;
      costPrice: number;
      prices: Array<{
        priceTypeId: string;
        price: number;
        minQuantity?: number;
      }>;
      minimumStock?: number | null;
      maximumStock?: number | null;
      multiple?: number | null;
      appliesToDiscounts?: boolean | null;
      attributes?: Record<string, any> | null;
      metadata?: Record<string, any> | null;
    },
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const newVariant = await tx.productVariant.create({
      data: {
        productId,
        type: variantData.type,
        sku: variantData.sku,
        barcode: variantData.barcode,
        name: variantData.name,
        costPrice: variantData.costPrice,
        minimumStock: variantData.minimumStock,
        maximumStock: variantData.maximumStock,
        multiple: variantData.multiple ?? null,
        appliesToDiscounts: variantData.appliesToDiscounts ?? true,
        attributes: (variantData.attributes as Prisma.JsonValue) || {},
        metadata: (variantData.metadata as Prisma.JsonValue) || {},
      },
    });

    if (variantData.prices && variantData.prices.length > 0) {
      const dataToCreate = variantData.prices
        .filter(p => p.priceTypeId && p.price != null && p.price > 0)
        .map(p => ({
          productVariantId: newVariant.id,
          priceTypeId: p.priceTypeId,
          price: Number(p.price),
          minQuantity: p.minQuantity ? Number(p.minQuantity) : 1,
        }));

      if (dataToCreate.length > 0) {
        await tx.productVariantPrice.createMany({
          data: dataToCreate,
          skipDuplicates: true,
        });
      }
    }
  }

  // Private method to update default variant (runs inside caller's transaction to avoid deadlocks)
  private async updateDefaultVariant(
    variantId: string,
    variantData: {
      name: string;
      type: ProductType;
      sku?: string | null;
      barcode?: string | null;
      costPrice: number;
      prices: Array<{
        priceTypeId: string;
        price: number;
        minQuantity?: number;
      }>;
      minimumStock?: number | null;
      maximumStock?: number | null;
      multiple?: number | null;
      appliesToDiscounts?: boolean | null;
      attributes?: Record<string, any> | null;
      metadata?: Record<string, any> | null;
    },
    tx: Prisma.TransactionClient
  ): Promise<void> {
    // Update variant
    await tx.productVariant.update({
      where: { id: variantId },
      data: {
        type: variantData.type,
        sku: variantData.sku,
        barcode: variantData.barcode,
        name: variantData.name,
        costPrice: variantData.costPrice,
        minimumStock: variantData.minimumStock,
        maximumStock: variantData.maximumStock,
        multiple: variantData.multiple ?? null,
        appliesToDiscounts: variantData.appliesToDiscounts ?? true,
        attributes:
          variantData.attributes !== null &&
          variantData.attributes !== undefined
            ? (variantData.attributes as Prisma.JsonValue)
            : Prisma.JsonNull,
        metadata:
          variantData.metadata !== null && variantData.metadata !== undefined
            ? (variantData.metadata as Prisma.JsonValue)
            : Prisma.JsonNull,
      },
    });

    // Delete existing prices
    await tx.productVariantPrice.deleteMany({
      where: { productVariantId: variantId },
    });

    // Create new prices
    if (variantData.prices && variantData.prices.length > 0) {
      const dataToCreate = variantData.prices
        .filter(p => p.priceTypeId && p.price != null && p.price > 0)
        .map(p => ({
          productVariantId: variantId,
          priceTypeId: p.priceTypeId,
          price: Number(p.price),
          minQuantity: p.minQuantity ? Number(p.minQuantity) : 1,
        }));

      if (dataToCreate.length > 0) {
        await tx.productVariantPrice.createMany({
          data: dataToCreate,
          skipDuplicates: true,
        });
      }
    }
  }

  // Validate product existence
  private async validateProductExists(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  // Check SKU uniqueness (similar to product-variants service)
  private async checkSkuUniqueness(
    sku: string | null,
    excludeProductId?: string
  ): Promise<void> {
    if (!sku) return;

    // Check products (excluding the current product if updating and excluding soft-deleted products)
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        sku: sku,
        isDeleted: false, // Exclude soft-deleted products
        ...(excludeProductId && { id: { not: excludeProductId } }),
      },
      select: { id: true },
    });

    if (existingProduct) {
      this.logger.warn(`[VALIDATION] SKU duplicate in product: ${sku}`);
      throw new ConflictException(`A product with SKU "${sku}" already exists`);
    }
  }

  // Remove soft-deleted products with duplicate SKU or barcode to prevent DB constraint violations
  private async removeSoftDeletedDuplicates(
    excludeProductId: string,
    sku?: string,
    barcode?: string
  ): Promise<void> {
    const conditions: Prisma.ProductWhereInput[] = [];

    // Find soft-deleted products with matching SKU
    if (sku) {
      conditions.push({
        sku: sku,
        isDeleted: true,
        id: { not: excludeProductId },
      });
    }

    // Find soft-deleted products with matching barcode
    if (barcode) {
      conditions.push({
        barcode: barcode,
        isDeleted: true,
        id: { not: excludeProductId },
      });
    }

    if (conditions.length === 0) return;

    // Find all soft-deleted products matching either condition
    const softDeletedProducts = await this.prisma.product.findMany({
      where: {
        OR: conditions,
      },
      select: { id: true, sku: true, barcode: true },
    });

    // Hard-delete all found soft-deleted products
    if (softDeletedProducts.length > 0) {
      const idsToDelete = softDeletedProducts.map(p => p.id);
      this.logger.warn(
        `[UPDATE] Hard-deleting ${idsToDelete.length} soft-deleted product(s) with duplicate SKU/barcode. ` +
          `SKU: ${sku || "N/A"}, Barcode: ${barcode || "N/A"}`
      );

      await this.prisma.product.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });

      // Also hard-delete associated variants
      await this.prisma.productVariant.deleteMany({
        where: {
          productId: { in: idsToDelete },
        },
      });
    }
  }

  // Validate category existence and active status
  private async validateCategory(
    newCategoryId?: string | null,
    currentCategoryId?: string | null
  ) {
    // Normalize empty strings to null
    const normalizedNewCategoryId = newCategoryId === "" ? null : newCategoryId;
    const normalizedCurrentCategoryId =
      currentCategoryId === "" ? null : currentCategoryId;

    if (
      normalizedNewCategoryId &&
      normalizedNewCategoryId !== normalizedCurrentCategoryId
    ) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: normalizedNewCategoryId,
          isDeleted: false,
          isActive: true,
        },
      });
      if (!category) {
        throw new NotFoundException("Category not found or inactive");
      }
    }
  }

  // Validate tax rate existence and active status
  private async validateTaxRate(
    newTaxId?: string | null,
    currentTaxId?: string | null
  ) {
    // Normalize empty strings to null
    const normalizedNewTaxId = newTaxId === "" ? null : newTaxId;
    const normalizedCurrentTaxId = currentTaxId === "" ? null : currentTaxId;

    if (normalizedNewTaxId && normalizedNewTaxId !== normalizedCurrentTaxId) {
      const taxRate = await this.prisma.taxRate.findFirst({
        where: { id: normalizedNewTaxId, isDeleted: false, active: true },
      });
      if (!taxRate) {
        throw new NotFoundException("Tax rate not found or inactive");
      }
    }
  }

  // Soft delete implementation
  async remove(id: string): Promise<DeleteProductResponseDto> {
    return await this.prisma.$transaction(async tx => {
      const product = await tx.product.findFirst({
        where: { id, isDeleted: false },
      });
      if (!product) {
        throw new NotFoundException("Product not found");
      }

      const deletedAt = new Date();

      // get variants to clean kit items references
      const variants = await tx.productVariant.findMany({
        where: { productId: id },
        select: { id: true },
      });

      const variantIds = variants.map(variant => variant.id);

      // Clean up kit items that reference the product variants being deleted
      // if it is the product kit (productKitId)
      // if its kit items (productVariantId)
      await tx.productKitItem.deleteMany({
        where: {
          OR: [{ productKitId: id }, { productVariantId: { in: variantIds } }],
        },
      });

      // Soft delete the product
      await tx.product.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt,
        },
      });

      // Soft delete all associated product variants
      await tx.productVariant.updateMany({
        where: {
          productId: id,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt,
        },
      });

      return {
        success: true,
        message: "Product deleted successfully",
        id,
      };
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    type?: ProductType,
    variantType?: ProductType,
    excludeTypes?: ProductType[],
    brandId?: string,
    categoryId?: string
  ): Promise<PaginatedProductDto> {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ProductWhereInput = {
      isDeleted: false,
      ...(type && { type }),
      ...(variantType && {
        variants: {
          some: { type: variantType, isDeleted: false },
        },
      }),
      ...(excludeTypes &&
        excludeTypes.length > 0 && {
          type: { notIn: excludeTypes },
        }),
      ...(brandId && { brandId }),
      ...(categoryId && { categoryId }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          brand: true,
          category: true,
          variants: {
            where: { isDeleted: false },
            orderBy: { name: "asc" },
            include: { prices: true },
          },
          kitItems: {
            include: {
              productVariant: { include: { prices: true } },
            },
          },
          images: {
            where: { isDeleted: false },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      }),
      this.prisma.product.count({ where: whereClause }),
    ]);

    const mappedProducts = products.map(product => {
      const { images: productImages, primaryImageUrl } = this.mapProductImages(
        (product as any).images ?? []
      );
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        description: product.description,
        brandId: product.brandId,
        brand: product.brand,
        categoryId: product.categoryId,
        category: product.category,
        variants: this.mapVariants(product.variants),
        isActive: product.isActive,
        isDeleted: product.isDeleted,
        defaultVariantOnly: (product as any).defaultVariantOnly,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        deletedAt: product.deletedAt,
        metadata:
          typeof product.metadata === "object" && product.metadata !== null
            ? (product.metadata as Record<string, any>)
            : {},
        type: product.type,
        expirationDate: product.expirationDate,
        kitItems: product.kitItems?.map(item => ({
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          productVariant: item.productVariant
            ? this.mapVariants([item.productVariant])[0]
            : undefined,
        })),
        images: productImages,
        primaryImageUrl,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: mappedProducts,
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

  async searchProducts(
    search?: string,
    page = 1,
    limit = 10,
    excludeTypes?: ProductType[],
    brandId?: string,
    categoryId?: string
  ): Promise<PaginatedProductDto> {
    const skip = (page - 1) * limit;

    if (!search || search.trim() === "") {
      throw new BadRequestException("You must provide a search term");
    }

    const baseFilters: Prisma.ProductWhereInput[] = [
      { isDeleted: false },
      ...(excludeTypes && excludeTypes.length > 0
        ? [{ type: { notIn: excludeTypes } }]
        : []),
      ...(brandId ? [{ brandId }] : []),
      ...(categoryId ? [{ categoryId }] : []),
    ];

    const productSearchInclude = {
      brand: true,
      category: true,
      variants: {
        where: { isDeleted: false },
        orderBy: { name: "asc" as const },
        include: { prices: true },
      },
      kitItems: {
        include: {
          productVariant: { include: { prices: true } },
        },
      },
      images: {
        where: { isDeleted: false },
        orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
      },
    };

    let products: ProductFullResponse[] = [];
    let total = 0;
    let matchedQuery = search.trim();

    const hybridHits = await this.variantEmbedding.hybridSearchVariantIds(
      search,
      Math.max(limit * 10, 100)
    );

    if (hybridHits.length > 0) {
      const variantIds = hybridHits.map(hit => hit.variantId);
      const matchedVariants = await this.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true },
      });

      const variantScoreById = new Map(
        hybridHits.map(hit => [hit.variantId, hit.score])
      );

      // Best variant score per product, preserving first-seen order (already score-sorted).
      const productScore = new Map<string, number>();
      for (const v of matchedVariants) {
        const score = variantScoreById.get(v.id) ?? 0;
        const current = productScore.get(v.productId) ?? 0;
        if (score > current) productScore.set(v.productId, score);
      }

      const ids = [...productScore.keys()];
      if (ids.length > 0) {
        // Two-pass: first count & paginate IDs by score, then fetch full data only for the page
        const validIds = await this.prisma.product.findMany({
          where: { AND: [...baseFilters, { id: { in: ids } }] },
          select: { id: true },
        });
        const validIdSet = new Set(validIds.map(r => r.id));
        const sortedIds = ids
          .filter(id => validIdSet.has(id))
          .sort(
            (a, b) => (productScore.get(b) ?? 0) - (productScore.get(a) ?? 0)
          );

        total = sortedIds.length;
        const pageIds = sortedIds.slice(skip, skip + limit);

        if (pageIds.length > 0) {
          const rows = (await this.prisma.product.findMany({
            where: { id: { in: pageIds } },
            include: productSearchInclude,
          })) as ProductFullResponse[];

          const idOrder = new Map(pageIds.map((id, i) => [id, i]));
          rows.sort(
            (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
          );
          products = rows;
        }

        matchedQuery = this.productSearch.buildRankedSearchTerm(search);
      }
    }

    if (total === 0) {
      const queries = this.productSearch.expandSearchQueries(search);
      for (const q of queries) {
        const productWhere: Prisma.ProductWhereInput = {
          AND: [
            ...baseFilters,
            {
              variants: { some: this.productSearch.buildVariantTokenWhere(q) },
            },
          ],
        };
        const [rows, count] = await Promise.all([
          this.prisma.product.findMany({
            where: productWhere,
            include: productSearchInclude,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
          }),
          this.prisma.product.count({ where: productWhere }),
        ]);

        if (count > 0) {
          products = rows as ProductFullResponse[];
          total = count;
          matchedQuery = q;
          break;
        }
      }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: products.map(product => {
        const { images: productImages, primaryImageUrl } =
          this.mapProductImages((product as any).images ?? []);
        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          description: product.description,
          brandId: product.brandId,
          brand: product.brand,
          categoryId: product.categoryId,
          category: product.category,
          variants: this.mapVariants(product.variants),
          isActive: product.isActive,
          isDeleted: product.isDeleted,
          defaultVariantOnly: (product as any).defaultVariantOnly,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          deletedAt: product.deletedAt,
          metadata:
            typeof product.metadata === "object" && product.metadata !== null
              ? (product.metadata as Record<string, any>)
              : {},
          type: product.type,
          expirationDate: product.expirationDate,
          kitItems: product.kitItems?.map(item => ({
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            productVariant: item.productVariant
              ? this.mapVariants([item.productVariant])[0]
              : undefined,
          })),
          images: productImages,
          primaryImageUrl,
          _searchMeta: { matchedQuery },
        };
      }),
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
   * All products matching catalog filters (for PDF export), sorted by brand → category → name.
   */
  async findProductsForCatalogPdf(filters: {
    search?: string;
    brandId?: string;
    categoryId?: string;
  }): Promise<ProductsDto[]> {
    const MAX = 5000;
    const search = filters.search?.trim();
    const andFilters: Prisma.ProductWhereInput[] = [{ isDeleted: false }];

    if (filters.brandId) {
      andFilters.push({ brandId: filters.brandId });
    }
    if (filters.categoryId) {
      andFilters.push({ categoryId: filters.categoryId });
    }
    if (search) {
      andFilters.push({
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { sku: { contains: search, mode: Prisma.QueryMode.insensitive } },
          {
            brand: {
              name: { contains: search, mode: Prisma.QueryMode.insensitive },
            },
          },
          {
            barcode: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
          {
            category: {
              name: { contains: search, mode: Prisma.QueryMode.insensitive },
            },
          },
        ],
      });
    }

    const whereClause: Prisma.ProductWhereInput = { AND: andFilters };

    const products = await this.prisma.product.findMany({
      where: whereClause,
      take: MAX,
      orderBy: [
        { brand: { name: "asc" } },
        { category: { name: "asc" } },
        { name: "asc" },
      ],
      include: {
        brand: true,
        category: true,
        variants: {
          where: { isDeleted: false },
          orderBy: { name: "asc" },
          include: {
            prices: true,
            images: {
              where: { isDeleted: false },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
        kitItems: {
          include: {
            productVariant: {
              include: {
                prices: true,
                images: {
                  where: { isDeleted: false },
                  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                },
              },
            },
          },
        },
        images: {
          where: { isDeleted: false },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    const mapped: ProductsDto[] = products.map(product => {
      const { images: productImages, primaryImageUrl } = this.mapProductImages(
        (product as any).images ?? []
      );
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        description: product.description,
        brandId: product.brandId,
        brand: product.brand,
        categoryId: product.categoryId,
        category: product.category,
        variants: this.mapVariants(
          product.variants,
          (product as any).images ?? []
        ),
        isActive: product.isActive,
        isDeleted: product.isDeleted,
        defaultVariantOnly: (product as any).defaultVariantOnly,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        deletedAt: product.deletedAt,
        metadata:
          typeof product.metadata === "object" && product.metadata !== null
            ? (product.metadata as Record<string, any>)
            : {},
        type: product.type,
        expirationDate: product.expirationDate,
        kitItems: product.kitItems?.map(item => ({
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          productVariant: item.productVariant
            ? this.mapVariants([item.productVariant])[0]
            : undefined,
        })),
        images: productImages,
        primaryImageUrl,
      };
    });

    return mapped;
  }
}
