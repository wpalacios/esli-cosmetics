import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PaymentAllocationTargetType } from "@prisma/client";

export class ManualPaymentReversalEntryDto {
  @ApiProperty({
    enum: PaymentAllocationTargetType,
    example: PaymentAllocationTargetType.INSTALLMENT,
  })
  @IsEnum(PaymentAllocationTargetType)
  targetType: PaymentAllocationTargetType;

  @ApiProperty({
    description: "Credit installment id when targetType is INSTALLMENT",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  creditInstallmentId?: string;

  @ApiProperty({
    description: "Amount to reverse for this target",
    example: 25.0,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class ManualPaymentReversalDto {
  @ApiProperty({
    description: "Reason for manual accounting reversal",
    example: "Legacy payment without allocation details",
  })
  @IsString()
  @MinLength(5)
  reason: string;

  @ApiProperty({
    type: [ManualPaymentReversalEntryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualPaymentReversalEntryDto)
  entries: ManualPaymentReversalEntryDto[];
}
