import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CustomerAddressDto {
  @ApiPropertyOptional({
    description: "Street / address line",
    example: "123 Main St",
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: "City where the customer lives",
    example: "San Salvador",
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: "Postal code",
    example: "1101",
  })
  @IsString()
  @IsOptional()
  postalCode?: string;
}
