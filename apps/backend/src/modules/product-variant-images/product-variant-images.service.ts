import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateProductVariantImageDto } from "./dto/create-product-variant-image.dto";
import { ReorderProductVariantImagesDto } from "./dto/reorder-product-variant-images.dto";
import { ProductVariantImageDto } from "./dto/product-variant-image.dto";

@Injectable()
export class ProductVariantImagesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(row: {
    id: string;
    productVariantId: string;
    url: string;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: Date;
  }): ProductVariantImageDto {
    return {
      id: row.id,
      productVariantId: row.productVariantId,
      url: row.url,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt,
    };
  }

  async ensureVariantExists(variantId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, isDeleted: false },
    });
    if (!variant) throw new NotFoundException("Product variant not found");
  }

  async create(
    variantId: string,
    dto: CreateProductVariantImageDto
  ): Promise<ProductVariantImageDto> {
    await this.ensureVariantExists(variantId);

    if (dto.isPrimary) {
      await this.prisma.productVariantImage.updateMany({
        where: { productVariantId: variantId, isDeleted: false },
        data: { isPrimary: false },
      });
    }

    const maxOrder = await this.prisma.productVariantImage
      .aggregate({
        where: { productVariantId: variantId, isDeleted: false },
        _max: { sortOrder: true },
      })
      .then(r => r._max.sortOrder ?? -1);
    const sortOrder =
      dto.sortOrder !== undefined ? dto.sortOrder : maxOrder + 1;

    const created = await this.prisma.productVariantImage.create({
      data: {
        productVariantId: variantId,
        url: dto.url,
        sortOrder,
        isPrimary: dto.isPrimary ?? false,
      },
    });
    return this.mapToDto(created);
  }

  async findAllByVariantId(
    variantId: string
  ): Promise<ProductVariantImageDto[]> {
    await this.ensureVariantExists(variantId);
    const images = await this.prisma.productVariantImage.findMany({
      where: { productVariantId: variantId, isDeleted: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return images.map(this.mapToDto);
  }

  async setPrimary(
    variantId: string,
    imageId: string
  ): Promise<ProductVariantImageDto> {
    await this.ensureVariantExists(variantId);
    const image = await this.prisma.productVariantImage.findFirst({
      where: { id: imageId, productVariantId: variantId, isDeleted: false },
    });
    if (!image) throw new NotFoundException("Variant image not found");

    await this.prisma.$transaction([
      this.prisma.productVariantImage.updateMany({
        where: { productVariantId: variantId, isDeleted: false },
        data: { isPrimary: false },
      }),
      this.prisma.productVariantImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);
    const updated = await this.prisma.productVariantImage.findUnique({
      where: { id: imageId },
    });
    return this.mapToDto(updated!);
  }

  async reorder(
    variantId: string,
    dto: ReorderProductVariantImagesDto
  ): Promise<ProductVariantImageDto[]> {
    await this.ensureVariantExists(variantId);
    const variantImageIds = await this.prisma.productVariantImage
      .findMany({
        where: { productVariantId: variantId, isDeleted: false },
        select: { id: true },
      })
      .then(rows => rows.map(r => r.id));
    const dtoIds = dto.images.map(i => i.id);
    const invalid = dtoIds.filter(id => !variantImageIds.includes(id));
    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid image IDs: ${invalid.join(", ")}`);
    }
    await this.prisma.$transaction(
      dto.images.map(({ id, sortOrder }) =>
        this.prisma.productVariantImage.update({
          where: { id },
          data: { sortOrder },
        })
      )
    );
    return this.findAllByVariantId(variantId);
  }

  async remove(variantId: string, imageId: string): Promise<void> {
    await this.ensureVariantExists(variantId);
    const image = await this.prisma.productVariantImage.findFirst({
      where: { id: imageId, productVariantId: variantId, isDeleted: false },
    });
    if (!image) throw new NotFoundException("Variant image not found");

    await this.prisma.productVariantImage.update({
      where: { id: imageId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    if (image.isPrimary) {
      const next = await this.prisma.productVariantImage.findFirst({
        where: { productVariantId: variantId, isDeleted: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      if (next) {
        await this.prisma.productVariantImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }
  }
}
