import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StockLevelDto {
  @ApiProperty({ description: "Stock Level ID" })
  id: string;

  @ApiPropertyOptional({ description: "Product Variant ID" })
  productVariantId?: string | null;

  @ApiPropertyOptional({ description: "Product ID" })
  productId?: string | null;

  @ApiPropertyOptional({ description: "Location ID" })
  locationId?: string | null;

  @ApiProperty({ description: "Quantity in stock" })
  quantity: number;

  @ApiProperty({ description: "Reserved quantity" })
  reserved: number;

  @ApiProperty({ description: "Last updated timestamp" })
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Product Variant details" })
  productVariant?: any;

  @ApiPropertyOptional({ description: "Product details" })
  product?: any;

  @ApiPropertyOptional({ description: "Location details" })
  location?: any;
}

export class KitAvailabilityDto {
  @ApiProperty({
    description: "Kit product variant ID",
    example: "11111111-2222-3333-4444-555555555555",
  })
  kitVariantId: string;

  @ApiProperty({
    description: "The unique identifier of the location",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  locationId: string;

  @ApiProperty({
    description: "The name of the location",
    example: "Main Warehouse",
  })
  locationName: string;

  @ApiProperty({
    description:
      "Map of component product variant IDs to their available stock quantities in this location",
    example: {
      "a1b2c3d4-e5f6-4g7h-8i9j-k0l1m2n3o4p5": 25,
      "z9y8x7w6-v5u4-t3s2-r1q0-p9o8n7m6l5k4": 12,
    },
    additionalProperties: { type: "number" },
  })
  stocks: Record<string, number>;

  @ApiProperty({
    description:
      "Maximum number of kits that can be assembled at this location",
    example: 3,
    minimum: 0,
  })
  kitsAvailable: number;
}
