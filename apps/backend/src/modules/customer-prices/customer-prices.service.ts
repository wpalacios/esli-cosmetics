import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateCustomerPriceDto } from "./dto/create-customer-price.dto";
import { CustomerPriceDto } from "./dto/customer-price.dto";
import { PaginatedCustomerPricesDto } from "./dto/paginated-customer-prices.dto";
import { DeleteCustomerPriceResponseDto } from "./dto/delete-customer-price-response.dto";

@Injectable()
export class CustomerPricesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createCustomerPriceDto: CreateCustomerPriceDto,
    createdBy?: string
  ): Promise<CustomerPriceDto> {
    return await this.prisma.$transaction(async tx => {
      // Verify customer exists
      const customer = await tx.customer.findFirst({
        where: {
          id: createCustomerPriceDto.customerId,
          isDeleted: false,
        },
      });

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      // Verify price type exists
      const priceType = await tx.priceType.findFirst({
        where: {
          id: createCustomerPriceDto.priceTypeId,
          isDeleted: false,
        },
      });

      if (!priceType) {
        throw new NotFoundException("Price type not found");
      }

      // Check if the relationship already exists
      const existingCustomerPrice = await tx.customerPrice.findFirst({
        where: {
          customerId: createCustomerPriceDto.customerId,
          priceTypeId: createCustomerPriceDto.priceTypeId,
          isDeleted: false,
        },
      });

      if (existingCustomerPrice) {
        throw new ConflictException(
          "Customer price relationship already exists"
        );
      }

      // Create the customer price relationship
      const customerPrice = await tx.customerPrice.create({
        data: {
          customerId: createCustomerPriceDto.customerId,
          priceTypeId: createCustomerPriceDto.priceTypeId,
          createdBy: createdBy || null,
        },
        include: {
          customer: {
            include: {
              person: true,
            },
          },
          priceType: true,
        },
      });

      return this.mapToDto(customerPrice);
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    customerId?: string,
    priceTypeId?: string
  ): Promise<PaginatedCustomerPricesDto> {
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (priceTypeId) {
      where.priceTypeId = priceTypeId;
    }

    const [customerPrices, total] = await Promise.all([
      this.prisma.customerPrice.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            include: {
              person: true,
            },
          },
          priceType: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      this.prisma.customerPrice.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: customerPrices.map(this.mapToDto),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findOne(id: string): Promise<CustomerPriceDto> {
    const customerPrice = await this.prisma.customerPrice.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        customer: {
          include: {
            person: true,
          },
        },
        priceType: true,
      },
    });

    if (!customerPrice) {
      throw new NotFoundException("Customer price not found");
    }

    return this.mapToDto(customerPrice);
  }

  async findByCustomerId(customerId: string): Promise<CustomerPriceDto[]> {
    const customerPrices = await this.prisma.customerPrice.findMany({
      where: {
        customerId,
        isDeleted: false,
      },
      include: {
        customer: {
          include: {
            person: true,
          },
        },
        priceType: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return customerPrices.map(this.mapToDto);
  }

  async remove(id: string): Promise<DeleteCustomerPriceResponseDto> {
    const customerPrice = await this.prisma.customerPrice.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!customerPrice) {
      throw new NotFoundException("Customer price not found");
    }

    await this.prisma.customerPrice.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return {
      message: "Customer price deleted successfully",
      id,
    };
  }

  async removeByCustomerAndPriceType(
    customerId: string,
    priceTypeId: string
  ): Promise<DeleteCustomerPriceResponseDto> {
    const customerPrice = await this.prisma.customerPrice.findFirst({
      where: {
        customerId,
        priceTypeId,
        isDeleted: false,
      },
    });

    if (!customerPrice) {
      throw new NotFoundException("Customer price relationship not found");
    }

    await this.prisma.customerPrice.update({
      where: { id: customerPrice.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return {
      message: "Customer price deleted successfully",
      id: customerPrice.id,
    };
  }

  async bulkCreate(
    customerId: string,
    priceTypeIds: string[],
    createdBy?: string
  ): Promise<CustomerPriceDto[]> {
    return await this.prisma.$transaction(async tx => {
      // Verify customer exists
      const customer = await tx.customer.findFirst({
        where: {
          id: customerId,
          isDeleted: false,
        },
      });

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      // Verify all price types exist
      const priceTypes = await tx.priceType.findMany({
        where: {
          id: { in: priceTypeIds },
          isDeleted: false,
        },
      });

      if (priceTypes.length !== priceTypeIds.length) {
        throw new BadRequestException("One or more price types not found");
      }

      // Check for existing relationships
      const existingRelations = await tx.customerPrice.findMany({
        where: {
          customerId,
          priceTypeId: { in: priceTypeIds },
          isDeleted: false,
        },
      });

      if (existingRelations.length > 0) {
        throw new ConflictException(
          "One or more customer price relationships already exist"
        );
      }

      // Create all relationships
      const customerPrices = await Promise.all(
        priceTypeIds.map(priceTypeId =>
          tx.customerPrice.create({
            data: {
              customerId,
              priceTypeId,
              createdBy: createdBy || null,
            },
            include: {
              customer: {
                include: {
                  person: true,
                },
              },
              priceType: true,
            },
          })
        )
      );

      return customerPrices.map(this.mapToDto);
    });
  }

  async bulkUpdate(
    customerId: string,
    priceTypeIds: string[],
    createdBy?: string
  ): Promise<CustomerPriceDto[]> {
    return await this.prisma.$transaction(async tx => {
      // Verify customer exists
      const customer = await tx.customer.findFirst({
        where: {
          id: customerId,
          isDeleted: false,
        },
      });

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      // Soft delete existing relationships
      await tx.customerPrice.updateMany({
        where: {
          customerId,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // If no price types provided, just return empty array
      if (!priceTypeIds || priceTypeIds.length === 0) {
        return [];
      }

      // Verify all price types exist
      const priceTypes = await tx.priceType.findMany({
        where: {
          id: { in: priceTypeIds },
          isDeleted: false,
        },
      });

      if (priceTypes.length !== priceTypeIds.length) {
        throw new BadRequestException("One or more price types not found");
      }

      // Create new relationships
      const customerPrices = await Promise.all(
        priceTypeIds.map(priceTypeId =>
          tx.customerPrice.create({
            data: {
              customerId,
              priceTypeId,
              createdBy: createdBy || null,
            },
            include: {
              customer: {
                include: {
                  person: true,
                },
              },
              priceType: true,
            },
          })
        )
      );

      return customerPrices.map(this.mapToDto);
    });
  }

  private mapToDto(customerPrice: any): CustomerPriceDto {
    return {
      id: customerPrice.id,
      customerId: customerPrice.customerId,
      priceTypeId: customerPrice.priceTypeId,
      createdBy: customerPrice.createdBy,
      createdAt: customerPrice.createdAt,
      isDeleted: customerPrice.isDeleted,
      deletedAt: customerPrice.deletedAt,
      customer: customerPrice.customer,
      priceType: customerPrice.priceType,
    };
  }
}
