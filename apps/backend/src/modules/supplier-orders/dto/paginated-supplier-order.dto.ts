import { ApiProperty } from "@nestjs/swagger";
import { PurchaseOrderDto } from "./supplier-order.dto";

export class PaginatedSupplierOrdersDto {
  @ApiProperty({
    description: "Array of supplier purchase orders",
    type: [PurchaseOrderDto],
  })
  data: PurchaseOrderDto[];

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
