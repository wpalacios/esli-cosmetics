import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class CreateCustomerPriceDto {
  @ApiProperty({
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID("4", { message: "CustomerId must be a valid UUID." })
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: "Price type ID",
    example: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  })
  @IsUUID("4", { message: "PriceTypeId must be a valid UUID." })
  @IsNotEmpty()
  priceTypeId: string;
}
