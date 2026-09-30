import { IsNotEmpty, IsOptional, IsUUID, IsNumber, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateStockLevelDto {
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

  @ApiProperty({
    description: "Location ID",
    example: "c7f5d3e9-8e3c-4f28-9c5a-1234567890ab",
  })
  @IsNotEmpty({ message: "Location ID is required" })
  @IsUUID()
  locationId: string;

  @ApiProperty({
    description: "Quantity in stock",
    example: 100,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity?: number;

  @ApiProperty({
    description: "Reserved quantity",
    example: 10,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reserved?: number;
}
