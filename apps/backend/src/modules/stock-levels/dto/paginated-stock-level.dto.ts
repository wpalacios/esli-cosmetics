import { ApiProperty } from "@nestjs/swagger";
import { StockLevelDto } from "./stock-level.dto";

class PaginationMetaDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNext: boolean;

  @ApiProperty()
  hasPrev: boolean;
}

export class PaginatedStockLevelDto {
  @ApiProperty({ type: [StockLevelDto] })
  data: StockLevelDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
