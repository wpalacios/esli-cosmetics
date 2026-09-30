import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsUUID, IsBoolean } from "class-validator";

export class CreateCashRegisterDto {
  @ApiProperty({
    description: "Location ID where the cash register is located",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiProperty({
    description: "Cash register name",
    example: "Main Register 1",
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Cash register code",
    example: "REG-001",
    required: false,
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: "Whether the cash register is active",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
