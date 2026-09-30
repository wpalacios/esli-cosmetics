import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
}

export class CreateDiscountCodeDto {
  @ApiProperty({
    description: "Unique discount code",
    example: "ESLI10OFF",
    maxLength: 50,
  })
  @IsNotEmpty({ message: "Code is required" })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({
    description: "Discount code name",
    example: "10% Off Summer Sale",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: "Type of discount",
    enum: DiscountType,
    example: DiscountType.PERCENTAGE,
  })
  @IsNotEmpty({ message: "Discount type is required" })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({
    description: "Discount value (percentage or fixed amount)",
    example: 10.0,
  })
  @IsNotEmpty({ message: "Value is required" })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  value: number;

  @ApiPropertyOptional({
    description: "Minimum purchase amount required",
    example: 50.0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minPurchase?: number;

  @ApiPropertyOptional({
    description: "Maximum discount amount",
    example: 100.0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional({
    description: "Usage limit per customer",
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  usageLimit?: number;

  @ApiPropertyOptional({
    description: "Start date for the discount code",
    example: "2024-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date for the discount code",
    example: "2024-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Whether the discount code is active",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
