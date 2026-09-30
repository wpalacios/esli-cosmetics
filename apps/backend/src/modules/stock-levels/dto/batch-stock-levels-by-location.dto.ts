import { IsNotEmpty, IsUUID, IsArray, ArrayMinSize } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class BatchStockLevelsByLocationDto {
  @ApiProperty({
    description: "Array of product variant IDs",
    example: [
      "a7f5d3e9-8e3c-4f28-9c5a-1234567890ab",
      "b6f5d3e9-8e3c-4f28-9c5a-1234567890ab",
    ],
    type: [String],
  })
  @IsNotEmpty({ message: "Product variant IDs are required" })
  @IsArray({ message: "Product variant IDs must be an array" })
  @ArrayMinSize(1, { message: "At least one product variant ID is required" })
  @IsUUID(undefined, {
    each: true,
    message: "Each product variant ID must be a valid UUID",
  })
  productVariantIds: string[];

  @ApiProperty({
    description: "Location ID",
    example: "c7f5d3e9-8e3c-4f28-9c5a-1234567890ab",
  })
  @IsNotEmpty({ message: "Location ID is required" })
  @IsUUID()
  locationId: string;
}
