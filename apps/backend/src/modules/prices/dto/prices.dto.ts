import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsDate,
  IsInt,
  Min,
} from "class-validator";

export class PriceDto {
  @IsUUID()
  @ApiProperty()
  id: string;

  @IsString()
  @ApiProperty()
  name: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  description?: string | null;

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

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isDeleted?: boolean;

  @ApiProperty()
  @IsDate()
  readonly createdAt: Date;

  @ApiProperty()
  @IsDate()
  readonly updatedAt: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  readonly deletedAt?: Date | null;
}
