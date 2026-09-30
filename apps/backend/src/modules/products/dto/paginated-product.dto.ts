import { ApiProperty } from "@nestjs/swagger";
import { ProductsDto } from "./products.dto";

export class PaginatedProductDto {
  @ApiProperty({
    description: "Array of products",
    type: [ProductsDto],
  })
  data: ProductsDto[];

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
