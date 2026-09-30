import { ApiProperty } from "@nestjs/swagger";

export class DeleteProductVariantResponseDto {
  @ApiProperty({ description: "Success status", example: true })
  success: boolean;

  @ApiProperty({
    description: "Success message",
    example: "Product variant deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "Deleted variant ID",
    example: "123j444-k43b-34k3-j353-2342532523",
  })
  id: string;
}
