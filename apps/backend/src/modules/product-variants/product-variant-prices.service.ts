import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { VariantPriceDto } from "./dto/variant-prices-dto/variant-prices.dto";

@Injectable()
export class ProductVariantPricesService {
  private readonly logger = new Logger(ProductVariantPricesService.name);

  constructor(private readonly prisma: PrismaService) {}

  public validatePrices(price?: VariantPriceDto[]): void {
    if (!price || price.length === 0) {
      this.logger.debug(
        "[VALIDATION] Prices array is empty or undefined. Skipping validation."
      );
      return;
    }

    price.forEach((price, index) => {
      if (price.price < 0) {
        this.logger.warn(
          `[VALIDATION] Price check failed at index ${index}. Price: ${price.price}.`
        );
        throw new BadRequestException(
          `Price at index ${index} cannot be negative`
        );
      }

      if (!price.priceTypeId) {
        this.logger.warn(
          `[VALIDATION] Price check failed at index ${index}. Missing priceTypeId.`
        );
        throw new BadRequestException(
          `Price at index ${index} must have a priceTypeId`
        );
      }

      if (price.minQuantity != null && price.minQuantity < 1) {
        this.logger.warn(
          `[VALIDATION] Quantity check failed at index ${index}. Invalid minQuantity: ${price.minQuantity}.`
        );
        throw new BadRequestException(
          `minQuantity at index ${index} must be at least 1`
        );
      }
    });
    this.logger.debug(
      `[VALIDATION] Successfully validated ${price.length} prices.`
    );
  }

  private mapPriceDtosToCreateData(
    variantId: string,
    prices: VariantPriceDto[]
  ): Prisma.ProductVariantPriceCreateManyInput[] {
    return prices.map(priceDto => ({
      priceTypeId: priceDto.priceTypeId,
      price: priceDto.price,
      minQuantity: priceDto.minQuantity ?? 1,
      productVariantId: variantId,
    }));
  }

  //used in  product variants service
  public updatePricesInTransaction(
    variantId: string,
    inputPrices: VariantPriceDto[]
  ): Prisma.PrismaPromise<any>[] {
    const transactionActions: Prisma.PrismaPromise<any>[] = [];
    const incomingPriceTypeIds = inputPrices.map(p => p.priceTypeId);

    this.logger.debug(
      `[TX:UPSERT] Preparing granular upsert actions for ${inputPrices.length} prices for variant ${variantId}.`
    );

    inputPrices.forEach(priceDto => {
      transactionActions.push(
        this.prisma.productVariantPrice.upsert({
          where: {
            productVariantId_priceTypeId: {
              productVariantId: variantId,
              priceTypeId: priceDto.priceTypeId,
            },
          },
          update: {
            price: priceDto.price,
            minQuantity: priceDto.minQuantity ?? 1,
          },
          create: {
            productVariantId: variantId,
            priceTypeId: priceDto.priceTypeId,
            price: priceDto.price,
            minQuantity: priceDto.minQuantity ?? 1,
          },
        })
      );
    });

    transactionActions.push(
      this.prisma.productVariantPrice.deleteMany({
        where: {
          productVariantId: variantId,
          priceTypeId: {
            notIn: incomingPriceTypeIds,
          },
        },
      })
    );

    return transactionActions;
  }

  /**
   * Upsert only the given price types for a variant (does not delete other price types).
   * Use for purchase import / partial updates.
   */
  async upsertPartialPricesInTransaction(
    tx: Prisma.TransactionClient,
    variantId: string,
    prices: Array<{ priceTypeId: string; price: number }>
  ): Promise<void> {
    if (prices.length === 0) {
      return;
    }

    const priceTypeIds = [...new Set(prices.map(p => p.priceTypeId))];
    const priceTypes = await tx.priceType.findMany({
      where: { id: { in: priceTypeIds } },
      select: { id: true, minQuantity: true },
    });
    const defaultMinByPriceType = new Map(
      priceTypes.map(pt => [pt.id, pt.minQuantity])
    );

    await Promise.all(
      prices.map(p =>
        tx.productVariantPrice.upsert({
          where: {
            productVariantId_priceTypeId: {
              productVariantId: variantId,
              priceTypeId: p.priceTypeId,
            },
          },
          update: {
            price: p.price,
          },
          create: {
            productVariantId: variantId,
            priceTypeId: p.priceTypeId,
            price: p.price,
            minQuantity: defaultMinByPriceType.get(p.priceTypeId) ?? 1,
          },
        })
      )
    );
  }
}
