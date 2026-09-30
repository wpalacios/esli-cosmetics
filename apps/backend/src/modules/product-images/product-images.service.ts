import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateProductImageDto } from "./dto/create-product-image.dto";
import { ReorderProductImagesDto } from "./dto/reorder-product-images.dto";
import { ProductImageDto } from "./dto/product-image.dto";

@Injectable()
export class ProductImagesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(row: {
    id: string;
    productId: string;
    url: string;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: Date;
  }): ProductImageDto {
    return {
      id: row.id,
      productId: row.productId,
      url: row.url,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt,
    };
  }

  async ensureProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
  }

  async create(
    productId: string,
    dto: CreateProductImageDto
  ): Promise<ProductImageDto> {
    await this.ensureProductExists(productId);

    if (dto.isPrimary) {
      await this.prisma.productImage.updateMany({
        where: { productId, isDeleted: false },
        data: { isPrimary: false },
      });
    }

    const maxOrder = await this.prisma.productImage
      .aggregate({
        where: { productId, isDeleted: false },
        _max: { sortOrder: true },
      })
      .then(r => r._max.sortOrder ?? -1);

    const sortOrder =
      dto.sortOrder !== undefined ? dto.sortOrder : maxOrder + 1;

    const created = await this.prisma.productImage.create({
      data: {
        productId,
        url: dto.url,
        sortOrder,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    return this.mapToDto(created);
  }

  async findAllByProductId(productId: string): Promise<ProductImageDto[]> {
    await this.ensureProductExists(productId);

    const images = await this.prisma.productImage.findMany({
      where: { productId, isDeleted: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return images.map(this.mapToDto);
  }

  async setPrimary(
    productId: string,
    imageId: string
  ): Promise<ProductImageDto> {
    await this.ensureProductExists(productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
        isDeleted: false,
      },
    });

    if (!image) {
      throw new NotFoundException("Product image not found");
    }

    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId, isDeleted: false },
        data: { isPrimary: false },
      }),
      this.prisma.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);

    const updated = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });
    return this.mapToDto(updated!);
  }

  async reorder(
    productId: string,
    dto: ReorderProductImagesDto
  ): Promise<ProductImageDto[]> {
    await this.ensureProductExists(productId);

    const productImageIds = await this.prisma.productImage
      .findMany({
        where: { productId, isDeleted: false },
        select: { id: true },
      })
      .then(rows => rows.map(r => r.id));

    const dtoIds = dto.images.map(i => i.id);
    const invalid = dtoIds.filter(id => !productImageIds.includes(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid or non-existent image IDs: ${invalid.join(", ")}`
      );
    }

    await this.prisma.$transaction(
      dto.images.map(({ id, sortOrder }) =>
        this.prisma.productImage.update({
          where: { id },
          data: { sortOrder },
        })
      )
    );

    return this.findAllByProductId(productId);
  }

  async remove(productId: string, imageId: string): Promise<void> {
    await this.ensureProductExists(productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
        isDeleted: false,
      },
    });

    if (!image) {
      throw new NotFoundException("Product image not found");
    }

    await this.prisma.productImage.update({
      where: { id: imageId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId, isDeleted: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      if (next) {
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }
  }
}
