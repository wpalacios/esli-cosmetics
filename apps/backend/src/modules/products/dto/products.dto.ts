import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsObject,
  ValidateNested,
  IsArray,
  Min,
  IsInt,
} from "class-validator";
import { ProductType } from "@prisma/client";
import { CategoryDto } from "src/modules/categories/dto/category.dto";
import { ProductVariantDto } from "src/modules/product-variants/dto/product-variants.dto";
import { ProductImageDto } from "src/modules/product-images/dto/product-image.dto";

export class ProductKitItemDto {
  @IsUUID()
  @ApiProperty({ description: "ID of the variant included in the kit" })
  productVariantId: string;

  @IsInt()
  @Min(1)
  @ApiProperty({
    description: "Quantity of this variant in the kit",
    example: 1,
  })
  quantity: number;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ description: "Optional full variant object" })
  productVariant?: ProductVariantDto;
}

export class ProductsDto {
  @IsString()
  @ApiProperty()
  id: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  sku?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  barcode?: string;

  @IsString()
  @ApiProperty()
  name: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional()
  brandId?: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description: "Related Brand Object",
  })
  brand?: any;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional()
  categoryId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryDto)
  @ApiPropertyOptional({
    type: () => CategoryDto,
    description: "Related Category Object",
  })
  category?: CategoryDto | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @ApiPropertyOptional({
    type: () => [ProductVariantDto],
    description: "Product variants",
  })
  variants?: ProductVariantDto[];

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional()
  taxRateId?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isDeleted?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description:
      "Indicates if the product only has a default variant (no user-created variants)",
    example: false,
  })
  defaultVariantOnly?: boolean;

  @ApiProperty()
  readonly createdAt: Date;

  @ApiProperty()
  readonly updatedAt: Date;

  @ApiPropertyOptional()
  readonly deletedAt?: Date | null;

  @IsObject()
  @ApiProperty({ description: "Additional product metadata", example: {} })
  metadata: Record<string, any>;

  @IsOptional()
  @ApiPropertyOptional({ enum: ProductType, default: ProductType.STANDARD })
  type?: ProductType;

  @IsOptional()
  @ApiPropertyOptional()
  expirationDate?: Date | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductKitItemDto)
  @ApiPropertyOptional({
    type: () => [ProductKitItemDto],
    description: "Kit items (only for products of type KIT)",
  })
  kitItems?: ProductKitItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @ApiPropertyOptional({
    type: () => [ProductImageDto],
    description: "Product images (from Supabase Storage)",
  })
  images?: ProductImageDto[];

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: "URL of the primary/featured product image",
  })
  primaryImageUrl?: string;
}
