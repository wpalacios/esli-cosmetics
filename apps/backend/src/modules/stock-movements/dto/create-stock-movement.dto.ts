import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  IsString,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { StockMovementType } from "@prisma/client";

export class CreateStockMovementDto {
  @ApiPropertyOptional({
    description: "Product Variant ID",
    example: "a7f5d3e9-8e3c-4f28-9c5a-1234567890ab",
  })
  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @ApiPropertyOptional({
    description: "Product ID",
    example: "b6f5d3e9-8e3c-4f28-9c5a-1234567890ab",
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: "Source Location ID",
    example: "c7f5d3e9-8e3c-4f28-9c5a-1234567890ab",
  })
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiPropertyOptional({
    description: "Destination Location ID",
    example: "d7f5d3e9-8e3c-4f28-9c5a-1234567890ab",
  })
  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @ApiProperty({
    description: "Type of stock movement",
    enum: StockMovementType,
    example: StockMovementType.SALE,
  })
  @IsNotEmpty({ message: "Movement type is required" })
  @IsEnum(StockMovementType)
  movementType: StockMovementType;

  @ApiProperty({
    description: "Quantity moved",
    example: 10,
  })
  @IsNotEmpty({ message: "Quantity is required" })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({
    description: "Reference number or code",
    example: "PO-2024-001",
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: "Additional notes",
    example: "Restocking from supplier",
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: "Additional metadata",
    example: { reason: "damage" },
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Stock Transfer ID (for transfer-related movements)",
    example: "e7f5d3e9-8e3c-4f28-9c5a-1234567890ab",
  })
  @IsOptional()
  @IsUUID()
  transferId?: string;
}
