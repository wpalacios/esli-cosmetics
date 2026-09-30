import { ApiProperty } from "@nestjs/swagger";

export class CashMovementDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cashSessionId: string;

  @ApiProperty({ enum: ["IN", "OUT"] })
  type: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ required: false, nullable: true })
  reason?: string | null;

  @ApiProperty({ required: false, nullable: true })
  referenceOrderId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  createdBy?: string | null;

  @ApiProperty()
  createdAt: Date;
}
