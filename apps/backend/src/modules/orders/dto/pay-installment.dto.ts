import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
} from "class-validator";

export class PayInstallmentDto {
  @ApiProperty({
    description: "Installment ID to pay",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsString()
  installmentId: string;

  @ApiProperty({
    description:
      "Payment amount (must be less than or equal to remaining amount)",
    example: 100.5,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: "Payment type",
    enum: ["CASH", "CARD", "TRANSFER"],
    example: "CASH",
  })
  @IsNotEmpty()
  @IsEnum(["CASH", "CARD", "TRANSFER"])
  paymentType: "CASH" | "CARD" | "TRANSFER";

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
