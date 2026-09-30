import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ReversePaymentDto {
  @ApiProperty({
    description: "Reason for reversal",
    example: "Payment registered to wrong customer account",
  })
  @IsString()
  @MinLength(5)
  reason: string;
}
