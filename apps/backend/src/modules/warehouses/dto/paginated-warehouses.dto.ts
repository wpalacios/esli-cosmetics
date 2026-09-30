import { ApiProperty } from "@nestjs/swagger";
import { WarehouseDto } from "./warehouse.dto";

export class PaginatedWarehousesDto {
  @ApiProperty({
    description: "Array of warehouses",
    type: [WarehouseDto],
  })
  data: WarehouseDto[];

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
