import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";

// --- CreatePurchaseOrderItem DTO ---
export class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: "Product variant ID" })
  @IsUUID()
  @IsNotEmpty()
  productVariantId: string;

  @ApiPropertyOptional({ description: "Brand ID" })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiProperty({ description: "Quantity to order" })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({ description: "Unit cost (optional override)" })
  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @ApiPropertyOptional({ description: "Line total (optional)" })
  @IsOptional()
  @IsNumber()
  lineTotal?: number;
}

// --- CreateSupplierOrder DTO ---
export class CreateSupplierOrderDto {
  @ApiProperty({ description: "Supplier ID" })
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiPropertyOptional({ description: "Branch ID (Destination)" })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Brand ID" })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional({ description: "Order status" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "LineTotal" })
  @IsOptional()
  @IsNumber()
  lineTotal?: number;

  @ApiPropertyOptional({ description: "Expected delivery date" })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({
    type: [CreatePurchaseOrderItemDto],
    description: "Items to order",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
