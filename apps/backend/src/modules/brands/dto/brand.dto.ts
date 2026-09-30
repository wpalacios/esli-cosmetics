import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BrandDto {
  @ApiProperty({
    description: "Brand ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Brand name",
    example: "L'Oréal",
  })
  name: string;

  @ApiPropertyOptional({
    description: "Brand description",
    example: "Leading beauty brand offering cosmetics and skincare products",
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Brand website URL",
    example: "https://www.loreal.com",
  })
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: "Brand logo URL",
    example: "https://example.com/logo.png",
  })
  logoUrl?: string;

  @ApiPropertyOptional({
    description: "Brand country of origin",
    example: "France",
  })
  country?: string;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2023-01-01T00:00:00.000Z",
  })
  createdAt: string;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2023-01-01T00:00:00.000Z",
  })
  updatedAt: string;

  @ApiProperty({
    description: "Soft delete flag",
    example: false,
  })
  isDeleted: boolean;

  @ApiPropertyOptional({
    description: "Soft delete timestamp",
    example: null,
  })
  deletedAt?: string;
}
