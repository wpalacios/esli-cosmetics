import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateDiscountCodeDto } from "./dto/create-discount-code.dto";
import { UpdateDiscountCodeDto } from "./dto/update-discount-code.dto";
import { DiscountCodeDto } from "./dto/discount-code.dto";
import { PaginatedDiscountCodesDto } from "./dto/paginated-discount-codes.dto";
import { DeleteDiscountCodeResponseDto } from "./dto/delete-discount-code-response.dto";

@Injectable()
export class DiscountCodesService {
  constructor(private prisma: PrismaService) {}

  private async validateIfCodeExists(code: string): Promise<void> {
    const existingCode = await this.prisma.discountCode.findFirst({
      where: {
        code,
      },
    });

    if (existingCode && !existingCode.isDeleted) {
      throw new BadRequestException(
        "Discount code with this code already exists"
      );
    } else if (existingCode?.isDeleted) {
      // hard-delete the discount code, user will not be able to recover it
      await this.prisma.discountCode.delete({
        where: { id: existingCode.id },
      });
    }
  }

  async create(
    createDiscountCodeDto: CreateDiscountCodeDto
  ): Promise<DiscountCodeDto> {
    const normalizedCode = createDiscountCodeDto.code.trim().toUpperCase();

    const existingCode = await this.prisma.discountCode.findFirst({
      where: {
        code: {
          equals: normalizedCode,
          mode: "insensitive",
        },
        isDeleted: false,
      },
    });

    if (existingCode) {
      throw new ConflictException("Discount code already exists");
    }

    const discountCode = await this.prisma.discountCode.create({
      data: {
        code: normalizedCode,
        name: createDiscountCodeDto.name?.trim(),
        discountType: createDiscountCodeDto.discountType,
        value: createDiscountCodeDto.value,
        minPurchase: createDiscountCodeDto.minPurchase,
        maxDiscount: createDiscountCodeDto.maxDiscount,
        usageLimit: createDiscountCodeDto.usageLimit,
        startDate: createDiscountCodeDto.startDate
          ? new Date(createDiscountCodeDto.startDate)
          : undefined,
        endDate: createDiscountCodeDto.endDate
          ? new Date(createDiscountCodeDto.endDate)
          : undefined,
        isActive: createDiscountCodeDto.isActive ?? true,
      },
    });

    return this.mapToDiscountCodeDto(discountCode);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedDiscountCodesDto> {
    const skip = (page - 1) * limit;

    // Build where clause for search
    const whereClause: any = {
      isDeleted: false,
    };

    if (search) {
      whereClause.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await this.prisma.discountCode.count({
      where: whereClause,
    });

    // Get discount codes with pagination
    const discountCodes = await this.prisma.discountCode.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: discountCodes.map(code => this.mapToDiscountCodeDto(code)),
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

  async findOne(id: string): Promise<DiscountCodeDto> {
    const discountCode = await this.prisma.discountCode.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!discountCode) {
      throw new NotFoundException("Discount code not found");
    }

    return this.mapToDiscountCodeDto(discountCode);
  }

  async update(
    id: string,
    updateDiscountCodeDto: UpdateDiscountCodeDto
  ): Promise<DiscountCodeDto> {
    const existingRecord = await this.prisma.discountCode.findFirst({
      where: { id, isDeleted: false },
    });

    if (!existingRecord) {
      throw new NotFoundException("Discount code not found");
    }

    const normalizedCode = updateDiscountCodeDto.code
      ? updateDiscountCodeDto.code.trim().toUpperCase()
      : undefined;

    if (normalizedCode && normalizedCode !== existingRecord.code) {
      const duplicate = await this.prisma.discountCode.findFirst({
        where: {
          code: {
            equals: normalizedCode,
            mode: "insensitive",
          },
          isDeleted: false,
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException("Discount code already exists");
      }
    }

    const updateData: any = {};

    if (normalizedCode) updateData.code = normalizedCode;
    if (updateDiscountCodeDto.name !== undefined)
      updateData.name = updateDiscountCodeDto.name.trim();
    if (updateDiscountCodeDto.discountType !== undefined)
      updateData.discountType = updateDiscountCodeDto.discountType;
    if (updateDiscountCodeDto.value !== undefined)
      updateData.value = updateDiscountCodeDto.value;
    if (updateDiscountCodeDto.minPurchase !== undefined)
      updateData.minPurchase = updateDiscountCodeDto.minPurchase;
    if (updateDiscountCodeDto.maxDiscount !== undefined)
      updateData.maxDiscount = updateDiscountCodeDto.maxDiscount;
    if (updateDiscountCodeDto.usageLimit !== undefined)
      updateData.usageLimit = updateDiscountCodeDto.usageLimit;

    if (updateDiscountCodeDto.startDate !== undefined) {
      updateData.startDate = updateDiscountCodeDto.startDate
        ? new Date(updateDiscountCodeDto.startDate)
        : null;
    }
    if (updateDiscountCodeDto.endDate !== undefined) {
      updateData.endDate = updateDiscountCodeDto.endDate
        ? new Date(updateDiscountCodeDto.endDate)
        : null;
    }
    if (updateDiscountCodeDto.isActive !== undefined) {
      updateData.isActive = updateDiscountCodeDto.isActive;
    }

    const updatedCode = await this.prisma.discountCode.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    return this.mapToDiscountCodeDto(updatedCode);
  }

  async remove(id: string): Promise<DeleteDiscountCodeResponseDto> {
    // Check if discount code exists
    const existingCode = await this.prisma.discountCode.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingCode) {
      throw new NotFoundException("Discount code not found");
    }

    // Check if discount code has associated customer discount codes
    const associatedCustomerCodes =
      await this.prisma.customerDiscountCode.count({
        where: {
          discountCodeId: id,
          isDeleted: false,
        },
      });

    if (associatedCustomerCodes > 0) {
      // If there are customer codes, just mark as deleted
      await this.prisma.discountCode.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false, // Also deactivate
        },
      });

      return {
        success: true,
        message: "Discount code deactivated and marked for deletion",
        id,
      };
    }

    // If no associated customer codes, we can soft delete safely
    await this.prisma.discountCode.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return {
      success: true,
      message: "Discount code deleted successfully",
      id,
    };
  }

  /**
   * Validate a discount code for POS usage
   */
  async validateCode(
    code: string,
    customerId?: string,
    orderAmount?: number
  ): Promise<any> {
    // Find the discount code
    const discountCode = await this.prisma.discountCode.findFirst({
      where: {
        code,
        isDeleted: false,
      },
      include: {
        customerDiscountCodes: customerId
          ? {
              where: {
                customerId,
                isDeleted: false,
              },
            }
          : undefined,
      },
    });

    if (!discountCode) {
      return {
        valid: false,
        message: "Discount code not found",
        discountCode: null,
        calculatedDiscount: 0,
      };
    }

    // Check if active
    if (!discountCode.isActive) {
      return {
        valid: false,
        message: "Discount code is not active",
        discountCode: null,
        calculatedDiscount: 0,
      };
    }

    // Check date validity
    const now = new Date();
    if (discountCode.startDate && new Date(discountCode.startDate) > now) {
      return {
        valid: false,
        message: "Discount code is not yet valid",
        discountCode: null,
        calculatedDiscount: 0,
      };
    }

    if (discountCode.endDate && new Date(discountCode.endDate) < now) {
      return {
        valid: false,
        message: "Discount code has expired",
        discountCode: null,
        calculatedDiscount: 0,
      };
    }

    // Check if discount code is assigned to customer
    if (customerId && discountCode.customerDiscountCodes.length === 0) {
      return {
        valid: false,
        message: "This discount code is not assigned to the customer",
        discountCode: null,
        calculatedDiscount: 0,
      };
    }

    // Check usage limit using CustomerDiscountCode.usageCount
    if (customerId && discountCode.usageLimit && discountCode.usageLimit > 0) {
      const customerDiscountCode = discountCode.customerDiscountCodes[0];
      if (customerDiscountCode) {
        const currentUsageCount = customerDiscountCode.usageCount || 0;
        if (currentUsageCount >= discountCode.usageLimit) {
          return {
            valid: false,
            message: "Discount code usage limit exceeded",
            discountCode: null,
            calculatedDiscount: 0,
          };
        }
      }
    }

    // Check minimum purchase
    if (
      orderAmount &&
      discountCode.minPurchase &&
      orderAmount < Number(discountCode.minPurchase)
    ) {
      return {
        valid: false,
        message: `Minimum purchase amount is $${Number(
          discountCode.minPurchase
        ).toFixed(2)}`,
        discountCode: null,
        calculatedDiscount: 0,
      };
    }

    // Calculate discount
    let calculatedDiscount = 0;
    if (orderAmount) {
      if (discountCode.discountType === "PERCENTAGE") {
        calculatedDiscount = (orderAmount * Number(discountCode.value)) / 100;
      } else {
        calculatedDiscount = Number(discountCode.value);
      }

      // Apply max discount if set
      if (
        discountCode.maxDiscount &&
        calculatedDiscount > Number(discountCode.maxDiscount)
      ) {
        calculatedDiscount = Number(discountCode.maxDiscount);
      }
    }

    return {
      valid: true,
      message: "Discount code is valid",
      discountCode: this.mapToDiscountCodeDto(discountCode),
      calculatedDiscount,
    };
  }

  private mapToDiscountCodeDto(discountCode: any): DiscountCodeDto {
    return {
      id: discountCode.id,
      code: discountCode.code,
      name: discountCode.name,
      discountType: discountCode.discountType,
      value: Number(discountCode.value),
      minPurchase: discountCode.minPurchase
        ? Number(discountCode.minPurchase)
        : undefined,
      maxDiscount: discountCode.maxDiscount
        ? Number(discountCode.maxDiscount)
        : undefined,
      usageLimit: discountCode.usageLimit,
      startDate: discountCode.startDate?.toISOString(),
      endDate: discountCode.endDate?.toISOString(),
      isActive: discountCode.isActive,
      createdAt: discountCode.createdAt.toISOString(),
      updatedAt: discountCode.updatedAt.toISOString(),
    };
  }
}
