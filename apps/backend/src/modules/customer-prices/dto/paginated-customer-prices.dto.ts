import { ApiProperty } from "@nestjs/swagger";
import { CustomerPriceDto } from "./customer-price.dto";

export class PaginatedCustomerPricesDto {
  @ApiProperty({
    description: "Array of customer prices",
    type: [CustomerPriceDto],
  })
  data: CustomerPriceDto[];

  @ApiProperty({
    description: "Total number of customer prices",
    example: 100,
  })
  total: number;

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
    description: "Total number of pages",
    example: 10,
  })
  totalPages: number;

  @ApiProperty({
    description: "Whether there is a next page",
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: "Whether there is a previous page",
    example: false,
  })
  hasPrev: boolean;
}
