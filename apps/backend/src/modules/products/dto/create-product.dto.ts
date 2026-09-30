import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  IsBoolean,
  IsNumber,
  IsObject,
  ValidateNested,
  IsArray,
  IsInt,
  Min,
  IsEnum,
  IsDate,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { ProductType } from "@prisma/client";

export class ProductKitItemDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ description: "ID of the variant included in the kit" })
  productVariantId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ApiProperty({
    description: "Quantity of this variant in the kit",
    example: 1,
  })
  quantity: number;
}

class VariantPriceDto {
  @IsNotEmpty()
  @IsUUID()
  priceTypeId: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minQuantity?: number;
}

class DefaultVariantDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  costPrice: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantPriceDto)
  prices?: VariantPriceDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minimumStock?: number | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maximumStock?: number | null;

  @IsOptional()
  @IsBoolean()
  appliesToDiscounts?: boolean | null;

  @ApiPropertyOptional({
    description: "Product must be sold in multiples of this number",
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
  multiple?: number | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any> | null;
}

export class CreateProductDto {
  @ApiProperty({
    description: "Product display name",
    example: "Cajita Emprendedora",
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: "Product type (STANDARD or KIT)",
    enum: ProductType,
    default: ProductType.STANDARD,
  })
  @IsNotEmpty()
  @IsEnum(ProductType)
  type: ProductType;

  @ApiPropertyOptional({
    description: "Stock Keeping Unit",
    example: "SKU12345",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiProperty({ description: "Product barcode", example: "0123456789123" })
  @IsNotEmpty({ message: "Barcode is required" })
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @ApiPropertyOptional({ description: "Product description" })
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @ValidateIf(
    o =>
      o.categoryId !== undefined && o.categoryId !== null && o.categoryId !== ""
  )
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  taxId?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  defaultVariantOnly?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DefaultVariantDto)
  defaultVariant?: DefaultVariantDto;

  @ApiPropertyOptional({
    description: "Expiration date for the product (kits)",
    example: "2026-12-31T23:59:59.000Z",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expirationDate?: Date | null;

  @ApiPropertyOptional({
    type: () => [ProductKitItemDto],
    description: "Kit items (only for products of type KIT)",
  })
  @IsOptional()
  @ValidateIf(o => o.type === ProductType.KIT)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductKitItemDto)
  kitItems?: ProductKitItemDto[];
}
