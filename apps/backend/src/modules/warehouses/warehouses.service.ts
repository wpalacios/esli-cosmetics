import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { LocationType } from "@prisma/client";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { WarehouseDto } from "./dto/warehouse.dto";
import { PaginatedWarehousesDto } from "./dto/paginated-warehouses.dto";
import { DeleteWarehouseResponseDto } from "./dto/delete-warehouse-response.dto";

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  private normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
  }

  async create(createWarehouseDto: CreateWarehouseDto): Promise<WarehouseDto> {
    return await this.prisma.$transaction(async tx => {
      // Verifica existencia de la sucursal
      if (createWarehouseDto.branchId) {
        const branch = await tx.branch.findFirst({
          where: {
            id: createWarehouseDto.branchId,
            isDeleted: false,
          },
        });

        if (!branch) {
          throw new NotFoundException("Branch not found");
        }
      }

      const normalizedName = this.normalizeName(createWarehouseDto.name);

      const duplicate = await tx.location.findFirst({
        where: {
          locationType: LocationType.WAREHOUSE,
          isDeleted: false,
          branchId: createWarehouseDto.branchId,
          name: {
            equals: createWarehouseDto.name.trim().replace(/\s+/g, " "),
            mode: "insensitive",
          },
        },
      });

      if (duplicate && this.normalizeName(duplicate.name) === normalizedName) {
        throw new ConflictException("Warehouse name already exists");
      }

      // Create the warehouse (location with type WAREHOUSE)
      const warehouse = await tx.location.create({
        data: {
          branchId: createWarehouseDto.branchId,
          name: createWarehouseDto.name,
          locationType: LocationType.WAREHOUSE,
          address: createWarehouseDto.address,
          contact: createWarehouseDto.contact,
        },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          stockLevels: {
            select: {
              id: true,
              productId: true,
              quantity: true,
            },
          },
        },
      });

      // 1. Create a cash register for the warehouse
      const cashRegisterCode = `${warehouse.id}-CR`;

      // 2. Search for any cash register with the same locationId or code
      const existingCR = await tx.cashRegister.findFirst({
        where: {
          OR: [{ locationId: warehouse.id }, { code: cashRegisterCode }],
        },
      });

      if (existingCR) {
        // 3. if exists and has the same locationId, we update it
        await tx.cashRegister.update({
          where: { id: existingCR.id },
          data: {
            locationId: warehouse.id,
            name: warehouse.name,
            code: cashRegisterCode,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        // 4. if not exists we create it
        await tx.cashRegister.create({
          data: {
            locationId: warehouse.id,
            name: warehouse.name,
            code: cashRegisterCode,
            isActive: true,
          },
        });
      }

      return this.mapToWarehouseDto(warehouse);
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedWarehousesDto> {
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      locationType: LocationType.WAREHOUSE,
      isDeleted: false,
    };

    // Add search functionality
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { contact: { contains: search, mode: "insensitive" } },
        { branch: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Get total count for pagination
    const total = await this.prisma.location.count({
      where: whereClause,
    });

    // Get warehouses with pagination
    const warehouses = await this.prisma.location.findMany({
      where: whereClause,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        stockLevels: {
          select: {
            id: true,
            productId: true,
            quantity: true,
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
      data: warehouses.map(warehouse => this.mapToWarehouseDto(warehouse)),
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

  async findOne(id: string): Promise<WarehouseDto> {
    const warehouse = await this.prisma.location.findFirst({
      where: {
        id,
        locationType: LocationType.WAREHOUSE,
        isDeleted: false,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        stockLevels: {
          select: {
            id: true,
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    return this.mapToWarehouseDto(warehouse);
  }

  async update(
    id: string,
    updateWarehouseDto: UpdateWarehouseDto
  ): Promise<WarehouseDto> {
    return await this.prisma.$transaction(async tx => {
      // Check if warehouse exists
      const existingWarehouse = await tx.location.findFirst({
        where: {
          id,
          locationType: LocationType.WAREHOUSE,
          isDeleted: false,
        },
      });

      if (!existingWarehouse) {
        throw new NotFoundException("Warehouse not found");
      }

      // Verify branch exists if branchId is being updated
      if (updateWarehouseDto.branchId) {
        const branch = await tx.branch.findFirst({
          where: {
            id: updateWarehouseDto.branchId,
            isDeleted: false,
          },
        });

        if (!branch) {
          throw new NotFoundException("Branch not found");
        }
      }

      if (updateWarehouseDto.name) {
        const normalizedName = this.normalizeName(updateWarehouseDto.name);
        const duplicate = await tx.location.findFirst({
          where: {
            locationType: LocationType.WAREHOUSE,
            isDeleted: false,
            branchId: updateWarehouseDto.branchId || existingWarehouse.branchId,
            id: { not: id },
            name: {
              equals: updateWarehouseDto.name.trim().replace(/\s+/g, " "),
              mode: "insensitive",
            },
          },
        });
        if (
          duplicate &&
          this.normalizeName(duplicate.name) === normalizedName
        ) {
          throw new ConflictException("Warehouse name already exists");
        }
      }

      // Update the warehouse
      const updatedWarehouse = await tx.location.update({
        where: { id },
        data: {
          ...updateWarehouseDto,
          updatedAt: new Date(),
        },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          stockLevels: {
            select: {
              id: true,
              productId: true,
              quantity: true,
            },
          },
        },
      });

      // Update the cash register for the warehouse
      const cashRegisterCode = `${updatedWarehouse.id}-CR`;

      // 1. Search for any cash register with the same locationId or code
      const existingCR = await tx.cashRegister.findFirst({
        where: {
          OR: [{ locationId: updatedWarehouse.id }, { code: cashRegisterCode }],
        },
      });

      if (existingCR) {
        // 2. If it exists, update it (using the ID to avoid ON CONFLICT)
        await tx.cashRegister.update({
          where: { id: existingCR.id },
          data: {
            locationId: updatedWarehouse.id,
            name: updatedWarehouse.name,
            code: cashRegisterCode,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        // 3. If it doesn't exist (rare case in update, but possible), create it
        await tx.cashRegister.create({
          data: {
            locationId: updatedWarehouse.id,
            name: updatedWarehouse.name,
            code: cashRegisterCode,
            isActive: true,
          },
        });
      }

      return this.mapToWarehouseDto(updatedWarehouse);
    });
  }

  async remove(id: string): Promise<DeleteWarehouseResponseDto> {
    return await this.prisma.$transaction(async tx => {
      // Check if warehouse exists
      const existingWarehouse = await tx.location.findFirst({
        where: {
          id,
          locationType: LocationType.WAREHOUSE,
          isDeleted: false,
        },
      });

      if (!existingWarehouse) {
        throw new NotFoundException("Warehouse not found");
      }

      // Deactivate all cash registers associated with this location
      await tx.cashRegister.updateMany({
        where: { locationId: id },
        data: { isActive: false },
      });

      // Soft delete the warehouse
      await tx.location.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Warehouse deleted successfully",
        id,
      };
    });
  }

  private mapToWarehouseDto(warehouse: any): WarehouseDto {
    return {
      id: warehouse.id,
      branch_id: warehouse.branchId,
      name: warehouse.name,
      location_type: warehouse.locationType,
      address: warehouse.address,
      contact: warehouse.contact,
      is_deleted: warehouse.isDeleted,
      created_at: warehouse.createdAt,
      updated_at: warehouse.updatedAt,
      deleted_at: warehouse.deletedAt,
      branch: warehouse.branch,
      stock_levels: warehouse.stockLevels,
    };
  }
}
