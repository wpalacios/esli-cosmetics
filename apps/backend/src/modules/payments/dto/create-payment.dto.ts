import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PaymentType } from "@prisma/client";

export class CreatePaymentDto {
  @ApiProperty({
    description: "Payment type",
    example: "CASH",
    enum: PaymentType,
  })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiPropertyOptional({
    description: "Payment provider (for cards)",
    example: "VISA",
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({
    description: "Payment amount",
    example: 100.0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    description: "Transaction reference",
    example: "TXN123456",
  })
  @IsOptional()
  @IsString()
  transactionReference?: string;
}
