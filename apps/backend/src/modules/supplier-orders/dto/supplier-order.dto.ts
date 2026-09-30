import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsUUID, IsNumber } from "class-validator";

// Products provided by supplier in supplier order
export class SupplierProductDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsString()
  productName: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productVariantId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  productVariantName?: string;

  @ApiProperty()
  @IsUUID()
  brandId: string;

  @ApiProperty()
  @IsString()
  brandName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplierSku?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  purchasePrice?: string;
}

// Product items in supplier order
export class PurchaseOrderItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsUUID()
  productVariantId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  productVariantName?: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brandName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  unitCost?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lineTotal?: string;
}

// Purchase supplier order dto
export class PurchaseOrderDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  brandName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  total?: string;

  @ApiProperty({ type: [PurchaseOrderItemDto] })
  items: PurchaseOrderItemDto[];
}
