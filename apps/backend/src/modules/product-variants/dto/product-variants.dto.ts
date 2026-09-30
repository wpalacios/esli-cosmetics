import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsInt,
  IsObject,
  IsDate,
  ValidateIf,
  IsArray,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { VariantPriceDto } from "./variant-prices-dto/variant-prices.dto";
import { ProductType } from "@prisma/client";

export class ProductVariantDto {
  @IsUUID()
  @ApiProperty({ description: "Product Variant ID (UUID)" })
  id: string;

  @IsUUID()
  @ApiProperty({ description: "Product Parent ID (Foreign Key)" })
  productId: string;

  @IsEnum(ProductType)
  @ApiProperty({
    description: "Type of the variant (inherited from parent product)",
    enum: ProductType,
    example: ProductType.STANDARD,
  })
  type: ProductType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: "Product variant SKU" })
  sku?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: "Barcode for product variant",
  })
  barcode?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: "Product variant name" })
  name?: string | null;

  @IsNumber()
  @ApiProperty({ description: "Cost price of product variant (Fixed)" })
  costPrice: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantPriceDto)
  @ApiProperty({
    description:
      "Array of price configurations for different Price Types (Ocasional, Emprendedor, Mayorista, etc.)",
    type: [VariantPriceDto],
    example: [
      {
        priceTypeId: "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
        price: 150.0,
        minQuantity: 1,
      },
      {
        priceTypeId: "b2c3d4e5-f6a7-8901-bcde-f0123456789a",
        price: 98.0,
        minQuantity: 10,
      },
    ],
  })
  prices: VariantPriceDto[];

  @ValidateIf((object, value) => value !== undefined)
  @IsInt()
  @ApiPropertyOptional({ description: "Product variant minimum stock" })
  minimumStock?: number | null;

  @ValidateIf((object, value) => value !== undefined)
  @IsInt()
  @ApiPropertyOptional({ description: "Product variant maximum stock" })
  maximumStock?: number | null;

  @ValidateIf((object, value) => value !== undefined)
  @IsInt()
  @ApiPropertyOptional({
    description:
      "Product must be sold in multiples of this number (e.g., 3 means product can only be sold in quantities of 3, 6, 9, etc.)",
    example: 3,
  })
  multiple?: number | null;

  @ApiPropertyOptional({
    description:
      "Indicates whether the variant applies to discounts (default: true)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  appliesToDiscounts?: boolean;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description:
      "Custom attributes of the product variant (e.g., color, size, etc.)",
    example: { color: "red", size: "M" },
  })
  attributes?: Record<string, any> | null;

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

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isActive: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isDeleted: boolean;

  @IsDate()
  @ApiProperty()
  createdAt: Date;

  @IsDate()
  @ApiProperty()
  updatedAt: Date;

  @ValidateIf((object, value) => value !== undefined)
  @IsDate()
  @ApiPropertyOptional()
  deletedAt?: Date | null;

  @IsOptional()
  @IsArray()
  @ApiPropertyOptional({
    description:
      "Variant-level images. If empty, use product images for display.",
  })
  images?: Array<{
    id: string;
    url: string;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: Date;
  }>;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: "Primary image URL (from variant images or product fallback).",
  })
  primaryImageUrl?: string | null;
}
