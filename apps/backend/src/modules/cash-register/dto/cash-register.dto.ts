import { ApiProperty } from "@nestjs/swagger";
import { CashSessionDto } from "./cash-session.dto";

export class CashRegisterDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false, nullable: true })
  locationId?: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  code?: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false, nullable: true })
  location?: {
    id: string;
    name: string;
    branchId?: string | null;
  } | null;

  @ApiProperty({ required: false, nullable: true, type: CashSessionDto })
  openSession?: CashSessionDto | null;

  @ApiProperty({ required: false, nullable: true })
  openSessionId?: string | null;
}
