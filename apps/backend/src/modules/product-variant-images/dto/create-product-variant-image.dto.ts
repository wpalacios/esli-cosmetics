import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateProductVariantImageDto {
  @ApiProperty({ description: "Public URL of the image" })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  @MaxLength(1024)
  url: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
