import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { LocationType } from "@prisma/client";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { BranchDto } from "./dto/branch.dto";
import { PaginatedBranchesDto } from "./dto/paginated-branches.dto";
import { DeleteBranchResponseDto } from "./dto/delete-branch-response.dto";

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validates uniqueness of branch name and code.
   * If both name and code are undefined, validation is skipped.
   * This allows partial updates (e.g., address/phone only) to avoid unnecessary queries.
   * If either field is provided, checks for duplicates (case/space insensitive).
   * Throws ConflictException if a duplicate is found.
   */
  private async validateBranchUniqueness(
    name?: string,
    code?: string,
    excludeId?: string
  ): Promise<void> {
    const trimmedName = name?.trim();
    let trimmedCode = code?.trim();

    // Treat empty code as undefined
    if (trimmedCode === "") {
      trimmedCode = undefined;
    }

    if (!trimmedName && !trimmedCode) return;

    const where: any = {
      isDeleted: false,
      OR: [],
    };

    if (trimmedName) {
      where.OR.push({
        name: { equals: trimmedName, mode: "insensitive" },
      });
    }

    if (trimmedCode) {
      where.OR.push({
        code: { equals: trimmedCode, mode: "insensitive" },
      });
    }

    if (where.OR.length === 0) return;

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const duplicate = await this.prisma.branch.findFirst({ where });

    if (duplicate) {
      // Always check both fields specifically
      if (
        trimmedName &&
        duplicate.name &&
        duplicate.name.trim().toLowerCase() === trimmedName.toLowerCase()
      ) {
        throw new ConflictException("Branch with this name already exists");
      }
      if (
        trimmedCode &&
        duplicate.code &&
        duplicate.code.trim().toLowerCase() === trimmedCode.toLowerCase()
      ) {
        throw new ConflictException("Branch with this code already exists");
      }
    }
  }

  async create(createBranchDto: CreateBranchDto): Promise<BranchDto> {
    return await this.prisma.$transaction(async tx => {
      // Validate uniqueness for Name and Code inside the transaction
      await this.validateBranchUniqueness(
        createBranchDto.name,
        createBranchDto.code
      );

      // Normalize optional fields: convert empty trimmed strings to undefined
      const trimmedName = createBranchDto.name.trim();
      const trimmedCode = createBranchDto.code?.trim();
      const normalizedCode = trimmedCode === "" ? undefined : trimmedCode;
      const trimmedAddress = createBranchDto.address?.trim();
      const normalizedAddress =
        trimmedAddress === "" ? undefined : trimmedAddress;
      const trimmedPhone = createBranchDto.phone?.trim();
      const normalizedPhone = trimmedPhone === "" ? undefined : trimmedPhone;

      // Check if manager employee exists
      if (createBranchDto.managerEmployeeId) {
        const managerEmployee = await tx.employee.findFirst({
          where: {
            id: createBranchDto.managerEmployeeId,
            isDeleted: false,
          },
        });

        if (!managerEmployee) {
          throw new NotFoundException("Manager employee not found");
        }
      }

      // Create the branch
      const branch = await tx.branch.create({
        data: {
          name: trimmedName,
          code: normalizedCode,
          address: normalizedAddress,
          phone: normalizedPhone,
          managerEmployeeId: createBranchDto.managerEmployeeId,
          isActive: createBranchDto.isActive ?? true,
        },
        include: {
          managerEmployee: {
            include: {
              person: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          locations: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              locationType: true,
              address: true,
              contact: true,
            },
          },
        },
      });

      // Always create a default location for the branch
      const defaultLocation = await tx.location.create({
        data: {
          branchId: branch.id,
          name: branch.name,
          locationType: LocationType.STORE,
          address: branch.address,
          contact: branch.phone,
        },
      });

      // Find if a cash register already exists for this location
      const existingCashRegister = await tx.cashRegister.findFirst({
        where: { locationId: defaultLocation.id },
      });

      if (existingCashRegister) {
        await tx.cashRegister.update({
          where: { id: existingCashRegister.id },
          data: {
            name: defaultLocation.name,
            code: `${defaultLocation.id}-CR`, // Use a unique code per location
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.cashRegister.create({
          data: {
            locationId: defaultLocation.id,
            name: defaultLocation.name,
            code: `${defaultLocation.id}-CR`, // Unique code per location
            isActive: true,
          },
        });
      }

      // Update manager employee's location assignment
      if (createBranchDto.managerEmployeeId) {
        await tx.employee.update({
          where: { id: createBranchDto.managerEmployeeId },
          data: {
            locationId: defaultLocation.id,
            updatedAt: new Date(),
          },
        });
      }

      return this.mapToBranchDto(branch);
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedBranchesDto> {
    const skip = (page - 1) * limit;
    const whereClause: any = { isDeleted: false };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        {
          managerEmployee: {
            person: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const total = await this.prisma.branch.count({ where: whereClause });
    const branches = await this.prisma.branch.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        managerEmployee: {
          include: {
            person: { select: { firstName: true, lastName: true } },
          },
        },
        locations: {
          where: { isDeleted: false },
          select: {
            id: true,
            name: true,
            locationType: true,
            address: true,
            contact: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(total / limit);
    return {
      data: branches.map(branch => this.mapToBranchDto(branch)),
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

  async findOne(id: string): Promise<BranchDto> {
    const branch = await this.prisma.branch.findFirst({
      where: { id, isDeleted: false },
      include: {
        managerEmployee: {
          include: {
            person: { select: { firstName: true, lastName: true } },
          },
        },
        locations: {
          where: { isDeleted: false },
          select: {
            id: true,
            name: true,
            locationType: true,
            address: true,
            contact: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return this.mapToBranchDto(branch);
  }

  async update(
    id: string,
    updateBranchDto: UpdateBranchDto
  ): Promise<BranchDto> {
    return await this.prisma.$transaction(async tx => {
      // Validate uniqueness for Name and Code inside the transaction
      await this.validateBranchUniqueness(
        updateBranchDto.name,
        updateBranchDto.code,
        id
      );

      // Normalize optional fields: convert empty trimmed strings to undefined
      const trimmedName = updateBranchDto.name?.trim();
      const normalizedName = trimmedName === "" ? undefined : trimmedName;
      const trimmedCode = updateBranchDto.code?.trim();
      const normalizedCode = trimmedCode === "" ? undefined : trimmedCode;
      const trimmedAddress = updateBranchDto.address?.trim();
      const normalizedAddress =
        trimmedAddress === "" ? undefined : trimmedAddress;
      const trimmedPhone = updateBranchDto.phone?.trim();
      const normalizedPhone = trimmedPhone === "" ? undefined : trimmedPhone;

      const existingBranch = await tx.branch.findFirst({
        where: { id, isDeleted: false },
      });

      if (!existingBranch) {
        throw new NotFoundException("Branch not found");
      }

      // Check manager if provided
      if (updateBranchDto.managerEmployeeId) {
        const managerEmployee = await tx.employee.findFirst({
          where: { id: updateBranchDto.managerEmployeeId, isDeleted: false },
        });
        if (!managerEmployee) {
          throw new NotFoundException("Manager employee not found");
        }
      }

      const updatedBranch = await tx.branch.update({
        where: { id },
        data: {
          name: normalizedName,
          code: normalizedCode,
          address: normalizedAddress,
          phone: normalizedPhone,
          managerEmployeeId: updateBranchDto.managerEmployeeId,
          isActive: updateBranchDto.isActive,
          updatedAt: new Date(),
        },
        include: {
          managerEmployee: {
            include: {
              person: { select: { firstName: true, lastName: true } },
            },
          },
          locations: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              locationType: true,
              address: true,
              contact: true,
            },
          },
        },
      });

      // Update default location details
      const defaultLocation = await tx.location.findFirst({
        where: { branchId: id, isDeleted: false },
        orderBy: { createdAt: "asc" },
      });

      if (defaultLocation) {
        const existingCashRegister = await tx.cashRegister.findFirst({
          where: { locationId: defaultLocation.id },
        });

        if (existingCashRegister) {
          await tx.cashRegister.update({
            where: { id: existingCashRegister.id },
            data: {
              name: updatedBranch.name,
              code: `${defaultLocation.id}-CR`, // Unique code per location
              isActive: true,
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.cashRegister.create({
            data: {
              locationId: defaultLocation.id,
              name: updatedBranch.name,
              code: `${defaultLocation.id}-CR`, // Unique code per location
              isActive: true,
            },
          });
        }

        // If we updated manager, ensure they are assigned to this location
        if (updateBranchDto.managerEmployeeId) {
          await tx.employee.update({
            where: { id: updateBranchDto.managerEmployeeId },
            data: {
              locationId: defaultLocation.id,
              updatedAt: new Date(),
            },
          });
        }
      }

      return this.mapToBranchDto(updatedBranch);
    });
  }

  async remove(id: string): Promise<DeleteBranchResponseDto> {
    return await this.prisma.$transaction(async tx => {
      const existingBranch = await tx.branch.findFirst({
        where: { id, isDeleted: false },
      });

      if (!existingBranch) {
        throw new NotFoundException("Branch not found");
      }

      // Find all locations associated with this branch
      const locations = await tx.location.findMany({
        where: { branchId: id, isDeleted: false },
        select: { id: true },
      });

      // Get all location IDs
      const locationIds = locations.map(loc => loc.id);

      // Deactivate all cash registers associated with these locations
      if (locationIds.length > 0) {
        await tx.cashRegister.updateMany({
          where: { locationId: { in: locationIds } },
          data: { isActive: false },
        });
      }

      await tx.location.updateMany({
        where: { branchId: id, isDeleted: false },
        data: { isDeleted: true, deletedAt: new Date() },
      });

      await tx.branch.update({
        where: { id },
        data: { isActive: false, isDeleted: true, deletedAt: new Date() },
      });

      return {
        success: true,
        message: "Branch deleted successfully",
        id,
      };
    });
  }

  private mapToBranchDto(branch: any): BranchDto {
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      manager_employee_id: branch.managerEmployeeId,
      is_active: branch.isActive,
      is_deleted: branch.isDeleted,
      created_at: branch.createdAt,
      updated_at: branch.updatedAt,
      deleted_at: branch.deletedAt,
      manager_employee: branch.managerEmployee
        ? {
            id: branch.managerEmployee.id,
            person: {
              firstName: branch.managerEmployee.person.firstName,
              lastName: branch.managerEmployee.person.lastName,
            },
          }
        : undefined,
      locations: branch.locations?.map((location: any) => ({
        id: location.id,
        name: location.name,
        locationType: location.locationType,
        address: location.address,
        contact: location.contact,
      })),
    };
  }
}
