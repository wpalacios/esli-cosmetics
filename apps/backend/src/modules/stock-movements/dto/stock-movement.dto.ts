import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { StockMovementType } from "@prisma/client";

export class StockMovementDto {
  @ApiProperty({ description: "Stock Movement ID" })
  id: string;

  @ApiPropertyOptional({ description: "Product Variant ID" })
  productVariantId?: string | null;

  @ApiPropertyOptional({ description: "Product ID" })
  productId?: string | null;

  @ApiPropertyOptional({ description: "Source Location ID" })
  fromLocationId?: string | null;

  @ApiPropertyOptional({ description: "Destination Location ID" })
  toLocationId?: string | null;

  @ApiProperty({ description: "Type of movement", enum: StockMovementType })
  movementType: StockMovementType;

  @ApiProperty({ description: "Quantity moved" })
  quantity: number;

  @ApiPropertyOptional({ description: "Reference number" })
  reference?: string | null;

  @ApiPropertyOptional({ description: "User who created the movement" })
  createdBy?: string | null;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;

  @ApiPropertyOptional({ description: "Additional notes" })
  note?: string | null;

  @ApiPropertyOptional({ description: "Additional metadata" })
  metadata?: any;

  @ApiPropertyOptional({ description: "Product Variant details" })
  productVariant?: any;

  @ApiPropertyOptional({ description: "Product details" })
  product?: any;

  @ApiPropertyOptional({ description: "Source Location details" })
  fromLocation?: any;

  @ApiPropertyOptional({ description: "Destination Location details" })
  toLocation?: any;

  @ApiPropertyOptional({ description: "Creator details" })
  creator?: any;
}
