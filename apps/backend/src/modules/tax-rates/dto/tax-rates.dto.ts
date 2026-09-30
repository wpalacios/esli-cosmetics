import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class TaxRateDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string | null;

  // Precision handled at DB layer. Accept numeric value in DTO.
  @ApiPropertyOptional({ type: "number", format: "decimal" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "rate must be a number" })
  @Min(0)
  rate?: number | null;

  @ApiProperty({ default: true })
  @IsBoolean()
  active!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @ApiProperty()
  @IsDateString()
  createdAt!: string;

  @ApiProperty()
  @IsDateString()
  updatedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deletedAt?: string | null;
}

export class CreateTaxRateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ type: "number", format: "decimal" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "rate must be a number" })
  @Min(0)
  rate?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateTaxRateDto extends PartialType(CreateTaxRateDto) {}
