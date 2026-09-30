import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  Min,
  IsInt,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateVariantPriceDto {
  @ApiProperty({
    description:
      "UUID of the Price Type (e.g., Ocasional, Emprendedor, Mayorista) from the PriceTypes table.",
    example: "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  })
  @IsNotEmpty({ message: "Price Type ID is required" })
  @IsUUID()
  priceTypeId: string;

  @ApiProperty({
    description: "Selling price for this variant and price type.",
    example: 150.0,
  })
  @IsNotEmpty({ message: "Price value is required" })
  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: "Price must be a valid number with at most 2 decimal places" }
  )
  @Type(() => Number)
  @Min(0, { message: "Price must be 0 or higher" })
  price: number;

  @ApiPropertyOptional({
    description:
      "Minimum quantity required for this price to apply (optional).",
    example: 10,
  })
  @IsOptional()
  @IsInt({ message: "Minimum quantity must be an integer" })
  @Type(() => Number)
  @Min(1, { message: "Minimum quantity must be at least 1" })
  minQuantity?: number;
}
