import { ApiProperty } from "@nestjs/swagger";
import {
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsEnum,
} from "class-validator";

export enum CashMovementTypeEnum {
  IN = "IN",
  OUT = "OUT",
}

export class CreateCashMovementDto {
  @ApiProperty({
    description: "Cash session ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  cashSessionId: string;

  @ApiProperty({
    description: "Movement type",
    enum: CashMovementTypeEnum,
    example: CashMovementTypeEnum.IN,
  })
  @IsEnum(CashMovementTypeEnum)
  type: CashMovementTypeEnum;

  @ApiProperty({
    description: "Amount",
    example: 50.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: "Reason for the movement",
    example: "Cash deposit for change",
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: "Reference order ID (if related to an order)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  referenceOrderId?: string;
}
