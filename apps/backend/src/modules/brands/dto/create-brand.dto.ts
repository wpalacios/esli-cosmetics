import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  IsNotEmpty,
} from "class-validator";

export class CreateBrandDto {
  @ApiProperty({
    description: "Brand name",
    example: "L'Oréal",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: "Brand description",
    example: "Leading beauty brand offering cosmetics and skincare products",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: "Brand website URL",
    example: "https://www.loreal.com",
    maxLength: 255,
  })
  @IsUrl()
  @IsOptional()
  @MaxLength(255)
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: "Brand logo URL",
    example: "https://example.com/logo.png",
    maxLength: 255,
  })
  @IsUrl()
  @IsOptional()
  @MaxLength(255)
  logoUrl?: string;

  @ApiPropertyOptional({
    description: "Brand country of origin",
    example: "France",
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  country?: string;
}
