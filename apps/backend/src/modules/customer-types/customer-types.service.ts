import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateCustomerTypeDto } from "./dto/create-customer-type.dto";
import { CustomerTypeDto } from "./dto/customer-type.dto";
import { Prisma } from "@prisma/client";
import { PaginatedCustomerTypesDto } from "./dto/paginated-customer-types.dto";
import { UpdateCustomerTypeDto } from "./dto/update-customer-type.dto";
import { DeleteCustomerTypeResponseDto } from "./dto/delete-customer-type.dto";

@Injectable()
export class CustomerTypesService {
  private readonly logger = new Logger(CustomerTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    createCustomerTypeDto: CreateCustomerTypeDto
  ): Promise<CustomerTypeDto> {
    this.logger.log(
      `Start creating CustomerType with name: "${createCustomerTypeDto.name}"`
    );

    const name = createCustomerTypeDto.name.trim();
    const description = createCustomerTypeDto.description?.trim() ?? null;

    try {
      await this.validateCustomerTypeName(name);
      this.validateNameLength(name);
      this.validateDescriptionLength(description);

      const created = await this.prisma.customerType.create({
        data: {
          name,
          description,
          isActive: createCustomerTypeDto.isActive ?? true,
          isDeleted: false,
        },
      });

      this.logger.log(`CustomerType created with id: ${created.id}`);

      return {
        id: created.id,
        name: created.name,
        description: created.description,
        isActive: created.isActive,
        isDeleted: created.isDeleted,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        deletedAt: created.deletedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error creating CustomerType: ${error.message}`,
        error.stack
      );

      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException("Failed to create CustomerType");
    }
  }

  async findAll(
    page: number = 1,
    limit = 10,
    filters?: { search?: string; name?: string; description?: string }
  ): Promise<PaginatedCustomerTypesDto> {
    this.logger.log(
      `Start fetching CustomerTypes: page=${page}, limit=${limit}, filters=${JSON.stringify(filters)}`
    );

    const skip = (page - 1) * limit;

    try {
      // Build where clause for filtering
      const where: Prisma.CustomerTypeWhereInput = {
        isDeleted: false,
      };

      // If search is provided, search in both name and description
      if (filters?.search) {
        const searchTerm = filters.search.trim();
        where.OR = [
          {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        ];
      } else {
        // If specific filters are provided, use them
        if (filters?.name) {
          where.name = {
            contains: filters.name.trim(),
            mode: "insensitive",
          };
        }
        if (filters?.description) {
          where.description = {
            contains: filters.description.trim(),
            mode: "insensitive",
          };
        }
      }

      const [customerTypes, total] = await Promise.all([
        this.prisma.customerType.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        this.prisma.customerType.count({
          where,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      this.logger.log(`Found ${customerTypes.length} CustomerTypes`);

      return {
        data: customerTypes.map(customerType => ({
          id: customerType.id,
          name: customerType.name,
          description: customerType.description,
          isActive: customerType.isActive,
          isDeleted: customerType.isDeleted,
          createdAt: customerType.createdAt,
          updatedAt: customerType.updatedAt,
          deletedAt: customerType.deletedAt,
        })),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching CustomerTypes: ${error.message}`,
        error.stack
      );
      throw new InternalServerErrorException("Failed to fetch CustomerTypes");
    }
  }

  async findOne(id: string): Promise<CustomerTypeDto> {
    this.logger.log(`Start fetching CustomerType with id: ${id}`);

    try {
      const customerType = await this.prisma.customerType.findFirst({
        where: {
          id,
          isDeleted: false,
        },
      });

      if (!customerType) {
        throw new NotFoundException(`CustomerType with id ${id} not found`);
      }

      this.logger.log(`CustomerType found: ${customerType.name}`);

      return {
        id: customerType.id,
        name: customerType.name,
        description: customerType.description,
        isActive: customerType.isActive,
        isDeleted: customerType.isDeleted,
        createdAt: customerType.createdAt,
        updatedAt: customerType.updatedAt,
        deletedAt: customerType.deletedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching CustomerType: ${error.message}`,
        error.stack
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException("Failed to fetch CustomerType");
    }
  }

  async update(
    id: string,
    updateCustomerTypeDto: UpdateCustomerTypeDto
  ): Promise<CustomerTypeDto> {
    this.logger.log(`Start updating CustomerType with id: ${id}`);

    try {
      // Check if customer type exists
      const existingCustomerType = await this.prisma.customerType.findFirst({
        where: {
          id,
          isDeleted: false,
        },
      });

      if (!existingCustomerType) {
        throw new NotFoundException(`CustomerType with id ${id} not found`);
      }

      const name = updateCustomerTypeDto.name?.trim();
      const description = updateCustomerTypeDto.description?.trim() ?? null;

      // Validate name if provided
      if (name) {
        await this.validateCustomerTypeName(name, id);
        this.validateNameLength(name);
      }

      // Validate description if provided
      if (description !== undefined) {
        this.validateDescriptionLength(description);
      }

      const updated = await this.prisma.customerType.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(updateCustomerTypeDto.isActive !== undefined && {
            isActive: updateCustomerTypeDto.isActive,
          }),
          updatedAt: new Date(),
        },
      });

      this.logger.log(`CustomerType updated: ${updated.name}`);

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isActive: updated.isActive,
        isDeleted: updated.isDeleted,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        deletedAt: updated.deletedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error updating CustomerType: ${error.message}`,
        error.stack
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException("Failed to update CustomerType");
    }
  }

  async remove(id: string): Promise<DeleteCustomerTypeResponseDto> {
    this.logger.log(`Start soft deleting CustomerType with id: ${id}`);

    try {
      // Check if customer type exists
      const existingCustomerType = await this.prisma.customerType.findFirst({
        where: {
          id,
          isDeleted: false,
        },
      });

      if (!existingCustomerType) {
        throw new NotFoundException(`CustomerType with id ${id} not found`);
      }

      // Check if customer type is being used by customers
      const customersUsingType = await this.prisma.customer.count({
        where: {
          customerTypeId: id,
          isDeleted: false,
        },
      });

      if (customersUsingType > 0) {
        throw new ConflictException(
          `Cannot delete CustomerType. It is being used by ${customersUsingType} customer(s)`
        );
      }

      await this.prisma.customerType.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      this.logger.log(
        `CustomerType soft deleted: ${existingCustomerType.name}`
      );

      return {
        success: true,
        message: "CustomerType deleted successfully",
      };
    } catch (error) {
      this.logger.error(
        `Error deleting CustomerType: ${error.message}`,
        error.stack
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException("Failed to delete CustomerType");
    }
  }

  private async validateCustomerTypeName(
    name: string,
    excludeId?: string
  ): Promise<void> {
    const existingCustomerType = await this.prisma.customerType.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },

        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (existingCustomerType && !existingCustomerType.isDeleted) {
      throw new ConflictException(
        `CustomerType with name "${name}" already exists`
      );
    } else if (existingCustomerType?.isDeleted) {
      // hard-delete the customer type, user will not be able to recover it
      await this.prisma.customerType.delete({
        where: { id: existingCustomerType.id },
      });
    }
  }

  private validateNameLength(name: string): void {
    if (name.length < 2) {
      throw new BadRequestException("Name must be at least 2 characters long");
    }
    if (name.length > 255) {
      throw new BadRequestException("Name must not exceed 255 characters");
    }
  }

  private validateDescriptionLength(description: string | null): void {
    if (description && description.length > 255) {
      throw new BadRequestException(
        "Description must not exceed 255 characters"
      );
    }
  }
}
