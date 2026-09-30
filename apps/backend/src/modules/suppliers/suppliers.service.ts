import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { runWithPrismaTransactionRetry } from "../../common/prisma/prisma-transaction-retry";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SupplierDto } from "./dto/supplier.dto";
import { PaginatedSuppliersDto } from "./dto/paginated-suppliers.dto";
import { DeleteSupplierResponseDto } from "./dto/delete-supplier-response.dto";

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(private prisma: PrismaService) {}

  private readonly supplierTxOptions = {
    maxWait: 10_000,
    timeout: 20_000,
  } as const;

  async create(createSupplierDto: CreateSupplierDto): Promise<SupplierDto> {
    return await runWithPrismaTransactionRetry(
      () =>
        this.prisma.$transaction(async tx => {
          const normalizedName = createSupplierDto.name.trim();

          const existingSupplier = await tx.supplier.findFirst({
            where: {
              name: {
                equals: normalizedName,
                mode: "insensitive",
              },
              isDeleted: false,
            },
          });

          if (existingSupplier) {
            throw new ConflictException(
              "Supplier with this name already exists"
            );
          }

          if (
            createSupplierDto.brandIds &&
            createSupplierDto.brandIds.length > 0
          ) {
            const existingBrands = await tx.brand.findMany({
              where: {
                id: { in: createSupplierDto.brandIds },
                isDeleted: false,
              },
              select: { id: true },
            });

            if (existingBrands.length !== createSupplierDto.brandIds.length) {
              throw new ConflictException("One or more brand IDs are invalid");
            }
          }

          const supplier = await tx.supplier.create({
            data: {
              name: normalizedName,
              contactName: createSupplierDto.contactName?.trim(),
              phone: createSupplierDto.phone?.trim(),
              email: createSupplierDto.email?.trim(),
              address: createSupplierDto.address?.trim(),
              supplierBrands:
                createSupplierDto.brandIds &&
                createSupplierDto.brandIds.length > 0
                  ? {
                      create: createSupplierDto.brandIds.map(brandId => ({
                        brandId,
                      })),
                    }
                  : undefined,
            },
            include: {
              supplierBrands: {
                where: { isDeleted: false },
                include: {
                  brand: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          });

          return this.mapToSupplierDto(supplier);
        }, this.supplierTxOptions),
      { logger: this.logger }
    );
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedSuppliersDto> {
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      isDeleted: false,
    };

    // Add search functionality
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count for pagination
    const total = await this.prisma.supplier.count({
      where: whereClause,
    });

    // Get suppliers with pagination
    const suppliers = await this.prisma.supplier.findMany({
      where: whereClause,
      include: {
        supplierBrands: {
          where: { isDeleted: false },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: suppliers.map(supplier => this.mapToSupplierDto(supplier)),
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

  async findOne(id: string): Promise<SupplierDto> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        supplierBrands: {
          where: { isDeleted: false },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    return this.mapToSupplierDto(supplier);
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto
  ): Promise<SupplierDto> {
    return await runWithPrismaTransactionRetry(
      () =>
        this.prisma.$transaction(async tx => {
          const existingSupplier = await tx.supplier.findFirst({
            where: { id, isDeleted: false },
          });

          if (!existingSupplier) {
            throw new NotFoundException("Supplier not found");
          }

          const normalizedName = updateSupplierDto.name
            ? updateSupplierDto.name.trim()
            : undefined;

          if (
            normalizedName &&
            normalizedName.toLowerCase() !== existingSupplier.name.toLowerCase()
          ) {
            const nameConflict = await tx.supplier.findFirst({
              where: {
                name: {
                  equals: normalizedName,
                  mode: "insensitive",
                },
                isDeleted: false,
                id: { not: id },
              },
            });

            if (nameConflict) {
              throw new ConflictException(
                "Supplier with this name already exists"
              );
            }
          }

          if (
            updateSupplierDto.brandIds &&
            updateSupplierDto.brandIds.length > 0
          ) {
            const uniqueBrandIds = [...new Set(updateSupplierDto.brandIds)];
            const existingBrands = await tx.brand.findMany({
              where: {
                id: { in: uniqueBrandIds },
                isDeleted: false,
              },
              select: { id: true },
            });

            if (existingBrands.length !== uniqueBrandIds.length) {
              throw new ConflictException("One or more brand IDs are invalid");
            }
          }

          if (updateSupplierDto.brandIds !== undefined) {
            const newBrandIds = [...new Set(updateSupplierDto.brandIds)];
            const newBrandSet = new Set(newBrandIds);

            const existingSupplierBrands = await tx.supplierBrand.findMany({
              where: { supplierId: id },
              select: { brandId: true },
            });

            const existingBrandIdSet = new Set(
              existingSupplierBrands.map(sb => sb.brandId)
            );

            const brandIdsToDelete = [...existingBrandIdSet].filter(
              existingId => !newBrandSet.has(existingId)
            );

            if (brandIdsToDelete.length > 0) {
              await tx.supplierBrand.updateMany({
                where: {
                  supplierId: id,
                  brandId: { in: brandIdsToDelete },
                  isDeleted: false,
                },
                data: { isDeleted: true, deletedAt: new Date() },
              });
            }

            if (newBrandIds.length > 0) {
              await tx.supplierBrand.updateMany({
                where: {
                  supplierId: id,
                  brandId: { in: newBrandIds },
                },
                data: { isDeleted: false, deletedAt: null },
              });

              const brandIdsToCreate = newBrandIds.filter(
                bid => !existingBrandIdSet.has(bid)
              );

              if (brandIdsToCreate.length > 0) {
                await tx.supplierBrand.createMany({
                  data: brandIdsToCreate.map(brandId => ({
                    supplierId: id,
                    brandId,
                  })),
                });
              }
            }
          }

          const updatedSupplier = await tx.supplier.update({
            where: { id },
            data: {
              name: normalizedName,
              contactName: updateSupplierDto.contactName?.trim(),
              phone: updateSupplierDto.phone?.trim(),
              email: updateSupplierDto.email?.trim(),
              address: updateSupplierDto.address?.trim(),
              updatedAt: new Date(),
            },
            include: {
              supplierBrands: {
                where: { isDeleted: false },
                include: {
                  brand: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          });

          return this.mapToSupplierDto(updatedSupplier);
        }, this.supplierTxOptions),
      { logger: this.logger }
    );
  }

  async remove(id: string): Promise<DeleteSupplierResponseDto> {
    return await runWithPrismaTransactionRetry(
      () =>
        this.prisma.$transaction(async tx => {
          const existingSupplier = await tx.supplier.findFirst({
            where: {
              id,
              isDeleted: false,
            },
          });

          if (!existingSupplier) {
            throw new NotFoundException("Supplier not found");
          }

          await tx.supplier.update({
            where: { id },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
              updatedAt: new Date(),
            },
          });

          return {
            success: true,
            message: "Supplier deleted successfully",
            id,
          };
        }, this.supplierTxOptions),
      { logger: this.logger }
    );
  }

  private mapToSupplierDto(supplier: any): SupplierDto {
    return {
      id: supplier.id,
      name: supplier.name,
      contact_name: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      is_deleted: supplier.isDeleted,
      created_at: supplier.createdAt,
      updated_at: supplier.updatedAt,
      deleted_at: supplier.deletedAt,
      metadata: supplier.metadata,
      brands:
        supplier.supplierBrands?.map((sb: any) => ({
          id: sb.id,
          brandId: sb.brandId,
          supplierId: sb.supplierId,
          brandName: sb.brand?.name || "",
          isDeleted: sb.isDeleted,
          createdAt: sb.createdAt,
          deletedAt: sb.deletedAt,
        })) || [],
    };
  }
}
