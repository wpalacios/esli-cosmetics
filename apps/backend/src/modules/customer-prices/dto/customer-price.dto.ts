import { ApiProperty } from "@nestjs/swagger";

export class CustomerPriceDto {
  @ApiProperty({
    description: "Customer price ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  customerId: string;

  @ApiProperty({
    description: "Price type ID",
    example: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  })
  priceTypeId: string;

  @ApiProperty({
    description: "Created by user ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  createdBy: string | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2023-12-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Soft delete flag",
    example: false,
  })
  isDeleted: boolean;

  @ApiProperty({
    description: "Deletion timestamp",
    example: null,
  })
  deletedAt: Date | null;

  @ApiProperty({
    description: "Customer information",
    type: "object",
    additionalProperties: true,
  })
  customer?: any;

  @ApiProperty({
    description: "Price type information",
    type: "object",
    additionalProperties: true,
  })
  priceType?: any;
}
