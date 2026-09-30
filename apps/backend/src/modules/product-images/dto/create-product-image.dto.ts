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

export class CreateProductImageDto {
  @ApiProperty({
    description: "Public URL of the image (from Supabase Storage or other CDN)",
    example:
      "https://xxx.supabase.co/storage/v1/object/public/product-images/abc.jpg",
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  @MaxLength(1024)
  url: string;

  @ApiPropertyOptional({
    description: "Display order (lower first). Defaults to end of list.",
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({
    description:
      "Set as primary image. If true, other images for this product are set to non-primary.",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
