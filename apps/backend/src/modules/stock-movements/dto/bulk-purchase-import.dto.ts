import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

const MAX_ROWS_PER_REQUEST = 150;

export class BulkPurchaseImportLocationQuantityDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  locationId!: string;

  @ApiProperty({
    description: "Quantity to receive at this location",
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity!: number;
}

export class BulkPurchaseImportPriceDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  priceTypeId!: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;
}

export class BulkPurchaseImportRowDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  productVariantId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  productId!: string;

  @ApiProperty({ type: [BulkPurchaseImportLocationQuantityDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkPurchaseImportLocationQuantityDto)
  locationQuantities!: BulkPurchaseImportLocationQuantityDto[];

  @ApiProperty({ description: "Variant cost price (cost_price)" })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice!: number;

  @ApiProperty({ type: [BulkPurchaseImportPriceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPurchaseImportPriceDto)
  prices!: BulkPurchaseImportPriceDto[];
}

export class BulkPurchaseImportDto {
  @ApiProperty({ description: "If true, validate only; no writes" })
  @IsBoolean()
  dryRun!: boolean;

  @ApiProperty({ description: "Purchase reference (e.g. PO number)" })
  @IsString()
  reference!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: "0-based batch index for metadata" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  batchIndex?: number;

  @ApiPropertyOptional({ description: "Total batches for metadata" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  batchCount?: number;

  @ApiProperty({ type: [BulkPurchaseImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ROWS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => BulkPurchaseImportRowDto)
  rows!: BulkPurchaseImportRowDto[];
}
