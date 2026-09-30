import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdatePurchaseOrderItemDto {
  @ApiPropertyOptional({ description: "Product variant ID" })
  @IsOptional()
  @IsString()
  productVariantId?: string;

  @ApiPropertyOptional({ description: "Brand ID" })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: "Quantity" })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({ description: "Unit cost" })
  @IsOptional()
  @IsNumber()
  unitCost?: number;
}

export class UpdateSupplierOrderDto {
  @ApiPropertyOptional({ description: "Supplier ID" })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: "Branch ID" })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: "Brand ID" })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: "Order status" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "Expected delivery date" })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({
    type: [UpdatePurchaseOrderItemDto],
    description: "Order items (Replaces existing list)",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseOrderItemDto)
  items?: UpdatePurchaseOrderItemDto[];
}
