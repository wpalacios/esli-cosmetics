import { ApiProperty } from "@nestjs/swagger";
import { DiscountCodeDto } from "./discount-code.dto";

class PaginationMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 10 })
  total_pages: number;

  @ApiProperty({ example: true })
  has_next: boolean;

  @ApiProperty({ example: false })
  has_prev: boolean;
}

export class PaginatedDiscountCodesDto {
  @ApiProperty({ type: [DiscountCodeDto] })
  data: DiscountCodeDto[];

  @ApiProperty({ type: PaginationMeta })
  pagination: PaginationMeta;
}
