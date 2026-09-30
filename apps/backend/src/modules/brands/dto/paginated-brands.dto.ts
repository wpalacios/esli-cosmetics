import { ApiProperty } from "@nestjs/swagger";
import { BrandDto } from "./brand.dto";

export class PaginationMetaDto {
  @ApiProperty({
    description: "Current page number",
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: "Number of items per page",
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: "Total number of items",
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: "Total number of pages",
    example: 10,
  })
  total_pages: number;

  @ApiProperty({
    description: "Whether there is a next page",
    example: true,
  })
  has_next: boolean;

  @ApiProperty({
    description: "Whether there is a previous page",
    example: false,
  })
  has_prev: boolean;
}

export class PaginatedBrandsDto {
  @ApiProperty({
    description: "Array of brands",
    type: [BrandDto],
  })
  data: BrandDto[];

  @ApiProperty({
    description: "Pagination metadata",
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}
