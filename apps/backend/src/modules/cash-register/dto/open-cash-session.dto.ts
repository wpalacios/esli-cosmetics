import { ApiProperty } from "@nestjs/swagger";
import {
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
} from "class-validator";

export class OpenCashSessionDto {
  @ApiProperty({
    description: "Cash register ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  cashRegisterId: string;

  @ApiProperty({
    description: "Opening balance (cash in register at start)",
    example: 100.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  openingBalance: number;

  @ApiProperty({
    description:
      "Employee ID (optional, will use authenticated user employee if not provided)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiProperty({
    description:
      "Opening datetime in ISO 8601 format with timezone (optional, defaults to server time)",
    example: "2024-01-15T10:30:00-05:00",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  openedAt?: string;
}
