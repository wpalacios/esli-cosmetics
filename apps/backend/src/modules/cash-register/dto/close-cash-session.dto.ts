import { ApiProperty } from "@nestjs/swagger";
import {
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsDateString,
  IsUUID,
} from "class-validator";

export class CloseCashSessionDto {
  @ApiProperty({
    description: "Closing balance (actual physical cash in register)",
    example: 150.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  closingBalance: number;

  @ApiProperty({
    description: "Notes about the closing",
    example: "All transactions verified",
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description:
      "Closing datetime in ISO 8601 format with timezone (optional, defaults to server time)",
    example: "2024-01-15T18:00:00-05:00",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  closedAt?: string;
  @ApiProperty({
    description: "Employee ID who closes the session (admin or cashier)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  closedById?: string;
}
