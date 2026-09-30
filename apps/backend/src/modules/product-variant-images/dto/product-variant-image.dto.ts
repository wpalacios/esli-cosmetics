import { ApiProperty } from "@nestjs/swagger";

export class ProductVariantImageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productVariantId: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: false })
  isPrimary: boolean;

  @ApiProperty()
  createdAt: Date;
}
