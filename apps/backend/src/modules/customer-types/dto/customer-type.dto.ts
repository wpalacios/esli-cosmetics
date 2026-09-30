import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsDate,
} from "class-validator";

export class CustomerTypeDto {
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
