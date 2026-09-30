import { ApiProperty } from "@nestjs/swagger";
import { StockMovementDto } from "./stock-movement.dto";

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

export class PaginatedStockMovementDto {
  @ApiProperty({ type: [StockMovementDto] })
  data: StockMovementDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
