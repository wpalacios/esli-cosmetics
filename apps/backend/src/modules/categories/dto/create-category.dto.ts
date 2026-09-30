import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCategoryDto {
  @ApiProperty({
    description: "Category display name",
    example: "Create Category",
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: "Category Slug",
    example: "category-slug",
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: "Category description",
    example: "Allows creating new category in the system",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "ID of the parent category, if this is a nested category",
    example: "a7f5d3e9-8e3c-4f28",
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({
    description: "Category active status",
    example: "true",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
