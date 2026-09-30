import { ApiProperty } from "@nestjs/swagger";

export class ProductImageDto {
  @ApiProperty({ description: "Image ID" })
  id: string;

  @ApiProperty({ description: "Product ID" })
  productId: string;

  @ApiProperty({
    description: "Public URL of the image (e.g. Supabase Storage)",
  })
  url: string;

  @ApiProperty({ description: "Display order (lower first)", example: 0 })
  sortOrder: number;

  @ApiProperty({
    description: "Whether this is the primary/featured image",
    example: false,
  })
  isPrimary: boolean;

  @ApiProperty()
  createdAt: Date;
}
