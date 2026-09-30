import { ApiProperty } from "@nestjs/swagger";
import { CustomerTypeDto } from "./customer-type.dto";

export class PaginatedCustomerTypesDto {
  @ApiProperty({ type: [CustomerTypeDto] })
  data: CustomerTypeDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
