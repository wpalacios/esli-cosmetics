import { ApiProperty } from "@nestjs/swagger";
import { TaxRateDto } from "./tax-rates.dto";

export class PaginatedTaxRateDto {
  @ApiProperty({
    description: "Array of tax rates",
    type: [TaxRateDto],
  })
  data: TaxRateDto[];

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
