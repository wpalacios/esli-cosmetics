import { ApiProperty } from "@nestjs/swagger";
import { BranchDto } from "./branch.dto";

export class PaginatedBranchesDto {
  @ApiProperty({
    description: "Array of branches",
    type: [BranchDto],
  })
  data: BranchDto[];

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
