import { ApiProperty } from "@nestjs/swagger";
import { CategoryDto } from "./category.dto";

export class PaginatedCategoryDto {
  @ApiProperty({
    description: "Array of categories",
    type: [CategoryDto],
  })
  data: CategoryDto[];

  @ApiProperty({
    description: "Pagination information",
    example: {
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
