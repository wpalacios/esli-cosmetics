import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsObject,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { VariantPriceDto } from "./variant-prices-dto/variant-prices.dto";
import { ProductType } from "@prisma/client";

export class CreateProductVariantDto {
  @ApiPropertyOptional({
    description: "Type of the variant (STANDARD or KIT)",
    enum: ProductType,
    example: ProductType.STANDARD,
  })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({
    description: "Stock Keeping Unit (SKU) of the variant",
    example: "NIKEAIR-RED-08",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sku?: string;

  @ApiPropertyOptional({
    description: "Barcode of the variant",
    example: "1234567890123",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  barcode?: string;

  @ApiPropertyOptional({
    description: "Variant display name",
    example: "Nike Air Red Size 8",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsNotEmpty({ message: "Cost price is required" })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  costPrice: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantPriceDto)
  @ApiPropertyOptional({
    description: "Array of price configurations for this variant",
    type: [VariantPriceDto],
  })
  prices?: VariantPriceDto[];

  @ApiPropertyOptional({
    description: "Minimum stock allowed",
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  minimumStock?: number;

  @ApiPropertyOptional({
    description: "Maximum stock allowed",
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  maximumStock?: number;

  @ApiPropertyOptional({
    description:
      "Product must be sold in multiples of this number (e.g., 3 means product can only be sold in quantities of 3, 6, 9, etc.)",
    example: 3,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      Number.isNaN(Number(value))
    ) {
      return undefined;
    }
    return Number(value);
  })
  @IsInt()
  @Min(1)
  multiple?: number;

  @ApiPropertyOptional({
    description:
      "Indicates whether the variant applies to discounts (default: true)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  appliesToDiscounts?: boolean;

  @ApiPropertyOptional({
    description: "Custom attributes like color, size, material, etc.",
    example: { color: "Red", size: "8" },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description:
      "Metadata for product variant (e.g., kitItems for KIT type variants)",
    example: {
      kitItems: [
        { variantId: "a1b2c3d4-e5f6-7890-abcd-ef0123456789", quantity: 2 },
        { variantId: "b2c3d4e5-f6a7-8901-bcde-f0123456789a", quantity: 1 },
      ],
    },
  })
  metadata?: Record<string, any> | null;
}
