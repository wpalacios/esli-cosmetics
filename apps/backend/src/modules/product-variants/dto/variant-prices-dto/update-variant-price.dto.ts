import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID, IsNumber, Min, IsInt, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class UpdateVariantPriceDto {
  @ApiPropertyOptional({
    description:
      "UUID of the Price Type (e.g., Ocasional, Emprendedor, Mayorista) from the PriceTypes table.",
    example: "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  })
  @IsOptional()
  @IsUUID()
  priceTypeId?: string;

  @ApiPropertyOptional({
    description: "Selling price for this variant and price type.",
    example: 150.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Price must be a valid number" })
  @Min(0, { message: "Price must be 0 or higher" })
  price?: number;

  @ApiPropertyOptional({
    description:
      "Minimum quantity required for this price to apply (optional).",
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Minimum quantity must be an integer" })
  @Min(1, { message: "Minimum quantity must be at least 1" })
  minQuantity?: number;
}
