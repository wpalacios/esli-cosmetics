import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CategoryDto {
  @IsString()
  @ApiProperty()
  id: string;

  @IsString()
  @ApiProperty()
  name: string;

  @IsString()
  @ApiProperty()
  slug: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  description?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty()
  parentId?: string | null;

  @ApiProperty({
    type: () => Object,
    nullable: true,
    description: "Parent category object",
  })
  parent?: {
    id: string;
    name: string;
    slug?: string;
  } | null;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isDeleted?: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
