import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export enum RefundMethod {
  CASH = "CASH",
  NONE = "NONE",
}

export class AnnulOrderItemDto {
  @ApiProperty({
    description: "Quantity to annul",
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: "Reason for annulment",
    example: "Customer returned item",
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: "Refund method",
    example: "CASH",
    enum: RefundMethod,
    default: RefundMethod.NONE,
    required: false,
  })
  @IsOptional()
  @IsEnum(RefundMethod)
  refundMethod?: RefundMethod;
}
