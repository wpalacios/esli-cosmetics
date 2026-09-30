import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DiscountType } from "./create-discount-code.dto";

export class DiscountCodeDto {
  @ApiProperty({
    description: "Discount code ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Unique discount code",
    example: "ESLI10OFF",
  })
  code: string;

  @ApiPropertyOptional({
    description: "Discount code name",
    example: "10% Off Summer Sale",
  })
  name?: string;

  @ApiProperty({
    description: "Type of discount",
    enum: DiscountType,
    example: DiscountType.PERCENTAGE,
  })
  discountType: DiscountType;

  @ApiProperty({
    description: "Discount value",
    example: 10.0,
  })
  value: number;

  @ApiPropertyOptional({
    description: "Minimum purchase amount required",
    example: 50.0,
  })
  minPurchase?: number;

  @ApiPropertyOptional({
    description: "Maximum discount amount",
    example: 100.0,
  })
  maxDiscount?: number;

  @ApiPropertyOptional({
    description: "Usage limit per customer",
    example: 1,
  })
  usageLimit?: number;

  @ApiPropertyOptional({
    description: "Start date for the discount code",
    example: "2024-01-01T00:00:00Z",
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date for the discount code",
    example: "2024-12-31T23:59:59Z",
  })
  endDate?: string;

  @ApiProperty({
    description: "Whether the discount code is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2024-01-01T00:00:00Z",
  })
  createdAt: string;

  @ApiProperty({
    description: "Update timestamp",
    example: "2024-01-01T00:00:00Z",
  })
  updatedAt: string;
}
