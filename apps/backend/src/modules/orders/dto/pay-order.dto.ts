import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class PaymentItemDto {
  @ApiProperty({
    description: "Payment type",
    enum: ["CASH", "CARD", "TRANSFER"],
    example: "CASH",
  })
  @IsNotEmpty()
  @IsEnum(["CASH", "CARD", "TRANSFER"])
  paymentType: "CASH" | "CARD" | "TRANSFER";

  @ApiProperty({
    description: "Payment amount",
    example: 100.5,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: "Payment provider (optional, for CARD payments)",
    example: "Visa",
    required: false,
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({
    description: "Transaction reference (optional)",
    example: "TXN-123456",
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionReference?: string;
}

export class PayOrderDto {
  @ApiProperty({
    description: "List of payments",
    type: [PaymentItemDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  payments: PaymentItemDto[];
}
