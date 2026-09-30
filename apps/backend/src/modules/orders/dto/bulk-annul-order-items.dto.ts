import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { RefundMethod } from "./annul-order-item.dto";

export class BulkAnnulOrderItemDto {
  @ApiProperty({
    description: "Order item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  orderItemId: string;

  @ApiProperty({
    description: "Quantity to annul",
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class BulkAnnulOrderItemsDto {
  @ApiProperty({
    description: "Array of items to annul with their quantities",
    type: [BulkAnnulOrderItemDto],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: "At least one item must be selected for annulment",
  })
  @ValidateNested({ each: true })
  @Type(() => BulkAnnulOrderItemDto)
  items: BulkAnnulOrderItemDto[];

  @ApiProperty({
    description: "Reason for bulk annulment",
    example: "Customer returned multiple items",
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: "Refund method (for cash orders only)",
    example: "CASH",
    enum: RefundMethod,
    default: RefundMethod.NONE,
    required: false,
  })
  @IsOptional()
  @IsEnum(RefundMethod)
  refundMethod?: RefundMethod;
}
