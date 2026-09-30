import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";
import { BrandDto } from "./dto/brand.dto";
import { PaginatedBrandsDto } from "./dto/paginated-brands.dto";
import { DeleteBrandResponseDto } from "./dto/delete-brand-response.dto";

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async create(createBrandDto: CreateBrandDto): Promise<BrandDto> {
    // Check if brand with this name already exists
    const existingBrand = await this.prisma.brand.findFirst({
      where: {
        name: createBrandDto.name,
      },
    });

    if (existingBrand && !existingBrand.isDeleted) {
      throw new ConflictException("Brand with this name already exists");
    } else if (existingBrand?.isDeleted) {
      // hard-delete the brand, user will not be able to recover it
      await this.prisma.brand.delete({
        where: { id: existingBrand.id },
      });
    }

    const brand = await this.prisma.brand.create({
      data: {
        name: createBrandDto.name,
        description: createBrandDto.description,
        websiteUrl: createBrandDto.websiteUrl,
        logoUrl: createBrandDto.logoUrl,
        country: createBrandDto.country,
      },
    });

    return this.mapToBrandDto(brand);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedBrandsDto> {
    const skip = (page - 1) * limit;

    // Build where clause for search
    const whereClause: any = {
      isDeleted: false,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await this.prisma.brand.count({
      where: whereClause,
    });

    // Get brands with pagination
    const brands = await this.prisma.brand.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: brands.map(brand => this.mapToBrandDto(brand)),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<BrandDto> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!brand) {
      throw new NotFoundException("Brand not found");
    }

    return this.mapToBrandDto(brand);
  }

  async update(id: string, updateBrandDto: UpdateBrandDto): Promise<BrandDto> {
    // Check if brand exists
    const existingBrand = await this.prisma.brand.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingBrand) {
      throw new NotFoundException("Brand not found");
    }

    // Check if brand with this name already exists (excluding current brand)
    if (updateBrandDto.name) {
      const conflictingBrand = await this.prisma.brand.findFirst({
        where: {
          name: updateBrandDto.name,
          id: { not: id },
          isDeleted: false,
        },
      });

      if (conflictingBrand) {
        throw new ConflictException("Brand with this name already exists");
      }
    }

    const updatedBrand = await this.prisma.brand.update({
      where: { id },
      data: {
        ...(updateBrandDto.name && { name: updateBrandDto.name }),
        ...(updateBrandDto.description !== undefined && {
          description: updateBrandDto.description,
        }),
        ...(updateBrandDto.websiteUrl !== undefined && {
          websiteUrl: updateBrandDto.websiteUrl,
        }),
        ...(updateBrandDto.logoUrl !== undefined && {
          logoUrl: updateBrandDto.logoUrl,
        }),
        ...(updateBrandDto.country !== undefined && {
          country: updateBrandDto.country,
        }),
        updatedAt: new Date(),
      },
    });

    return this.mapToBrandDto(updatedBrand);
  }

  async checkNameExists(name: string, excludeId?: string): Promise<boolean> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
        isDeleted: false,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return !!brand;
  }

  async remove(id: string): Promise<DeleteBrandResponseDto> {
    // Check if brand exists
    const existingBrand = await this.prisma.brand.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingBrand) {
      throw new NotFoundException("Brand not found");
    }

    // Check if brand has associated products
    const associatedProducts = await this.prisma.product.count({
      where: {
        brandId: id,
        isDeleted: false,
      },
    });

    if (associatedProducts > 0) {
      throw new ConflictException(
        "Cannot delete brand with associated products"
      );
    }

    // Soft delete associated supplier brands (cascade delete)
    await this.prisma.supplierBrand.updateMany({
      where: {
        brandId: id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Soft delete the brand
    await this.prisma.brand.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message: "Brand deleted successfully",
      id,
    };
  }

  private mapToBrandDto(brand: any): BrandDto {
    return {
      id: brand.id,
      name: brand.name,
      description: brand.description,
      websiteUrl: brand.websiteUrl,
      logoUrl: brand.logoUrl,
      country: brand.country,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
      isDeleted: brand.isDeleted,
      deletedAt: brand.deletedAt?.toISOString(),
    };
  }
}
