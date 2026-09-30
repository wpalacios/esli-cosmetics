import { ApiProperty } from "@nestjs/swagger";
import { CustomerDto } from "./customer.dto";

export class PaginatedCustomersDto {
  @ApiProperty({
    description: "Array of customers",
    type: [CustomerDto],
  })
  data: CustomerDto[];

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
