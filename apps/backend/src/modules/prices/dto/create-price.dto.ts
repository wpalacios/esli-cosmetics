import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean,
  Min,
  IsInt,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
export class CreatePriceDto {
  @ApiProperty({
    description: "Name of the price type",
    example: "Retail",
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: "Description of the price type",
    example: "Standard retail price",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsInt()
  @Min(1)
  @ApiProperty({
    description: "Minimum quantity reference for this price type",
    example: 100,
  })
  minQuantity: number;

  @IsInt()
  @Min(1)
  @ApiProperty({
    description: "Priority level (1 being highest priority)",
    example: 1,
  })
  priority: number;

  @ApiPropertyOptional({
    description: "Price active status",
    example: "true",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
