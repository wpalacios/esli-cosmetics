import { ApiProperty } from "@nestjs/swagger";
import { PriceDto } from "./prices.dto";

export class PaginatedPricesDto {
  @ApiProperty({
    description: "Array of price types",
    type: [PriceDto],
  })
  data: PriceDto[];

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
