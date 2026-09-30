import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCustomerTypeDto {
  @ApiProperty({
    description: "Name of the customer type",
    example: "mayorista",
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: "Description of the customer type",
    example: "Cliente mayorista con descuentos especiales por volumen",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: "Customer type active status",
    example: "true",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
